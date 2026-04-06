import { Card, CardContent, Paper, Skeleton as MuiSkeleton, Stack, Box } from '@mui/material';

export function TranscriptSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Stack spacing={2}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Stack key={index} direction="row" spacing={2} alignItems="flex-start">
            <MuiSkeleton variant="text" width={52} height={20} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MuiSkeleton variant="text" width={`${90 - index * 5}%`} />
              <MuiSkeleton variant="text" width={`${70 - (index % 3) * 8}%`} />
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

export function MeetingCardSkeleton() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Box flex={1} minWidth={0}>
              <MuiSkeleton variant="text" width="60%" height={28} />
              <MuiSkeleton variant="text" width="42%" height={20} />
            </Box>
            <MuiSkeleton variant="rounded" width={64} height={24} />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <MuiSkeleton variant="rounded" width={88} height={24} />
            <MuiSkeleton variant="rounded" width={76} height={24} />
            <MuiSkeleton variant="rounded" width={64} height={24} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SummarySkeleton() {
  return (
    <Stack spacing={3}>
      <Box>
        <MuiSkeleton variant="text" width="28%" height={28} />
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Stack spacing={1.5}>
            <MuiSkeleton variant="text" width="100%" />
            <MuiSkeleton variant="text" width="92%" />
            <MuiSkeleton variant="text" width="78%" />
          </Stack>
        </Paper>
      </Box>

      <Box>
        <MuiSkeleton variant="text" width="20%" height={24} />
        <Stack spacing={1} sx={{ pl: 4 }}>
          <MuiSkeleton variant="text" width="85%" />
          <MuiSkeleton variant="text" width="68%" />
          <MuiSkeleton variant="text" width="74%" />
        </Stack>
      </Box>

      <Box>
        <MuiSkeleton variant="text" width="22%" height={24} />
        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <MuiSkeleton variant="text" width="88%" />
            <MuiSkeleton variant="text" width="60%" />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <MuiSkeleton variant="text" width="82%" />
            <MuiSkeleton variant="text" width="54%" />
          </Paper>
        </Stack>
      </Box>

      <Box>
        <MuiSkeleton variant="text" width="24%" height={24} />
        <Stack spacing={1.5}>
          <MuiSkeleton variant="rounded" height={56} />
          <MuiSkeleton variant="rounded" height={56} />
        </Stack>
      </Box>
    </Stack>
  );
}
