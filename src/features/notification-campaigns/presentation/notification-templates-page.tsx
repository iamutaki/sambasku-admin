import { useMemo, useState } from 'react';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App as AntdApp,
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { PageHeader } from '@/shared/components/page-header';
import { normalizeError } from '@/shared/api/error';
import { useAuth } from '@/shared/auth/use-auth';
import {
  DEEP_LINK_KIND_LABELS,
  type DeepLinkKind,
  type NotificationTemplate,
} from '../domain/campaign';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplateList,
  useUpdateTemplate,
} from '../application/use-campaigns';

interface TemplateFormValues {
  name: string;
  title: string;
  body: string;
  deep_link_kind: DeepLinkKind;
  deep_link_value?: string;
}

export function NotificationTemplatesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'root';
  const { message } = AntdApp.useApp();
  const { data, isLoading, isError, error, refetch } = useTemplateList(canManage);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form] = Form.useForm<TemplateFormValues>();
  const deepLinkKind = Form.useWatch('deep_link_kind', form);
  const previewTitle = Form.useWatch('title', form);
  const previewBody = Form.useWatch('body', form);

  const items = data?.data ?? [];

  const columns = useMemo(
    () => [
      { title: 'Nama', dataIndex: 'name', key: 'name' },
      { title: 'Judul', dataIndex: 'title', key: 'title' },
      {
        title: 'Deep link',
        key: 'deeplink',
        render: (_: unknown, row: NotificationTemplate) =>
          DEEP_LINK_KIND_LABELS[row.deepLinkKind],
      },
      {
        title: '',
        key: 'actions',
        width: 120,
        render: (_: unknown, row: NotificationTemplate) => (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(row);
                form.setFieldsValue({
                  name: row.name,
                  title: row.title,
                  body: row.body,
                  deep_link_kind: row.deepLinkKind,
                  deep_link_value: row.deepLinkValue ?? undefined,
                });
                setOpen(true);
              }}
            />
            <Popconfirm
              title="Hapus template ini?"
              onConfirm={async () => {
                try {
                  await deleteMutation.mutateAsync(row.id);
                  message.success('Template dihapus');
                } catch (err) {
                  message.warning(normalizeError(err).message);
                }
              }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteMutation, form, message],
  );

  if (!canManage) {
    return <Typography.Text type="secondary">Hanya admin/root yang dapat mengelola template.</Typography.Text>;
  }

  const submit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: values.name,
          title: values.title,
          body: values.body,
          deep_link_kind: values.deep_link_kind,
          deep_link_value: values.deep_link_value ?? null,
        });
        message.success('Template diperbarui');
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          title: values.title,
          body: values.body,
          deep_link_kind: values.deep_link_kind,
          deep_link_value: values.deep_link_value ?? null,
        });
        message.success('Template dibuat');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
    } catch (err) {
      message.warning(normalizeError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Template notifikasi"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              form.setFieldsValue({ deep_link_kind: 'none' });
              setOpen(true);
            }}
          >
            Template baru
          </Button>
        }
      />
      {isError ? (
        <Typography.Text type="danger">{normalizeError(error).message}</Typography.Text>
      ) : null}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        columns={columns}
        pagination={false}
      />
      <Drawer
        title={editing ? 'Edit template' : 'Template baru'}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        extra={
          <Button type="primary" onClick={submit} loading={createMutation.isPending || updateMutation.isPending}>
            Simpan
          </Button>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ deep_link_kind: 'none' }}>
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: 'Nama wajib' }]}>
            <Input maxLength={100} showCount />
          </Form.Item>
          <Form.Item name="title" label="Judul push" rules={[{ required: true, message: 'Judul wajib' }]}>
            <Input maxLength={80} showCount placeholder="Maks. ~50 karakter untuk FCM" />
          </Form.Item>
          <Form.Item name="body" label="Isi" rules={[{ required: true, message: 'Isi wajib' }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="Maks. ~150 karakter disarankan untuk FCM" />
          </Form.Item>
          <Form.Item name="deep_link_kind" label="Deep link">
            <Select
              options={(Object.keys(DEEP_LINK_KIND_LABELS) as DeepLinkKind[]).map((k) => ({
                value: k,
                label: DEEP_LINK_KIND_LABELS[k],
              }))}
            />
          </Form.Item>
          {deepLinkKind && deepLinkKind !== 'none' ? (
            <Form.Item
              name="deep_link_value"
              label={deepLinkKind === 'url' ? 'URL' : 'ID target'}
              rules={[{ required: true, message: 'Target wajib diisi' }]}
            >
              <Input />
            </Form.Item>
          ) : null}
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Pratinjau
          </Typography.Paragraph>
          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <Typography.Text strong>
              {previewTitle || 'Judul notifikasi'}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary">
                {previewBody || 'Isi notifikasi'}
              </Typography.Text>
            </div>
          </div>
        </Form>
        <Button type="link" onClick={() => refetch()} style={{ padding: 0, marginTop: 16 }}>
          Muat ulang daftar
        </Button>
      </Drawer>
    </>
  );
}
