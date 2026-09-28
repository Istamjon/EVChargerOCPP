// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as organizationService from '../services/organization.service.js';
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

const organizationListItem = z
  .object({
    id: z.string(),
    name: z.string(),
    legalName: z.string().nullable(),
    taxId: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    address: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    userCount: z.number(),
    driverCount: z.number(),
    transactionCount: z.number(),
    planName: z.string().nullable(),
    planExpiresAt: z.coerce.date().nullable(),
  })
  .passthrough();

const organizationItem = z
  .object({
    id: z.string(),
    name: z.string(),
    legalName: z.string().nullable(),
    taxId: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    address: z.string().nullable(),
    isActive: z.boolean(),
    settings: z.record(z.unknown()),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .passthrough();

const planAssignmentItem = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    annualPlanId: z.string(),
    planName: z.string(),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    status: z.string(),
    limits: z.record(z.unknown()),
    createdAt: z.coerce.date(),
  })
  .passthrough();

const organizationPlanStatus = z
  .object({
    assignment: planAssignmentItem.nullable(),
    usage: z.record(z.unknown()),
    limits: z.record(z.unknown()),
    exceeded: z.array(z.string()),
    withinLimits: z.boolean(),
    isValid: z.boolean(),
    daysRemaining: z.number().nullable(),
  })
  .passthrough();

const organizationUserItem = z
  .object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.coerce.date(),
  })
  .passthrough();

const organizationTransactionItem = z
  .object({
    id: z.string(),
    transactionId: z.string(),
    status: z.string(),
    startedAt: z.coerce.date().nullable(),
    endedAt: z.coerce.date().nullable(),
    energyDeliveredWh: z.coerce.number().nullable(),
    finalCostCents: z.number().nullable(),
    currency: z.string().nullable(),
  })
  .passthrough();

const organizationParams = z.object({
  id: ID_PARAMS.organizationId.describe('Organization ID'),
});

const assignmentParams = z.object({
  id: ID_PARAMS.organizationId.describe('Organization ID'),
  assignmentId: ID_PARAMS.organizationAnnualPlanId.describe('Plan assignment ID'),
});

const organizationSettings = z
  .record(z.unknown())
  .describe('Free-form per-organization settings object');

const createOrganizationBody = z.object({
  name: z.string().min(1).max(255).describe('Organization display name'),
  legalName: z.string().max(255).optional().describe('Registered legal name'),
  taxId: z.string().max(50).optional().describe('Tax / VAT identification number'),
  contactEmail: z.string().email().max(255).optional().describe('Contact email address'),
  contactPhone: z
    .string()
    .max(50)
    .optional()
    .describe('Contact phone number in international format, e.g. +998 90 123 45 67'),
  address: z.string().max(500).optional().describe('Registered address'),
  isActive: z.boolean().optional().describe('Whether the organization is active'),
  settings: organizationSettings.optional(),
});

const updateOrganizationBody = z.object({
  name: z.string().min(1).max(255).optional(),
  legalName: z.string().max(255).nullable().optional(),
  taxId: z.string().max(50).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  settings: organizationSettings.optional(),
});

const assignPlanBody = z.object({
  annualPlanId: ID_PARAMS.annualPlanId.describe('Annual plan ID to assign'),
  startsAt: z.coerce.date().describe('Validity window start'),
  expiresAt: z.coerce.date().describe('Validity window end'),
});

const subResourceQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function organizationRoutes(app: FastifyInstance): void {
  app.get(
    '/organizations',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'List organizations',
        operationId: 'listOrganizations',
        security: [{ bearerAuth: [] }],
        querystring: zodSchema(paginationQuery),
        response: { 200: paginatedResponse(organizationListItem) },
      },
    },
    async (request) => {
      const params = request.query as z.infer<typeof paginationQuery>;
      await organizationService.refreshPlanStatuses();
      return organizationService.listOrganizations(params);
    },
  );

  app.get(
    '/organizations/:id',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'Get an organization by ID',
        operationId: 'getOrganization',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        response: { 200: itemResponse(organizationItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const organization = await organizationService.getOrganization(id);
      if (organization == null) {
        await reply
          .status(404)
          .send({ error: 'Organization not found', code: 'ORGANIZATION_NOT_FOUND' });
        return;
      }
      return organization;
    },
  );

  app.post(
    '/organizations',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Create an organization',
        operationId: 'createOrganization',
        security: [{ bearerAuth: [] }],
        body: zodSchema(createOrganizationBody),
        response: { 201: itemResponse(organizationItem) },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createOrganizationBody>;
      const organization = await organizationService.createOrganization(body);
      return reply.status(201).send(organization);
    },
  );

  app.patch(
    '/organizations/:id',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Update an organization',
        operationId: 'updateOrganization',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        body: zodSchema(updateOrganizationBody),
        response: { 200: itemResponse(organizationItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const body = request.body as z.infer<typeof updateOrganizationBody>;
      const organization = await organizationService.updateOrganization(id, body);
      if (organization == null) {
        await reply
          .status(404)
          .send({ error: 'Organization not found', code: 'ORGANIZATION_NOT_FOUND' });
        return;
      }
      return organization;
    },
  );

  app.delete(
    '/organizations/:id',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Delete an organization',
        operationId: 'deleteOrganization',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        response: { 204: zodSchema(z.null()), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const organization = await organizationService.deleteOrganization(id);
      if (organization == null) {
        await reply
          .status(404)
          .send({ error: 'Organization not found', code: 'ORGANIZATION_NOT_FOUND' });
        return;
      }
      await reply.status(204).send();
    },
  );

  app.get(
    '/organizations/:id/plan',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'Get the annual plan status of an organization',
        operationId: 'getOrganizationPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        response: { 200: itemResponse(organizationPlanStatus), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const organization = await organizationService.getOrganization(id);
      if (organization == null) {
        await reply
          .status(404)
          .send({ error: 'Organization not found', code: 'ORGANIZATION_NOT_FOUND' });
        return;
      }
      return organizationService.getOrganizationPlanStatus(id);
    },
  );

  app.get(
    '/organizations/:id/plan-history',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'List the annual plan assignment history of an organization',
        operationId: 'listOrganizationPlanHistory',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        response: { 200: arrayResponse(planAssignmentItem) },
      },
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      return organizationService.listOrganizationPlanHistory(id);
    },
  );

  app.post(
    '/organizations/:id/plan',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Assign an annual plan to an organization',
        operationId: 'assignOrganizationPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        body: zodSchema(assignPlanBody),
        response: { 201: itemResponse(planAssignmentItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const body = request.body as z.infer<typeof assignPlanBody>;
      const assignment = await organizationService.assignAnnualPlan(id, body);
      return reply.status(201).send(assignment);
    },
  );

  app.post(
    '/organizations/:id/plan/:assignmentId/cancel',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Cancel an assigned annual plan',
        operationId: 'cancelOrganizationPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(assignmentParams),
        response: { 200: itemResponse(planAssignmentItem), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id, assignmentId } = request.params as z.infer<typeof assignmentParams>;
      const assignment = await organizationService.cancelAnnualPlanAssignment(id, assignmentId);
      if (assignment == null) {
        await reply
          .status(404)
          .send({ error: 'Plan assignment not found', code: 'PLAN_ASSIGNMENT_NOT_FOUND' });
        return;
      }
      return assignment;
    },
  );

  app.delete(
    '/organizations/:id/plan/:assignmentId',
    {
      onRequest: [authorize('organizations:write')],
      schema: {
        tags: ['Organizations'],
        summary: 'Remove an assigned annual plan',
        operationId: 'deleteOrganizationPlan',
        security: [{ bearerAuth: [] }],
        params: zodSchema(assignmentParams),
        response: { 204: zodSchema(z.null()), 404: errorResponse },
      },
    },
    async (request, reply) => {
      const { id, assignmentId } = request.params as z.infer<typeof assignmentParams>;
      const assignment = await organizationService.deleteAnnualPlanAssignment(id, assignmentId);
      if (assignment == null) {
        await reply
          .status(404)
          .send({ error: 'Plan assignment not found', code: 'PLAN_ASSIGNMENT_NOT_FOUND' });
        return;
      }
      await reply.status(204).send();
    },
  );

  app.get(
    '/organizations/:id/users',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'List the users bound to an organization',
        operationId: 'listOrganizationUsers',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        response: { 200: arrayResponse(organizationUserItem) },
      },
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      return organizationService.listOrganizationUsers(id);
    },
  );

  app.get(
    '/organizations/:id/transactions',
    {
      onRequest: [authorize('organizations:read')],
      schema: {
        tags: ['Organizations'],
        summary: 'List the transactions bound to an organization',
        operationId: 'listOrganizationTransactions',
        security: [{ bearerAuth: [] }],
        params: zodSchema(organizationParams),
        querystring: zodSchema(subResourceQuery),
        response: { 200: paginatedResponse(organizationTransactionItem) },
      },
    },
    async (request) => {
      const { id } = request.params as z.infer<typeof organizationParams>;
      const { page, limit } = request.query as z.infer<typeof subResourceQuery>;
      return organizationService.listOrganizationTransactions(id, page, limit);
    },
  );
}
