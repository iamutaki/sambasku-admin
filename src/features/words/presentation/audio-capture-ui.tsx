import type { ReactNode } from 'react';
import {
  AudioOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Col, Flex, Input, Progress, Row, Select, Space, Tag, Typography, Upload, theme } from 'antd';
import type { UploadProps } from 'antd';
import { formatRecordingClock, MAX_RECORDING_SECONDS } from '../application/use-audio-recorder';

const { Text, Title } = Typography;

export interface AudioMetaFieldsProps {
  speakerName: string;
  onSpeakerNameChange: (value: string) => void;
  dialectId?: string;
  onDialectIdChange: (value: string | undefined) => void;
  dialectOptions: { value: string; label: string }[];
  disabled?: boolean;
}

/** Nama penutur + dialek — baris meta di atas aksi rekam. */
export function AudioMetaFields({
  speakerName,
  onSpeakerNameChange,
  dialectId,
  onDialectIdChange,
  dialectOptions,
  disabled,
}: AudioMetaFieldsProps) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={14}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
          Nama penutur
        </Text>
        <Input
          placeholder="Opsional — siapa yang berbicara"
          value={speakerName}
          onChange={(e) => onSpeakerNameChange(e.target.value)}
          maxLength={255}
          allowClear
          disabled={disabled}
        />
      </Col>
      <Col xs={24} md={10}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
          Dialek
        </Text>
        <Select
          allowClear
          placeholder="Opsional"
          options={dialectOptions}
          value={dialectId}
          onChange={(v) => onDialectIdChange(v)}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </Col>
    </Row>
  );
}

export interface AudioStudioShellProps {
  hint?: ReactNode;
  children: ReactNode;
}

/** Kerangka panel studio audio — satu permukaan visual untuk semua tahap. */
export function AudioStudioShell({ hint, children }: AudioStudioShellProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="audio-studio"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorFillAlter,
        overflow: 'hidden',
      }}
    >
      {hint ? (
        <div
          style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {hint}
          </Text>
        </div>
      ) : null}
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

export interface AudioIdleCaptureProps {
  recordLabel?: string;
  pickLabel?: string;
  supported: boolean;
  disabled?: boolean;
  loadingPick?: boolean;
  onRecord: () => void;
  beforeUpload: UploadProps['beforeUpload'];
  onFileChange: UploadProps['onChange'];
}

/** Dua jalur jelas: rekam mikrofon atau unggah file. */
export function AudioIdleCapture({
  recordLabel = 'Rekam mikrofon',
  pickLabel = 'Pilih file audio',
  supported,
  disabled,
  loadingPick,
  onRecord,
  beforeUpload,
  onFileChange,
}: AudioIdleCaptureProps) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      <button
        type="button"
        className="audio-studio__action"
        disabled={!supported || disabled}
        onClick={onRecord}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 8,
          padding: 16,
          margin: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
          cursor: !supported || disabled ? 'not-allowed' : 'pointer',
          opacity: !supported || disabled ? 0.55 : 1,
          textAlign: 'left',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: 18,
          }}
        >
          <AudioOutlined />
        </span>
        <div>
          <Text strong style={{ display: 'block' }}>
            {recordLabel}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {supported
              ? `Maks. ${MAX_RECORDING_SECONDS} detik`
              : 'Tidak didukung di browser ini'}
          </Text>
        </div>
      </button>

      <Upload
        accept=".mp3,.m4a,.wav,.ogg,.webm,audio/*"
        showUploadList={false}
        beforeUpload={beforeUpload}
        onChange={onFileChange}
        disabled={disabled}
        style={{ display: 'block', height: '100%' }}
      >
        <button
          type="button"
          className="audio-studio__action"
          disabled={disabled}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            padding: 16,
            margin: 0,
            width: '100%',
            height: '100%',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            background: token.colorBgContainer,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: token.colorInfoBg,
              color: token.colorInfo,
              fontSize: 18,
            }}
          >
            {loadingPick ? <CloudUploadOutlined /> : <UploadOutlined />}
          </span>
          <div>
            <Text strong style={{ display: 'block' }}>
              {pickLabel}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              mp3, m4a, wav, ogg, webm · maks. 5 MB
            </Text>
          </div>
        </button>
      </Upload>
    </div>
  );
}

export interface AudioRecordingPanelProps {
  elapsedMs: number;
  onStop: () => void;
}

/** Banner rekaman aktif — timer besar + indikator denyut. */
export function AudioRecordingPanel({ elapsedMs, onStop }: AudioRecordingPanelProps) {
  const { token } = theme.useToken();
  const progress = Math.min(100, (elapsedMs / (MAX_RECORDING_SECONDS * 1000)) * 100);
  const nearLimit = progress >= 85;

  return (
    <div
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${nearLimit ? token.colorWarningBorder : token.colorErrorBorder}`,
        background: nearLimit ? token.colorWarningBg : token.colorErrorBg,
        padding: '20px 16px',
      }}
    >
      <Flex vertical align="center" gap={12}>
        <div
          className="audio-studio__pulse"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: token.colorError,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
          aria-hidden
        >
          <AudioOutlined />
        </div>
        <div style={{ textAlign: 'center' }}>
          <Title level={3} style={{ margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
            {formatRecordingClock(elapsedMs)}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Sedang merekam — tekan stop saat selesai
          </Text>
        </div>
        <Progress
          percent={Math.round(progress)}
          showInfo={false}
          strokeColor={nearLimit ? token.colorWarning : token.colorError}
          trailColor="rgba(0,0,0,0.06)"
          style={{ width: '100%', maxWidth: 280, margin: 0 }}
          size="small"
        />
        <Button type="primary" danger size="large" icon={<StopOutlined />} onClick={onStop}>
          Stop rekaman
        </Button>
      </Flex>
    </div>
  );
}

export interface AudioReadyCardProps {
  previewUrl: string;
  durationMs: number;
  statusLabel: string;
  onDiscard: () => void;
  onRerecord?: () => void;
}

/** Preview audio yang sudah siap (pending create / setelah trim). */
export function AudioReadyCard({
  previewUrl,
  durationMs,
  statusLabel,
  onDiscard,
  onRerecord,
}: AudioReadyCardProps) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorSuccessBorder}`,
        background: token.colorSuccessBg,
        padding: 14,
      }}
    >
      <Flex justify="space-between" align="flex-start" wrap gap={8} style={{ marginBottom: 10 }}>
        <Space size={8} wrap>
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            {statusLabel}
          </Tag>
          <Tag style={{ margin: 0 }}>{formatRecordingClock(durationMs)}</Tag>
        </Space>
        <Space size={8} wrap>
          {onRerecord ? (
            <Button size="small" icon={<AudioOutlined />} onClick={onRerecord}>
              Rekam ulang
            </Button>
          ) : null}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onDiscard}>
            Buang
          </Button>
        </Space>
      </Flex>
      <audio
        controls
        src={previewUrl}
        preload="metadata"
        style={{ width: '100%', display: 'block' }}
      />
    </div>
  );
}
