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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error-message';
import { validateOptionalPhone } from '@/lib/field-validation';

export interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  legalName: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  legalName: '',
  taxId: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  isActive: true,
};

export function OrganizationCreate(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Organization>('/v1/organizations', body),
    onSuccess: (created) => {
      void navigate(`/organizations/${created.id}`);
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getValidationErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (form.name.trim() === '') errors.name = t('validation.required');
    if (form.contactEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errors.contactEmail = t('validation.email');
    }
    const phoneError = validateOptionalPhone(form.contactPhone, t);
    if (phoneError != null) errors.contactPhone = phoneError;
    return errors;
  }

  const errors = getValidationErrors();

  function handleSubmit(e: React.SyntheticEvent): void {
    e.preventDefault();
    setHasSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const body: Record<string, unknown> = { name: form.name.trim(), isActive: form.isActive };
    if (form.legalName.trim() !== '') body.legalName = form.legalName.trim();
    if (form.taxId.trim() !== '') body.taxId = form.taxId.trim();
    if (form.contactEmail.trim() !== '') body.contactEmail = form.contactEmail.trim();
    if (form.contactPhone.trim() !== '') body.contactPhone = form.contactPhone.trim();
    if (form.address.trim() !== '') body.address = form.address.trim();
    createMutation.mutate(body);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton to="/organizations" />
        <h1 className="text-2xl font-bold md:text-3xl">{t('organizations.createOrganization')}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{t('organizations.organizationName')}</Label>
              <Input
                id="org-name"
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
              <Label htmlFor="org-legal-name">{t('organizations.legalName')}</Label>
              <Input
                id="org-legal-name"
                value={form.legalName}
                onChange={(e) => {
                  update('legalName', e.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-tax-id">{t('organizations.taxId')}</Label>
              <Input
                id="org-tax-id"
                value={form.taxId}
                onChange={(e) => {
                  update('taxId', e.target.value);
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
                  update('contactEmail', e.target.value);
                }}
                className={hasSubmitted && errors.contactEmail ? 'border-destructive' : ''}
              />
              {hasSubmitted && errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">{t('organizations.contactPhone')}</Label>
              <Input
                id="org-contact-phone"
                value={form.contactPhone}
                placeholder="+998 90 123 45 67"
                onChange={(e) => {
                  update('contactPhone', e.target.value);
                }}
                className={hasSubmitted && errors.contactPhone ? 'border-destructive' : ''}
              />
              {hasSubmitted && errors.contactPhone && (
                <p className="text-sm text-destructive">{errors.contactPhone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-address">{t('organizations.address')}</Label>
              <Input
                id="org-address"
                value={form.address}
                onChange={(e) => {
                  update('address', e.target.value);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="org-is-active"
                checked={form.isActive}
                onChange={(e) => {
                  update('isActive', e.target.checked);
                }}
              />
              <Label htmlFor="org-is-active">{t('common.active')}</Label>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-destructive">{getErrorMessage(createMutation.error, t)}</p>
            )}

            <div className="flex justify-end gap-2">
              <CancelButton
                onClick={() => {
                  void navigate('/organizations');
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
