import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrgUserSelector } from "./org-user-selector";

describe("OrgUserSelector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("桌面双栏布局不拉伸待选组织与用户面板", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("min-width: 1280px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <OrgUserSelector
        loadDepartments={() => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0 })}
        loadUsers={() => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0 })}
        originalSubjects={[]}
        subjects={[]}
        onSave={vi.fn()}
        onSubjectsChange={vi.fn()}
      />,
    );

    await screen.findAllByText("当前范围暂无组织或用户");

    const desktopLayout = container.querySelector(".xl\\:grid");
    expect(desktopLayout).toHaveClass("items-start");
    expect(screen.getAllByRole("region", { name: "待选组织与用户" })[0]).toHaveClass("content-start");
  });
});
