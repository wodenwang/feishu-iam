import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} ref={ref} {...props} />
  </div>
));

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead className={cn('[&_tr]:border-b', className)} ref={ref} {...props} />,
);

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody className={cn('[&_tr:last-child]:border-0', className)} ref={ref} {...props} />,
);

TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} ref={ref} {...props} />
  ),
);

TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
      ref={ref}
      {...props}
    />
  ),
);

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      className={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)}
      ref={ref}
      {...props}
    />
  ),
);

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} ref={ref} {...props} />
  ),
);

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption className={cn('mt-4 text-sm text-muted-foreground', className)} ref={ref} {...props} />
  ),
);

TableCaption.displayName = 'TableCaption';
