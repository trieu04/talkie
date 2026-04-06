import { useCallback } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import { useTranslation } from 'react-i18next';

export interface LanguageOption {
  code: string | null;
  label: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: null, label: 'translation.noTranslation' },
  { code: 'en', label: 'translation.languages.en' },
  { code: 'vi', label: 'translation.languages.vi' },
  { code: 'ja', label: 'translation.languages.ja' },
  { code: 'ko', label: 'translation.languages.ko' },
  { code: 'zh', label: 'translation.languages.zh' },
  { code: 'fr', label: 'translation.languages.fr' },
  { code: 'es', label: 'translation.languages.es' },
];

interface LanguageSelectorProps {
  value: string | null;
  onChange: (languageCode: string | null) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export default function LanguageSelector({
  value,
  onChange,
  disabled = false,
  size = 'small',
}: LanguageSelectorProps) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const selectedValue = event.target.value;
      onChange(selectedValue === '' ? null : selectedValue);
    },
    [onChange],
  );

  return (
    <FormControl size={size} sx={{ minWidth: 180 }} disabled={disabled}>
      <InputLabel id="language-selector-label">
        <TranslateRoundedIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
        {t('translation.targetLanguage')}
      </InputLabel>
      <Select
        labelId="language-selector-label"
        id="language-selector"
        value={value ?? ''}
        label={t('translation.targetLanguage')}
        onChange={handleChange}
        inputProps={{ 'aria-label': t('translation.targetLanguage') }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <MenuItem key={option.code ?? 'none'} value={option.code ?? ''}>
            {t(option.label)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
