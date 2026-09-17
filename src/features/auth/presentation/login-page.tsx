import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { useLogin } from '../application/use-login';
import type { LoginCredentials } from '../domain/user';
import { ApiError } from '@/shared/api/error';

/**
 * Halaman Login (base layout / pra-auth).
 *
 * Form memakai antd Form + hook `useLogin` (application layer). Saat
 * backend mengembalikan 400 VALIDATION_ERROR dengan `details[].field`,
 * error dipetakan inline ke field form (pola kontrak Section 13 API:
 * `ApiError.fieldErrors()`).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const loginMutation = useLogin();
  const [form] = Form.useForm<LoginCredentials>();

  const onFinish = async (values: LoginCredentials) => {
    try {
      const result = await loginMutation.mutateAsync(values);
      message.success(`Selamat datang, ${result.user.username}`);
      navigate({ to: '/dashboard' });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) {
          const fields = Object.entries(fieldErrors).map(([name, value]) => ({
            name: name as keyof LoginCredentials,
            errors: [value],
          }));
          form.setFields(fields);
        }
        if (err.status === 401 || err.status === 403) {
          message.error(err.message);
        }
      }
    }
  };

  return (
    <Card style={{ width: 400, maxWidth: '100%' }} styles={{ body: { padding: 32 } }}>
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4, textAlign: 'center' }}>
        Masuk ke Konsol
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
        Gunakan akun admin/editor/reviewer Anda.
      </Typography.Paragraph>

      {loginMutation.isError && loginMutation.error instanceof ApiError && loginMutation.error.status !== 401 && loginMutation.error.status !== 403 ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Gagal masuk" description={loginMutation.error.message} />
      ) : null}

      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} disabled={loginMutation.isPending}>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email wajib diisi' }, { type: 'email', message: 'Format email tidak valid' }]}>
          <Input prefix={<MailOutlined />} placeholder="admin@contoh.id" autoComplete="email" size="large" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password wajib diisi' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loginMutation.isPending}>
          Masuk
        </Button>
      </Form>
    </Card>
  );
}