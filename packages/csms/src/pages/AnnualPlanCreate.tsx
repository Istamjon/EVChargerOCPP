// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BackButton } from '@/components/back-button';
import { CancelButton } from '@/components/cancel-button';
import { CreateButton } from '@/components/create-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { InfoNote } from '@/components/ui/info-note';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error-message';
import type { AnnualPlanListItem } from '@/pages/AnnualPlans';

interface FormState {
  name: string;
  description: string;
  price: string;
  currency: string;
  billingPeriod: 'annual' | 'monthly';
  maxUsers: string;
  maxTransactionsPerMonth: string;
  maxEnergyKwhPerMonth: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  price: '',
  currency: 'UZS',
  billingPeriod: 'annual',
  maxUsers: '',
  maxTransactionsPerMonth: '',
  maxEnergyKwhPerMonth: '',
  isActive: true,
};

/** Parse a limit input into a number, or `null` when left empty (= unlimited). */
function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function AnnualPlanCreate(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<AnnualPlanListItem>('/v1/annual-plans', body),
    onSuccess: (created) => {
      void navigate(`/annual-plans/${created.id}`);
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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

  function handleSubmit(e: React.SyntheticEvent): void {
    e.preventDefault();
    setHasSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      currency: form.currency.trim().toUpperCase(),
      billingPeriod: form.billingPeriod,
      isActive: form.isActive,
      maxUsers: parseLimit(form.maxUsers),
      maxTransactionsPerMonth: parseLimit(form.maxTransactionsPerMonth),
      maxEnergyKwhPerMonth: parseLimit(form.maxEnergyKwhPerMonth),
    };
    if (form.description.trim() !== '') body.description = form.description.trim();
    if (form.price.trim() !== '') {
      body.priceCents = Math.round(Number(form.price) * 100);
    }
    createMutation.mutate(body);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton to="/annual-plans" />
        <h1 className="text-2xl font-bold md:text-3xl">{t('annualPlans.createAnnualPlan')}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">{t('annualPlans.planName')}</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => {
                  update('name', e.target.value);
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
                  update('description', e.target.value);
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
                    update('price', e.target.value);
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
                    update('currency', e.target.value.toUpperCase());
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
                    update('billingPeriod', e.target.value === 'monthly' ? 'monthly' : 'annual');
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
                    update('maxUsers', e.target.value);
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
                    update('maxTransactionsPerMonth', e.target.value);
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
                    update('maxEnergyKwhPerMonth', e.target.value);
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
                  update('isActive', e.target.checked);
                }}
              />
              <Label htmlFor="plan-is-active">{t('common.active')}</Label>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-destructive">{getErrorMessage(createMutation.error, t)}</p>
            )}

            <div className="flex justify-end gap-2">
              <CancelButton
                onClick={() => {
                  void navigate('/annual-plans');
                }}
              />
              <CreateButton
                label={t('common.create')}
                type="submit"
                disabled={createMutation.isPending}
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
