import { Popover, theme, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { diffChanges, formatValue, type AuditChange } from '../domain/audit-changes';

const MAX_VISIBLE_CHANGES = 3;
const MAX_VALUE_CHARS = 80;

interface AuditChangesCellProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

/** Nilai satu field — `null`/boolean/objek diberi gaya agar cepat terbaca. */
function ValueText({ value, tone }: { value: unknown; tone: 'old' | 'new' | 'plain' }) {
  if (value === null || value === undefined) {
    return (
      <Typography.Text type="secondary" italic>
        null
      </Typography.Text>
    );
  }
  if (typeof value === 'boolean') {
    return <Typography.Text type={value ? 'success' : 'danger'}>{String(value)}</Typography.Text>;
  }
  const text = formatValue(value);
  const shown = text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text;
  return (
    <Typography.Text type={tone === 'old' ? 'secondary' : undefined} delete={tone === 'old'} code={typeof value !== 'string'}>
      {shown}
    </Typography.Text>
  );
}

/** Satu baris ringkasan: `field: lama → baru` (atau nilai tunggal untuk create/delete). */
function ChangeLine({ change }: { change: AuditChange }) {
  return (
    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <Typography.Text strong>{change.key}</Typography.Text>
      {': '}
      {change.hasBefore && change.hasAfter ? (
        <>
          <ValueText value={change.before} tone="old" />
          {' → '}
          <ValueText value={change.after} tone="new" />
        </>
      ) : (
        <ValueText value={change.hasAfter ? change.after : change.before} tone={change.hasAfter ? 'plain' : 'old'} />
      )}
    </div>
  );
}

/** Blok JSON rapi (2 spasi) untuk popover detail. */
function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }): ReactNode {
  const { token } = theme.useToken();
  if (!data) return null;
  const pre: CSSProperties = {
    margin: '4px 0 12px',
    padding: token.paddingXS,
    background: token.colorFillTertiary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    maxHeight: 260,
    overflow: 'auto',
    fontSize: 12,
    lineHeight: 1.5,
  };
  return (
    <div>
      <Typography.Text strong style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <pre style={pre}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

/**
 * Kolom "Perubahan" audit: ringkas field yang berubah (create/update/delete)
 * dalam bentuk `field: lama → baru`, lalu klik untuk melihat `old_data`/
 * `new_data` sebagai JSON rapi. Menggantikan stringify satu baris.
 */
export function AuditChangesCell({ oldData, newData }: AuditChangesCellProps) {
  if (!oldData && !newData) return <Typography.Text type="secondary">—</Typography.Text>;

  const changes = diffChanges(oldData, newData);
  if (changes.length === 0) return <Typography.Text type="secondary">Tidak ada perubahan</Typography.Text>;

  const visible = changes.slice(0, MAX_VISIBLE_CHANGES);
  const remaining = changes.length - visible.length;

  return (
    <Popover
      trigger="click"
      placement="leftTop"
      title="Detail perubahan"
      content={
        <div style={{ maxWidth: 440 }}>
          <JsonBlock label="Sebelum (old_data)" data={oldData} />
          <JsonBlock label="Sesudah (new_data)" data={newData} />
        </div>
      }
    >
      <div style={{ cursor: 'pointer', maxWidth: 360, fontSize: 12 }}>
        {visible.map((change) => (
          <ChangeLine key={change.key} change={change} />
        ))}
        {remaining > 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            +{remaining} field lainnya
          </Typography.Text>
        ) : null}
      </div>
    </Popover>
  );
}
