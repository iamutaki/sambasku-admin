import {
  ClockCircleOutlined,
  RiseOutlined,
  TeamOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { Card, Col, Divider, Flex, Row, Statistic, Tag, Typography } from 'antd';
import {
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_STATUS_TAG_COLOR,
  ROLE_LABELS_SHORT,
  WORD_STATUS_LABELS,
  WORD_STATUS_TAG_COLOR,
  type DashboardStats,
} from '../../domain/dashboard-stats';

export interface StatCardsProps {
  stats: DashboardStats;
  onNavigateContributions?: () => void;
}

/**
 * Baris 4 kartu statistik agregat: Total Kata, Antrean Kontribusi,
 * Pengguna Aktif, dan Aktivitas Mutasi 7 hari.
 */
export function StatCards({ stats, onNavigateContributions }: StatCardsProps) {
  const { words, contributions, users, activity } = stats;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic
            title="Total Kata"
            value={words.total}
            prefix={<TranslationOutlined style={{ color: '#1677ff' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(words.byStatus).map(([status, count]) => (
              <Tag key={status} color={WORD_STATUS_TAG_COLOR[status as keyof DashboardStats['words']['byStatus']]}>
                {WORD_STATUS_LABELS[status as keyof DashboardStats['words']['byStatus']]}: {count}
              </Tag>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Terverifikasi {words.verified} · Terhapus {words.deleted}
          </Typography.Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card hoverable={Boolean(onNavigateContributions)} onClick={onNavigateContributions}>
          <Statistic
            title="Total Kontribusi"
            value={contributions.total}
            suffix={`· ${contributions.byStatus.pending} menunggu review`}
            prefix={<RiseOutlined style={{ color: '#fa8c16' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(contributions.byStatus).map(([status, count]) => (
              <Tag
                key={status}
                color={CONTRIBUTION_STATUS_TAG_COLOR[status as keyof DashboardStats['contributions']['byStatus']]}
              >
                {CONTRIBUTION_STATUS_LABELS[status as keyof DashboardStats['contributions']['byStatus']]}: {count}
              </Tag>
            ))}
          </Flex>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic
            title="Pengguna Aktif"
            value={users.active}
            prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Flex wrap gap={4}>
            {Object.entries(users.byRole).map(([roleKey, count]) => (
              <Tag key={roleKey}>
                {ROLE_LABELS_SHORT[roleKey as keyof DashboardStats['users']['byRole']]}: {count}
              </Tag>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Distribusi role pengguna aktif.
          </Typography.Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} xl={6}>
        <Card>
          <Statistic
            title="Aktivitas Mutasi (7 Hari)"
            value={activity.auditLogsLast7Days}
            prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Perubahan data terekam di audit log.
          </Typography.Text>
        </Card>
      </Col>
    </Row>
  );
}
