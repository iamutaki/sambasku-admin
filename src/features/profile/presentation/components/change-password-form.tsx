import { useState } from 'react';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import { Alert, App as AntdApp, Button, Form, Input } from 'antd';
import { ApiError, normalizeError } from '@/shared/api/error';
import { useChangePassword } from '../../application/use-change-password';

interface ChangePasswordValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/**
 * Form ubah password sendiri (pola login-page). Setelah sukses backend
 * me-revoke SEMUA session (hook sudah clear sesi lokal) - tinggal pesan
 * sukses + navigasi ke /login untuk login ulang dengan password baru.
 */
export function ChangePasswordForm() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ChangePasswordValues>();
  const changePassword = useChangePassword();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onFinish = async (values: ChangePasswordValues) => {
    setSubmitError(null);
    try {
      const resultMessage = await changePassword.mutateAsync(values);
      message.success(resultMessage || 'Password berhasil diubah. Silakan login kembali.');
      navigate({ to: '/login' });
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();
        const names = Object.keys(fields);
        if (names.length > 0) {
          form.setFields(
            names.map((name) => ({ name: name as keyof ChangePasswordValues, errors: [fields[name]] })),
          );
        } else if (err.status === 401) {
          // Password lama salah (INVALID_CREDENTIALS) - inline di fieldnya
          form.setFields([{ name: 'old_password', errors: [err.message] }]);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError(normalizeError(err).message || 'Gagal mengubah password');
      }
    }
  };

  return (
    <Form<ChangePasswordValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      disabled={changePassword.isPending}
      onFinish={onFinish}
    >
      {submitError ? (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={submitError} closable onClose={() => setSubmitError(null)} />
      ) : null}

      <Form.Item
        name="old_password"
        label="Password Lama"
        rules={[{ required: true, message: 'Password lama wajib diisi' }]}
      >
        <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="Password saat ini" />
      </Form.Item>

      <Form.Item
        name="new_password"
        label="Password Baru"
        dependencies={['old_password']}
        rules={[
          { required: true, message: 'Password baru wajib diisi' },
          { min: 8, message: 'Minimal 8 karakter' },
          { pattern: /[a-zA-Z]/, message: 'Harus mengandung huruf' },
          { pattern: /[0-9]/, message: 'Harus mengandung angka' },
          {
            validator: (_, value: string) =>
              value && form.getFieldValue('old_password') === value
                ? Promise.reject(new Error('Password baru tidak boleh sama dengan password lama'))
                : Promise.resolve(),
          },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Minimal 8 karakter, huruf + angka" />
      </Form.Item>

      <Form.Item
        name="confirm_password"
        label="Konfirmasi Password Baru"
        dependencies={['new_password']}
        rules={[
          { required: true, message: 'Konfirmasi password wajib diisi' },
          {
            validator: (_, value: string) =>
              value && value !== form.getFieldValue('new_password')
                ? Promise.reject(new Error('Konfirmasi password tidak sama dengan password baru'))
                : Promise.resolve(),
          },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="Ulangi password baru" />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={changePassword.isPending} danger>
        Ubah Password
      </Button>
      <Button type="text" onClick={() => form.resetFields()} disabled={changePassword.isPending} style={{ marginLeft: 8 }}>
        Reset
      </Button>
    </Form>
  );
}
