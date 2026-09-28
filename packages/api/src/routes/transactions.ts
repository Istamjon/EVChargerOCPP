// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, chargingSessions, chargingStations } from '@evtivity/database';
import {
  optionalPersonNameSchema,
  optionalPhoneSchema,
  optionalVinSchema,
  optionalPlateSchema,
  searchFilterSchema,
  normalizeVin,
  normalizePlate,
} from '@evtivity/lib';
import * as transactionService from '../services/transaction.service.js';
import { buildXlsx } from '../services/excel.service.js';
import { zodSchema } from '../lib/zod-schema.js';
import { ID_PARAMS } from '../lib/id-validation.js';
import { paginationQuery } from '../lib/pagination.js';
import {
  errorResponse,
  paginatedResponse,
  itemResponse,
  arrayResponse,
} from '../lib/response-schemas.js';
import { getUserSiteIds } from '../lib/site-access.js';
import { authorize } from '../middleware/rbac.js';

const transactionEventItem = z.object({}).passthrough();
const transactionSessionItem = z.object({}).passthrough();

const sessionParams = z.object({
  sessionId: ID_PARAMS.sessionId.describe('Charging session ID'),
});

const transactionIdParams = z.object({
  transactionId: z.string().describe('OCPP transaction ID'),
});

const transactionRecordItem = z
  .object({
    id: z.string(),
    transactionId: z.string(),
    status: z.string(),
    startedAt: z.coerce.date().nullable(),
    endedAt: z.coerce.date().nullable(),
    energyDeliveredWh: z.coerce.number().nullable(),
    currentCostCents: z.number().nullable(),
    finalCostCents: z.number().nullable(),
    currency: z.string().nullable(),
    freeVend: z.boolean(),
    isRoaming: z.boolean(),
    createdAt: z.coerce.date(),
    stationId: z.string(),
    stationName: z.string().nullable(),
    siteId: z.string().nullable(),
    siteName: z.string().nullable(),
    userId: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    vin: z.string().nullable(),
    plate: z.string().nullable(),
    organizationId: z.string().nullable(),
    organizationName: z.string().nullable(),
  })
  .passthrough();

/** ISO 8601 date or date-time, e.g. `2026-09-28` or `2026-09-28T14:30:00Z`. */
const isoDateFilter = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/,
    'must be an ISO 8601 date (YYYY-MM-DD) or date-time',
  );

/** Shared filter contract for listing and exporting transactions. */
const transactionRecordFilters = {
  search: searchFilterSchema
    .optional()
    .describe('Free-text search across transaction, user and vehicle fields'),
  transactionId: searchFilterSchema.optional().describe('Filter by OCPP transaction ID (partial)'),
  sessionId: ID_PARAMS.sessionId.optional().describe('Filter by exact session ID'),
  organizationId: ID_PARAMS.organizationId
    .optional()
    .describe('Filter by organization ID the transaction is bound to'),
  userId: ID_PARAMS.driverId.optional().describe('Filter by user (driver) ID'),
  firstName: optionalPersonNameSchema.describe('Filter by user first name (partial)'),
  lastName: optionalPersonNameSchema.describe('Filter by user last name (partial)'),
  phone: optionalPhoneSchema.describe('Filter by user phone number (digits are compared)'),
  vin: optionalVinSchema.describe('Filter by vehicle VIN (17 characters, partial match)'),
  plate: optionalPlateSchema.describe('Filter by vehicle license plate (partial match)'),
  status: z
    .enum(['active', 'completed', 'invalid', 'faulted', 'failed'])
    .optional()
    .describe('Filter by transaction status'),
  siteId: ID_PARAMS.siteId.optional().describe('Filter by site ID'),
  stationId: ID_PARAMS.stationId.optional().describe('Filter by charging station ID'),
  dateFrom: isoDateFilter.optional().describe('Only transactions created on or after this date'),
  dateTo: isoDateFilter.optional().describe('Only transactions created on or before this date'),
};

const transactionRecordQuery = paginationQuery.extend(transactionRecordFilters);

const transactionExportQuery = z.object(transactionRecordFilters);

/** Parse an ISO date filter into a Date, extending a bare date to the end of that day. */
function parseDateFilter(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (value == null || value === '') return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (endOfDay && !value.includes('T')) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

/** Check if user has site access to a session's station. Returns true if allowed. */
async function checkSessionSiteAccess(sessionId: string, userId: string): Promise<boolean> {
  const siteIds = await getUserSiteIds(userId);
  if (siteIds == null) return true;

  const [session] = await db
    .select({ siteId: chargingStations.siteId })
    .from(chargingSessions)
    .innerJoin(chargingStations, eq(chargingSessions.stationId, chargingStations.id))
    .where(eq(chargingSessions.id, sessionId));

  if (session == null) return true;
  if (session.siteId == null) return true;
  return siteIds.includes(session.siteId);
}

/** Build the filter object handed to the service from a validated query. */
function toServiceFilters(
  query: z.infer<typeof transactionRecordQuery>,
  siteIds: string[] | null,
): transactionService.TransactionRecordFilters {
  return {
    transactionId: query.transactionId,
    sessionId: query.sessionId,
    organizationId: query.organizationId,
    userId: query.userId,
    firstName: query.firstName,
    lastName: query.lastName,
    phone: query.phone,
    vin: query.vin != null ? normalizeVin(query.vin) : undefined,
    plate: query.plate != null ? normalizePlate(query.plate) : undefined,
    status: query.status,
    siteId: query.siteId,
    stationId: query.stationId,
    dateFrom: parseDateFilter(query.dateFrom, false),
    dateTo: parseDateFilter(query.dateTo, true),
    search: query.search,
    siteIds,
  };
}

/** Human-readable list of the filters that produced an export. */
function describeFilters(query: z.infer<typeof transactionExportQuery>): {
  label: string;
  value: string;
}[] {
  const entries: { label: string; value: string }[] = [
    { label: 'Transaction ID', value: query.transactionId ?? '' },
    { label: 'Session ID', value: query.sessionId ?? '' },
    { label: 'Organization ID', value: query.organizationId ?? '' },
    { label: 'User ID', value: query.userId ?? '' },
    { label: 'First name', value: query.firstName ?? '' },
    { label: 'Last name', value: query.lastName ?? '' },
    { label: 'Phone', value: query.phone ?? '' },
    { label: 'VIN', value: query.vin ?? '' },
    { label: 'Plate', value: query.plate ?? '' },
    { label: 'Status', value: query.status ?? '' },
    { label: 'Site ID', value: query.siteId ?? '' },
    { label: 'Station ID', value: query.stationId ?? '' },
    { label: 'Created from', value: query.dateFrom ?? '' },
    { label: 'Created to', value: query.dateTo ?? '' },
    { label: 'Search', value: query.search ?? '' },
  ];
  return entries.filter((entry) => entry.value !== '');
}

/** Column layout of the exported transaction report. */
function transactionExportColumns(): {
  header: string;
  width: number;
  value: (row: Record<string, unknown>) => string | number | null;
}[] {
  const text = (value: unknown): string | null =>
    value == null ? null : typeof value === 'string' ? value : String(value);
  const num = (value: unknown): number | null => {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return [
    { header: 'Transaction ID', width: 38, value: (r) => text(r['transactionId']) },
    { header: 'Session ID', width: 20, value: (r) => text(r['id']) },
    { header: 'Status', width: 12, value: (r) => text(r['status']) },
    { header: 'Organization ID', width: 20, value: (r) => text(r['organizationId']) },
    { header: 'Organization', width: 28, value: (r) => text(r['organizationName']) },
    { header: 'User ID', width: 20, value: (r) => text(r['userId']) },
    { header: 'First Name', width: 18, value: (r) => text(r['firstName']) },
    { header: 'Last Name', width: 18, value: (r) => text(r['lastName']) },
    { header: 'Phone', width: 18, value: (r) => text(r['phone']) },
    { header: 'VIN', width: 20, value: (r) => text(r['vin']) },
    { header: 'Plate', width: 14, value: (r) => text(r['plate']) },
    { header: 'Site', width: 24, value: (r) => text(r['siteName']) },
    { header: 'Station', width: 20, value: (r) => text(r['stationName']) },
    {
      header: 'Started At',
      width: 22,
      value: (r) =>
        r['startedAt'] != null ? new Date(r['startedAt'] as string).toISOString() : null,
    },
    {
      header: 'Ended At',
      width: 22,
      value: (r) => (r['endedAt'] != null ? new Date(r['endedAt'] as string).toISOString() : null),
    },
    {
      header: 'Energy (kWh)',
      width: 14,
      value: (r) => {
        const wh = num(r['energyDeliveredWh']);
        return wh == null ? null : Math.round((wh / 1000) * 1000) / 1000;
      },
    },
    {
      header: 'Cost',
      width: 12,
      value: (r) => {
        const cents = num(r['finalCostCents']) ?? num(r['currentCostCents']);
        return cents == null ? null : cents / 100;
      },
    },
    { header: 'Currency', width: 10, value: (r) => text(r['currency']) },
  ];
}

function sendXlsx(reply: FastifyReply, buffer: Buffer): FastifyReply {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', `attachment; filename="transactions-${stamp}.xlsx"`)
    .header('Content-Length', String(buffer.length))
    .send(buffer);
}

export function transactionRoutes(app: FastifyInstance): void {
  app.get(
    '/transactions',
    {
      onRequest: [authorize('sessions:read')],
      schema: {
        tags: ['Transactions'],
        summary: 'List transaction events',
        operationId: 'listTransactions',
        security: [{ bearerAuth: [] }],
        querystring: zodSchema(paginationQuery),
        response: { 200: paginatedResponse(transactionEventItem) },
      },
    },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const siteIds = await getUserSiteIds(userId);
      if (siteIds != null && siteIds.length === 0) return { data: [], total: 0 };

      const params = request.query as z.infer<typeof paginationQuery>;
      return transactionService.listTransactionEvents(params, siteIds);
    },
  );

  app.get(
    '/transactions/records',
    {
      onRequest: [authorize('transactions:read')],
      schema: {
        tags: ['Transactions'],
        summary: 'List transaction records with person and vehicle details',
        operationId: 'listTransactionRecords',
        security: [{ bearerAuth: [] }],
        querystring: zodSchema(transactionRecordQuery),
        response: { 200: paginatedResponse(transactionRecordItem) },
      },
    },
    async (request) => {
      const { userId } = request.user as { userId: string };
      const siteIds = await getUserSiteIds(userId);
      if (siteIds != null && siteIds.length === 0) return { data: [], total: 0 };

      const query = request.query as z.infer<typeof transactionRecordQuery>;
      return transactionService.listTransactionRecords(
        toServiceFilters(query, siteIds),
        query.page,
        query.limit,
      );
    },
  );

  app.get(
    '/transactions/records/export',
    {
      onRequest: [authorize('transactions:read')],
      schema: {
        tags: ['Transactions'],
        summary: 'Export transaction records to an Excel (.xlsx) workbook',
        operationId: 'exportTransactionRecords',
        security: [{ bearerAuth: [] }],
        querystring: zodSchema(transactionExportQuery),
        response: { 400: errorResponse },
      },
    },
    async (request, reply: FastifyReply) => {
      const { userId } = request.user as { userId: string };
      const siteIds = await getUserSiteIds(userId);
      const query = request.query as z.infer<typeof transactionExportQuery>;

      const filters = toServiceFilters(
        query as unknown as z.infer<typeof transactionRecordQuery>,
        siteIds,
      );

      const rows =
        siteIds != null && siteIds.length === 0
          ? []
          : await transactionService.listTransactionRecordsForExport(filters);

      const workbook = await buildXlsx({
        sheetName: 'Transactions',
        title: 'Transactions',
        parameters: [
          ...describeFilters(query),
          { label: 'Rows exported', value: String(rows.length) },
          { label: 'Generated at', value: new Date().toISOString() },
        ],
        columns: transactionExportColumns(),
        rows,
      });

      return sendXlsx(reply, workbook);
    },
  );

  app.get(
    '/transactions/by-session/:sessionId',
    {
      onRequest: [authorize('sessions:read')],
      schema: {
        tags: ['Transactions'],
        summary: 'Get transaction events for a session',
        operationId: 'getTransactionsBySession',
        security: [{ bearerAuth: [] }],
        params: zodSchema(sessionParams),
        response: { 200: arrayResponse(transactionEventItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as z.infer<typeof sessionParams>;
      const { userId } = request.user as { userId: string };

      if (!(await checkSessionSiteAccess(sessionId, userId))) {
        await reply.status(404).send({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
        return;
      }

      return transactionService.getTransactionEventsBySession(sessionId);
    },
  );

  app.get(
    '/transactions/by-transaction-id/:transactionId',
    {
      onRequest: [authorize('sessions:read')],
      schema: {
        tags: ['Transactions'],
        summary: 'Get session by OCPP transaction ID',
        operationId: 'getTransactionById',
        security: [{ bearerAuth: [] }],
        params: zodSchema(transactionIdParams),
        response: { 200: itemResponse(transactionSessionItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { transactionId } = request.params as z.infer<typeof transactionIdParams>;
      const session = await transactionService.getSessionByTransactionId(transactionId);
      if (session == null) {
        await reply
          .status(404)
          .send({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
        return;
      }

      const { userId } = request.user as { userId: string };
      const siteIds = await getUserSiteIds(userId);
      if (siteIds != null) {
        const [stationRow] = await db
          .select({ siteId: chargingStations.siteId })
          .from(chargingStations)
          .where(eq(chargingStations.id, session.stationId));
        if (stationRow?.siteId != null && !siteIds.includes(stationRow.siteId)) {
          await reply
            .status(404)
            .send({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
          return;
        }
      }

      return session;
    },
  );
}
