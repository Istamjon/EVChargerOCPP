// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/search-input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ResponsiveFilters } from '@/components/responsive-filters';
import { ExportButton } from '@/components/export-button';
import { TransactionsTable } from '@/components/TransactionsTable';
import type { TransactionRecord } from '@/components/TransactionsTable';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useUserTimezone } from '@/lib/timezone';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import {
  validateOptionalPersonName,
  validateOptionalPhone,
  validateOptionalVin,
  validateOptionalPlate,
  normalizeVin,
  normalizePlate,
} from '@/lib/field-validation';

interface Site {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

/** Fields validated on the client before a request is issued. */
interface ValidatedFilters {
  firstName: string;
  lastName: string;
  phone: string;
  vin: string;
  plate: string;
}

const EMPTY_VALIDATED: ValidatedFilters = {
  firstName: '',
  lastName: '',
  phone: '',
  vin: '',
  plate: '',
};

export function Transactions(): React.JSX.Element {
  const { t } = useTranslation();
  const timezone = useUserTimezone();

  const [transactionId, setTransactionId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [siteId, setSiteId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [validated, setValidated] = useState<ValidatedFilters>(EMPTY_VALIDATED);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const validationErrors = useMemo(() => {
    const errors: Partial<Record<keyof ValidatedFilters, string>> = {};
    const checks: [keyof ValidatedFilters, string | null][] = [
      ['firstName', validateOptionalPersonName(validated.firstName, t)],
      ['lastName', validateOptionalPersonName(validated.lastName, t)],
      ['phone', validateOptionalPhone(validated.phone, t)],
      ['vin', validateOptionalVin(validated.vin, t)],
      ['plate', validateOptionalPlate(validated.plate, t)],
    ];
    for (const [field, message] of checks) {
      if (message != null) errors[field] = message;
    }
    return errors;
  }, [validated, t]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ data: Site[]; total: number }>('/v1/sites?limit=100'),
  });

  const { data: organizations } = useQuery({
    queryKey: ['organizations', 'filter-options'],
    queryFn: () =>
      api.get<{ data: Organization[]; total: number }>('/v1/organizations?limit=100'),
  });

  /** Filters sent to the API: only validated values are included. */
  const activeFilters = useMemo(() => {
    const params: Record<string, string> = {};
    if (transactionId !== '') params.transactionId = transactionId;
    if (organizationId !== '') params.organizationId = organizationId;
    if (userId !== '') params.userId = userId;
    if (status !== '') params.status = status;
    if (siteId !== '') params.siteId = siteId;
    if (dateFrom !== '') params.dateFrom = dateFrom;
    if (dateTo !== '') params.dateTo = dateTo;
    if (validated.firstName !== '') params.firstName = validated.firstName.trim();
    if (validated.lastName !== '') params.lastName = validated.lastName.trim();
    if (validated.phone !== '') params.phone = validated.phone.trim();
    if (validated.vin !== '') params.vin = normalizeVin(validated.vin);
    if (validated.plate !== '') params.plate = normalizePlate(validated.plate);
    return params;
  }, [transactionId, organizationId, userId, status, siteId, dateFrom, dateTo, validated]);

  const extraParams = Object.keys(activeFilters).length > 0 ? activeFilters : undefined;

  const { data: records, isLoading, page, totalPages, setPage, search, setSearch } =
    usePaginatedQuery<TransactionRecord>('transactions', '/v1/transactions/records', extraParams);

  function handleExport(): void {
    setHasSubmitted(true);
    if (hasValidationErrors) return;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(activeFilters)) {
      params.set(key, value);
    }
    if (search !== '') params.set('search', search);

    setIsExporting(true);
    void fetch(`${API_BASE_URL}/v1/transactions/records/export?${params.toString()}`, {
      credentials: 'include',
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .finally(() => {
        setIsExporting(false);
      });
  }

  function updateValidated(field: keyof ValidatedFilters, value: string): void {
    setValidated((prev) => ({ ...prev, [field]: value }));
  }

  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">{t('transactions.title')}</h1>
        <ExportButton
          label={isExporting ? t('transactions.exporting') : t('transactions.exportExcel')}
          onClick={handleExport}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <SearchInput
          value={search}
          onDebouncedChange={setSearch}
          placeholder={t('transactions.searchPlaceholder')}
        />
        <InfoTooltip content={t('transactions.searchHint')} />
        <ResponsiveFilters
          activeCount={activeFilterCount}
          moreFilters={
            <>
              <div className="space-y-1">
                <Label htmlFor="tx-first-name">{t('transactions.firstName')}</Label>
                <Input
                  id="tx-first-name"
                  value={validated.firstName}
                  onChange={(e) => {
                    updateValidated('firstName', e.target.value);
                  }}
                  className={hasSubmitted && validationErrors.firstName ? 'border-destructive' : ''}
                />
                {hasSubmitted && validationErrors.firstName && (
                  <p className="text-sm text-destructive">{validationErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-last-name">{t('transactions.lastName')}</Label>
                <Input
                  id="tx-last-name"
                  value={validated.lastName}
                  onChange={(e) => {
                    updateValidated('lastName', e.target.value);
                  }}
                  className={hasSubmitted && validationErrors.lastName ? 'border-destructive' : ''}
                />
                {hasSubmitted && validationErrors.lastName && (
                  <p className="text-sm text-destructive">{validationErrors.lastName}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-phone">{t('transactions.phone')}</Label>
                <Input
                  id="tx-phone"
                  value={validated.phone}
                  onChange={(e) => {
                    updateValidated('phone', e.target.value);
                  }}
                  className={hasSubmitted && validationErrors.phone ? 'border-destructive' : ''}
                />
                {hasSubmitted && validationErrors.phone && (
                  <p className="text-sm text-destructive">{validationErrors.phone}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-vin">{t('transactions.vin')}</Label>
                <Input
                  id="tx-vin"
                  value={validated.vin}
                  onChange={(e) => {
                    updateValidated('vin', e.target.value);
                  }}
                  className={hasSubmitted && validationErrors.vin ? 'border-destructive' : ''}
                />
                {hasSubmitted && validationErrors.vin && (
                  <p className="text-sm text-destructive">{validationErrors.vin}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-plate">{t('transactions.plate')}</Label>
                <Input
                  id="tx-plate"
                  value={validated.plate}
                  onChange={(e) => {
                    updateValidated('plate', e.target.value);
                  }}
                  className={hasSubmitted && validationErrors.plate ? 'border-destructive' : ''}
                />
                {hasSubmitted && validationErrors.plate && (
                  <p className="text-sm text-destructive">{validationErrors.plate}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-user-id">{t('transactions.userId')}</Label>
                <Input
                  id="tx-user-id"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-date-from">{t('transactions.dateFrom')}</Label>
                <Input
                  id="tx-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-date-to">{t('transactions.dateTo')}</Label>
                <Input
                  id="tx-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                  }}
                />
              </div>
            </>
          }
        >
          <Input
            aria-label={t('transactions.transactionId')}
            placeholder={t('transactions.transactionIdPlaceholder')}
            value={transactionId}
            onChange={(e) => {
              setTransactionId(e.target.value);
            }}
            className="h-9 sm:w-56"
          />
          <Select
            aria-label={t('transactions.organization')}
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
            }}
            className="h-9 sm:w-48"
          >
            <option value="">{t('transactions.allOrganizations')}</option>
            {organizations?.data.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('transactions.site')}
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
            }}
            className="h-9 sm:w-44"
          >
            <option value="">{t('transactions.allSites')}</option>
            {sites?.data.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('common.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
            }}
            className="h-9 sm:w-40"
          >
            <option value="">{t('transactions.allStatuses')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="completed">{t('status.completed')}</option>
            <option value="faulted">{t('status.faulted')}</option>
            <option value="failed">{t('status.failed')}</option>
            <option value="invalid">{t('status.invalid')}</option>
          </Select>
        </ResponsiveFilters>
      </div>

      <TransactionsTable
        records={records}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        timezone={timezone}
        isLoading={isLoading}
      />
    </div>
  );
}
