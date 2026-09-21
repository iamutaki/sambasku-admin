import { Card, Skeleton, Tag, Typography } from 'antd';
import { formatDate } from '@/shared/utils/format-datetime';
import { useWordOfDay } from '../application/use-word-of-day';

/**
 * Kartu dashboard: kata yang sama dilihat semua user hari ini.
 * Soft-fail: loading = skeleton; null/error = tidak dirender.
 */
export function WordOfDayCard() {
  const { data, isPending, isError } = useWordOfDay();

  if (isError) return null;
  if (isPending) {
    return (
      <Card size="small" className="dashboard__wotd">
        <Skeleton active title={{ width: 160 }} paragraph={{ rows: 2 }} />
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card size="small" className="dashboard__wotd">
      <div className="dashboard__wotd-meta">
        <Typography.Text type="secondary">Kata Hari Ini</Typography.Text>
        <Typography.Text type="secondary">{formatDate(data.date)}</Typography.Text>
      </div>
      <Typography.Title level={4} className="dashboard__wotd-lemma">
        {data.lemma}
      </Typography.Title>
      {data.firstSense ? (
        <Typography.Paragraph ellipsis className="dashboard__wotd-sense">
          {data.firstSense}
        </Typography.Paragraph>
      ) : null}
      {data.isNewThisWeek ? <Tag color="green">Kata baru minggu ini</Tag> : null}
    </Card>
  );
}
