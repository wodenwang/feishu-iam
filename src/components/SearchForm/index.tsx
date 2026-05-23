import { Card, Form } from 'antd';
import type { FormInstance, FormProps } from 'antd';
import type { ReactNode } from 'react';

interface SearchFormProps<Values extends object> {
  form: FormInstance<Values>;
  children: ReactNode;
  onFinish: FormProps<Values>['onFinish'];
}

export function SearchForm<Values extends object>({ form, children, onFinish }: SearchFormProps<Values>) {
  return (
    <Card>
      <Form form={form} layout="inline" style={{ rowGap: 12 }} onFinish={onFinish}>
        {children}
      </Form>
    </Card>
  );
}
