import { useCallback, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';

import { meetingApi, type TranscriptSearchResult } from '@/services/meetingApi';

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

  sorted.forEach((hl, index) => {
    if (cursor < hl.start) {
      parts.push(text.slice(cursor, hl.start));
    }
    parts.push(
      <Box
        key={index}
        component="mark"
        sx={{
          bgcolor: 'warning.light',
          color: 'warning.contrastText',
          borderRadius: 0.5,
          px: 0.25,
        }}
      >
        {text.slice(hl.start, hl.end)}
      </Box>,
    );
    cursor = hl.end;
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

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      try {
        const response = roomCode
          ? await meetingApi.searchPublicTranscript(roomCode, searchQuery.trim())
          : meetingId
            ? await meetingApi.searchTranscript(meetingId, searchQuery.trim())
            : { results: [], total: 0, query: searchQuery.trim() };
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
      }, 400);
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
    [query, performSearch],
  );

  return (
    <Stack component="section" spacing={1} aria-label="Transcript search">
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
                <IconButton size="small" onClick={handleClear} aria-label="Clear search">
                  <ClearRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              ) : null}
            </InputAdornment>
          ),
        }}
      />

      {hasSearched && !isSearching && results.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }} role="status" aria-live="polite">
          {t('replay.searchNoResults')}
        </Typography>
      )}

      {results.length > 0 && (
        <Paper
          variant="outlined"
          role="region"
          aria-label="Transcript search results"
          aria-live="polite"
          aria-atomic="true"
          sx={{ maxHeight: 240, overflowY: 'auto' }}
        >
          <List dense disablePadding>
            {results.map((result) => (
              <ListItemButton
                key={result.segment_id}
                onClick={() => onResultClick(result.segment_id)}
                divider
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" component="span">
                      <HighlightedText text={result.text} highlights={result.highlights} />
                    </Typography>
                  }
                  secondary={formatTimestamp(result.start_time_ms)}
                />
              </ListItemButton>
            ))}
          </List>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ p: 1, display: 'block' }}
            role="status"
            aria-live="polite"
          >
            {t('replay.searchResultCount', { count: results.length })}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
