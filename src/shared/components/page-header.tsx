import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

/** Header standar halaman bawaan konsol: judul + sub judul + aksi kanan. */
export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <Flex align={extra ? 'center' : 'flex-start'} justify="space-between" wrap gap={8} className="page-header">
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      </div>
      {extra ? <Flex gap={8}>{extra}</Flex> : null}
    </Flex>
  );
}