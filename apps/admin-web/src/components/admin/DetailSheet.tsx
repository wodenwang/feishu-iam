import { Maximize2, PanelRight, Rows3 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export type DetailSheetSize = "normal" | "wide" | "full";

export type DetailSheetProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  presentation?: "sheet" | "page";
  size?: DetailSheetSize;
  defaultSize?: DetailSheetSize;
  sizeStorageKey?: string;
  onSizeChange?: (size: DetailSheetSize) => void;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

const sizeOrder: DetailSheetSize[] = ["normal", "wide", "full"];

const sizeClassName: Record<DetailSheetSize, string> = {
  normal: "w-[calc(100vw-2rem)] max-w-[520px] sm:max-w-[520px]",
  wide: "w-[calc(100vw-2rem)] max-w-[760px] sm:max-w-[760px]",
  full: "w-[calc(100vw-2rem)] max-w-[1120px] sm:max-w-[1120px]",
};

const sizeLabels: Record<DetailSheetSize, string> = {
  normal: "常规详情",
  wide: "宽屏详情",
  full: "填满详情",
};

const sizeIcons: Record<DetailSheetSize, ReactNode> = {
  normal: <PanelRight className="h-4 w-4" aria-hidden="true" />,
  wide: <Rows3 className="h-4 w-4" aria-hidden="true" />,
  full: <Maximize2 className="h-4 w-4" aria-hidden="true" />,
};

export function DetailSheet({
  open,
  title,
  description,
  presentation = "sheet",
  size,
  defaultSize = "normal",
  sizeStorageKey,
  onSizeChange,
  onOpenChange,
  children,
}: DetailSheetProps) {
  const [internalSize, setInternalSize] = useState<DetailSheetSize>(() =>
    readStoredSize(sizeStorageKey, defaultSize),
  );
  const currentSize = size ?? internalSize;

  useEffect(() => {
    if (size === undefined) {
      setInternalSize(readStoredSize(sizeStorageKey, defaultSize));
    }
  }, [defaultSize, size, sizeStorageKey]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  function updateSize(nextSize: DetailSheetSize) {
    if (size === undefined) {
      setInternalSize(nextSize);
      writeStoredSize(sizeStorageKey, nextSize);
    }
    onSizeChange?.(nextSize);
  }

  if (presentation === "page") {
    if (!open) {
      return null;
    }
    return (
      <section className="grid gap-5">
        <header className="rounded-md border bg-card px-6 py-5 shadow-sm">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </header>
        <div className="min-w-0 rounded-md border bg-card px-6 py-5 shadow-sm">
          {children}
        </div>
      </section>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "flex flex-col overflow-y-auto p-0",
          sizeClassName[currentSize],
        )}
        onEscapeKeyDown={() => {
          onOpenChange(false);
        }}
      >
        <TooltipProvider>
          <SheetHeader className="border-b px-6 py-5 pr-14">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <SheetTitle>{title}</SheetTitle>
                {description ? (
                  <SheetDescription asChild>{description}</SheetDescription>
                ) : null}
              </div>
              <div
                className="flex shrink-0 items-center gap-1"
                aria-label="详情宽度"
              >
                {sizeOrder.map((item) => (
                  <Tooltip key={item}>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={`切换为${sizeLabels[item]}`}
                        aria-pressed={currentSize === item}
                        size="icon"
                        type="button"
                        variant={currentSize === item ? "secondary" : "ghost"}
                        onClick={() => {
                          updateSize(item);
                        }}
                      >
                        {sizeIcons[item]}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{sizeLabels[item]}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </SheetHeader>
          <div
            className="min-h-0 flex-1 px-6 py-5 pb-24"
            data-testid="detail-sheet-body"
          >
            {children}
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}

function readStoredSize(
  storageKey: string | undefined,
  fallback: DetailSheetSize,
): DetailSheetSize {
  if (!storageKey) {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    return isDetailSheetSize(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredSize(
  storageKey: string | undefined,
  size: DetailSheetSize,
): void {
  if (!storageKey) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, size);
  } catch {
    // The open sheet still keeps the selected size when storage is unavailable.
  }
}

function isDetailSheetSize(value: string | null): value is DetailSheetSize {
  return value === "normal" || value === "wide" || value === "full";
}
