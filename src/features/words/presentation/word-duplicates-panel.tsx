import { useEffect, useState } from 'react';
import { EyeOutlined, MergeCellsOutlined } from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Flex,
  Popconfirm,
  Radio,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { normalizeError } from '@/shared/api/error';
import { WORD_STATUS_LABELS, WORD_TYPE_LABELS } from '../domain/word';
import { useDuplicateWordGroups, useMergeDuplicateWords } from '../application/use-duplicate-words';
import type { DuplicateWordGroupDto } from '../infrastructure/word-api';

function statusColor(status: string): string {
  if (status === 'published') return 'green';
  if (status === 'pending_review') return 'orange';
  if (status === 'rejected' || status === 'taken_down') return 'red';
  return 'default';
}

function GroupCard({
  group,
  canMerge,
}: {
  group: DuplicateWordGroupDto;
  canMerge: boolean;
}) {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const merge = useMergeDuplicateWords();
  const [keepId, setKeepId] = useState(group.default_keep_word_id);

  useEffect(() => {
    setKeepId(group.default_keep_word_id);
  }, [group.default_keep_word_id, group.lemma]);

  const keep = group.items.find((i) => i.id === keepId);
  const mergeIds = group.items.filter((i) => i.id !== keepId).map((i) => i.id);
  const keepNotPublished = keep && keep.status !== 'published';

  const onMerge = async () => {
    try {
      await merge.mutateAsync({
        keep_word_id: keepId,
        merge_word_ids: mergeIds,
      });
      message.success(`"${group.lemma}" digabung ke satu entri`);
    } catch (err) {
      message.error(normalizeError(err).message || 'Gagal menggabungkan');
    }
  };

  return (
    <Card
      size="small"
      title={
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>{group.lemma}</Typography.Text>
          <Tag>{group.language_code}</Tag>
          <Typography.Text type="secondary">{group.items.length} entri</Typography.Text>
        </Flex>
      }
      extra={
        canMerge ? (
          <Popconfirm
            title={`Gabungkan ke entri yang dipilih?`}
            description="Makna dan media dipindahkan. Entri lain dihapus dari kamus (soft-delete)."
            okText="Gabungkan"
            cancelText="Batal"
            onConfirm={onMerge}
          >
            <Button
              type="primary"
              icon={<MergeCellsOutlined />}
              loading={merge.isPending}
              disabled={mergeIds.length === 0}
            >
              Gabungkan
            </Button>
          </Popconfirm>
        ) : null
      }
    >
      {keepNotPublished ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Entri yang dipertahankan belum tayang. Lemma bisa hilang dari pencarian publik sampai ditayangkan."
        />
      ) : null}
      <Radio.Group
        value={keepId}
        onChange={(e) => setKeepId(e.target.value as string)}
        disabled={!canMerge}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {group.items.map((item) => (
            <Flex
              key={item.id}
              align="center"
              justify="space-between"
              gap={12}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: item.id === keepId ? 'rgba(22, 119, 255, 0.06)' : undefined,
                border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
              }}
            >
              <Radio value={item.id}>
                <Space wrap size={[4, 4]}>
                  <Tag color={statusColor(item.status)}>
                    {WORD_STATUS_LABELS[item.status] ?? item.status}
                  </Tag>
                  {item.is_verified ? <Tag color="blue">Terverifikasi</Tag> : null}
                  <Tag>{WORD_TYPE_LABELS[item.word_type]}</Tag>
                  <Typography.Text type="secondary">
                    {item.meanings_count} makna
                  </Typography.Text>
                  {item.suggested_keep ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      (disarankan)
                    </Typography.Text>
                  ) : null}
                </Space>
              </Radio>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => navigate({ to: '/words/$id', params: { id: item.id } })}
              >
                Detail
              </Button>
            </Flex>
          ))}
        </Space>
      </Radio.Group>
    </Card>
  );
}

export function WordDuplicatesPanel({ canMerge }: { canMerge: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useDuplicateWordGroups(true);

  if (isLoading) {
    return <Typography.Text type="secondary">Memuat kelompok duplikat…</Typography.Text>;
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Gagal memuat duplikat"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Button size="small" onClick={() => refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  const groups = data?.groups ?? [];
  if (groups.length === 0) {
    return (
      <Empty
        description="Tidak ada lemma duplikat aktif"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary">
          {data?.total_groups ?? groups.length} kelompok lemma duplikat
        </Typography.Text>
        <Button size="small" loading={isFetching} onClick={() => refetch()}>
          Muat ulang
        </Button>
      </Flex>
      {groups.map((g) => (
        <GroupCard key={`${g.language_id}:${g.lemma}`} group={g} canMerge={canMerge} />
      ))}
    </Flex>
  );
}
