import { useCallback, useId } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
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
  const selectorId = useId();
  const labelId = `${selectorId}-label`;

  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const selectedValue = event.target.value;
      onChange(selectedValue === '' ? null : selectedValue);
    },
    [onChange],
  );

  return (
    <FormControl size={size} sx={{ minWidth: 220 }} disabled={disabled}>
      <InputLabel id={labelId}>{t('translation.targetLanguage')}</InputLabel>
      <Select
        labelId={labelId}
        id={selectorId}
        value={value ?? ''}
        label={t('translation.targetLanguage')}
        onChange={handleChange}
        inputProps={{ 'aria-label': t('translation.targetLanguage') }}
        startAdornment={
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.tertiary', ml: 1, mr: 0.5 }}>
            <TranslateRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        }
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
