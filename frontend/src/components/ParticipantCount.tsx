import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import { useTranslation } from 'react-i18next';

import { MetricChip } from './SurfacePrimitives';

interface ParticipantCountProps {
  count: number;
}

export default function ParticipantCount({ count }: ParticipantCountProps) {
  const { t } = useTranslation();

  return (
    <MetricChip
      icon={<GroupRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
      label={t('meeting.participants')}
      value={count}
    />
  );
}
