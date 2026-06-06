import { useState } from 'react';
import { Button } from '../ui/button';

export type CopyFieldProps = {
  label: string;
  value: string;
  copyLabel?: string;
};

export function CopyField({ label, value, copyLabel }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => { void handleCopy(); }} disabled={!value}>
          {copied ? '已复制' : (copyLabel ?? `复制 ${label}`)}
        </Button>
      </div>
      <code className="block break-all rounded bg-background px-3 py-2 font-mono text-sm text-foreground">{value}</code>
    </div>
  );
}
