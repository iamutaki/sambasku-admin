import { useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/utils/format-datetime';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import { useLegalDocuments, useLegalMutations, useLegalSettings } from '../application/use-legal';
import type { LegalDocument, LegalDocumentType } from '../domain/legal';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  published: 'success',
  archived: 'warning',
};

export function LegalPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const [docType, setDocType] = useState<LegalDocumentType>('terms');
  const [draftOpen, setDraftOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<LegalDocument | null>(null);

  const docsQuery = useLegalDocuments(docType, canManage);
  const settingsQuery = useLegalSettings(canManage);
  const mutations = useLegalMutations();

  const [form] = Form.useForm<{
    document_type: LegalDocumentType;
    version: string;
    title: string;
    body_markdown: string;
  }>();
  const [editForm] = Form.useForm<{ title: string; body_markdown: string }>();
  const [settingsForm] = Form.useForm<{
    third_party_registration: string;
    retention_days: string;
  }>();

  const settingsMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const s of settingsQuery.data ?? []) map[s.key] = s.value;
    return map;
  }, [settingsQuery.data]);

  const openCreate = () => {
    form.setFieldsValue({
      document_type: docType,
      version: new Date().toISOString().slice(0, 10),
      title: docType === 'terms' ? 'Syarat dan Ketentuan' : 'Kebijakan Privasi',
      body_markdown: '',
    });
    setDraftOpen(true);
  };

  const openEdit = (doc: LegalDocument) => {
    setEditDoc(doc);
    editForm.setFieldsValue({ title: doc.title, body_markdown: doc.body_markdown });
  };

  if (!canManage) {
    return (
      <Alert type="warning" showIcon message="Hanya admin/root yang dapat mengelola dokumen legal." />
    );
  }

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Legal & OAuth"
        subtitle="Dokumen Syarat/Privasi berversi dan pengaturan enforce OAuth"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { void docsQuery.refetch(); void settingsQuery.refetch(); }}>
              Muat ulang
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Draft baru
            </Button>
          </Space>
        }
      />

      <Card title="Pengaturan runtime" size="small" loading={settingsQuery.isLoading}>
        <Form
          form={settingsForm}
          layout="vertical"
          key={JSON.stringify(settingsMap)}
          initialValues={{
            third_party_registration: settingsMap['oauth.third_party_registration'] ?? 'closed',
            retention_days: settingsMap['oauth.request_log_retention_days'] ?? '90',
          }}
          onFinish={async (values) => {
            try {
              await mutations.patchSettings.mutateAsync([
                { key: 'oauth.third_party_registration', value: values.third_party_registration },
                { key: 'oauth.request_log_retention_days', value: values.retention_days },
              ]);
              message.success('Pengaturan disimpan');
            } catch (err) {
              message.error(normalizeError(err).message);
            }
          }}
        >
          <Flex gap={16} wrap>
            <Form.Item name="third_party_registration" label="Registrasi third-party" style={{ minWidth: 200 }}>
              <Select
                options={[
                  { value: 'closed', label: 'closed' },
                  { value: 'open', label: 'open' },
                ]}
              />
            </Form.Item>
            <Form.Item name="retention_days" label="Retensi request log (hari)" style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
          </Flex>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            Gate JWT <Typography.Text code>azp</Typography.Text> dikontrol env{' '}
            <Typography.Text code>OAUTH_REQUIRE_AZP</Typography.Text> (bukan pengaturan ini).
            Default false = token lama tanpa azp masih lolos.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            Versi legal aktif: terms <Typography.Text code>{settingsMap['legal.terms_version'] ?? '-'}</Typography.Text>
            {' · '}
            privacy <Typography.Text code>{settingsMap['legal.privacy_version'] ?? '-'}</Typography.Text>
            {' '}(diubah otomatis saat Publish dokumen)
          </Typography.Paragraph>
          <Popconfirm
            title="Simpan pengaturan OAuth?"
            description="Perubahan retensi / registrasi third-party berlaku segera."
            okText="Simpan"
            onConfirm={() => settingsForm.submit()}
          >
            <Button type="primary" loading={mutations.patchSettings.isPending}>
              Simpan pengaturan
            </Button>
          </Popconfirm>
        </Form>
      </Card>

      <Card size="small">
        <Tabs
          activeKey={docType}
          onChange={(k) => setDocType(k as LegalDocumentType)}
          items={[
            { key: 'terms', label: 'Syarat Ketentuan' },
            { key: 'privacy', label: 'Kebijakan Privasi' },
          ]}
        />
        <Table<LegalDocument>
          rowKey="id"
          loading={docsQuery.isLoading || docsQuery.isFetching}
          dataSource={docsQuery.data?.items ?? []}
          pagination={false}
          columns={[
            {
              title: 'Versi',
              dataIndex: 'version',
              width: 120,
              render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
            },
            { title: 'Judul', dataIndex: 'title', ellipsis: true },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 120,
              render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
            },
            {
              title: 'Diterbitkan',
              dataIndex: 'published_at',
              width: 170,
              render: (v: string | null) => (v ? formatDateTime(v) : '-'),
            },
            {
              title: 'Aksi',
              width: 260,
              render: (_, row) => (
                <Space wrap>
                  {row.status === 'draft' ? (
                    <>
                      <Button size="small" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Publish dokumen ini?"
                        description="User lama akan diminta setujui ulang versi baru."
                        okText="Publish"
                        onConfirm={async () => {
                          try {
                            await mutations.publish.mutateAsync(row.id);
                            message.success(`Versi ${row.version} dipublish`);
                          } catch (err) {
                            message.error(normalizeError(err).message);
                          }
                        }}
                      >
                        <Button size="small" type="primary">
                          Publish
                        </Button>
                      </Popconfirm>
                    </>
                  ) : null}
                  {row.status !== 'archived' ? (
                    <Popconfirm
                      title="Archive dokumen?"
                      okText="Archive"
                      onConfirm={async () => {
                        try {
                          await mutations.archive.mutateAsync(row.id);
                          message.success('Dokumen di-archive');
                        } catch (err) {
                          message.error(normalizeError(err).message);
                        }
                      }}
                    >
                      <Button size="small" danger>
                        Archive
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Draft dokumen legal"
        open={draftOpen}
        onCancel={() => setDraftOpen(false)}
        width={720}
        okText="Simpan draft"
        confirmLoading={mutations.createDraft.isPending}
        onOk={() => form.submit()}
          destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await mutations.createDraft.mutateAsync(values);
              message.success('Draft dibuat');
              setDraftOpen(false);
              setDocType(values.document_type);
            } catch (err) {
              message.error(normalizeError(err).message);
            }
          }}
        >
          <Form.Item name="document_type" label="Tipe" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'terms', label: 'terms (Syarat)' },
                { value: 'privacy', label: 'privacy (Privasi)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="version" label="Versi" rules={[{ required: true, message: 'Versi wajib' }]}>
            <Input placeholder="2026-09-26" />
          </Form.Item>
          <Form.Item name="title" label="Judul" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body_markdown" label="Isi (markdown)" rules={[{ required: true }]}>
            <Input.TextArea rows={14} placeholder="# Judul&#10;&#10;Paragraf..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editDoc ? `Edit draft ${editDoc.version}` : 'Edit draft'}
        open={!!editDoc}
        onCancel={() => setEditDoc(null)}
        width={720}
        okText="Simpan"
        confirmLoading={mutations.updateDraft.isPending}
        onOk={() => editForm.submit()}
          destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editDoc) return;
            try {
              await mutations.updateDraft.mutateAsync({ id: editDoc.id, ...values });
              message.success('Draft diperbarui');
              setEditDoc(null);
            } catch (err) {
              message.error(normalizeError(err).message);
            }
          }}
        >
          <Form.Item name="title" label="Judul" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body_markdown" label="Isi (markdown)" rules={[{ required: true }]}>
            <Input.TextArea rows={14} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
