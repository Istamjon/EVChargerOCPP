// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as annualPlanService from '../services/annual-plan.service.js';
import { zodSchema } from '../lib/zod-schema.js';
import { ID_PARAMS } from '../lib/id-validation.js';
import { paginationQuery } from '../lib/pagination.js';
import { authorize } from '../middleware/rbac.js';
import {
  errorResponse,
  paginatedResponse,
  itemResponse,
  arrayResponse,
} from '../lib/response-schemas.js';

const annualPlanItem = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    priceCents: z.number(),
    currency: z.string(),
    billingPeriod: z.string(),
    maxUsers: z.number().nullable(),
    maxTransactionsPerMonth: z.number().nullable(),
    maxEnergyKwhPerMonth: z.coerce.number().nullable(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    organizationCount: z.number().optional(),
  })
  .passthrough();

const planAssignmentItem = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    status: z.string(),
    limits: z.record(z.unknown()),
    createdAt: z.coerce.date(),
  })
  .passthrough();

const annualPlanParams = z.object({
  id: ID_PARAMS.annualPlanId.describe('Annual plan ID'),
});

const limitValue = z
  .number()
  .int()
  .min(0)
  .nullable()
  .describe('Limit value. Null means unlimited.');

const annualPlanLimits = {
  maxUsers: limitValue.optional().describe('Maximum number of users. Null = unlimited.'),
  maxTransactionsPerMonth: limitValue
    .optional()
    .describe('Maximum transactions per calendar month. Null = unlimited.'),
  maxEnergyKwhPerMonth: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe('Maximum energy per calendar month in kWh. Null = unlimited.'),
};

const createAnnualPlanBody = z.object({
  name: z.string().min(1).max(255).describe('Plan name'),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).optional().describe('Price in minor currency units'),
  currency: z.string().length(3).optional().describe('ISO 4217 currency code, e.g. UZS'),
  billingPeriod: z
    .enum(['annual', 'monthly'])
    .optional()
    .describe('Subscription billing period'),
  ...annualPlanLimits,
  isActive: z.boolean().optional(),
});

const updateAnnualPlanBody = createAnnualPlanBody.partial();

export function annualPlanRoutes(app: FastifyInstance): void {
  app.get(
    '/annual-plans',
    {
      onRequest: [authorize('annualPlans:read')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'List annual plans',
        operationId: 'listAnnualPlans',
        security: [{ bearerAuth: [] }],
        querystring: zodSchema(paginationQuery),
        response: { 200: paginatedResponse(annualPlanItem) },
      },
    },
    async (request) => {
      const params = request.query as z.infer<typeof paginationQuery>;
      return annualPlanService.listAnnualPlans(params);
    },
  );

  app.get(
    '/annual-plans/:id',
    {
      onRequest: [authorize('annualPlans:read')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'Get an annual plan by ID',
        operationId: 'getAnnualPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(annualPlanParams),
        response: { 200: itemResponse(annualPlanItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof annualPlanParams>;
      const plan = await annualPlanService.getAnnualPlan(id);
      if (plan == null) {
        await reply.status(404).send({ error: 'Annual plan not found', code: 'ANNUAL_PLAN_NOT_FOUND' });
        return;
      }
      return plan;
    },
  );

  app.post(
    '/annual-plans',
    {
      onRequest: [authorize('annualPlans:write')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'Create an annual plan',
        operationId: 'createAnnualPlan',
        security: [{ bearerAuth: [] }],
        body: zodSchema(createAnnualPlanBody),
        response: { 201: itemResponse(annualPlanItem) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createAnnualPlanBody>;
      const plan = await annualPlanService.createAnnualPlan(body);
      return reply.status(201).send(plan);
    },
  );

  app.patch(
    '/annual-plans/:id',
    {
      onRequest: [authorize('annualPlans:write')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'Update an annual plan',
        operationId: 'updateAnnualPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(annualPlanParams),
        body: zodSchema(updateAnnualPlanBody),
        response: { 200: itemResponse(annualPlanItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof annualPlanParams>;
      const body = request.body as z.infer<typeof updateAnnualPlanBody>;
      const plan = await annualPlanService.updateAnnualPlan(id, body);
      if (plan == null) {
        await reply.status(404).send({ error: 'Annual plan not found', code: 'ANNUAL_PLAN_NOT_FOUND' });
        return;
      }
      return plan;
    },
  );

  app.delete(
    '/annual-plans/:id',
    {
      onRequest: [authorize('annualPlans:write')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'Delete an annual plan',
        operationId: 'deleteAnnualPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(annualPlanParams),
        response: { 204: zodSchema(z.null()), 404: errorResponse, 409: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof annualPlanParams>;
      const plan = await annualPlanService.deleteAnnualPlan(id);
      if (plan == null) {
        await reply.status(404).send({ error: 'Annual plan not found', code: 'ANNUAL_PLAN_NOT_FOUND' });
        return;
      }
      await reply.status(204).send();
    },
  );

  app.get(
    '/annual-plans/:id/assignments',
    {
      onRequest: [authorize('annualPlans:read')],
      schema: {
        tags: ['Annual Plans'],
        summary: 'List organizations the annual plan is assigned to',
        operationId: 'listAnnualPlanAssignments',
        security: [{ bearerAuth: [] }],
        params: zodSchema(annualPlanParams),
        response: { 200: arrayResponse(planAssignmentItem) },
      },
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof annualPlanParams>;
      return annualPlanService.listAnnualPlanAssignments(id);
    },
  );
}
