import { Card, Table } from 'antd';
import type { TableProps } from 'antd';
import type { ReactNode } from 'react';

interface AppTableProps<RecordType extends object> {
  title: ReactNode;
  extra?: ReactNode;
  error?: ReactNode;
  empty?: ReactNode;
  isError?: boolean;
  isEmpty?: boolean;
  tableProps: TableProps<RecordType>;
}

export function AppTable<RecordType extends object>({
  title,
  extra,
  error,
  empty,
  isError = false,
  isEmpty = false,
  tableProps,
}: AppTableProps<RecordType>) {
  return (
    <Card title={title} extra={extra}>
      {isError ? error : isEmpty ? empty : <Table<RecordType> {...tableProps} />}
    </Card>
  );
}
