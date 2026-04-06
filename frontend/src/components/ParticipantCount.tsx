import { Chip } from '@mui/material';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';

interface ParticipantCountProps {
  count: number;
  size?: 'small' | 'medium';
}

export default function ParticipantCount({ count, size = 'small' }: ParticipantCountProps) {
  return (
    <Chip
      size={size}
      icon={<GroupRoundedIcon />}
      label={count}
      variant="outlined"
      aria-label={`Participant count: ${count}`}
    />
  );
}
