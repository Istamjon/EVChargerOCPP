// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { eq, and, ilike, desc, sql, inArray, gte, lte, or } from 'drizzle-orm';
import { db } from '@evtivity/database';
import {
  transactionEvents,
  chargingSessions,
  chargingStations,
  sites,
  drivers,
  organizations,
} from '@evtivity/database';
import type { PaginationParams, PaginatedResponse } from '../lib/pagination.js';

export async function listTransactionEvents(
  params: PaginationParams,
  siteIds?: string[] | null,
): Promise<PaginatedResponse<(typeof transactionEvents)['$inferSelect']>> {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(ilike(transactionEvents.triggerReason, `%${search}%`));
  }
  if (siteIds != null) {
    conditions.push(inArray(chargingStations.siteId, siteIds));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({ event: transactionEvents })
    .from(transactionEvents)
    .innerJoin(chargingSessions, eq(transactionEvents.sessionId, chargingSessions.id))
    .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id));

  const [data, countRows] = await Promise.all([
    baseQuery.where(where).orderBy(desc(transactionEvents.createdAt)).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactionEvents)
      .innerJoin(chargingSessions, eq(transactionEvents.sessionId, chargingSessions.id))
      .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id))
      .where(where),
  ]);

  return { data: data.map((r) => r.event), total: countRows[0]?.count ?? 0 };
}

export async function getTransactionEventsBySession(sessionId: string) {
  return db
    .select()
    .from(transactionEvents)
    .where(eq(transactionEvents.sessionId, sessionId))
    .orderBy(transactionEvents.seqNo);
}

export async function getSessionByTransactionId(transactionId: string) {
  const [session] = await db
    .select()
    .from(chargingSessions)
    .where(eq(chargingSessions.transactionId, transactionId));
  return session ?? null;
}

/**
 * Filters accepted by the Transactions module. Every field is validated by the
 * route layer before it reaches this service.
 */
export interface TransactionRecordFilters {
  transactionId?: string | undefined;
  sessionId?: string | undefined;
  organizationId?: string | undefined;
  userId?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  vin?: string | undefined;
  plate?: string | undefined;
  status?: string | undefined;
  siteId?: string | undefined;
  stationId?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  search?: string | undefined;
  siteIds?: string[] | null | undefined;
}

/** A transaction is bound to its own organization, or to the driver's organization. */
const effectiveOrganizationId = sql<
  string | null
>`coalesce("charging_sessions"."organization_id", "drivers"."organization_id")`;

const vehicleVin = sql<
  string | null
>`(select v.vin from vehicles v where v.driver_id = "charging_sessions"."driver_id" order by v.created_at desc limit 1)`;

const vehiclePlate = sql<
  string | null
>`(select v.license_plate from vehicles v where v.driver_id = "charging_sessions"."driver_id" order by v.created_at desc limit 1)`;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function buildRecordConditions(filters: TransactionRecordFilters) {
  const conditions = [];

  if (filters.siteIds != null) {
    conditions.push(inArray(chargingStations.siteId, filters.siteIds));
  }
  if (filters.transactionId != null && filters.transactionId !== '') {
    conditions.push(ilike(chargingSessions.transactionId, `%${filters.transactionId}%`));
  }
  if (filters.sessionId != null && filters.sessionId !== '') {
    conditions.push(eq(chargingSessions.id, filters.sessionId));
  }
  if (filters.organizationId != null && filters.organizationId !== '') {
    conditions.push(eq(effectiveOrganizationId, filters.organizationId));
  }
  if (filters.userId != null && filters.userId !== '') {
    conditions.push(eq(chargingSessions.driverId, filters.userId));
  }
  if (filters.firstName != null && filters.firstName !== '') {
    conditions.push(ilike(drivers.firstName, `%${filters.firstName}%`));
  }
  if (filters.lastName != null && filters.lastName !== '') {
    conditions.push(ilike(drivers.lastName, `%${filters.lastName}%`));
  }
  if (filters.phone != null && filters.phone !== '') {
    const digits = digitsOnly(filters.phone);
    conditions.push(
      sql`regexp_replace(coalesce(${drivers.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`,
    );
  }
  if (filters.vin != null && filters.vin !== '') {
    conditions.push(
      sql`exists (select 1 from vehicles v where v.driver_id = "charging_sessions"."driver_id" and v.vin ilike ${`%${filters.vin}%`})`,
    );
  }
  if (filters.plate != null && filters.plate !== '') {
    conditions.push(
      sql`exists (select 1 from vehicles v where v.driver_id = "charging_sessions"."driver_id" and v.license_plate ilike ${`%${filters.plate}%`})`,
    );
  }
  if (filters.status != null && filters.status !== '') {
    conditions.push(
      eq(chargingSessions.status, filters.status as 'active' | 'completed' | 'invalid' | 'faulted' | 'failed'),
    );
  }
  if (filters.siteId != null && filters.siteId !== '') {
    conditions.push(eq(chargingStations.siteId, filters.siteId));
  }
  if (filters.stationId != null && filters.stationId !== '') {
    conditions.push(eq(chargingSessions.stationId, filters.stationId));
  }
  if (filters.dateFrom != null) {
    conditions.push(gte(chargingSessions.createdAt, filters.dateFrom));
  }
  if (filters.dateTo != null) {
    conditions.push(lte(chargingSessions.createdAt, filters.dateTo));
  }
  if (filters.search != null && filters.search !== '') {
    const pattern = `%${filters.search}%`;
    const searchCondition = or(
      ilike(chargingSessions.transactionId, pattern),
      ilike(chargingSessions.id, pattern),
      ilike(chargingStations.stationId, pattern),
      ilike(drivers.firstName, pattern),
      ilike(drivers.lastName, pattern),
      ilike(drivers.phone, pattern),
      ilike(organizations.name, pattern),
      sql`exists (select 1 from vehicles v where v.driver_id = "charging_sessions"."driver_id" and (v.vin ilike ${pattern} or v.license_plate ilike ${pattern}))`,
    );
    if (searchCondition != null) conditions.push(searchCondition);
  }

  return conditions;
}

const recordSelection = {
  id: chargingSessions.id,
  transactionId: chargingSessions.transactionId,
  status: chargingSessions.status,
  startedAt: chargingSessions.startedAt,
  endedAt: chargingSessions.endedAt,
  energyDeliveredWh: chargingSessions.energyDeliveredWh,
  currentCostCents: chargingSessions.currentCostCents,
  finalCostCents: chargingSessions.finalCostCents,
  currency: chargingSessions.currency,
  freeVend: chargingSessions.freeVend,
  isRoaming: chargingSessions.isRoaming,
  createdAt: chargingSessions.createdAt,
  stationId: chargingSessions.stationId,
  stationName: chargingStations.stationId,
  siteId: chargingStations.siteId,
  siteName: sites.name,
  userId: chargingSessions.driverId,
  firstName: drivers.firstName,
  lastName: drivers.lastName,
  phone: drivers.phone,
  vin: vehicleVin.as('vin'),
  plate: vehiclePlate.as('plate'),
  organizationId: effectiveOrganizationId.as('organization_id'),
  organizationName: organizations.name,
};

/** Paginated transaction records for the Transactions module. */
export async function listTransactionRecords(
  filters: TransactionRecordFilters,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const conditions = buildRecordConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countRows] = await Promise.all([
    db
      .select(recordSelection)
      .from(chargingSessions)
      .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id))
      .leftJoin(sites, eq(chargingStations.siteId, sites.id))
      .leftJoin(drivers, eq(chargingSessions.driverId, drivers.id))
      .leftJoin(organizations, eq(organizations.id, effectiveOrganizationId))
      .where(where)
      .orderBy(desc(chargingSessions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(chargingSessions)
      .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id))
      .leftJoin(drivers, eq(chargingSessions.driverId, drivers.id))
      .leftJoin(organizations, eq(organizations.id, effectiveOrganizationId))
      .where(where),
  ]);

  return { data, total: countRows[0]?.count ?? 0 };
}

/** Maximum number of rows a single export may contain. */
export const TRANSACTION_EXPORT_LIMIT = 50_000;

/** All transaction records matching the filters, for export. */
export async function listTransactionRecordsForExport(
  filters: TransactionRecordFilters,
): Promise<Awaited<ReturnType<typeof listTransactionRecords>>['data']> {
  const conditions = buildRecordConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select(recordSelection)
    .from(chargingSessions)
    .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id))
    .leftJoin(sites, eq(chargingStations.siteId, sites.id))
    .leftJoin(drivers, eq(chargingSessions.driverId, drivers.id))
    .leftJoin(organizations, eq(organizations.id, effectiveOrganizationId))
    .where(where)
    .orderBy(desc(chargingSessions.createdAt))
    .limit(TRANSACTION_EXPORT_LIMIT);
}
