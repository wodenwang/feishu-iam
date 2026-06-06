import type { ReactNode } from 'react';
import { Button } from '../ui/button';

export type FilterBarProps = { children: ReactNode; actions?: ReactNode; onReset?: () => void };

export function FilterBar({ children, actions, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-background p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid flex-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">{children}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {onReset ? (
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
