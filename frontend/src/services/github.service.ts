import axios from "../config/axios";

export interface GitHubStatus {
  /** GitHub is set up on the server. */
  available: boolean;
  connected: boolean;
  login: string;
  connectedAt: string | null;
}

export interface GitHubRepo {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
  description: string;
  updatedAt: string;
}

export interface GitHubLink {
  repo: string;
  branch: string;
  lastCommit: string;
  syncedAt: string;
}

export interface ProjectGitHubStatus {
  link: GitHubLink | null;
  /** Files changed in Aivex since the last push or pull. */
  localChanges: boolean;
  /** New commits on GitHub since then. */
  remoteChanges: boolean;
}

export const getGitHubStatus = async () => (await axios.get<GitHubStatus>("/integrations/github")).data;

/** Send the browser to GitHub to connect; it comes back to `next`. */
export const connectGitHub = async (next: string) => {
  const { data } = await axios.post<{ ticket: string }>("/integrations/github/ticket", { next });
  window.location.assign(`${import.meta.env.VITE_API_URL}/auth/github/connect?ticket=${encodeURIComponent(data.ticket)}`);
};

export const disconnectGitHub = async () => {
  await axios.delete("/integrations/github");
};

export const listGitHubRepos = async () => (await axios.get<GitHubRepo[]>("/integrations/github/repos")).data;

export const importGitHubRepo = async (repo: string, branch?: string) =>
  (await axios.post<{ projectId: string; name: string; stack: string; files: number; skipped: number }>("/integrations/github/import", { repo, branch })).data;

export const getProjectGitHub = async (projectId: string) => (await axios.get<ProjectGitHubStatus>(`/projects/${projectId}/github`)).data;

export const pushToGitHub = async (projectId: string, body: {
  message?: string;
  repo?: string;
  branch?: string;
  create?: { name: string; private: boolean };
  force?: boolean;
}) => (await axios.post<{ changed: boolean; repo: string; branch: string; commit: string; url: string }>(`/projects/${projectId}/github/push`, body)).data;

export const pullFromGitHub = async (projectId: string, force = false) =>
  (await axios.post<{ changed: boolean; commit: string; files?: Record<string, string>; skipped?: number }>(`/projects/${projectId}/github/pull`, { force })).data;

export const unlinkGitHub = async (projectId: string) => {
  await axios.delete(`/projects/${projectId}/github`);
};
