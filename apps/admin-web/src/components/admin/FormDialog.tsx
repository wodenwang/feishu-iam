import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

export type FormDialogProps = {
  open: boolean;
  title: string;
  pending?: boolean;
  error?: string;
  contentClassName?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function FormDialog({ open, title, pending = false, error, contentClassName, onOpenChange, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[calc(100vh-2rem)] overflow-y-auto", contentClassName)} aria-busy={pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>请确认表单信息后提交。</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}
