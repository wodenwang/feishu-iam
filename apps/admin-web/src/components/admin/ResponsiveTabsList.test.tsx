import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsTrigger } from "../ui/tabs";
import { ResponsiveTabsList } from "./ResponsiveTabsList";

describe("ResponsiveTabsList", () => {
  it("wraps TabsList in a horizontal scroll region with an accessible label", () => {
    render(
      <Tabs defaultValue="trace">
        <ResponsiveTabsList aria-label="操作审计标签">
          <TabsTrigger value="trace">追踪</TabsTrigger>
          <TabsTrigger value="audit">审计日志</TabsTrigger>
          <TabsTrigger value="security">安全事件</TabsTrigger>
          <TabsTrigger value="sync">同步记录</TabsTrigger>
          <TabsTrigger value="tokens">登录与 Token 记录</TabsTrigger>
        </ResponsiveTabsList>
      </Tabs>,
    );

    expect(screen.getByRole("tablist", { name: "操作审计标签" })).toBeInTheDocument();
    expect(screen.getByTestId("responsive-tabs-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("tab", { name: "登录与 Token 记录" })).toBeInTheDocument();
  });
});
