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
import { formatDate, useUserTimezone } from '@/lib/timezone';

export interface OrganizationListItem {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  driverCount: number;
  transactionCount: number;
  planName: string | null;
  planExpiresAt: string | null;
}

const COLUMN_COUNT = 8;

export function Organizations(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useUserTimezone();

  const { data: organizations, isLoading, page, totalPages, setPage, search, setSearch } =
    usePaginatedQuery<OrganizationListItem>('organizations', '/v1/organizations');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">{t('organizations.title')}</h1>
        <CreateButton
          label={t('organizations.createOrganization')}
          onClick={() => {
            void navigate('/organizations/new');
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <SearchInput
          value={search}
          onDebouncedChange={setSearch}
          placeholder={t('organizations.searchPlaceholder')}
        />
        <InfoTooltip content={t('organizations.searchHint')} />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('organizations.organizationName')}</TableHead>
              <TableHead>{t('organizations.organizationId')}</TableHead>
              <TableHead>{t('organizations.taxId')}</TableHead>
              <TableHead>{t('organizations.contactEmail')}</TableHead>
              <TableHead className="text-right">{t('organizations.users')}</TableHead>
              <TableHead className="text-right">{t('organizations.drivers')}</TableHead>
              <TableHead className="text-right">{t('organizations.transactions')}</TableHead>
              <TableHead>{t('organizations.currentPlan')}</TableHead>
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
            {organizations?.map((organization) => (
              <TableRow
                key={organization.id}
                className="cursor-pointer"
                data-testid={`organization-row-${organization.id}`}
                onClick={() => {
                  void navigate(`/organizations/${organization.id}`);
                }}
              >
                <TableCell className="font-medium text-primary" data-testid="row-click-target">
                  <span className="flex items-center gap-2">
                    {organization.name}
                    {!organization.isActive && (
                      <Badge variant="secondary">{t('common.inactive')}</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <CopyableId id={organization.id} variant="table" />
                </TableCell>
                <TableCell>{organization.taxId ?? '-'}</TableCell>
                <TableCell>{organization.contactEmail ?? '-'}</TableCell>
                <TableCell className="text-right">{organization.userCount}</TableCell>
                <TableCell className="text-right">{organization.driverCount}</TableCell>
                <TableCell className="text-right">{organization.transactionCount}</TableCell>
                <TableCell>
                  {organization.planName != null ? (
                    <span className="flex flex-col">
                      <span>{organization.planName}</span>
                      {organization.planExpiresAt != null && (
                        <span className="text-xs text-muted-foreground">
                          {t('organizations.planExpiresAt')}:{' '}
                          {formatDate(organization.planExpiresAt, timezone)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('organizations.noPlan')}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {organizations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-center text-muted-foreground">
                  {t('organizations.noOrganizationsFound')}
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
