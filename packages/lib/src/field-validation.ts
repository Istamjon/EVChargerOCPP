// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

/**
 * Field validation rules shared by the API layer for the extended person and
 * vehicle fields exposed by the Transactions module (firstName, lastName,
 * phone, VIN, plate).
 *
 * The same rules are mirrored in the frontend so a value that the UI accepts is
 * always accepted by the API, and a value the API rejects is rejected before the
 * request is sent.
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

export const PERSON_NAME_ERROR = 'must contain letters, spaces, hyphens, apostrophes or dots only';
export const PHONE_ERROR = 'must be a valid phone number (7-15 digits, optional leading +)';
export const VIN_ERROR = 'must be exactly 17 characters (letters A-Z excluding I, O, Q and digits)';
export const PLATE_ERROR = 'must be 1-20 alphanumeric characters (spaces and hyphens allowed)';

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'is required')
  .max(PERSON_NAME_MAX_LENGTH)
  .regex(PERSON_NAME_REGEX, PERSON_NAME_ERROR);

export const optionalPersonNameSchema = personNameSchema.optional();

export const nullablePersonNameSchema = personNameSchema.nullable();

export const phoneSchema = z.string().trim().max(PHONE_MAX_LENGTH).regex(PHONE_REGEX, PHONE_ERROR);

export const optionalPhoneSchema = phoneSchema.optional();

export const nullablePhoneSchema = phoneSchema.nullable();

export const vinSchema = z.string().trim().length(VIN_LENGTH).regex(VIN_REGEX, VIN_ERROR);

export const optionalVinSchema = vinSchema.optional();

export const plateSchema = z.string().trim().max(PLATE_MAX_LENGTH).regex(PLATE_REGEX, PLATE_ERROR);

export const optionalPlateSchema = plateSchema.optional();

/** Uppercase and strip separators so stored values are comparable. */
export function normalizeVin(value: string): string {
  return value.trim().toUpperCase();
}

/** Uppercase, collapse inner whitespace and trim. */
export function normalizePlate(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Keep a leading `+` and the digits only. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Free-text search filters: bounded length, no control characters. */
export const searchFilterSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[^\u0000-\u001f\u007f]*$/, 'must not contain control characters');
