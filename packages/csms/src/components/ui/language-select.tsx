// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import { Select } from '@/components/ui/select';

const LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Espanol' },
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Russian' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
] as const;

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}

export function LanguageSelect({
  value,
  onChange,
  className,
}: LanguageSelectProps): React.JSX.Element {
  return (
    <Select
      aria-label="Language"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className={className}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </Select>
  );
}

export { LANGUAGES };
