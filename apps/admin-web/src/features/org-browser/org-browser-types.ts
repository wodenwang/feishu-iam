import type { PageResult } from "../../api/feishu";
import type { IamRoleSubject } from "../../api/permission";

export type OrgBrowserDepartment = {
  departmentId: string;
  name: string;
  parentDepartmentId?: string | null;
  isDeleted?: boolean;
};

export type OrgBrowserUser = {
  userId: string;
  name: string;
  isActive?: boolean;
  isDeleted?: boolean;
};

export type OrgBrowserSelection = {
  orgSubjects: string[];
  userSubjects: string[];
};

export type OrgBrowserSelectionMeta = {
  displayPath: string;
};

export type OrgBrowserLoadDepartments = (input: {
  keyword?: string;
  parentDepartmentId?: string | null;
  page: number;
  pageSize: number;
}) => Promise<PageResult<OrgBrowserDepartment>>;

export type OrgBrowserLoadUsers = (input: {
  keyword?: string;
  departmentId?: string;
  page: number;
  pageSize: number;
}) => Promise<PageResult<OrgBrowserUser>>;

export type SubjectDiff = {
  added: IamRoleSubject[];
  removed: IamRoleSubject[];
};

export function splitRoleSubjects(subjects: IamRoleSubject[]): OrgBrowserSelection {
  return {
    orgSubjects: subjects
      .filter((subject) => subject.type === "feishu_department")
      .map((subject) => subject.id),
    userSubjects: subjects
      .filter((subject) => subject.type === "feishu_user")
      .map((subject) => subject.id),
  };
}

export function toRoleSubjects(selection: OrgBrowserSelection): IamRoleSubject[] {
  return [
    ...selection.orgSubjects.map((id) => ({
      type: "feishu_department" as const,
      id,
    })),
    ...selection.userSubjects.map((id) => ({
      type: "feishu_user" as const,
      id,
    })),
  ];
}

export function diffRoleSubjects(original: IamRoleSubject[], current: IamRoleSubject[]): SubjectDiff {
  return {
    added: current.filter((subject) => !original.some((item) => sameSubject(item, subject))),
    removed: original.filter((subject) => !current.some((item) => sameSubject(item, subject))),
  };
}

export function sameSubject(left: IamRoleSubject, right: IamRoleSubject): boolean {
  return left.type === right.type && left.id === right.id;
}

export function subjectKey(subject: IamRoleSubject): string {
  return `${subject.type}:${subject.id}`;
}
