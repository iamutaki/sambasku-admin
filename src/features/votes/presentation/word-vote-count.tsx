import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import { Flex, Skeleton, Tag, Typography, theme } from 'antd';
import { toVoteCountMap } from '../application/use-vote-counts';
import { useVoteCounts } from '../application/use-vote-counts';

const { Text } = Typography;

/**
 * Ringkasan vote kata (READ-ONLY) - GET /api/v1/votes/counts untuk
 * target `word:<id>`. Tampilan: up ↑, down ↓, skor. Tanpa tombol vote -
 * admin mengawasi engagement, bukan memilih (keputusan produk admin).
 */
export function WordVoteCount({ wordId }: { wordId: string }) {
  const target = `word:${wordId}`;
  const baselineColor = theme.useToken().token.colorTextSecondary;

  const { data, isLoading, isError } = useVoteCounts([target]);

  if (isLoading) {
    return <Skeleton.Node active style={{ width: 180, height: 32 }} />;
  }

  if (isError || !data) {
    return (
      <Text type="secondary" style={{ color: baselineColor }}>
        Vote tidak tersedia
      </Text>
    );
  }

  const { upvotes, downvotes } = toVoteCountMap(data)[target] ?? { upvotes: 0, downvotes: 0 };

  return (
    <Flex gap={8} align="center">
      <Tag icon={<LikeOutlined />} color="green">
        {upvotes}
      </Tag>
      <Tag icon={<DislikeOutlined />} color="red">
        {downvotes}
      </Tag>
      <Text type="secondary">Skor {upvotes - downvotes}</Text>
    </Flex>
  );
}