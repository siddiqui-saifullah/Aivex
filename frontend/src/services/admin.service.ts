import axios from "../config/axios";

export interface DayCount {
  day: string;
  count: number;
}

export interface AdminOverview {
  totals: { users: number; projects: number; classrooms: number; messages: number; aiReplies: number };
  active: { today: number; last7d: number; last30d: number };
  lastActivity: { username: string; at: string } | null;
  series: { activeUsers: DayCount[]; signups: DayCount[]; projectsCreated: DayCount[]; aiReplies: DayCount[] };
  stacks: { stack: string; count: number }[];
  generatedAt: string;
}

export interface AdminUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
  lastActiveAt: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  lastProject: { project: string; name: string; at: string } | null;
  projectsOwned: number;
  projectsShared: number;
}

export interface AdminProject {
  _id: string;
  name: string;
  stack: string;
  owner: string | null;
  members: number;
  pendingInvites: number;
  isClassProject: boolean;
  messages: number;
  createdAt: string;
  lastEditedAt: string;
  lastOpenedAt: string | null;
  lastOpenedBy: string | null;
  openCount: number;
}

export interface Page<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

/** True for admins; anyone else gets a 404 from the server. */
export const checkIsAdmin = async () => {
  try {
    const { data } = await axios.get<{ isAdmin: boolean }>("/admin/me");
    return Boolean(data?.isAdmin);
  } catch {
    return false;
  }
};

export const getAdminOverview = async () => (await axios.get<AdminOverview>("/admin/overview")).data;

export const getAdminUsers = async (params: { q?: string; sort?: string; page?: number }): Promise<Page<AdminUser>> => {
  const { data } = await axios.get<{ total: number; page: number; pageSize: number; users: AdminUser[] }>(
    "/admin/users",
    { params },
  );
  return { total: data.total, page: data.page, pageSize: data.pageSize, items: data.users };
};

export const getAdminProjects = async (params: {
  q?: string;
  sort?: string;
  page?: number;
}): Promise<Page<AdminProject>> => {
  const { data } = await axios.get<{ total: number; page: number; pageSize: number; projects: AdminProject[] }>(
    "/admin/projects",
    { params },
  );
  return { total: data.total, page: data.page, pageSize: data.pageSize, items: data.projects };
};
