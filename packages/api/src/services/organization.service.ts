// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { eq, and, or, ilike, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '@evtivity/database';
import {
  organizations,
  annualPlans,
  organizationAnnualPlans,
  users,
  drivers,
  chargingSessions,
} from '@evtivity/database';
import { AppError } from '@evtivity/lib';
import type { PaginationParams } from '../lib/pagination.js';

/** Limits snapshot applied to an organization by its annual plan. */
export interface PlanLimits {
  maxUsers?: number | null;
  maxTransactionsPerMonth?: number | null;
  maxEnergyKwhPerMonth?: number | null;
  priceCents?: number;
  currency?: string;
  billingPeriod?: string;
}

export interface OrganizationSettings {
  [key: string]: unknown;
}

/** Build the limits snapshot stored on an assignment from the plan catalogue row. */
export function buildPlanLimits(plan: {
  maxUsers: number | null;
  maxTransactionsPerMonth: number | null;
  maxEnergyKwhPerMonth: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: string;
}): PlanLimits {
  return {
    maxUsers: plan.maxUsers,
    maxTransactionsPerMonth: plan.maxTransactionsPerMonth,
    maxEnergyKwhPerMonth:
      plan.maxEnergyKwhPerMonth != null ? Number(plan.maxEnergyKwhPerMonth) : null,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
  };
}

/**
 * Automatically expire assignments whose validity window has passed.
 * Called before every read so plan validity is always enforced without a cron job.
 */
export async function refreshPlanStatuses(): Promise<number> {
  const rows = await db
    .update(organizationAnnualPlans)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(organizationAnnualPlans.status, 'active'),
        lte(organizationAnnualPlans.expiresAt, new Date()),
      ),
    )
    .returning({ id: organizationAnnualPlans.id });
  return rows.length;
}

export async function listOrganizations(params: PaginationParams) {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  let where = undefined;
  if (search) {
    const pattern = `%${search}%`;
    where = or(
      ilike(organizations.id, pattern),
      ilike(organizations.name, pattern),
      ilike(organizations.legalName, pattern),
      ilike(organizations.taxId, pattern),
      ilike(organizations.contactEmail, pattern),
    );
  }

  const [data, countRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        legalName: organizations.legalName,
        taxId: organizations.taxId,
        contactEmail: organizations.contactEmail,
        contactPhone: organizations.contactPhone,
        address: organizations.address,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        userCount: sql<number>`(select count(*)::int from users u where u.organization_id = "organizations"."id")`,
        driverCount: sql<number>`(select count(*)::int from drivers d where d.organization_id = "organizations"."id")`,
        transactionCount: sql<number>`(select count(*)::int from charging_sessions cs where cs.organization_id = "organizations"."id")`,
        planName: sql<
          string | null
        >`(select ap.name from organization_annual_plans oap join annual_plans ap on ap.id = oap.annual_plan_id where oap.organization_id = "organizations"."id" and oap.status = 'active' order by oap.expires_at desc limit 1)`,
        planExpiresAt: sql<
          string | null
        >`(select oap.expires_at from organization_annual_plans oap where oap.organization_id = "organizations"."id" and oap.status = 'active' order by oap.expires_at desc limit 1)`,
      })
      .from(organizations)
      .where(where)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations)
      .where(where),
  ]);

  return { data, total: countRows[0]?.count ?? 0 };
}

export async function getOrganization(id: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  return org ?? null;
}

export async function createOrganization(data: {
  name: string;
  legalName?: string | undefined;
  taxId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  isActive?: boolean | undefined;
  settings?: OrganizationSettings | undefined;
}) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      legalName: data.legalName ?? null,
      taxId: data.taxId ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      address: data.address ?? null,
      isActive: data.isActive ?? true,
      settings: data.settings ?? {},
    })
    .returning();
  return org;
}

export async function updateOrganization(
  id: string,
  data: {
    name?: string | undefined;
    legalName?: string | null | undefined;
    taxId?: string | null | undefined;
    contactEmail?: string | null | undefined;
    contactPhone?: string | null | undefined;
    address?: string | null | undefined;
    isActive?: boolean | undefined;
    settings?: OrganizationSettings | undefined;
  },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) patch[key] = value;
  }
  const [org] = await db
    .update(organizations)
    .set(patch)
    .where(eq(organizations.id, id))
    .returning();
  return org ?? null;
}

export async function deleteOrganization(id: string) {
  const [org] = await db.delete(organizations).where(eq(organizations.id, id)).returning();
  return org ?? null;
}

/** Usage counters used to apply the organization's plan limits. */
export async function getOrganizationUsage(organizationId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [userRows, driverRows, sessionRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.organizationId, organizationId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(drivers)
      .where(eq(drivers.organizationId, organizationId)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        energyKwh: sql<number>`coalesce(sum(${chargingSessions.energyDeliveredWh}::numeric), 0) / 1000`,
      })
      .from(chargingSessions)
      .where(
        and(
          eq(chargingSessions.organizationId, organizationId),
          gte(chargingSessions.createdAt, monthStart),
        ),
      ),
  ]);

  return {
    users: userRows[0]?.count ?? 0,
    drivers: driverRows[0]?.count ?? 0,
    transactionsThisMonth: sessionRows[0]?.count ?? 0,
    energyKwhThisMonth: Number(sessionRows[0]?.energyKwh ?? 0),
  };
}

/** Current (most recent) plan assignment for an organization. */
export async function getCurrentPlanAssignment(organizationId: string) {
  const [row] = await db
    .select({
      id: organizationAnnualPlans.id,
      organizationId: organizationAnnualPlans.organizationId,
      annualPlanId: organizationAnnualPlans.annualPlanId,
      planName: annualPlans.name,
      planDescription: annualPlans.description,
      startsAt: organizationAnnualPlans.startsAt,
      expiresAt: organizationAnnualPlans.expiresAt,
      status: organizationAnnualPlans.status,
      limits: organizationAnnualPlans.limits,
      createdAt: organizationAnnualPlans.createdAt,
      updatedAt: organizationAnnualPlans.updatedAt,
    })
    .from(organizationAnnualPlans)
    .innerJoin(annualPlans, eq(organizationAnnualPlans.annualPlanId, annualPlans.id))
    .where(eq(organizationAnnualPlans.organizationId, organizationId))
    .orderBy(desc(organizationAnnualPlans.startsAt))
    .limit(1);
  return row ?? null;
}

/**
 * Combine the assigned plan, its limits and the live usage into a single
 * status object. `exceeded` lists every limit the organization is currently
 * over, which is how the platform applies the plan's restrictions.
 */
export async function getOrganizationPlanStatus(organizationId: string) {
  await refreshPlanStatuses();
  const assignment = await getCurrentPlanAssignment(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  if (assignment == null) {
    return {
      assignment: null,
      usage,
      limits: {} as PlanLimits,
      exceeded: [] as string[],
      withinLimits: true,
      isValid: false,
      daysRemaining: null as number | null,
    };
  }

  const limits = (assignment.limits ?? {}) as PlanLimits;
  const exceeded: string[] = [];

  if (limits.maxUsers != null && usage.users > limits.maxUsers) exceeded.push('maxUsers');
  if (
    limits.maxTransactionsPerMonth != null &&
    usage.transactionsThisMonth > limits.maxTransactionsPerMonth
  ) {
    exceeded.push('maxTransactionsPerMonth');
  }
  if (
    limits.maxEnergyKwhPerMonth != null &&
    usage.energyKwhThisMonth > limits.maxEnergyKwhPerMonth
  ) {
    exceeded.push('maxEnergyKwhPerMonth');
  }

  const now = Date.now();
  const expiresAt = new Date(assignment.expiresAt).getTime();
  const isValid = assignment.status === 'active' && expiresAt > now;

  return {
    assignment,
    usage,
    limits,
    exceeded,
    withinLimits: exceeded.length === 0,
    isValid,
    daysRemaining: isValid ? Math.ceil((expiresAt - now) / 86_400_000) : 0,
  };
}

/** Assign (or re-assign) an annual plan to an organization. */
export async function assignAnnualPlan(
  organizationId: string,
  input: { annualPlanId: string; startsAt: Date | string; expiresAt: Date | string },
) {
  const org = await getOrganization(organizationId);
  if (org == null) throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');

  const [plan] = await db.select().from(annualPlans).where(eq(annualPlans.id, input.annualPlanId));
  if (plan == null) throw new AppError('Annual plan not found', 404, 'ANNUAL_PLAN_NOT_FOUND');
  if (!plan.isActive) {
    throw new AppError('Annual plan is not active', 409, 'ANNUAL_PLAN_INACTIVE');
  }

  // Fastify validates request bodies against the JSON Schema produced from Zod,
  // so `z.coerce.date()` fields arrive as ISO strings rather than Date objects.
  const startsAt = new Date(input.startsAt);
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
    throw new AppError('Invalid plan validity dates', 400, 'INVALID_PLAN_WINDOW');
  }
  if (expiresAt.getTime() <= startsAt.getTime()) {
    throw new AppError(
      'Plan expiry date must be after the start date',
      400,
      'INVALID_PLAN_WINDOW',
    );
  }

  const limits = buildPlanLimits(plan);
  const status = expiresAt.getTime() <= Date.now() ? 'expired' : 'active';

  const [assignment] = await db
    .insert(organizationAnnualPlans)
    .values({
      organizationId,
      annualPlanId: plan.id,
      startsAt,
      expiresAt,
      status,
      limits,
    })
    .onConflictDoUpdate({
      target: [
        organizationAnnualPlans.organizationId,
        organizationAnnualPlans.startsAt,
        organizationAnnualPlans.expiresAt,
      ],
      set: {
        annualPlanId: plan.id,
        limits,
        status,
        updatedAt: new Date(),
      },
    })
    .returning();

  // The insert row alone has no plan name; the response schema requires it.
  return { ...assignment, planName: plan.name };
}

/** Cancel an assignment before its expiry date. */
export async function cancelAnnualPlanAssignment(organizationId: string, assignmentId: string) {
  const [updated] = await db
    .update(organizationAnnualPlans)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(organizationAnnualPlans.id, assignmentId),
        eq(organizationAnnualPlans.organizationId, organizationId),
      ),
    )
    .returning();
  if (updated == null) return null;

  // The update row alone has no plan name; the response schema requires it.
  const [plan] = await db
    .select({ name: annualPlans.name })
    .from(annualPlans)
    .where(eq(annualPlans.id, updated.annualPlanId));

  return { ...updated, planName: plan?.name ?? '' };
}

export async function deleteAnnualPlanAssignment(organizationId: string, assignmentId: string) {
  const [assignment] = await db
    .delete(organizationAnnualPlans)
    .where(
      and(
        eq(organizationAnnualPlans.id, assignmentId),
        eq(organizationAnnualPlans.organizationId, organizationId),
      ),
    )
    .returning();
  return assignment ?? null;
}

export async function listOrganizationPlanHistory(organizationId: string) {
  await refreshPlanStatuses();
  return db
    .select({
      id: organizationAnnualPlans.id,
      organizationId: organizationAnnualPlans.organizationId,
      annualPlanId: organizationAnnualPlans.annualPlanId,
      planName: annualPlans.name,
      startsAt: organizationAnnualPlans.startsAt,
      expiresAt: organizationAnnualPlans.expiresAt,
      status: organizationAnnualPlans.status,
      limits: organizationAnnualPlans.limits,
      createdAt: organizationAnnualPlans.createdAt,
    })
    .from(organizationAnnualPlans)
    .innerJoin(annualPlans, eq(organizationAnnualPlans.annualPlanId, annualPlans.id))
    .where(eq(organizationAnnualPlans.organizationId, organizationId))
    .orderBy(desc(organizationAnnualPlans.startsAt));
}

/**
 * Automatically apply the organization's user limit.
 * Throws when the assigned plan does not allow another user.
 */
export async function assertUserLimit(organizationId: string | null | undefined): Promise<void> {
  if (organizationId == null) return;
  const status = await getOrganizationPlanStatus(organizationId);
  const maxUsers = status.limits.maxUsers;
  if (maxUsers == null) return;
  if (status.usage.users >= maxUsers) {
    throw new AppError(
      'Organization user limit reached for the assigned annual plan',
      409,
      'ORGANIZATION_USER_LIMIT_REACHED',
    );
  }
}

export async function listOrganizationUsers(organizationId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(users.email);
}

export async function listOrganizationTransactions(
  organizationId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const [data, countRows] = await Promise.all([
    db
      .select({
        id: chargingSessions.id,
        transactionId: chargingSessions.transactionId,
        status: chargingSessions.status,
        startedAt: chargingSessions.startedAt,
        endedAt: chargingSessions.endedAt,
        energyDeliveredWh: chargingSessions.energyDeliveredWh,
        finalCostCents: chargingSessions.finalCostCents,
        currency: chargingSessions.currency,
      })
      .from(chargingSessions)
      .where(eq(chargingSessions.organizationId, organizationId))
      .orderBy(desc(chargingSessions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(chargingSessions)
      .where(eq(chargingSessions.organizationId, organizationId)),
  ]);
  return { data, total: countRows[0]?.count ?? 0 };
}
