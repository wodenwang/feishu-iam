import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPermissionMatrix,
  fetchIamRolesAcrossApplications,
  replaceIamRolePermissionGroups,
  setIamRoleApplicationBindingStatus,
  type Application,
} from "./permission";

const applications: Application[] = [
  {
    id: "app-base",
    appKey: "base-portal",
    name: "Base Portal",
    status: "active",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "app-hr",
    appKey: "hr",
    name: "HR Portal",
    status: "active",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  },
];

describe("permission api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges the same global role returned from multiple applications", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const textUrl = readRequestUrl(url);
      if (textUrl.includes("/base-portal/iam-roles")) {
        return jsonResponse({
          items: [
            {
              id: "role-shared",
              key: "ops_admin",
              name: "运维管理员",
              status: "active",
              applications: [
                {
                  application_id: "app-base",
                  app_key: "base-portal",
                  name: "Base Portal",
                  status: "active",
                  binding_status: "active",
                },
              ],
              permission_groups: [
                {
                  id: "group-base",
                  applicationId: "app-base",
                  key: "base-portal.ops",
                  name: "Base 权限组",
                  status: "active",
                  createdAt: "2026-06-20T10:00:00.000Z",
                  updatedAt: "2026-06-20T10:00:00.000Z",
                },
              ],
              permission_group_ids: ["group-base"],
              permission_points: [
                {
                  id: "point-base",
                  applicationId: "app-base",
                  key: "base-portal.deploy",
                  name: "应用部署",
                  status: "active",
                  createdAt: "2026-06-20T10:00:00.000Z",
                  updatedAt: "2026-06-20T10:00:00.000Z",
                },
              ],
              createdAt: "2026-06-20T10:00:00.000Z",
              updatedAt: "2026-06-20T10:00:00.000Z",
            },
          ],
        });
      }

      return jsonResponse({
        items: [
          {
            id: "role-shared",
            key: "ops_admin",
            name: "运维管理员",
            status: "active",
            applications: [
              {
                application_id: "app-hr",
                app_key: "hr",
                name: "HR Portal",
                status: "active",
                binding_status: "active",
              },
            ],
            permission_groups: [
              {
                id: "group-hr",
                applicationId: "app-hr",
                key: "hr.ops",
                name: "HR 权限组",
                status: "active",
                createdAt: "2026-06-20T10:00:00.000Z",
                updatedAt: "2026-06-20T10:00:00.000Z",
              },
            ],
            permission_group_ids: ["group-hr"],
            permission_points: [
              {
                id: "point-hr",
                applicationId: "app-hr",
                key: "hr.user.manage",
                name: "用户管理",
                status: "active",
                createdAt: "2026-06-20T10:00:00.000Z",
                updatedAt: "2026-06-20T10:00:00.000Z",
              },
            ],
            createdAt: "2026-06-20T10:00:00.000Z",
            updatedAt: "2026-06-20T10:00:00.000Z",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roles = await fetchIamRolesAcrossApplications(applications);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({
      id: "role-shared",
      key: "ops_admin",
      appKeys: ["base-portal", "hr"],
      applicationIds: ["app-base", "app-hr"],
      permissionGroupIds: ["group-base", "group-hr"],
    });
    expect(roles[0]?.applications?.map((application) => application.appKey)).toEqual([
      "base-portal",
      "hr",
    ]);
    expect(roles[0]?.permissionGroups?.map((group) => group.key)).toEqual([
      "base-portal.ops",
      "hr.ops",
    ]);
    expect(roles[0]?.permissionPoints?.map((point) => point.key)).toEqual([
      "base-portal.deploy",
      "hr.user.manage",
    ]);
  });

  it("saves role permission groups with the new groupIds request body", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await replaceIamRolePermissionGroups("base-portal", "role-1", [
      "group-a",
      "group-b",
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/applications/base-portal/iam-roles/role-1/permission-groups",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds: ["group-a", "group-b"] }),
        credentials: "include",
      }),
    );
  });

  it("patches IAM role application binding status", async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({
        id: "role-1",
        app_key: "crm",
        key: "crm.operator",
        name: "CRM 操作员",
        status: "active",
        createdAt: "2026-06-21T00:00:00.000Z",
        updatedAt: "2026-06-21T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await setIamRoleApplicationBindingStatus("crm", "role-1", "disabled");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/applications/crm/iam-roles/role-1/application-binding",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
        credentials: "include",
      }),
    );
  });

  it("fetches permission matrix by subject", async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({
        subject: { type: "user", id: "user-1", name: "张三" },
        scope_note: "用户查询包含直接用户绑定和用户所属组织绑定。",
        applications: [],
        computed_at: "2026-06-21T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchPermissionMatrix({ subjectType: "user", subjectId: "user-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/permission-matrix?subjectType=user&subjectId=user-1",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response;
}

function readRequestUrl(url: string | URL | Request): string {
  if (typeof url === "string") {
    return url;
  }
  if (url instanceof URL) {
    return url.href;
  }
  return url.url;
}
