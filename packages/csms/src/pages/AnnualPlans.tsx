// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateButton } from '@/components/create-button';
import { SearchInput } from '@/components/search-input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Pagination } from '@/components/ui/pagination';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { CopyableId } from '@/components/copyable-id';
import { TableSkeleton } from '@/components/TableSkeleton';
import { billingPeriodKey } from '@/lib/plan-labels';

export interface AnnualPlanListItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  maxUsers: number | null;
  maxTransactionsPerMonth: number | null;
  maxEnergyKwhPerMonth: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organizationCount?: number;
}

const COLUMN_COUNT = 8;

export function AnnualPlans(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: plans, isLoading, page, totalPages, setPage, search, setSearch } =
    usePaginatedQuery<AnnualPlanListItem>('annual-plans', '/v1/annual-plans');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">{t('annualPlans.title')}</h1>
        <CreateButton
          label={t('annualPlans.createAnnualPlan')}
          onClick={() => {
            void navigate('/annual-plans/new');
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <SearchInput
          value={search}
          onDebouncedChange={setSearch}
          placeholder={t('annualPlans.searchPlaceholder')}
        />
        <InfoTooltip content={t('annualPlans.searchHint')} />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('annualPlans.planName')}</TableHead>
              <TableHead>{t('annualPlans.planId')}</TableHead>
              <TableHead>{t('annualPlans.price')}</TableHead>
              <TableHead>{t('annualPlans.billingPeriod')}</TableHead>
              <TableHead className="text-right">{t('annualPlans.maxUsers')}</TableHead>
              <TableHead className="text-right">
                {t('annualPlans.maxTransactionsPerMonth')}
              </TableHead>
              <TableHead className="text-right">{t('annualPlans.maxEnergyKwhPerMonth')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <TableSkeleton columns={COLUMN_COUNT} rows={5} />
                </TableCell>
              </TableRow>
            )}
            {plans?.map((plan) => (
              <TableRow
                key={plan.id}
                className="cursor-pointer"
                data-testid={`annual-plan-row-${plan.id}`}
                onClick={() => {
                  void navigate(`/annual-plans/${plan.id}`);
                }}
              >
                <TableCell className="font-medium text-primary" data-testid="row-click-target">
                  {plan.name}
                </TableCell>
                <TableCell>
                  <CopyableId id={plan.id} variant="table" />
                </TableCell>
                <TableCell>
                  {(plan.priceCents / 100).toFixed(2)} {plan.currency}
                </TableCell>
                <TableCell>{t(billingPeriodKey(plan.billingPeriod))}</TableCell>
                <TableCell className="text-right">
                  {plan.maxUsers ?? t('annualPlans.unlimited')}
                </TableCell>
                <TableCell className="text-right">
                  {plan.maxTransactionsPerMonth ?? t('annualPlans.unlimited')}
                </TableCell>
                <TableCell className="text-right">
                  {plan.maxEnergyKwhPerMonth ?? t('annualPlans.unlimited')}
                </TableCell>
                <TableCell>
                  <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                    {plan.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {plans?.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-center text-muted-foreground">
                  {t('annualPlans.noPlansFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
