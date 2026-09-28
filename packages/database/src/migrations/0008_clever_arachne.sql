CREATE TYPE "public"."annual_plan_status" AS ENUM('active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "annual_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"billing_period" varchar(20) DEFAULT 'annual' NOT NULL,
	"max_users" integer,
	"max_transactions_per_month" integer,
	"max_energy_kwh_per_month" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_annual_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"annual_plan_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "annual_plan_status" DEFAULT 'active' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"tax_id" varchar(50),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"address" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "organization_annual_plans" ADD CONSTRAINT "organization_annual_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_annual_plans" ADD CONSTRAINT "organization_annual_plans_annual_plan_id_annual_plans_id_fk" FOREIGN KEY ("annual_plan_id") REFERENCES "public"."annual_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_annual_plans_name" ON "annual_plans" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_org_annual_plans_org" ON "organization_annual_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_annual_plans_plan" ON "organization_annual_plans" USING btree ("annual_plan_id");--> statement-breakpoint
CREATE INDEX "idx_org_annual_plans_status" ON "organization_annual_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_annual_plans_unique_window" ON "organization_annual_plans" USING btree ("organization_id","starts_at","expires_at");--> statement-breakpoint
CREATE INDEX "idx_organizations_name" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_organizations_is_active" ON "organizations" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_drivers_organization_id" ON "drivers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_organization_id" ON "charging_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_organization_id" ON "users" USING btree ("organization_id");