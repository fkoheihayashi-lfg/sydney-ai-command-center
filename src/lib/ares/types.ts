export type Priority = "高" | "中" | "低";
export type ProjectStatus = "進行中" | "設計中" | "準備中" | "保留" | "完了";

export type ProjectGroup = {
  id: string;
  name: string;
  color: string;
  githubProjectNumber?: number;
  githubUser?: string;
  githubOrg?: string;
};

export type AresProject = {
  id: string;
  rank: number;
  name: string;
  progress: number;
  phase: string;
  status: ProjectStatus;
  nextAction: string;
  due: string;
  priority: Priority;
  blocker: string;
  note: string;
  color: "blue" | "teal" | "purple" | "orange";
};

export type MemberStatus = {
  id: string;
  name: string;
  project: string;
  currentTask: string;
  status: "進行中" | "完了" | "ブロック" | "待機中";
  blocker: string;
  lastUpdate: string;
  nextAction: string;
  source: "manual" | "github" | "discord";
};

export type AresNotification = {
  id: string;
  type: "Discord" | "GitHub" | "Calendar";
  title: string;
  body: string;
  time: string;
};

export type CommandLogEntry = {
  id: string;
  time: string;
  text: string;
};

export type AresMemberStatus = "Active" | "Idle" | "Blocked";

export type MemberRole = "Owner" | "Dev" | "Design" | "PM" | "Other";

export type AresMember = {
  id: string;
  name: string;
  role: MemberRole;
  currentTask: string;
  status: AresMemberStatus;
};
