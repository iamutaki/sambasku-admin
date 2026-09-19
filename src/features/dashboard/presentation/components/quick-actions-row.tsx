import { AuditOutlined, InboxOutlined, TranslationOutlined } from '@ant-design/icons';
import { Card, Col, Flex, Row, Typography } from 'antd';

export type QuickActionTarget = '/words' | '/contributions' | '/audit-logs';

export interface QuickActionsRowProps {
  onNavigate: (to: QuickActionTarget) => void;
}

/**
 * Baris pintu cepat (3 kartu hoverable) menuju halaman konsol utama:
 * Kelola Kata, Antrean Review, dan Audit Log.
 */
export function QuickActionsRow({ onNavigate }: QuickActionsRowProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card hoverable onClick={() => onNavigate('/words')}>
          <Flex align="center" gap={12}>
            <TranslationOutlined style={{ fontSize: 28, color: '#1677ff' }} />
            <div>
              <Typography.Text strong>Kelola Kata</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                List, cari, dan kelola entri kosakata.
              </Typography.Paragraph>
            </div>
          </Flex>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card hoverable onClick={() => onNavigate('/contributions')}>
          <Flex align="center" gap={12}>
            <InboxOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
            <div>
              <Typography.Text strong>Antrean Review</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                Kontribusi yang menunggu verifikasi.
              </Typography.Paragraph>
            </div>
          </Flex>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card hoverable onClick={() => onNavigate('/audit-logs')}>
          <Flex align="center" gap={12}>
            <AuditOutlined style={{ fontSize: 28, color: '#722ed1' }} />
            <div>
              <Typography.Text strong>Audit Log</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                Jejak mutasi data (admin & root).
              </Typography.Paragraph>
            </div>
          </Flex>
        </Card>
      </Col>
    </Row>
  );
}
