import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export type PageBreadcrumb = {
  label: string;
  href?: string;
  current?: boolean;
};

export function PageHeader(props: {
  title: string;
  description?: string;
  breadcrumbs?: PageBreadcrumb[];
  badges?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b bg-background px-6 py-5 lg:flex-row lg:items-start lg:justify-between",
        props.className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {props.breadcrumbs && props.breadcrumbs.length > 0 ? (
          <Breadcrumbs items={props.breadcrumbs} />
        ) : null}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-normal text-foreground">
              {props.title}
            </h1>
            {props.badges}
          </div>
          {props.description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {props.description}
            </p>
          ) : null}
        </div>
      </div>
      {props.primaryAction || props.secondaryActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {props.secondaryActions}
          {props.primaryAction}
        </div>
      ) : null}
    </header>
  );
}

function Breadcrumbs({ items }: { items: PageBreadcrumb[] }) {
  return (
    <nav aria-label="面包屑" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li
            className="flex items-center gap-1.5"
            key={`${item.label}:${String(index)}`}
          >
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && !item.current ? (
              <Link className="hover:text-foreground" to={item.href}>
                {item.label}
              </Link>
            ) : (
              <span aria-current={item.current ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
