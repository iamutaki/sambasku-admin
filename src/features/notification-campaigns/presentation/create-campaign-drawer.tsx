import { useEffect, useState } from 'react';
import {
  App as AntdApp,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { normalizeError } from '@/shared/api/error';
import { listAdminUsersRequest } from '@/features/users/infrastructure/user-admin-api';
import {
  AUDIENCE_LABELS,
  DEEP_LINK_KIND_LABELS,
  type CampaignAudienceType,
  type DeepLinkKind,
} from '../domain/campaign';
import {
  useCreateCampaign,
  useEstimateAudience,
  useTemplateList,
} from '../application/use-campaigns';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

interface FormValues {
  template_id?: string;
  title?: string;
  body?: string;
  deep_link_kind?: DeepLinkKind;
  deep_link_value?: string;
  audience_type: CampaignAudienceType;
  user_ids?: string[];
  schedule_mode: 'now' | 'later';
  send_at?: dayjs.Dayjs;
}

export function CreateCampaignDrawer({ open, onClose, onCreated }: Props) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const templates = useTemplateList(open);
  const createMutation = useCreateCampaign();
  const estimateMutation = useEstimateAudience();
  const [userOptions, setUserOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const audienceType = Form.useWatch('audience_type', form);
  const scheduleMode = Form.useWatch('schedule_mode', form);
  const selectedUsers = Form.useWatch('user_ids', form);
  const templateId = Form.useWatch('template_id', form);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      audience_type: 'all',
      schedule_mode: 'now',
      deep_link_kind: 'none',
    });
  }, [open, form]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listAdminUsersRequest({ q: userSearch || undefined, limit: 30 })
      .then((res) => {
        if (cancelled) return;
        setUserOptions(
          res.data.map((u) => ({
            value: u.id,
            label: `${u.username} (${u.email})`,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, userSearch]);

  useEffect(() => {
    if (!open || !audienceType) return;
    estimateMutation.mutate({
      audience_type: audienceType,
      user_ids: audienceType === 'selected' ? selectedUsers : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-estimate on audience change
  }, [open, audienceType, selectedUsers?.join(',')]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.data?.data.find((x) => x.id === templateId);
    if (!t) return;
    form.setFieldsValue({
      title: t.title,
      body: t.body,
      deep_link_kind: t.deepLinkKind,
      deep_link_value: t.deepLinkValue ?? undefined,
    });
  }, [templateId, templates.data, form]);

  const submit = async () => {
    const values = await form.validateFields();
    try {
      const campaign = await createMutation.mutateAsync({
        template_id: values.template_id || null,
        title: values.title,
        body: values.body,
        deep_link_kind: values.deep_link_kind,
        deep_link_value: values.deep_link_value ?? null,
        audience_type: values.audience_type,
        user_ids: values.audience_type === 'selected' ? values.user_ids : undefined,
        send_at:
          values.schedule_mode === 'later' && values.send_at
            ? values.send_at.toISOString()
            : null,
      });
      onCreated(campaign.id);
      form.resetFields();
    } catch (err) {
      message.warning(normalizeError(err).message);
    }
  };

  const estimate = estimateMutation.data;

  return (
    <Drawer
      title="Campaign baru"
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={submit} loading={createMutation.isPending}>
            Simpan draft
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="template_id" label="Template (opsional)">
          <Select
            allowClear
            placeholder="Pilih template"
            options={(templates.data?.data ?? []).map((t) => ({
              value: t.id,
              label: t.name,
            }))}
          />
        </Form.Item>
        <Form.Item name="title" label="Judul" rules={[{ required: true, message: 'Judul wajib' }]}>
          <Input maxLength={80} showCount />
        </Form.Item>
        <Form.Item name="body" label="Isi" rules={[{ required: true, message: 'Isi wajib' }]}>
          <Input.TextArea rows={4} maxLength={500} showCount />
        </Form.Item>
        <Form.Item name="deep_link_kind" label="Deep link">
          <Select
            options={(Object.keys(DEEP_LINK_KIND_LABELS) as DeepLinkKind[]).map((k) => ({
              value: k,
              label: DEEP_LINK_KIND_LABELS[k],
            }))}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.deep_link_kind !== next.deep_link_kind}>
          {({ getFieldValue }) =>
            getFieldValue('deep_link_kind') && getFieldValue('deep_link_kind') !== 'none' ? (
              <Form.Item
                name="deep_link_value"
                label="Target deep link"
                rules={[{ required: true, message: 'Target wajib' }]}
              >
                <Input />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item name="audience_type" label="Audience" rules={[{ required: true }]}>
          <Radio.Group
            options={(Object.keys(AUDIENCE_LABELS) as CampaignAudienceType[]).map((k) => ({
              value: k,
              label: AUDIENCE_LABELS[k],
            }))}
          />
        </Form.Item>
        {audienceType === 'selected' ? (
          <Form.Item
            name="user_ids"
            label="Pengguna"
            rules={[{ required: true, message: 'Pilih minimal satu pengguna' }]}
          >
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              onSearch={setUserSearch}
              options={userOptions}
              placeholder="Cari username / email"
            />
          </Form.Item>
        ) : null}
        {estimate ? (
          <Typography.Paragraph type="secondary">
            Estimasi: {estimate.users_with_device} user dengan device aktif
            {audienceType === 'selected' ? ` · ${estimate.devices} token` : ''}.
          </Typography.Paragraph>
        ) : null}
        <Form.Item name="schedule_mode" label="Waktu kirim">
          <Radio.Group
            options={[
              { value: 'now', label: 'Kirim setelah konfirmasi di detail' },
              { value: 'later', label: 'Jadwalkan' },
            ]}
          />
        </Form.Item>
        {scheduleMode === 'later' ? (
          <Form.Item
            name="send_at"
            label="Jadwal"
            rules={[{ required: true, message: 'Pilih jadwal' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs())} />
          </Form.Item>
        ) : null}
      </Form>
    </Drawer>
  );
}
