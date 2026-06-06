import { useState } from 'react';
import { Button } from '../ui/button';

export type SecretRevealPanelProps = {
  label: string;
  value: string;
};

export function SecretRevealPanel({ label, value }: SecretRevealPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <section className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950" role="region" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-sm text-amber-800">该值只在当前面板展示，请按需复制后妥善保存。</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { void handleCopy(); }} disabled={!value}>
          {copied ? '已复制' : `复制 ${label}`}
        </Button>
      </div>
      <code className="block break-all rounded-md border border-amber-200 bg-background px-3 py-2 font-mono text-sm text-foreground">
        {value}
      </code>
    </section>
  );
}
