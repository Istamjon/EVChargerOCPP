// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import {
  pgTable,
  pgEnum,
  text,
  serial,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createId } from '../lib/id.js';

/**
 * Organization status for an assigned annual plan.
 * - `active`    — within its validity window and not cancelled
 * - `expired`   — validity window has passed (set automatically)
 * - `cancelled` — terminated manually before the expiry date
 */
export const annualPlanStatusEnum = pgEnum('annual_plan_status', [
  'active',
  'expired',
  'cancelled',
]);

/** Organizations (legal entities) that own users, drivers and transactions. */
export const organizations = pgTable(
  'organizations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('organization')),
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    taxId: varchar('tax_id', { length: 50 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    address: varchar('address', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    /** Per-organization settings. Every organization may be configured separately. */
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_organizations_name').on(table.name),
    index('idx_organizations_is_active').on(table.isActive),
  ],
);

/** Annual plan catalogue: pricing plus the limits/restrictions it applies. */
export const annualPlans = pgTable(
  'annual_plans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('annualPlan')),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }),
    /** Price in minor currency units (tiyin/kopeck/cents). */
    priceCents: integer('price_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('UZS'),
    /** Billing period of the plan. Annual subscription model. */
    billingPeriod: varchar('billing_period', { length: 20 }).notNull().default('annual'),
    /** Limit: maximum number of users the organization may have. NULL = unlimited. */
    maxUsers: integer('max_users'),
    /** Limit: maximum number of transactions per calendar month. NULL = unlimited. */
    maxTransactionsPerMonth: integer('max_transactions_per_month'),
    /** Limit: maximum energy delivered per calendar month (kWh). NULL = unlimited. */
    maxEnergyKwhPerMonth: numeric('max_energy_kwh_per_month', { precision: 12, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_annual_plans_name').on(table.name)],
);

/**
 * Assignment of an annual plan to an organization, including its validity window.
 * `limits` snapshots the plan limits at assignment time so later catalogue edits
 * do not silently change an organization's applied restrictions.
 */
export const organizationAnnualPlans = pgTable(
  'organization_annual_plans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId('organizationAnnualPlan')),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    annualPlanId: text('annual_plan_id')
      .notNull()
      .references(() => annualPlans.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: annualPlanStatusEnum('status').notNull().default('active'),
    /** Snapshot of the limits applied to this organization. */
    limits: jsonb('limits').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_org_annual_plans_org').on(table.organizationId),
    index('idx_org_annual_plans_plan').on(table.annualPlanId),
    index('idx_org_annual_plans_status').on(table.status),
    uniqueIndex('idx_org_annual_plans_unique_window').on(
      table.organizationId,
      table.startsAt,
      table.expiresAt,
    ),
  ],
);
