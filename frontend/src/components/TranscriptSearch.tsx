import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';

import { meetingApi, type TranscriptSearchResult } from '@/services/meetingApi';
import { SectionCard } from './SurfacePrimitives';

interface TranscriptSearchProps {
  meetingId?: string;
  roomCode?: string;
  onResultClick: (segmentId: string) => void;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function HighlightedText({
  text,
  highlights,
}: {
  text: string;
  highlights: Array<{ start: number; end: number }>;
}) {
  if (highlights.length === 0) {
    return <>{text}</>;
  }

  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((highlight, index) => {
    if (cursor < highlight.start) {
      parts.push(text.slice(cursor, highlight.start));
    }

    const highlightKey = `${highlight.start}-${highlight.end}-${index}`;

    parts.push(
      <Typography
        key={highlightKey}
        component="mark"
        sx={{
          bgcolor: 'talkie.transcriptHighlight',
          color: 'text.primary',
          borderRadius: 1,
          px: 0.5,
        }}
      >
        {text.slice(highlight.start, highlight.end)}
      </Typography>,
    );

    cursor = highlight.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

export default function TranscriptSearch({ meetingId, roomCode, onResultClick }: TranscriptSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TranscriptSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const normalizedQuery = searchQuery.trim();
      if (normalizedQuery.length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      try {
        const response = roomCode
          ? await meetingApi.searchPublicTranscript(roomCode, normalizedQuery)
          : meetingId
            ? await meetingApi.searchTranscript(meetingId, normalizedQuery)
            : { results: [], total: 0, query: normalizedQuery };
        setResults(response.results);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [meetingId, roomCode],
  );

  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void performSearch(value);
      }, 350);
    },
    [performSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        void performSearch(query);
      }
    },
    [performSearch, query],
  );

  return (
    <SectionCard title={t('replay.searchTitle')} description={t('replay.searchDescription')} tone="muted">
      <Stack spacing={1.5}>
        <TextField
          size="small"
          placeholder={t('replay.searchPlaceholder')}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          inputProps={{ 'aria-label': t('replay.searchPlaceholder') }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {isSearching ? (
                  <CircularProgress size={18} />
                ) : query ? (
                  <IconButton size="small" onClick={handleClear} aria-label={t('replay.clearSearch')}>
                    <ClearRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                ) : null}
              </InputAdornment>
            ),
          }}
        />

        {hasSearched && !isSearching && results.length === 0 ? (
          <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
            {t('replay.searchNoResults')}
          </Typography>
        ) : null}

        {results.length > 0 ? (
          <Stack spacing={1}>
            <List dense disablePadding sx={{ display: 'grid', gap: 1 }}>
              {results.map((result) => (
                <ListItemButton
                  key={result.segment_id}
                  onClick={() => onResultClick(result.segment_id)}
                  sx={{
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'talkie.borderSubtle',
                    alignItems: 'flex-start',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body2" component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.25 }}>
                        <HighlightedText text={result.text} highlights={result.highlights} />
                      </Typography>
                    }
                    secondary={formatTimestamp(result.start_time_ms)}
                  />
                </ListItemButton>
              ))}
            </List>
            <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
              {t('replay.searchResultCount', { count: results.length })}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
