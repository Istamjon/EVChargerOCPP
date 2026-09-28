// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CopyableId } from '@/components/copyable-id';
import { Pagination } from '@/components/ui/pagination';
import { formatDateTime } from '@/lib/timezone';
import { sessionStatusVariant } from '@/lib/status-variants';

export interface TransactionRecord {
  id: string;
  transactionId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  energyDeliveredWh: number | null;
  currentCostCents: number | null;
  finalCostCents: number | null;
  currency: string | null;
  createdAt: string;
  stationId: string;
  stationName: string | null;
  siteId: string | null;
  siteName: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  vin: string | null;
  plate: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

function formatCost(record: TransactionRecord): string {
  const cents =
    record.status === 'completed' ? record.finalCostCents : record.currentCostCents;
  if (cents == null) return '-';
  return `${(cents / 100).toFixed(2)} ${record.currency ?? ''}`.trim();
}

interface TransactionsTableProps {
  records: TransactionRecord[] | undefined;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  timezone: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export const TransactionsTable = memo(function TransactionsTable({
  records,
  page,
  totalPages,
  onPageChange,
  timezone,
  isLoading,
  emptyMessage,
}: TransactionsTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const colCount = 13;

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('transactions.transactionId')}</TableHead>
              <TableHead>{t('transactions.organization')}</TableHead>
              <TableHead>{t('transactions.userId')}</TableHead>
              <TableHead>{t('transactions.firstName')}</TableHead>
              <TableHead>{t('transactions.lastName')}</TableHead>
              <TableHead>{t('transactions.phone')}</TableHead>
              <TableHead>{t('transactions.vin')}</TableHead>
              <TableHead>{t('transactions.plate')}</TableHead>
              <TableHead>{t('transactions.station')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('transactions.started')}</TableHead>
              <TableHead className="text-right">{t('transactions.energy')}</TableHead>
              <TableHead className="text-right">{t('payments.cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading === true && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            )}
            {records?.map((record) => (
              <TableRow
                key={record.id}
                className="cursor-pointer"
                data-testid={`transaction-row-${record.id}`}
                onClick={() => {
                  void navigate(`/sessions/${record.id}`);
                }}
              >
                <TableCell>
                  <CopyableId id={record.transactionId} variant="table" />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {record.organizationId != null ? (
                    <Link
                      to={`/organizations/${record.organizationId}`}
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {record.organizationName ?? record.organizationId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{t('transactions.unassigned')}</span>
                  )}
                </TableCell>
                <TableCell>
                  {record.userId != null ? (
                    <CopyableId id={record.userId} variant="table" />
                  ) : (
                    '--'
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{record.firstName ?? '--'}</TableCell>
                <TableCell className="whitespace-nowrap">{record.lastName ?? '--'}</TableCell>
                <TableCell className="whitespace-nowrap">{record.phone ?? '--'}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {record.vin ?? '--'}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {record.plate ?? '--'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {record.siteName != null
                    ? `${record.siteName} / ${String(record.stationName ?? '')}`
                    : (record.stationName ?? '--')}
                </TableCell>
                <TableCell>
                  <Badge variant={sessionStatusVariant(record.status, false)}>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {record.startedAt != null ? formatDateTime(record.startedAt, timezone) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {record.energyDeliveredWh != null
                    ? t('sessions.energyKwh', {
                        value: (record.energyDeliveredWh / 1000).toFixed(2),
                      })
                    : '-'}
                </TableCell>
                <TableCell className="text-right">{formatCost(record)}</TableCell>
              </TableRow>
            ))}
            {records?.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  {emptyMessage ?? t('transactions.noRecordsFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
});
