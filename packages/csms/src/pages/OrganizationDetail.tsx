// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CopyPlus } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { CopyableId } from '@/components/copyable-id';
import { SaveButton } from '@/components/save-button';
import { RemoveButton } from '@/components/remove-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { TableSkeleton } from '@/components/TableSkeleton';
import { useTab } from '@/hooks/use-tab';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate, formatDateTime, useUserTimezone } from '@/lib/timezone';
import { billingPeriodKey, planStatusKey } from '@/lib/plan-labels';
import { validateOptionalPhone } from '@/lib/field-validation';
import type { Organization } from '@/pages/OrganizationCreate';

interface PlanLimits {
  maxUsers?: number | null;
  maxTransactionsPerMonth?: number | null;
  maxEnergyKwhPerMonth?: number | null;
  priceCents?: number;
  currency?: string;
  billingPeriod?: string;
}

interface PlanAssignment {
  id: string;
  organizationId: string;
  annualPlanId: string;
  planName: string;
  planDescription?: string | null;
  startsAt: string;
  expiresAt: string;
  status: string;
  limits: PlanLimits;
  createdAt: string;
}

interface PlanUsage {
  users: number;
  drivers: number;
  transactionsThisMonth: number;
  energyKwhThisMonth: number;
}

interface PlanStatus {
  assignment: PlanAssignment | null;
  usage: PlanUsage;
  limits: PlanLimits;
  exceeded: string[];
  withinLimits: boolean;
  isValid: boolean;
  daysRemaining: number | null;
}

interface OrganizationUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OrganizationTransaction {
  id: string;
  transactionId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  energyDeliveredWh: number | null;
  finalCostCents: number | null;
  currency: string | null;
}

interface AnnualPlanOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** `YYYY-MM-DD` for an `<input type="date">` value, offset by whole days. */
function toDateInput(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function OrganizationDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const organizationId = id ?? '';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useUserTimezone();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useTab('details');

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organizations', organizationId],
    queryFn: () => api.get<Organization>(`/v1/organizations/${organizationId}`),
    enabled: organizationId !== '',
  });

  const { data: planStatus } = useQuery({
    queryKey: ['organizations', organizationId, 'plan'],
    queryFn: () => api.get<PlanStatus>(`/v1/organizations/${organizationId}/plan`),
    enabled: organizationId !== '',
  });

  const { data: planHistory } = useQuery({
    queryKey: ['organizations', organizationId, 'plan-history'],
    queryFn: () => api.get<PlanAssignment[]>(`/v1/organizations/${organizationId}/plan-history`),
    enabled: organizationId !== '',
  });

  const { data: plans } = useQuery({
    queryKey: ['annual-plans', 'options'],
    queryFn: () =>
      api.get<{ data: AnnualPlanOption[]; total: number }>('/v1/annual-plans?limit=100'),
    enabled: activeTab === 'plan',
  });

  const { data: orgUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'users'],
    queryFn: () => api.get<OrganizationUser[]>(`/v1/organizations/${organizationId}/users`),
    enabled: activeTab === 'users',
  });

  const { data: orgTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'transactions'],
    queryFn: () =>
      api.get<{ data: OrganizationTransaction[]; total: number }>(
        `/v1/organizations/${organizationId}/transactions?limit=25`,
      ),
    enabled: activeTab === 'transactions',
  });

  // ---- Details form -------------------------------------------------------
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    taxId: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    isActive: true,
  });
  const [settingsText, setSettingsText] = useState('{}');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (organization == null) return;
    setForm({
      name: organization.name,
      legalName: organization.legalName ?? '',
      taxId: organization.taxId ?? '',
      contactEmail: organization.contactEmail ?? '',
      contactPhone: organization.contactPhone ?? '',
      address: organization.address ?? '',
      isActive: organization.isActive,
    });
    setSettingsText(JSON.stringify(organization.settings ?? {}, null, 2));
  }, [organization]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<Organization>(`/v1/organizations/${organizationId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<void>(`/v1/organizations/${organizationId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void navigate('/organizations');
    },
  });

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (form.name.trim() === '') errors.name = t('validation.required');
    if (form.contactEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errors.contactEmail = t('validation.email');
    }
    const phoneError = validateOptionalPhone(form.contactPhone, t);
    if (phoneError != null) errors.contactPhone = phoneError;
    return errors;
  }, [form, t]);

  function handleSave(e: React.SyntheticEvent): void {
    e.preventDefault();
    setHasSubmitted(true);
    if (Object.keys(validationErrors).length > 0) return;

    let parsedSettings: unknown;
    try {
      parsedSettings = JSON.parse(settingsText);
      setSettingsError(null);
    } catch {
      setSettingsError(t('organizations.settingsInvalidJson'));
      return;
    }
    if (parsedSettings == null || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) {
      setSettingsError(t('organizations.settingsInvalidJson'));
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      legalName: form.legalName.trim() === '' ? null : form.legalName.trim(),
      taxId: form.taxId.trim() === '' ? null : form.taxId.trim(),
      contactEmail: form.contactEmail.trim() === '' ? null : form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim() === '' ? null : form.contactPhone.trim(),
      address: form.address.trim() === '' ? null : form.address.trim(),
      isActive: form.isActive,
      settings: parsedSettings,
    };
    saveMutation.mutate(body);
  }

  // ---- Plan assignment ----------------------------------------------------
  const [planForm, setPlanForm] = useState({
    annualPlanId: '',
    startsAt: toDateInput(0),
    expiresAt: toDateInput(365),
  });
  const [planError, setPlanError] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<PlanAssignment>(`/v1/organizations/${organizationId}/plan`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'plan'] });
      void queryClient.invalidateQueries({
        queryKey: ['organizations', organizationId, 'plan-history'],
      });
      setPlanError(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.post<PlanAssignment>(
        `/v1/organizations/${organizationId}/plan/${assignmentId}/cancel`,
        {},
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'plan'] });
      void queryClient.invalidateQueries({
        queryKey: ['organizations', organizationId, 'plan-history'],
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.delete<void>(`/v1/organizations/${organizationId}/plan/${assignmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'plan'] });
      void queryClient.invalidateQueries({
        queryKey: ['organizations', organizationId, 'plan-history'],
      });
    },
  });

  function handleAssignPlan(e: React.SyntheticEvent): void {
    e.preventDefault();
    if (planForm.annualPlanId === '') {
      setPlanError(t('organizations.selectPlan'));
      return;
    }
    if (planForm.expiresAt <= planForm.startsAt) {
      setPlanError(t('organizations.invalidPlanWindow'));
      return;
    }
    setPlanError(null);
    assignMutation.mutate({
      annualPlanId: planForm.annualPlanId,
      startsAt: new Date(`${planForm.startsAt}T00:00:00Z`).toISOString(),
      expiresAt: new Date(`${planForm.expiresAt}T23:59:59Z`).toISOString(),
    });
  }

  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) {
    return <p className="text-muted-foreground">{t('common.loading')}</p>;
  }

  if (organization == null) {
    return <p className="text-destructive">{t('organizations.organizationNotFound')}</p>;
  }

  const currentPlan = planStatus?.assignment ?? null;
  const limits = planStatus?.limits ?? {};
  const usage = planStatus?.usage;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <BackButton to="/organizations" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold">{organization.name}</h1>
              <Badge variant={organization.isActive ? 'success' : 'secondary'}>
                {organization.isActive ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            <CopyableId id={organization.id} />
          </div>
        </div>
        <RemoveButton
          label={t('common.delete')}
          onClick={() => {
            setShowDelete(true);
          }}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">{t('common.details')}</TabsTrigger>
          <TabsTrigger value="plan">{t('organizations.plan')}</TabsTrigger>
          <TabsTrigger value="users">{t('organizations.users')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('organizations.transactions')}</TabsTrigger>
        </TabsList>

        {/* ---------------------------- Details ---------------------------- */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSave} noValidate className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">{t('organizations.organizationName')}</Label>
                    <Input
                      id="org-name"
                      value={form.name}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, name: e.target.value }));
                      }}
                      className={hasSubmitted && validationErrors.name ? 'border-destructive' : ''}
                    />
                    {hasSubmitted && validationErrors.name && (
                      <p className="text-sm text-destructive">{validationErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-legal-name">{t('organizations.legalName')}</Label>
                    <Input
                      id="org-legal-name"
                      value={form.legalName}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, legalName: e.target.value }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-tax-id">{t('organizations.taxId')}</Label>
                    <Input
                      id="org-tax-id"
                      value={form.taxId}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, taxId: e.target.value }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-contact-email">{t('organizations.contactEmail')}</Label>
                    <Input
                      id="org-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, contactEmail: e.target.value }));
                      }}
                      className={
                        hasSubmitted && validationErrors.contactEmail ? 'border-destructive' : ''
                      }
                    />
                    {hasSubmitted && validationErrors.contactEmail && (
                      <p className="text-sm text-destructive">{validationErrors.contactEmail}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-contact-phone">{t('organizations.contactPhone')}</Label>
                    <Input
                      id="org-contact-phone"
                      value={form.contactPhone}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, contactPhone: e.target.value }));
                      }}
                      className={
                        hasSubmitted && validationErrors.contactPhone ? 'border-destructive' : ''
                      }
                    />
                    {hasSubmitted && validationErrors.contactPhone && (
                      <p className="text-sm text-destructive">{validationErrors.contactPhone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-address">{t('organizations.address')}</Label>
                    <Input
                      id="org-address"
                      value={form.address}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, address: e.target.value }));
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="org-is-active"
                    checked={form.isActive}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, isActive: e.target.checked }));
                    }}
                  />
                  <Label htmlFor="org-is-active">{t('common.active')}</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-settings">{t('organizations.settings')}</Label>
                  <InfoNote>{t('organizations.settingsHint')}</InfoNote>
                  <Textarea
                    id="org-settings"
                    rows={8}
                    className="font-mono text-xs"
                    value={settingsText}
                    onChange={(e) => {
                      setSettingsText(e.target.value);
                    }}
                  />
                  {settingsError != null && (
                    <p className="text-sm text-destructive">{settingsError}</p>
                  )}
                </div>

                {saveMutation.isError && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(saveMutation.error, t)}
                  </p>
                )}
                {saveMutation.isSuccess && (
                  <p className="text-sm text-success">{t('common.saved')}</p>
                )}

                <div className="flex justify-end">
                  <SaveButton isPending={saveMutation.isPending} />
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------ Plan ----------------------------- */}
        <TabsContent value="plan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('organizations.currentPlan')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPlan == null ? (
                <p className="text-muted-foreground">{t('organizations.noPlanAssigned')}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{currentPlan.planName}</span>
                    <Badge variant={planStatus?.isValid === true ? 'success' : 'destructive'}>
                      {planStatus?.isValid === true
                        ? t('organizations.validPlan')
                        : t(planStatusKey(currentPlan.status))}
                    </Badge>
                    {planStatus?.daysRemaining != null && planStatus.isValid && (
                      <span className="text-sm text-muted-foreground">
                        {t('organizations.daysRemaining', { days: planStatus.daysRemaining })}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">{t('organizations.startsAt')}</p>
                      <p>{formatDate(currentPlan.startsAt, timezone)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('organizations.expiresAt')}</p>
                      <p>{formatDate(currentPlan.expiresAt, timezone)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('organizations.billingPeriod')}</p>
                      <p>
                        {limits.billingPeriod != null
                          ? t(billingPeriodKey(limits.billingPeriod))
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {!planStatus?.withinLimits && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      {t('organizations.limitsExceeded')}:{' '}
                      {(planStatus?.exceeded ?? []).join(', ')}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('organizations.limit')}</TableHead>
                          <TableHead className="text-right">{t('organizations.usage')}</TableHead>
                          <TableHead className="text-right">{t('organizations.limitValue')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>{t('organizations.maxUsers')}</TableCell>
                          <TableCell className="text-right">{usage?.users ?? 0}</TableCell>
                          <TableCell className="text-right">
                            {limits.maxUsers == null
                              ? t('organizations.unlimited')
                              : limits.maxUsers}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t('organizations.maxTransactionsPerMonth')}</TableCell>
                          <TableCell className="text-right">
                            {usage?.transactionsThisMonth ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {limits.maxTransactionsPerMonth == null
                              ? t('organizations.unlimited')
                              : limits.maxTransactionsPerMonth}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t('organizations.maxEnergyKwhPerMonth')}</TableCell>
                          <TableCell className="text-right">
                            {(usage?.energyKwhThisMonth ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {limits.maxEnergyKwhPerMonth == null
                              ? t('organizations.unlimited')
                              : limits.maxEnergyKwhPerMonth.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('organizations.assignPlan')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignPlan} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="org-plan">{t('organizations.selectPlan')}</Label>
                    <Select
                      id="org-plan"
                      value={planForm.annualPlanId}
                      onChange={(e) => {
                        setPlanForm((prev) => ({ ...prev, annualPlanId: e.target.value }));
                      }}
                    >
                      <option value="">{t('common.select')}</option>
                      {(plans?.data ?? [])
                        .filter((plan) => plan.isActive)
                        .map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-plan-start">{t('organizations.startsAt')}</Label>
                    <Input
                      id="org-plan-start"
                      type="date"
                      value={planForm.startsAt}
                      onChange={(e) => {
                        setPlanForm((prev) => ({ ...prev, startsAt: e.target.value }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-plan-end">{t('organizations.expiresAt')}</Label>
                    <Input
                      id="org-plan-end"
                      type="date"
                      value={planForm.expiresAt}
                      onChange={(e) => {
                        setPlanForm((prev) => ({ ...prev, expiresAt: e.target.value }));
                      }}
                    />
                  </div>
                </div>

                {planError != null && <p className="text-sm text-destructive">{planError}</p>}
                {assignMutation.isError && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(assignMutation.error, t)}
                  </p>
                )}
                {assignMutation.isSuccess && (
                  <p className="text-sm text-success">{t('organizations.planAssigned')}</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" variant="success" className="gap-1.5" disabled={assignMutation.isPending}>
                    <CopyPlus className="h-4 w-4" />
                    {t('organizations.assignPlan')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('organizations.planHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('annualPlans.planName')}</TableHead>
                      <TableHead>{t('organizations.startsAt')}</TableHead>
                      <TableHead>{t('organizations.expiresAt')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(planHistory ?? []).map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.planName}</TableCell>
                        <TableCell>{formatDate(assignment.startsAt, timezone)}</TableCell>
                        <TableCell>{formatDate(assignment.expiresAt, timezone)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={assignment.status === 'active' ? 'success' : 'secondary'}
                          >
                            {t(planStatusKey(assignment.status))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {assignment.status === 'active' && (
                              <button
                                type="button"
                                className="text-sm text-primary hover:underline"
                                onClick={() => {
                                  cancelMutation.mutate(assignment.id);
                                }}
                              >
                                {t('organizations.cancelPlan')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-sm text-destructive hover:underline"
                              onClick={() => {
                                removeAssignmentMutation.mutate(assignment.id);
                              }}
                            >
                              {t('organizations.removePlan')}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(planHistory ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {t('organizations.noPlanHistory')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------ Users ---------------------------- */}
        <TabsContent value="users">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.email')}</TableHead>
                  <TableHead>{t('users.firstName')}</TableHead>
                  <TableHead>{t('users.lastName')}</TableHead>
                  <TableHead>{t('users.phone')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <TableSkeleton columns={6} rows={3} />
                    </TableCell>
                  </TableRow>
                )}
                {(orgUsers ?? []).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link to={`/users/${user.id}`} className="text-primary hover:underline">
                        {user.email}
                      </Link>
                    </TableCell>
                    <TableCell>{user.firstName ?? '-'}</TableCell>
                    <TableCell>{user.lastName ?? '-'}</TableCell>
                    <TableCell>{user.phone ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt, timezone)}</TableCell>
                  </TableRow>
                ))}
                {!usersLoading && (orgUsers ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t('organizations.noUsers')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* --------------------------- Transactions ------------------------ */}
        <TabsContent value="transactions">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('transactions.transactionId')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('transactions.started')}</TableHead>
                  <TableHead className="text-right">{t('transactions.energy')}</TableHead>
                  <TableHead className="text-right">{t('payments.cost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableSkeleton columns={5} rows={3} />
                    </TableCell>
                  </TableRow>
                )}
                {(orgTransactions?.data ?? []).map((transaction) => (
                  <TableRow
                    key={transaction.id}
                    className="cursor-pointer"
                    onClick={() => {
                      void navigate(`/sessions/${transaction.id}`);
                    }}
                  >
                    <TableCell>
                      <CopyableId id={transaction.transactionId} variant="table" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{transaction.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.startedAt != null
                        ? formatDateTime(transaction.startedAt, timezone)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.energyDeliveredWh != null
                        ? t('sessions.energyKwh', {
                            value: (transaction.energyDeliveredWh / 1000).toFixed(2),
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.finalCostCents != null
                        ? `${(transaction.finalCostCents / 100).toFixed(2)} ${transaction.currency ?? ''}`.trim()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {!transactionsLoading && (orgTransactions?.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('organizations.noTransactions')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t('organizations.deleteOrganization')}
        description={t('organizations.confirmDeleteOrganizationDescription')}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          deleteMutation.mutate();
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
