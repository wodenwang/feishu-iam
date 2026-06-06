import { describe, expect, it } from "vitest";
import { resultLabel, stageLabel } from "./trace-format";

describe("trace-format", () => {
  it("返回中文阶段和结果标签", () => {
    expect(stageLabel("admin_auth")).toBe("后台认证/授权");
    expect(stageLabel("token_exchange")).toBe("换取 token");
    expect(stageLabel("permission_query")).toBe("权限查询");
    expect(resultLabel("failed")).toBe("失败");
  });
});
