// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/components/back-button';
import { CopyableId } from '@/components/copyable-id';
import { SaveButton } from '@/components/save-button';
import { RemoveButton } from '@/components/remove-button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InfoNote } from '@/components/ui/info-note';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getApiErrorCode } from '@/lib/api';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, useUserTimezone } from '@/lib/timezone';
import { planStatusKey } from '@/lib/plan-labels';
import type { AnnualPlanListItem } from '@/pages/AnnualPlans';

interface PlanAssignment {
  id: string;
  organizationId: string;
  organizationName: string;
  startsAt: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

/** Parse a limit input into a number, or `null` when left empty (= unlimited). */
function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function limitToInput(value: number | null): string {
  return value == null ? '' : String(value);
}

export function AnnualPlanDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const planId = id ?? '';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useUserTimezone();
  const queryClient = useQueryClient();

  const { data: plan, isLoading } = useQuery({
    queryKey: ['annual-plans', planId],
    queryFn: () => api.get<AnnualPlanListItem>(`/v1/annual-plans/${planId}`),
    enabled: planId !== '',
  });

  const { data: assignments } = useQuery({
    queryKey: ['annual-plans', planId, 'assignments'],
    queryFn: () => api.get<PlanAssignment[]>(`/v1/annual-plans/${planId}/assignments`),
    enabled: planId !== '',
  });

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'UZS',
    billingPeriod: 'annual',
    maxUsers: '',
    maxTransactionsPerMonth: '',
    maxEnergyKwhPerMonth: '',
    isActive: true,
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (plan == null) return;
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      price: (plan.priceCents / 100).toString(),
      currency: plan.currency,
      billingPeriod: plan.billingPeriod,
      maxUsers: limitToInput(plan.maxUsers),
      maxTransactionsPerMonth: limitToInput(plan.maxTransactionsPerMonth),
      maxEnergyKwhPerMonth: limitToInput(plan.maxEnergyKwhPerMonth),
      isActive: plan.isActive,
    });
  }, [plan]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<AnnualPlanListItem>(`/v1/annual-plans/${planId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['annual-plans'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<void>(`/v1/annual-plans/${planId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['annual-plans'] });
      void navigate('/annual-plans');
    },
  });

  function getValidationErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (form.name.trim() === '') errors.name = t('validation.required');
    if (form.currency.trim().length !== 3) errors.currency = t('annualPlans.currencyHint');
    const limits: [string, string][] = [
      ['maxUsers', form.maxUsers],
      ['maxTransactionsPerMonth', form.maxTransactionsPerMonth],
      ['maxEnergyKwhPerMonth', form.maxEnergyKwhPerMonth],
    ];
    for (const [field, value] of limits) {
      const trimmed = value.trim();
      if (trimmed !== '' && (Number.isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
        errors[field] = t('annualPlans.limitHint');
      }
    }
    return errors;
  }

  const errors = getValidationErrors();

  function handleSave(e: React.SyntheticEvent): void {
    e.preventDefault();
    setHasSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      currency: form.currency.trim().toUpperCase(),
      billingPeriod: form.billingPeriod,
      isActive: form.isActive,
      maxUsers: parseLimit(form.maxUsers),
      maxTransactionsPerMonth: parseLimit(form.maxTransactionsPerMonth),
      maxEnergyKwhPerMonth: parseLimit(form.maxEnergyKwhPerMonth),
    };
    if (form.price.trim() !== '') body.priceCents = Math.round(Number(form.price) * 100);
    saveMutation.mutate(body);
  }

  const deleteErrorCode = getApiErrorCode(deleteMutation.error);
  const deleteBlocked = deleteErrorCode === 'ANNUAL_PLAN_IN_USE';

  if (isLoading) {
    return <p className="text-muted-foreground">{t('common.loading')}</p>;
  }

  if (plan == null) {
    return <p className="text-destructive">{t('annualPlans.planNotFound')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <BackButton to="/annual-plans" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">{plan.name}</h1>
              <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                {plan.isActive ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <CopyableId id={plan.id} />
          </div>
        </div>
        <RemoveButton
          label={t('common.delete')}
          onClick={() => {
            setShowDelete(true);
          }}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">{t('annualPlans.planName')}</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                }}
                className={hasSubmitted && errors.name ? 'border-destructive' : ''}
              />
              {hasSubmitted && errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">{t('common.description')}</Label>
              <Textarea
                id="plan-description"
                rows={3}
                value={form.description}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, description: e.target.value }));
                }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plan-price">{t('annualPlans.price')}</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, price: e.target.value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-currency">{t('annualPlans.currency')}</Label>
                <Input
                  id="plan-currency"
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }));
                  }}
                  className={hasSubmitted && errors.currency ? 'border-destructive' : ''}
                />
                {hasSubmitted && errors.currency && (
                  <p className="text-sm text-destructive">{errors.currency}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-billing-period">{t('annualPlans.billingPeriod')}</Label>
                <Select
                  id="plan-billing-period"
                  value={form.billingPeriod}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, billingPeriod: e.target.value }));
                  }}
                >
                  <option value="annual">{t('annualPlans.annual')}</option>
                  <option value="monthly">{t('annualPlans.monthly')}</option>
                </Select>
              </div>
            </div>

            <InfoNote>{t('annualPlans.limitsHint')}</InfoNote>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plan-max-users">{t('annualPlans.maxUsers')}</Label>
                <Input
                  id="plan-max-users"
                  type="number"
                  min="0"
                  placeholder={t('annualPlans.unlimited')}
                  value={form.maxUsers}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, maxUsers: e.target.value }));
                  }}
                  className={hasSubmitted && errors.maxUsers ? 'border-destructive' : ''}
                />
                {hasSubmitted && errors.maxUsers && (
                  <p className="text-sm text-destructive">{errors.maxUsers}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-max-transactions">
                  {t('annualPlans.maxTransactionsPerMonth')}
                </Label>
                <Input
                  id="plan-max-transactions"
                  type="number"
                  min="0"
                  placeholder={t('annualPlans.unlimited')}
                  value={form.maxTransactionsPerMonth}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, maxTransactionsPerMonth: e.target.value }));
                  }}
                  className={
                    hasSubmitted && errors.maxTransactionsPerMonth ? 'border-destructive' : ''
                  }
                />
                {hasSubmitted && errors.maxTransactionsPerMonth && (
                  <p className="text-sm text-destructive">{errors.maxTransactionsPerMonth}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-max-energy">{t('annualPlans.maxEnergyKwhPerMonth')}</Label>
                <Input
                  id="plan-max-energy"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t('annualPlans.unlimited')}
                  value={form.maxEnergyKwhPerMonth}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, maxEnergyKwhPerMonth: e.target.value }));
                  }}
                  className={hasSubmitted && errors.maxEnergyKwhPerMonth ? 'border-destructive' : ''}
                />
                {hasSubmitted && errors.maxEnergyKwhPerMonth && (
                  <p className="text-sm text-destructive">{errors.maxEnergyKwhPerMonth}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="plan-is-active"
                checked={form.isActive}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }));
                }}
              />
              <Label htmlFor="plan-is-active">{t('common.active')}</Label>
            </div>

            {saveMutation.isError && (
              <p className="text-sm text-destructive">{getErrorMessage(saveMutation.error, t)}</p>
            )}
            {saveMutation.isSuccess && <p className="text-sm text-success">{t('common.saved')}</p>}

            <div className="flex justify-end">
              <SaveButton isPending={saveMutation.isPending} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('annualPlans.assignments')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('organizations.organizationName')}</TableHead>
                  <TableHead>{t('organizations.startsAt')}</TableHead>
                  <TableHead>{t('organizations.expiresAt')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(assignments ?? []).map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <Link
                        to={`/organizations/${assignment.organizationId}`}
                        className="text-primary hover:underline"
                      >
                        {assignment.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(assignment.startsAt, timezone)}</TableCell>
                    <TableCell>{formatDate(assignment.expiresAt, timezone)}</TableCell>
                    <TableCell>
                      <Badge variant={assignment.status === 'active' ? 'success' : 'secondary'}>
                        {t(planStatusKey(assignment.status))}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(assignments ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('annualPlans.noAssignments')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t('annualPlans.deletePlan')}
        description={
          deleteBlocked
            ? t('annualPlans.planInUse')
            : t('annualPlans.confirmDeletePlanDescription')
        }
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          deleteMutation.mutate();
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
