// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import type { TFunction } from 'i18next';

/**
 * Frontend mirror of the API field validation rules for the extended person and
 * vehicle fields (firstName, lastName, phone, VIN, plate). Keeping the rules
 * identical means a value accepted here is accepted by the API.
 */

/** Letters (any script), spaces, apostrophes, dots and hyphens. */
export const PERSON_NAME_REGEX = /^[\p{L}][\p{L}\s'’.-]*$/u;
export const PERSON_NAME_MAX_LENGTH = 100;

/** Optional leading `+`, 7-15 digits, spaces/dashes/parentheses allowed as separators. */
export const PHONE_REGEX = /^\+?[0-9](?:[0-9\s()-]{5,18})[0-9]$/;
export const PHONE_MAX_LENGTH = 20;

/** ISO 3779 VIN: exactly 17 characters, digits and letters excluding I, O and Q. */
export const VIN_REGEX = /^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/;
export const VIN_LENGTH = 17;

/** License plate: 1-20 alphanumeric characters, spaces and hyphens allowed. */
export const PLATE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]{0,19}$/;
export const PLATE_MAX_LENGTH = 20;

export function validatePersonName(value: string, t: TFunction): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return t('validation.required');
  if (trimmed.length > PERSON_NAME_MAX_LENGTH) {
    return t('validation.maxLength', { max: PERSON_NAME_MAX_LENGTH });
  }
  if (!PERSON_NAME_REGEX.test(trimmed)) return t('validation.personName');
  return null;
}

export function validateOptionalPersonName(value: string, t: TFunction): string | null {
  if (value.trim() === '') return null;
  return validatePersonName(value, t);
}

export function validatePhone(value: string, t: TFunction): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return t('validation.required');
  if (trimmed.length > PHONE_MAX_LENGTH) {
    return t('validation.maxLength', { max: PHONE_MAX_LENGTH });
  }
  if (!PHONE_REGEX.test(trimmed)) return t('validation.phone');
  return null;
}

export function validateOptionalPhone(value: string, t: TFunction): string | null {
  if (value.trim() === '') return null;
  return validatePhone(value, t);
}

export function validateVin(value: string, t: TFunction): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return t('validation.required');
  if (trimmed.length !== VIN_LENGTH) return t('validation.vin');
  if (!VIN_REGEX.test(trimmed)) return t('validation.vin');
  return null;
}

export function validateOptionalVin(value: string, t: TFunction): string | null {
  if (value.trim() === '') return null;
  return validateVin(value, t);
}

export function validatePlate(value: string, t: TFunction): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return t('validation.required');
  if (trimmed.length > PLATE_MAX_LENGTH) {
    return t('validation.maxLength', { max: PLATE_MAX_LENGTH });
  }
  if (!PLATE_REGEX.test(trimmed)) return t('validation.plate');
  return null;
}

export function validateOptionalPlate(value: string, t: TFunction): string | null {
  if (value.trim() === '') return null;
  return validatePlate(value, t);
}

/** Uppercase and strip separators so values match what the API stores. */
export function normalizeVin(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePlate(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
