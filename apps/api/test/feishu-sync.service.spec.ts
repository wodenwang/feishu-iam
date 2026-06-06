import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { MockFeishuClient } from "../src/feishu/mock-feishu.client";
import { FeishuSyncService } from "../src/feishu/feishu-sync.service";
import { FeishuClientError } from "../src/feishu/feishu.types";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

class FakeModel {
  rows = new Map<string, Row>();

  constructor(
    private readonly keyOf: (data: Row) => string,
    private readonly options: { singleRunning?: boolean } = {},
  ) {}

  snapshot(): Map<string, Row> {
    return new Map(
      Array.from(this.rows.entries()).map(([key, row]) => [key, { ...row }]),
    );
  }

  restore(rows: Map<string, Row>): void {
    this.rows = new Map(
      Array.from(rows.entries()).map(([key, row]) => [key, { ...row }]),
    );
  }

  create(args: { data: Row }): Promise<Row> {
    if (
      this.options.singleRunning === true &&
      args.data.status === "running" &&
      Array.from(this.rows.values()).some((row) => row.status === "running")
    ) {
      throw new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "fake",
          meta: { target: ["status"] },
        },
      );
    }

    const row = { ...args.data };
    this.rows.set(this.keyOf(row), row);
    return Promise.resolve(row);
  }

  findFirst(args?: {
    where?: Where;
    orderBy?: Record<string, string>;
  }): Promise<Row | null> {
    const rows = this.filterRows(args?.where);
    if (args?.orderBy?.startedAt === "desc") {
      return Promise.resolve(
        rows.sort((a, b) =>
          String(b.startedAt).localeCompare(String(a.startedAt)),
        )[0] ?? null,
      );
    }
    return Promise.resolve(rows[0] ?? null);
  }

  findMany(args?: {
    where?: Where;
    orderBy?: Record<string, string>;
    take?: number;
  }): Promise<Row[]> {
    let rows = this.filterRows(args?.where);
    if (args?.orderBy?.startedAt === "desc") {
      rows = rows.sort((a, b) =>
        String(b.startedAt).localeCompare(String(a.startedAt)),
      );
    }
    return Promise.resolve(
      typeof args?.take === "number" ? rows.slice(0, args.take) : rows,
    );
  }

  findUnique(args: { where: Where }): Promise<Row | null> {
    const key = this.keyFromWhere(args.where);
    return Promise.resolve(
      (key ? this.rows.get(key) : undefined) ??
        this.filterRows(args.where)[0] ??
        null,
    );
  }

  count(args?: { where?: Where }): Promise<number> {
    return Promise.resolve(this.filterRows(args?.where).length);
  }

  upsert(args: { where: Where; create: Row; update: Row }): Promise<Row> {
    const key = this.keyFromWhere(args.where) || this.keyOf(args.create);
    const existing = this.rows.get(key);
    const row = existing ? { ...existing, ...args.update } : { ...args.create };
    this.rows.set(key, row);
    return Promise.resolve(row);
  }

  update(args: { where: Where; data: Row }): Promise<Row> {
    const key = this.keyFromWhere(args.where);
    const existing = this.rows.get(key);
    if (!existing) {
      throw new Error(`missing row ${key}`);
    }
    const row = { ...existing, ...args.data };
    const nextKey = this.keyOf(row);
    if (nextKey !== key) {
      this.rows.delete(key);
    }
    this.rows.set(nextKey, row);
    return Promise.resolve(row);
  }

  updateMany(args: { where?: Where; data: Row }): Promise<{ count: number }> {
    let count = 0;
    for (const [key, row] of this.rows) {
      if (this.matchesWhere(row, args.where)) {
        this.rows.set(key, { ...row, ...args.data });
        count += 1;
      }
    }
    return Promise.resolve({ count });
  }

  private filterRows(where?: Where): Row[] {
    return Array.from(this.rows.values()).filter((row) =>
      this.matchesWhere(row, where),
    );
  }

  private matchesWhere(row: Row, where?: Where): boolean {
    if (!where) {
      return true;
    }

    return Object.entries(where).every(([key, value]) => {
      const rowValue = row[key];
      if (value && typeof value === "object" && "notIn" in value) {
        return !(value.notIn as unknown[]).includes(rowValue);
      }
      if (value && typeof value === "object" && "lt" in value) {
        return (
          new Date(String(rowValue)).getTime() <
          new Date(String(value.lt)).getTime()
        );
      }
      return rowValue === value;
    });
  }

  private keyFromWhere(where: Where): string {
    if (isScalarKey(where.id)) {
      return String(where.id);
    }
    if (isScalarKey(where.userId) && isScalarKey(where.departmentId)) {
      return `${String(where.userId)}:${String(where.departmentId)}`;
    }
    if (isScalarKey(where.departmentId)) {
      return String(where.departmentId);
    }
    if (isScalarKey(where.userId)) {
      return String(where.userId);
    }
    if (
      where.userId_departmentId &&
      typeof where.userId_departmentId === "object"
    ) {
      const compound = where.userId_departmentId as {
        userId: string;
        departmentId: string;
      };
      return `${compound.userId}:${compound.departmentId}`;
    }
    return "";
  }
}

function isScalarKey(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

class FakePrisma {
  feishuDepartment = new FakeModel((row) => String(row.departmentId));
  feishuUser = new FakeModel((row) => String(row.userId));
  feishuUserDepartment = new FakeModel(
    (row) => `${String(row.userId)}:${String(row.departmentId)}`,
  );
  feishuSyncRun = new FakeModel((row) => String(row.id), {
    singleRunning: true,
  });

  async $transaction<T>(callback: (tx: FakePrisma) => Promise<T>): Promise<T> {
    const snapshots = {
      feishuDepartment: this.feishuDepartment.snapshot(),
      feishuUser: this.feishuUser.snapshot(),
      feishuUserDepartment: this.feishuUserDepartment.snapshot(),
      feishuSyncRun: this.feishuSyncRun.snapshot(),
    };

    try {
      return await callback(this);
    } catch (error) {
      this.feishuDepartment.restore(snapshots.feishuDepartment);
      this.feishuUser.restore(snapshots.feishuUser);
      this.feishuUserDepartment.restore(snapshots.feishuUserDepartment);
      this.feishuSyncRun.restore(snapshots.feishuSyncRun);
      throw error;
    }
  }
}

describe("FeishuSyncService", () => {
  it("同步部门、用户和用户部门关系", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      {
        "0": [
          {
            department_id: "D001",
            open_department_id: "od-001",
            parent_department_id: "0",
            name: "总部",
            status: { is_deleted: false },
          },
        ],
      },
      {
        D001: [
          {
            user_id: "u001",
            open_id: "ou_001",
            union_id: "on_001",
            name: "张三",
            status: {
              is_frozen: false,
              is_resigned: false,
              is_activated: true,
              is_exited: false,
              is_unjoin: false,
            },
            department_ids: ["D001"],
            orders: [
              {
                department_id: "D001",
                user_order: 10,
                department_order: 20,
                is_primary_dept: true,
              },
            ],
          },
        ],
      },
    );

    const service = new FeishuSyncService(prisma as never, client);
    const result = await service.runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.status).toBe("success");
    expect(result.departmentCreatedCount).toBe(1);
    expect(result.userCreatedCount).toBe(1);
    expect(result.relationCreatedCount).toBe(1);
    expect(prisma.feishuDepartment.rows.has("D001")).toBe(true);
    expect(prisma.feishuUser.rows.get("u001")?.isActive).toBe(true);
    expect(prisma.feishuUserDepartment.rows.get("u001:D001")?.isPrimary).toBe(
      true,
    );
  });

  it("重复同步使用 upsert 更新已有镜像", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001"],
          },
        ],
      },
    );

    const service = new FeishuSyncService(prisma as never, client);
    await service.runFullSync({ triggeredBy: "test", triggerSource: "test" });
    const result = await service.runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.departmentUpdatedCount).toBe(1);
    expect(result.userUpdatedCount).toBe(1);
    expect(result.relationUpdatedCount).toBe(1);
    expect(prisma.feishuDepartment.rows.size).toBe(1);
    expect(prisma.feishuUser.rows.size).toBe(1);
    expect(prisma.feishuUserDepartment.rows.size).toBe(1);
  });

  it("部门缺少 department_id 时使用 open_department_id 作为本地部门主键", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      {
        "0": [{ open_department_id: "od-001", parent_department_id: "0" }],
      },
      {
        "0": [],
        "od-001": [],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.status).toBe("success");
    expect(result.departmentCreatedCount).toBe(1);
    expect(prisma.feishuDepartment.rows.get("od-001")?.departmentId).toBe(
      "od-001",
    );
    expect(prisma.feishuDepartment.rows.get("od-001")?.openDepartmentId).toBe(
      "od-001",
    );
    expect(prisma.feishuDepartment.rows.get("od-001")?.name).toBe("od-001");
  });

  it("飞书后续返回自定义 department_id 时按 open_department_id 更新旧部门镜像主键", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: {
        departmentId: "od-001",
        openDepartmentId: "od-001",
        parentDepartmentId: "0",
        name: "旧部门",
        status: {},
        rawPayload: { open_department_id: "od-001" },
        lastSyncedAt: new Date("2026-05-15T00:00:00.000Z"),
        isDeleted: false,
      },
    });
    const client = new MockFeishuClient(
      {
        "0": [
          {
            department_id: "D001",
            open_department_id: "od-001",
            parent_department_id: "0",
            name: "新部门",
          },
        ],
      },
      {
        "0": [],
        D001: [],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.status).toBe("success");
    expect(result.departmentCreatedCount).toBe(0);
    expect(result.departmentUpdatedCount).toBe(1);
    expect(prisma.feishuDepartment.rows.size).toBe(1);
    expect(prisma.feishuDepartment.rows.has("od-001")).toBe(false);
    expect(prisma.feishuDepartment.rows.get("D001")?.openDepartmentId).toBe(
      "od-001",
    );
    expect(prisma.feishuDepartment.rows.get("D001")?.name).toBe("新部门");
  });

  it("用户缺少 name 和 department_ids 时使用 user_id 占位并绑定当前部门", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      {
        "0": [{ open_department_id: "od-001" }],
      },
      {
        "0": [],
        "od-001": [{ user_id: "u001", open_id: "ou_001", union_id: "on_001" }],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.userCreatedCount).toBe(1);
    expect(result.relationCreatedCount).toBe(1);
    expect(prisma.feishuUser.rows.get("u001")?.name).toBe("u001");
    expect(prisma.feishuUser.rows.get("u001")?.isActive).toBe(false);
    expect(prisma.feishuUserDepartment.rows.has("u001:od-001")).toBe(true);
  });

  it("飞书遗漏曾经存在的可空字段时清空本地旧值", async () => {
    const prisma = new FakePrisma();
    const firstClient = new MockFeishuClient(
      {
        "0": [
          {
            department_id: "D001",
            open_department_id: "od-001",
            parent_department_id: "0",
            name: "总部",
            i18n_name: { zh_cn: "总部" },
            leader_user_id: "u-leader",
          },
        ],
      },
      {
        D001: [
          {
            user_id: "u001",
            open_id: "ou_001",
            union_id: "on_001",
            name: "张三",
            en_name: "San Zhang",
            email: "zhangsan@example.com",
            mobile: "13800000000",
            mobile_visible: true,
            avatar: { avatar_72: "avatar-key" },
            employee_no: "E001",
            employee_type: 1,
            job_title: "工程师",
            leader_user_id: "u-leader",
            status: { is_activated: true },
            department_ids: ["D001"],
            orders: [
              { department_id: "D001", user_order: 10, department_order: 20 },
            ],
          },
        ],
      },
    );
    await new FeishuSyncService(prisma as never, firstClient).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    const secondClient = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001"],
            orders: [{ department_id: "D001" }],
          },
        ],
      },
    );
    await new FeishuSyncService(prisma as never, secondClient).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(
      prisma.feishuDepartment.rows.get("D001")?.openDepartmentId,
    ).toBeNull();
    expect(prisma.feishuDepartment.rows.get("D001")?.i18nName).toBe(
      Prisma.DbNull,
    );
    expect(prisma.feishuDepartment.rows.get("D001")?.leaderUserId).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.openId).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.unionId).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.enName).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.email).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.mobile).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.mobileVisible).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.avatar).toBe(Prisma.DbNull);
    expect(prisma.feishuUser.rows.get("u001")?.employeeNo).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.employeeType).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.jobTitle).toBeNull();
    expect(prisma.feishuUser.rows.get("u001")?.leaderUserId).toBeNull();
    expect(
      prisma.feishuUserDepartment.rows.get("u001:D001")?.userOrder,
    ).toBeNull();
    expect(
      prisma.feishuUserDepartment.rows.get("u001:D001")?.departmentOrder,
    ).toBeNull();
  });

  it("用户冻结后 isActive 为 false", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_frozen: true, is_activated: true },
            department_ids: ["D001"],
          },
        ],
      },
    );

    const service = new FeishuSyncService(prisma as never, client);
    await service.runFullSync({ triggeredBy: "test", triggerSource: "test" });

    expect(prisma.feishuUser.rows.get("u001")?.isActive).toBe(false);
  });

  it("同一用户出现在多个部门时本次同步只计数一次", async () => {
    const prisma = new FakePrisma();
    const user = {
      user_id: "u001",
      name: "张三",
      status: { is_activated: true },
      department_ids: ["D001", "D002"],
    };
    const client = new MockFeishuClient(
      {
        "0": [
          { department_id: "D001", name: "总部" },
          { department_id: "D002", name: "研发" },
        ],
      },
      {
        D001: [user],
        D002: [user],
      },
    );

    const service = new FeishuSyncService(prisma as never, client);
    const result = await service.runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.userCreatedCount).toBe(1);
    expect(result.userUpdatedCount).toBe(0);
    expect(result.relationCreatedCount).toBe(2);
    expect(result.relationUpdatedCount).toBe(0);
  });

  it("飞书 user_id 变化但 open_id 相同时迁移本地用户主键", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuUser.create({
      data: {
        userId: "u-old",
        openId: "ou_001",
        unionId: "on_001",
        name: "旧用户",
        status: { is_activated: true },
        rawPayload: { user_id: "u-old", open_id: "ou_001" },
        lastSyncedAt: new Date("2026-05-17T00:00:00.000Z"),
        isActive: true,
        isDeleted: false,
      },
    });

    const client = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        D001: [
          {
            user_id: "u-new",
            open_id: "ou_001",
            union_id: "on_001",
            name: "新用户",
            status: { is_activated: true },
            department_ids: ["D001"],
          },
        ],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.userUpdatedCount).toBe(1);
    expect(result.userCreatedCount).toBe(0);
    expect(prisma.feishuUser.rows.has("u-old")).toBe(false);
    expect(prisma.feishuUser.rows.get("u-new")?.openId).toBe("ou_001");
    expect(prisma.feishuUser.rows.get("u-new")?.name).toBe("新用户");
  });

  it("同步 root 直属用户但不写入未知部门关系", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        "0": [
          {
            user_id: "u-root",
            name: "根部门用户",
            status: { is_activated: true },
            department_ids: ["0"],
          },
        ],
        D001: [],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.userCreatedCount).toBe(1);
    expect(result.relationCreatedCount).toBe(0);
    expect(prisma.feishuUser.rows.get("u-root")?.isDeleted).toBe(false);
    expect(prisma.feishuUserDepartment.rows.has("u-root:0")).toBe(false);
  });

  it("忽略用户返回的未同步部门关系", async () => {
    const prisma = new FakePrisma();
    const client = new MockFeishuClient(
      { "0": [{ department_id: "D001", name: "总部" }] },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001", "D999"],
          },
        ],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.userCreatedCount).toBe(1);
    expect(result.relationCreatedCount).toBe(1);
    expect(prisma.feishuUserDepartment.rows.has("u001:D001")).toBe(true);
    expect(prisma.feishuUserDepartment.rows.has("u001:D999")).toBe(false);
  });

  it("成功同步后标记未见用户部门关系为删除", async () => {
    const prisma = new FakePrisma();
    const firstClient = new MockFeishuClient(
      {
        "0": [
          { department_id: "D001", name: "总部" },
          { department_id: "D002", name: "研发" },
        ],
      },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001", "D002"],
          },
        ],
        D002: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001", "D002"],
          },
        ],
      },
    );
    await new FeishuSyncService(prisma as never, firstClient).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    const secondClient = new MockFeishuClient(
      {
        "0": [
          { department_id: "D001", name: "总部" },
          { department_id: "D002", name: "研发" },
        ],
      },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001"],
          },
        ],
        D002: [],
      },
    );
    const result = await new FeishuSyncService(
      prisma as never,
      secondClient,
    ).runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.relationDeletedCount).toBe(1);
    expect(prisma.feishuUserDepartment.rows.get("u001:D001")?.isDeleted).toBe(
      false,
    );
    expect(prisma.feishuUserDepartment.rows.get("u001:D002")?.isDeleted).toBe(
      true,
    );
  });

  it("已有 running run 时将唯一约束冲突映射为同步运行中错误", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuSyncRun.create({
      data: {
        id: "running-run",
        status: "running",
        triggeredBy: "test",
        triggerSource: "test",
      },
    });
    const service = new FeishuSyncService(
      prisma as never,
      new MockFeishuClient(),
    );

    await expect(
      service.runFullSync({ triggeredBy: "test", triggerSource: "test" }),
    ).rejects.toMatchObject({
      code: "FEISHU_API_ERROR",
      detail: { error_code: "FEISHU_SYNC_ALREADY_RUNNING" },
    });
    expect(prisma.feishuSyncRun.rows.size).toBe(1);
  });

  it("自动释放超时遗留的 running run 后允许新同步继续执行", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuSyncRun.create({
      data: {
        id: "stale-run",
        status: "running",
        triggeredBy: "test",
        triggerSource: "test",
        startedAt: new Date("2026-05-26T00:00:00.000Z"),
      },
    });
    const client = new MockFeishuClient({ "0": [] });
    const service = new FeishuSyncService(prisma as never, client, {
      now: () => new Date("2026-05-26T02:00:00.000Z"),
    });

    const result = await service.runFullSync({
      triggeredBy: "test",
      triggerSource: "test",
    });

    expect(result.status).toBe("success");
    expect(prisma.feishuSyncRun.rows.get("stale-run")?.status).toBe("failed");
    expect(prisma.feishuSyncRun.rows.get("stale-run")?.errorCode).toBe(
      "FEISHU_SYNC_STALE_RUNNING",
    );
    expect(prisma.feishuSyncRun.rows.size).toBe(2);
  });

  it("同步失败时不标记未见数据为删除", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: { departmentId: "D999", name: "旧部门", isDeleted: false },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u999",
        name: "旧用户",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u999", departmentId: "D999", isDeleted: false },
    });
    const client = new MockFeishuClient({
      "0": [{ department_id: "D001", name: "总部" }],
    });
    vi.spyOn(client, "listDepartmentUsers").mockRejectedValueOnce(
      new Error("network down"),
    );
    const service = new FeishuSyncService(prisma as never, client);

    await expect(
      service.runFullSync({ triggeredBy: "test", triggerSource: "test" }),
    ).rejects.toBeInstanceOf(FeishuClientError);

    expect(prisma.feishuDepartment.rows.get("D999")?.isDeleted).toBe(false);
    expect(prisma.feishuUser.rows.get("u999")?.isDeleted).toBe(false);
    expect(prisma.feishuUserDepartment.rows.get("u999:D999")?.isDeleted).toBe(
      false,
    );
    expect(
      (await prisma.feishuSyncRun.findFirst({ where: { status: "failed" } }))
        ?.errorCode,
    ).toBe("FEISHU_API_ERROR");
    expect(
      (await prisma.feishuSyncRun.findFirst({ where: { status: "failed" } }))
        ?.errorDetail,
    ).toMatchObject({
      sync_stage: "users:0",
    });
  });

  it("部门级轻量同步只刷新目标部门直属数据且不执行全局清理", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: { departmentId: "D999", name: "旧部门", isDeleted: false },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u999",
        name: "旧用户",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u999", departmentId: "D999", isDeleted: false },
    });
    const client = new MockFeishuClient(
      {
        D001: [
          {
            department_id: "D002",
            parent_department_id: "D001",
            name: "财务一组",
          },
        ],
      },
      {
        D001: [
          {
            user_id: "u001",
            name: "张三",
            status: { is_activated: true },
            department_ids: ["D001"],
          },
        ],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runDepartmentLightSync({
      triggeredBy: "admin-sync",
      triggerSource: "admin_web_department_light",
      departmentId: "D001",
    });

    expect(result.status).toBe("success");
    expect(result.departmentCreatedCount).toBe(1);
    expect(result.userCreatedCount).toBe(1);
    expect(prisma.feishuDepartment.rows.get("D999")?.isDeleted).toBe(false);
    expect(prisma.feishuUser.rows.get("u999")?.isDeleted).toBe(false);
    expect(prisma.feishuUserDepartment.rows.get("u999:D999")?.isDeleted).toBe(
      false,
    );
  });

  it("用户级轻量同步通过本地部门关系刷新目标用户且不执行全局清理", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: { departmentId: "D001", name: "总部", isDeleted: false },
    });
    await prisma.feishuDepartment.create({
      data: { departmentId: "D999", name: "旧部门", isDeleted: false },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u001",
        name: "旧张三",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u999",
        name: "旧用户",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u001", departmentId: "D001", isDeleted: false },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u999", departmentId: "D999", isDeleted: false },
    });
    const client = new MockFeishuClient(
      {},
      {
        D001: [
          {
            user_id: "u001",
            name: "新张三",
            status: { is_activated: true },
            department_ids: ["D001"],
          },
        ],
      },
    );

    const result = await new FeishuSyncService(
      prisma as never,
      client,
    ).runUserLightSync({
      triggeredBy: "admin-sync",
      triggerSource: "admin_web_user_light",
      userId: "u001",
    });

    expect(result.status).toBe("success");
    expect(result.userUpdatedCount).toBe(1);
    expect(prisma.feishuUser.rows.get("u001")?.name).toBe("新张三");
    expect(prisma.feishuUser.rows.get("u999")?.isDeleted).toBe(false);
    expect(prisma.feishuUserDepartment.rows.get("u999:D999")?.isDeleted).toBe(
      false,
    );
  });

  it("用户级轻量同步找不到目标用户时返回稳定失败且不伪造成功", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: { departmentId: "D001", name: "总部", isDeleted: false },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u001",
        name: "旧张三",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u001", departmentId: "D001", isDeleted: false },
    });
    const service = new FeishuSyncService(
      prisma as never,
      new MockFeishuClient({}, { D001: [] }),
    );

    await expect(
      service.runUserLightSync({
        triggeredBy: "admin-sync",
        triggerSource: "admin_web_user_light",
        userId: "u001",
      }),
    ).rejects.toMatchObject({
      code: "FEISHU_API_ERROR",
      detail: { error_code: "FEISHU_LIGHT_SYNC_TARGET_NOT_FOUND" },
    });
    expect(
      (await prisma.feishuSyncRun.findFirst({ where: { status: "failed" } }))
        ?.errorDetail,
    ).toMatchObject({
      error_code: "FEISHU_LIGHT_SYNC_TARGET_NOT_FOUND",
    });
  });

  it("清理开始后最终成功更新失败时回滚删除标记并记录失败", async () => {
    const prisma = new FakePrisma();
    await prisma.feishuDepartment.create({
      data: { departmentId: "D999", name: "旧部门", isDeleted: false },
    });
    await prisma.feishuUser.create({
      data: {
        userId: "u999",
        name: "旧用户",
        isDeleted: false,
        isActive: true,
      },
    });
    await prisma.feishuUserDepartment.create({
      data: { userId: "u999", departmentId: "D999", isDeleted: false },
    });

    const originalUpdate = prisma.feishuSyncRun.update.bind(
      prisma.feishuSyncRun,
    );
    vi.spyOn(prisma.feishuSyncRun, "update").mockImplementation((args) => {
      if (args.data.status === "success") {
        return Promise.reject(new Error("success run update failed"));
      }
      return originalUpdate(args);
    });

    const client = new MockFeishuClient({ "0": [] });
    const service = new FeishuSyncService(prisma as never, client);

    await expect(
      service.runFullSync({ triggeredBy: "test", triggerSource: "test" }),
    ).rejects.toBeInstanceOf(FeishuClientError);

    expect(prisma.feishuDepartment.rows.get("D999")?.isDeleted).toBe(false);
    expect(prisma.feishuUser.rows.get("u999")?.isDeleted).toBe(false);
    expect(prisma.feishuUserDepartment.rows.get("u999:D999")?.isDeleted).toBe(
      false,
    );
    expect(
      (await prisma.feishuSyncRun.findFirst({ where: { status: "failed" } }))
        ?.errorMessage,
    ).toBe("飞书同步失败");
  });
});
