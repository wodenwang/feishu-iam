import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TabsList } from "../ui/tabs";

export function ResponsiveTabsList(props: {
  children: ReactNode;
  className?: string;
  "aria-label": string;
}) {
  return (
    <div
      className="min-w-0 max-w-full overflow-x-auto pb-1"
      data-testid="responsive-tabs-scroll"
    >
      <TabsList
        aria-label={props["aria-label"]}
        className={cn("w-max min-w-full justify-start", props.className)}
      >
        {props.children}
      </TabsList>
    </div>
  );
}
