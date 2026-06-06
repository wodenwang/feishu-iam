import { ChevronDown, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

const DEFAULT_STORAGE_KEY = "feishu-iam:admin-sidebar-collapsed";

export type AppShellNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  children?: AppShellNavItem[];
};

export type AppShellProps = {
  brand: ReactNode;
  navItems: AppShellNavItem[];
  userMenu: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  storageKey?: string;
};

export function AppShell(props: AppShellProps) {
  const storageKey = props.storageKey ?? DEFAULT_STORAGE_KEY;
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (props.collapsed !== undefined) {
      return props.collapsed;
    }
    return readStoredCollapsed(storageKey, props.defaultCollapsed ?? false);
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const collapsed = props.collapsed ?? internalCollapsed;
  const desktopNavId = useId();

  useEffect(() => {
    if (props.collapsed !== undefined) {
      return;
    }

    writeStoredCollapsed(storageKey, collapsed);
  }, [collapsed, props.collapsed, storageKey]);

  const setCollapsed = (nextCollapsed: boolean) => {
    if (props.collapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }
    props.onCollapsedChange?.(nextCollapsed);
  };

  const shellColumns = useMemo(
    () => ({
      gridTemplateColumns: `${collapsed ? "80px" : "260px"} minmax(0, 1fr)`,
    }),
    [collapsed],
  );

  return (
    <TooltipProvider>
      <div
        className="min-h-screen bg-background text-foreground lg:grid lg:h-dvh lg:min-h-0 lg:overflow-hidden"
        style={shellColumns}
      >
        <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
          <div
            className={cn(
              "flex min-h-16 items-center border-b border-sidebar-border transition-[padding] duration-200",
              collapsed
                ? "justify-center px-3 py-4"
                : "justify-between gap-3 p-5",
            )}
          >
            <div className={cn("min-w-0", collapsed && "sr-only")}>
              {props.brand}
            </div>
            <Button
              aria-controls={desktopNavId}
              aria-label={collapsed ? "展开主菜单" : "收起主菜单"}
              className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => {
                setCollapsed(!collapsed);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <PrimaryNav
            id={desktopNavId}
            items={props.navItems}
            collapsed={collapsed}
            className="flex-1 p-3"
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col lg:h-dvh lg:min-h-0">
          <header className="sticky top-0 z-30 flex min-h-16 min-w-0 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  className="lg:hidden"
                  size="icon"
                  type="button"
                  variant="ghost"
                  aria-label="打开导航"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0">
                <SheetHeader className="border-b px-5 py-4">
                  <SheetTitle>主菜单</SheetTitle>
                  <SheetDescription className="sr-only">
                    后台主导航，包含工作台、应用管理、权限管理和系统管理入口。
                  </SheetDescription>
                </SheetHeader>
                <div className="border-b px-5 py-4">{props.brand}</div>
                <PrimaryNav
                  items={props.navItems}
                  className="p-3"
                  tone="surface"
                  onNavigate={() => {
                    setMobileNavOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              {props.userMenu}
            </div>
          </header>

          <main className="min-w-0 flex-1 bg-muted/30 lg:min-h-0 lg:overflow-y-auto">
            {props.children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function readStoredCollapsed(storageKey: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue === "true") {
      return true;
    }
    if (storedValue === "false") {
      return false;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function writeStoredCollapsed(storageKey: string, collapsed: boolean): void {
  try {
    window.localStorage.setItem(storageKey, String(collapsed));
  } catch {
    // Keep the visible shell state even when storage is unavailable.
  }
}

function PrimaryNav(props: {
  items: AppShellNavItem[];
  className?: string;
  collapsed?: boolean;
  id?: string;
  onNavigate?: () => void;
  tone?: "sidebar" | "surface";
}) {
  const generatedId = useId();
  const navId = props.id ?? generatedId;
  const tone = props.tone ?? "sidebar";
  const baseLinkClass =
    tone === "surface"
      ? "text-foreground hover:bg-accent hover:text-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const activeLinkClass =
    tone === "surface"
      ? "bg-primary text-primary-foreground"
      : "bg-sidebar-accent text-sidebar-accent-foreground";
  const disabledLinkClass =
    tone === "surface" ? "text-muted-foreground" : "text-sidebar-foreground/45";
  const childLinkClass =
    tone === "surface"
      ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const groupBorderClass =
    tone === "surface" ? "border-border" : "border-sidebar-foreground/20";
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const toggleGroup = (href: string) => {
    setExpandedGroups((current) => ({
      ...current,
      [href]: !(current[href] ?? true),
    }));
  };

  return (
    <nav
      className={cn("space-y-1", props.className)}
      aria-label="主菜单"
      id={props.id}
    >
      {props.items.map((item, index) => {
        const children = item.children ?? [];
        const hasChildren = children.length > 0;
        const hasActiveChild = children.some((child) => child.active);
        const groupId = `${navId}-group-${String(index)}`;
        const groupExpanded =
          hasChildren &&
          (hasActiveChild || expandedGroups[item.href] !== false);
        const label = item.ariaLabel ?? item.label;
        const icon = item.icon ? (
          <span
            className="grid h-5 w-5 shrink-0 place-items-center"
            aria-hidden="true"
          >
            {item.icon}
          </span>
        ) : null;
        const content = (
          <>
            {icon}
            <span
              className={cn("min-w-0 truncate", props.collapsed && "sr-only")}
            >
              {item.label}
            </span>
            {hasChildren && !props.collapsed ? (
              <span className="ml-auto grid h-5 w-5 shrink-0 place-items-center" aria-hidden="true">
                {groupExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            ) : null}
          </>
        );
        const itemNode = item.disabled ? (
          <span
            aria-disabled="true"
            aria-label={label}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
              disabledLinkClass,
              "w-full flex-1 text-left",
              props.collapsed && "justify-center px-2",
            )}
            key={item.href}
            title={props.collapsed ? item.label : undefined}
          >
            {content}
          </span>
        ) : hasChildren && !props.collapsed ? (
          <button
            aria-controls={groupId}
            aria-expanded={groupExpanded}
            aria-label={
              hasActiveChild
                ? `${item.label}分组已展开，当前页面位于该分组下`
                : groupExpanded
                  ? `收起${item.label}子菜单`
                  : `展开${item.label}子菜单`
            }
            aria-current={item.active && !hasActiveChild ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              baseLinkClass,
              item.active && activeLinkClass,
              "w-full flex-1 text-left",
            )}
            key={item.href}
            onClick={() => {
              if (!hasActiveChild) {
                toggleGroup(item.href);
              }
            }}
            type="button"
          >
            {content}
          </button>
        ) : (
          <Link
            aria-current={item.active && !hasActiveChild ? "page" : undefined}
            aria-label={label}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              baseLinkClass,
              item.active && activeLinkClass,
              "w-full flex-1 text-left",
              props.collapsed && "justify-center px-2",
            )}
            key={item.href}
            onClick={props.onNavigate}
            title={props.collapsed ? item.label : undefined}
            to={item.href}
          >
            {content}
          </Link>
        );
        if (!props.collapsed) {
          return (
            <div key={item.href} className="space-y-1">
              <div className="flex items-center">
                {itemNode}
              </div>
              {hasChildren && groupExpanded ? (
                <div
                  className={cn(
                    "ml-5 space-y-1 border-l pl-3",
                    groupBorderClass,
                  )}
                  id={groupId}
                >
                  {children.map((child) => {
                    const childLabel = child.ariaLabel ?? child.label;
                    if (child.disabled) {
                      return (
                        <span
                          aria-disabled="true"
                          aria-label={childLabel}
                          className={cn(
                            "flex min-h-9 items-center rounded-md px-3 text-sm font-medium",
                            disabledLinkClass,
                          )}
                          key={child.href}
                        >
                          <span className="min-w-0 truncate">
                            {child.label}
                          </span>
                        </span>
                      );
                    }
                    return (
                      <Link
                        aria-current={child.active ? "page" : undefined}
                        aria-label={childLabel}
                        className={cn(
                          "flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                          childLinkClass,
                          child.active && activeLinkClass,
                        )}
                        key={child.href}
                        onClick={props.onNavigate}
                        to={child.href}
                      >
                        {child.icon ? (
                          <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">
                            {child.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{itemNode}</TooltipTrigger>
            <TooltipContent side="right">
              <div className="space-y-1">
                <div className="font-medium">{item.label}</div>
                {hasChildren ? (
                  <div className="max-w-52 text-xs text-muted-foreground">
                    {children.map((child) => child.label).join(" / ")}
                  </div>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
