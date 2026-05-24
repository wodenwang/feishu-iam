import { Skeleton, Table } from 'antd';
import type { TableProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

interface AppTableProps<RecordType extends object> {
  title: ReactNode;
  extra?: ReactNode;
  error?: ReactNode;
  empty?: ReactNode;
  searchEmpty?: ReactNode;
  isError?: boolean;
  isEmpty?: boolean;
  isSearchEmpty?: boolean;
  minHeight?: number | string;
  className?: string;
  style?: CSSProperties;
  tableProps: TableProps<RecordType>;
}

function getStablePagination<RecordType extends object>(pagination: TableProps<RecordType>['pagination']) {
  if (pagination === false) {
    return false;
  }

  if (typeof pagination === 'object') {
    return {
      ...pagination,
      hideOnSinglePage: false,
    };
  }

  return pagination;
}

function LoadingEmptyState() {
  return (
    <div style={{ padding: '8px 24px' }}>
      <Skeleton active title={false} paragraph={{ rows: 4, width: ['92%', '86%', '88%', '80%'] }} />
    </div>
  );
}

export function AppTable<RecordType extends object>({
  title,
  extra,
  error,
  empty,
  searchEmpty,
  isError = false,
  isEmpty = false,
  isSearchEmpty = false,
  minHeight = 360,
  className,
  style,
  tableProps,
}: AppTableProps<RecordType>) {
  const loading = Boolean(tableProps.loading);
  const stateContent = isError ? error : isSearchEmpty ? searchEmpty : isEmpty ? empty : loading ? <LoadingEmptyState /> : tableProps.locale?.emptyText;
  const stableDataSource = isError || isSearchEmpty || isEmpty ? [] : tableProps.dataSource;

  return (
    <section
      data-testid="app-table-shell"
      className={className}
      style={{
        width: '100%',
        minHeight,
        background: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: 6,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          minHeight: 54,
          padding: '0 16px',
          borderBottom: '1px solid #d9e2ec',
        }}
      >
        <div style={{ color: '#122230', fontSize: 15, fontWeight: 600 }}>{title}</div>
        {extra ? <div style={{ flex: '0 0 auto' }}>{extra}</div> : null}
      </div>
      <div style={{ padding: 16 }}>
        <Table<RecordType>
          {...tableProps}
          dataSource={stableDataSource}
          pagination={getStablePagination(tableProps.pagination)}
          locale={{
            ...tableProps.locale,
            emptyText: stateContent,
          }}
        />
      </div>
    </section>
  );
}
