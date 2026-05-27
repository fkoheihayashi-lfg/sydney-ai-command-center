import type { AresNotification, AresProject, MemberStatus, ProjectGroup } from "./types";

export const defaultProjectGroups: ProjectGroup[] = [
  {
    id: "recipe",
    name: "Demo App",
    color: "teal",
    githubProjectNumber: undefined,
    githubUser: undefined,
  },
  {
    id: "bot-cat",
    name: "Research Bot",
    color: "purple",
  },
  {
    id: "sydney-core",
    name: "Command Center",
    color: "blue",
  },
];

export const defaultProjects: Array<AresProject & { groupId: string }> = [
  {
    id: "cat-translator",
    groupId: "bot-cat",
    rank: 1,
    name: "Demo Integration",
    progress: 78,
    phase: "Integration QA",
    status: "進行中",
    nextAction: "Add smoke tests and verify edge cases",
    due: "Demo milestone 1",
    priority: "高",
    blocker: "Waiting on sample data review",
    note: "Demo notes →",
    color: "blue",
  },
  {
    id: "bot-cat",
    groupId: "bot-cat",
    rank: 2,
    name: "Research Bot",
    progress: 86,
    phase: "Response Tuning",
    status: "進行中",
    nextAction: "Tune response quality and prompt guardrails",
    due: "Demo milestone 2",
    priority: "中",
    blocker: "Rate-limit scenario needs review",
    note: "In progress",
    color: "teal",
  },
  {
    id: "recipe-app",
    groupId: "recipe",
    rank: 3,
    name: "Demo App",
    progress: 42,
    phase: "MVP Build",
    status: "進行中",
    nextAction: "Sketch the dashboard list view and sample data model",
    due: "Demo milestone 3",
    priority: "中",
    blocker: "Sample data model needs confirmation",
    note: "Review scheduled",
    color: "purple",
  },
  {
    id: "ares-sydney",
    groupId: "sydney-core",
    rank: 4,
    name: "Command Center",
    progress: 35,
    phase: "Research",
    status: "準備中",
    nextAction: "Compare dashboard workflows and refine demo scope",
    due: "Demo milestone 4",
    priority: "低",
    blocker: "Collecting reference examples",
    note: "Research continuing",
    color: "orange",
  },
];

export const topTasks = [
  { id: 1, title: "Demo Integration QA", priority: "高", estimate: "2.5h" },
  { id: 2, title: "Research Bot response tuning", priority: "中", estimate: "1.5h" },
  { id: 3, title: "Active Focus review", priority: "低", estimate: "1.0h" },
] as const;

export const memberStatuses: MemberStatus[] = [
  {
    id: "alex",
    name: "Alex",
    project: "Research Bot",
    currentTask: "Response tuning",
    status: "進行中",
    blocker: "",
    lastUpdate: "Manual update",
    nextAction: "Finish prompt guardrail pass",
    source: "manual",
  },
  {
    id: "jordan",
    name: "Jordan",
    project: "Demo Integration",
    currentTask: "Integration QA",
    status: "進行中",
    blocker: "Sample data variance",
    lastUpdate: "Manual update",
    nextAction: "Run edge-case smoke test",
    source: "manual",
  },
  {
    id: "taylor",
    name: "Taylor",
    project: "Demo App",
    currentTask: "Sample data model",
    status: "待機中",
    blocker: "Waiting for model review",
    lastUpdate: "Manual update",
    nextAction: "Apply review feedback",
    source: "manual",
  },
];

export const notifications: AresNotification[] = [
  {
    id: "discord-general",
    type: "Discord",
    title: "#general",
    body: "新しいメッセージがあります",
    time: "2分前",
  },
  {
    id: "github-pr",
    type: "GitHub",
    title: "pull request #128",
    body: "Demo Integration: update README copy",
    time: "15分前",
  },
  {
    id: "calendar-checkin",
    type: "Calendar",
    title: "カレンダー",
    body: "10:30 - 11:00　定例チェックイン",
    time: "1時間前",
  },
];

export const studyDay = {
  dayNumber: 5,
  title: "workflow review",
  summary:
    "Review the demo workflow, identify one blocker, and write the next safest project action.",
  criteria: "Can summarize the current project state and next action",
};
