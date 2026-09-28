// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import type { ParseKeys } from 'i18next';

/**
 * The csms i18n setup types translation keys from `en.json`, so a dynamic
 * template key such as `t(`organizations.planStatus.${status}`)` is not
 * assignable. These helpers map the finite sets of backend values onto literal
 * keys instead.
 */

/** Map an annual plan assignment status onto its translation key. */
export function planStatusKey(status: string): ParseKeys {
  if (status === 'expired') return 'organizations.planStatus.expired';
  if (status === 'cancelled') return 'organizations.planStatus.cancelled';
  return 'organizations.planStatus.active';
}

/** Map a billing period onto its translation key. `monthly` is the only alternative. */
export function billingPeriodKey(period: string | null | undefined): ParseKeys {
  return period === 'monthly' ? 'annualPlans.monthly' : 'annualPlans.annual';
}
