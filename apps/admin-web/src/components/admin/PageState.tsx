import type { ReactNode } from 'react';
import { Skeleton } from '../ui/skeleton';

export type PageStateType = 'loading' | 'empty' | 'error' | 'forbidden';

export type PageStateProps = {
  type: PageStateType;
  title?: ReactNode;
  description?: ReactNode;
};

const defaults: Record<PageStateType, { title: string; description: string }> = {
  loading: {
    title: '正在加载',
    description: '请稍候，数据正在读取。'
  },
  empty: {
    title: '暂无数据',
    description: '当前筛选条件下没有可展示的数据。'
  },
  error: {
    title: '读取失败',
    description: '请稍后重试，或联系管理员排查。'
  },
  forbidden: {
    title: '没有权限',
    description: '当前管理员无权访问该资源。'
  }
};

export function PageState({ type, title, description }: PageStateProps) {
  const state = defaults[type];
  const role = type === 'error' ? 'alert' : 'status';

  return (
    <section
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 p-6 text-center"
      role={role}
      aria-live={type === 'loading' ? 'polite' : undefined}
    >
      {type === 'loading' ? (
        <div className="flex w-full max-w-sm flex-col gap-3" aria-hidden="true">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>
      ) : null}
      <div className="text-sm font-medium text-foreground">{title ?? state.title}</div>
      {description ?? state.description ? (
        <div className="max-w-md text-sm text-muted-foreground">{description ?? state.description}</div>
      ) : null}
    </section>
  );
}
