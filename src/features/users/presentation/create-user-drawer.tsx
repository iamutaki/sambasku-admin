import { useEffect } from 'react';
import { Button, Drawer, Form, Input, Select, Switch } from 'antd';
import { ROLE_OPTIONS_SELECT, type AdminUserRole } from '../domain/user-admin';
import { useCreateAdminUser } from '../application/use-update-user-role';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirm_password: string;
  role: Exclude<AdminUserRole, 'root'>;
  is_active: boolean;
}

const PASSWORD_HINT = 'Minimal 8 karakter, kombinasi huruf dan angka';

export function CreateUserDrawer({ open, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const createUser = useCreateAdminUser();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ role: 'contributor', is_active: true });
  }, [open, form]);

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await createUser.mutateAsync({
        username: values.username.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        password: values.password,
        confirm_password: values.confirm_password,
        role: values.role,
        is_active: values.is_active,
      });
      form.resetFields();
      onClose();
    } catch {
      // Pesan gagal ditampilkan hook mutation.
    }
  };

  return (
    <Drawer
      title="Tambah pengguna"
      open={open}
      onClose={onClose}
      size="default"
      destroyOnHidden
      extra={
        <Button type="primary" loading={createUser.isPending} onClick={() => void submit()}>
          Simpan
        </Button>
      }
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="username"
          label="Nama pengguna"
          rules={[{ required: true, whitespace: true, message: 'Nama pengguna wajib diisi' }]}
        >
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Email wajib diisi' },
            { type: 'email', message: 'Format email tidak valid' },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="phone" label="Nomor HP" extra="Opsional. Contoh: 81234567890">
          <Input maxLength={20} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          extra="Sampaikan password ini ke pengguna di luar sistem. Email tidak dikirim."
          rules={[
            { required: true, message: 'Password wajib diisi' },
            { min: 8, message: PASSWORD_HINT },
            { pattern: /[a-zA-Z]/, message: PASSWORD_HINT },
            { pattern: /[0-9]/, message: PASSWORD_HINT },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="Konfirmasi password"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Konfirmasi password wajib diisi' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Konfirmasi password tidak sama'));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="role" label="Peran" rules={[{ required: true, message: 'Peran wajib dipilih' }]}>
          <Select options={ROLE_OPTIONS_SELECT} />
        </Form.Item>
        <Form.Item name="is_active" label="Aktif" valuePropName="checked">
          <Switch size="small" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
