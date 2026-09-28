// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { eq, or, ilike, sql, desc, and } from 'drizzle-orm';
import { db } from '@evtivity/database';
import { annualPlans, organizationAnnualPlans, organizations } from '@evtivity/database';
import { AppError } from '@evtivity/lib';
import type { PaginationParams } from '../lib/pagination.js';

export interface AnnualPlanInput {
  name: string;
  description?: string | null | undefined;
  priceCents?: number | undefined;
  currency?: string | undefined;
  billingPeriod?: string | undefined;
  maxUsers?: number | null | undefined;
  maxTransactionsPerMonth?: number | null | undefined;
  maxEnergyKwhPerMonth?: number | null | undefined;
  isActive?: boolean | undefined;
}

/**
 * Patch payload for `updateAnnualPlan`. Every key may be omitted or explicitly
 * `undefined`, which is what the route layer produces from a Zod `.partial()`.
 */
export type AnnualPlanPatch = {
  [K in keyof AnnualPlanInput]?: AnnualPlanInput[K] | undefined;
};

export async function listAnnualPlans(params: PaginationParams) {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  let where = undefined;
  if (search) {
    const pattern = `%${search}%`;
    where = or(
      ilike(annualPlans.id, pattern),
      ilike(annualPlans.name, pattern),
      ilike(annualPlans.description, pattern),
    );
  }

  const [data, countRows] = await Promise.all([
    db
      .select({
        id: annualPlans.id,
        name: annualPlans.name,
        description: annualPlans.description,
        priceCents: annualPlans.priceCents,
        currency: annualPlans.currency,
        billingPeriod: annualPlans.billingPeriod,
        maxUsers: annualPlans.maxUsers,
        maxTransactionsPerMonth: annualPlans.maxTransactionsPerMonth,
        maxEnergyKwhPerMonth: annualPlans.maxEnergyKwhPerMonth,
        isActive: annualPlans.isActive,
        createdAt: annualPlans.createdAt,
        updatedAt: annualPlans.updatedAt,
        organizationCount: sql<number>`(select count(*)::int from organization_annual_plans oap where oap.annual_plan_id = "annual_plans"."id" and oap.status = 'active')`,
      })
      .from(annualPlans)
      .where(where)
      .orderBy(desc(annualPlans.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(annualPlans)
      .where(where),
  ]);

  return { data, total: countRows[0]?.count ?? 0 };
}

export async function getAnnualPlan(id: string) {
  const [plan] = await db.select().from(annualPlans).where(eq(annualPlans.id, id));
  return plan ?? null;
}

export async function createAnnualPlan(data: AnnualPlanInput) {
  const [plan] = await db
    .insert(annualPlans)
    .values({
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents ?? 0,
      currency: data.currency ?? 'UZS',
      billingPeriod: data.billingPeriod ?? 'annual',
      maxUsers: data.maxUsers ?? null,
      maxTransactionsPerMonth: data.maxTransactionsPerMonth ?? null,
      maxEnergyKwhPerMonth:
        data.maxEnergyKwhPerMonth != null ? String(data.maxEnergyKwhPerMonth) : null,
      isActive: data.isActive ?? true,
    })
    .returning();
  return plan;
}

export async function updateAnnualPlan(id: string, data: AnnualPlanPatch) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) patch['name'] = data.name;
  if (data.description !== undefined) patch['description'] = data.description;
  if (data.priceCents !== undefined) patch['priceCents'] = data.priceCents;
  if (data.currency !== undefined) patch['currency'] = data.currency;
  if (data.billingPeriod !== undefined) patch['billingPeriod'] = data.billingPeriod;
  if (data.maxUsers !== undefined) patch['maxUsers'] = data.maxUsers;
  if (data.maxTransactionsPerMonth !== undefined) {
    patch['maxTransactionsPerMonth'] = data.maxTransactionsPerMonth;
  }
  if (data.maxEnergyKwhPerMonth !== undefined) {
    patch['maxEnergyKwhPerMonth'] =
      data.maxEnergyKwhPerMonth != null ? String(data.maxEnergyKwhPerMonth) : null;
  }
  if (data.isActive !== undefined) patch['isActive'] = data.isActive;

  const [plan] = await db.update(annualPlans).set(patch).where(eq(annualPlans.id, id)).returning();
  return plan ?? null;
}

export async function deleteAnnualPlan(id: string) {
  const [assigned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationAnnualPlans)
    .where(eq(organizationAnnualPlans.annualPlanId, id));
  if ((assigned?.count ?? 0) > 0) {
    throw new AppError(
      'Annual plan is assigned to one or more organizations',
      409,
      'ANNUAL_PLAN_IN_USE',
    );
  }
  const [plan] = await db.delete(annualPlans).where(eq(annualPlans.id, id)).returning();
  return plan ?? null;
}

export async function listAnnualPlanAssignments(planId: string) {
  return db
    .select({
      id: organizationAnnualPlans.id,
      organizationId: organizationAnnualPlans.organizationId,
      organizationName: organizations.name,
      startsAt: organizationAnnualPlans.startsAt,
      expiresAt: organizationAnnualPlans.expiresAt,
      status: organizationAnnualPlans.status,
      limits: organizationAnnualPlans.limits,
      createdAt: organizationAnnualPlans.createdAt,
    })
    .from(organizationAnnualPlans)
    .innerJoin(organizations, eq(organizationAnnualPlans.organizationId, organizations.id))
    .where(
      and(
        eq(organizationAnnualPlans.annualPlanId, planId),
        eq(organizationAnnualPlans.status, 'active'),
      ),
    )
    .orderBy(desc(organizationAnnualPlans.startsAt));
}
