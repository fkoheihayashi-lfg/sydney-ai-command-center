"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  Code2,
  Edit3,
  Github,
  LineChart,
  ListChecks,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  TriangleAlert,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sortProjectsForAttention } from "@/lib/ares/priorityEngine";
import { defaultProjectGroups, defaultProjects, memberStatuses, notifications, studyDay, topTasks } from "@/lib/ares/seedData";
import type { AresMember, AresNotification, AresProject, CommandLogEntry, MemberRole, MemberStatus, ProjectGroup, ProjectStatus } from "@/lib/ares/types";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const priorityStyles = {
  高: "border-red-400/60 bg-red-500/15 text-red-200 shadow-[0_0_16px_rgba(239,68,68,0.18)]",
  中: "border-amber-400/60 bg-amber-500/15 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.16)]",
  低: "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.14)]",
} as const;

const statusStyles = {
  進行中: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  学習中: "border-cyan-400/50 bg-cyan-500/15 text-cyan-200",
  設計中: "border-amber-400/50 bg-amber-500/15 text-amber-200",
  準備中: "border-slate-400/40 bg-slate-500/15 text-slate-200",
  保留: "border-slate-500/50 bg-slate-700/40 text-slate-300",
  完了: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  未完了: "border-amber-400/50 bg-amber-500/15 text-amber-200",
  困ってる: "border-red-400/50 bg-red-500/15 text-red-200",
  ブロック: "border-red-400/50 bg-red-500/15 text-red-200",
  待機中: "border-slate-400/40 bg-slate-500/15 text-slate-200",
  未接続: "border-slate-500/50 bg-slate-700/35 text-slate-300",
  接続予定: "border-blue-400/50 bg-blue-500/15 text-blue-200",
  Mock: "border-cyan-400/50 bg-cyan-500/15 text-cyan-200",
} as const;

const priorityLeftBorderStyles = {
  高: "border-l-4 border-l-red-500",
  中: "border-l-4 border-l-amber-400",
  低: "border-l-4 border-l-teal-500",
} as const;

const priorityProgressStyles = {
  高: "bg-red-500",
  中: "bg-amber-400",
  低: "bg-teal-500",
} as const;

const projectGroupDotStyles: Record<string, string> = {
  teal: "bg-teal-500",
  purple: "bg-purple-400",
  blue: "bg-blue-400",
};

const aresMemberRoles: MemberRole[] = ["Owner", "Dev", "Design", "PM", "Other"];
const aresMemberStatuses: Array<AresMember["status"]> = ["Active", "Idle", "Blocked"];

const memberStatusStyles: Record<AresMember["status"], string> = {
  Active: "border border-teal-800/50 bg-teal-900/40 text-teal-400",
  Idle: "border border-gray-700 bg-gray-800 text-gray-400",
  Blocked: "border border-red-800/50 bg-red-900/40 text-red-400",
};

const PROJECT_STATUS_ORDER: ProjectStatus[] = ["進行中", "設計中", "準備中", "保留", "完了"];
const GITHUB_MISSING_ENV_MESSAGE = "GitHub Projects env vars are not connected yet. Add GITHUB_TOKEN, exactly one of GITHUB_USER or GITHUB_ORG, and GITHUB_PROJECT_NUMBER locally in .env.local.";
const GITHUB_SAFE_FAILURE_MESSAGE = "GitHub Projects read failed safely. Check local env values and token permissions.";
const GITHUB_PROJECTS_SUMMARY_UNAVAILABLE_MESSAGE = "GitHub Projects read-only source unavailable or not configured.";
const GITHUB_PROJECTS_CANONICAL_ROUTE = "/api/integrations/github/projects";
const GITHUB_WORKSPACE_ROUTE = "/api/integrations/github/workspace";
const GITHUB_WORKSPACE_NOT_CONFIGURED_MESSAGE = "Connect GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPOS in .env.local to load live repo activity.";
const GITHUB_WORKSPACE_SAFE_FAILURE_MESSAGE = "GitHub Workspace read failed safely. Check local env values and repo access.";
const GITHUB_ACTIVITY_ROUTE = "/api/integrations/github/activity";
const GITHUB_ACTIVITY_REPO_NOT_CONFIGURED_MESSAGE = "GitHub repo is not configured. Add GITHUB_REPO locally to enable GitHub Activity.";
const PROJECT_SUMMARY_ROUTE = "/api/ai/project-summary";
const APPROVED_DRAFT_POST_NO_DRAFT_MESSAGE = "Generate a summary draft before posting to Discord.";
const APPROVED_DRAFT_POST_NEEDS_APPROVAL_MESSAGE = "Approve the AI draft before posting to Discord.";
const APPROVED_DRAFT_POST_FAILURE_MESSAGE = "Discord post failed safely. Check local configuration and try again.";
const GITHUB_PROJECTS_SUMMARY_ITEM_LIMIT = 8;
const GITHUB_PROJECTS_SUMMARY_ARRAY_LIMIT = 5;
const GITHUB_PROJECTS_SUMMARY_TEXT_LIMIT = 160;

const createDailyReviewEventId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const safeCopyText = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to a temporary textarea for browsers that block clipboard writes.
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const textarea = document.createElement("textarea");
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let didCopy = false;
  const writeClipboardData = (event: ClipboardEvent) => {
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
  };

  try {
    document.addEventListener("copy", writeClipboardData);
    didCopy = document.execCommand("copy");
  } catch {
    didCopy = false;
  } finally {
    document.removeEventListener("copy", writeClipboardData);
    document.body.removeChild(textarea);
    activeElement?.focus({ preventScroll: true });
  }

  return didCopy;
};

const EMPTY_PROJECT_FORM = {
  name: "",
  phase: "New demo phase",
  progress: 0,
  status: "準備中" as ProjectStatus,
  nextAction: "",
  due: "",
  priority: "中" as const,
  blocker: "",
  note: "Demo notes ->",
  color: "blue" as const,
};

type DateTimeDisplay = {
  dateLabel: string;
  timeLabel: string;
  periodLabel: string;
  timezoneLabel: string;
};

type WeatherStatus = "loading" | "ready" | "unavailable";

type WeatherDisplay = {
  status: WeatherStatus;
  temperatureC: number | null;
  condition: string;
  updatedAt: string;
};

function formatLocalDateTime(date: Date, language: LanguageMode): DateTimeDisplay {
  const dateParts = new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: language === "en" ? "short" : "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);
  const getDatePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? "";
  const getTimePart = (type: Intl.DateTimeFormatPartTypes) => timeParts.find((part) => part.type === type)?.value ?? "";

  return {
    dateLabel: language === "en"
      ? `${getDatePart("weekday")}, ${getDatePart("month")} ${getDatePart("day")}, ${getDatePart("year")}`
      : `${getDatePart("year")}年${getDatePart("month")}月${getDatePart("day")}日 (${getDatePart("weekday")})`,
    timeLabel: `${getTimePart("hour")}:${getTimePart("minute")}`,
    periodLabel: getTimePart("dayPeriod"),
    timezoneLabel: getTimePart("timeZoneName") || "Local Time",
  };
}

function weatherCodeLabel(code: number, language: LanguageMode) {
  if (code === 0) return language === "en" ? "Clear" : "快晴";
  if ([1, 2, 3].includes(code)) return language === "en" ? "Partly cloudy" : "晴れ時々くもり";
  if ([45, 48].includes(code)) return language === "en" ? "Fog" : "霧";
  if ([51, 53, 55, 56, 57].includes(code)) return language === "en" ? "Drizzle" : "霧雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return language === "en" ? "Rain" : "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return language === "en" ? "Snow" : "雪";
  if ([95, 96, 99].includes(code)) return language === "en" ? "Thunderstorm" : "雷雨";
  return language === "en" ? "Weather updated" : "天気更新済み";
}

function formatWeatherUpdatedAt(value: string, language: LanguageMode) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseWeatherCoordinate(value: string | undefined, min: number, max: number) {
  if (!value) return null;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) return null;
  return coordinate;
}

const configuredWeatherLatitude = parseWeatherCoordinate(process.env.NEXT_PUBLIC_WEATHER_LATITUDE, -90, 90);
const configuredWeatherLongitude = parseWeatherCoordinate(process.env.NEXT_PUBLIC_WEATHER_LONGITUDE, -180, 180);

const uiText = {
  ja: {
    dashboard: "ダッシュボード",
    projects: "プロジェクト",
    notifications: "通知",
    calendar: "カレンダー",
    settings: "設定",
    top3: "今日のTop 3",
    top3Sub: "今日取り組むタスク",
    allTasks: "すべてのタスクを見る →",
    aiSummary: "AI PM Summary",
    todayFocus: "今日のフォーカス",
    todayTodo: "今日やること",
    projectStatus: "プロジェクト状況",
    showAll: "すべて表示 →",
    sort: "ステータス順",
    helper: "稼働テスト用: + / - ボタンで進捗調整。ステータス変更・詳細確認・新規追加・編集内容はLocalStorageに保存されます。",
    project: "プロジェクト",
    progressPhase: "進捗 / フェーズ",
    nextAction: "次のアクション",
    priority: "優先度",
    blocker: "ブロッカー / メモ",
    details: "詳細を開く",
    detailsShort: "詳細",
    studyStatus: "学習中",
    theme: "テーマ",
    completion: "完了条件",
    done: "完了",
    incomplete: "未完了",
    stuck: "困ってる",
    studyMemo: "今日の学習メモ / 詰まった点をここに残す",
    all: "すべて",
    discord: "Discord",
    github: "GitHub",
    allNotifications: "すべての通知を見る →",
  },
  en: {
    dashboard: "Dashboard",
    projects: "Projects",
    notifications: "Notifications",
    calendar: "Calendar",
    settings: "Settings",
    top3: "Today’s Top 3",
    top3Sub: "Priority tasks for today",
    allTasks: "View all tasks →",
    aiSummary: "AI PM Summary",
    todayFocus: "Today’s Focus",
    todayTodo: "Do Today",
    projectStatus: "Project Status",
    showAll: "Show all →",
    sort: "Sort by status",
    helper: "Local test: use + / - to adjust progress. Status, details, new projects, and edits are saved to LocalStorage.",
    project: "Project",
    progressPhase: "Progress / Phase",
    nextAction: "Next Action",
    priority: "Priority",
    blocker: "Blocker / Note",
    details: "Open Details",
    detailsShort: "Details",
    studyStatus: "Learning",
    theme: "Theme",
    completion: "Completion",
    done: "Done",
    incomplete: "Incomplete",
    stuck: "Stuck",
    studyMemo: "Leave today’s study note / blocker here",
    all: "All",
    discord: "Discord",
    github: "GitHub",
    allNotifications: "View all notifications →",
  },
} as const;

type TimerMode = "timer" | "stopwatch";
type StudyStatus = "学習中" | "完了" | "未完了" | "困ってる";
type LanguageMode = "ja" | "en";
type WorkspaceTab = "board" | "today" | "ai" | "review";
type LocalProjectSortMode = "status" | "priority" | "progress" | "due" | "attention";
type IntegrationMode = "mock" | "live";
type IntegrationStatus =
  | "not_configured"
  | "mock_ready"
  | "live_ready"
  | "needs_env"
  | "prep_ready"
  | "read_only_test"
  | "read_only_display"
  | "connected"
  | "planned";
type IntegrationKey = "github" | "discord" | "openai" | "weather" | "market" | "calendar";
type ReadinessTone = "local" | "readOnly" | "manual" | "apiReady" | "future" | "demo";
type LocalProjectTaskKey = "next-action" | "blocker-note" | "handoff-note";
type LocalAresProject = AresProject & {
  groupId?: string;
  todayTaskCompletions?: Partial<Record<LocalProjectTaskKey, boolean>>;
};

function priorityLabel(value: AresProject["priority"], language: LanguageMode) {
  const labels: Record<AresProject["priority"], { en: string; ja: string }> = {
    高: { en: "High", ja: "高" },
    中: { en: "Medium", ja: "中" },
    低: { en: "Low", ja: "低" },
  };
  return labels[value][language];
}

function projectStatusLabel(value: ProjectStatus, language: LanguageMode) {
  const labels: Record<ProjectStatus, { en: string; ja: string }> = {
    進行中: { en: "In Progress", ja: "進行中" },
    設計中: { en: "Designing", ja: "設計中" },
    準備中: { en: "Preparing", ja: "準備中" },
    保留: { en: "On Hold", ja: "保留" },
    完了: { en: "Done", ja: "完了" },
  };
  return labels[value][language];
}

function focusStatusLabel(value: StudyStatus, language: LanguageMode) {
  const labels: Record<StudyStatus, { en: string; ja: string }> = {
    学習中: { en: "In Focus", ja: "集中中" },
    完了: { en: "Done", ja: "完了" },
    未完了: { en: "Not Done", ja: "未完了" },
    困ってる: { en: "Blocked", ja: "困ってる" },
  };
  return labels[value][language];
}

function memberStatusLabel(value: MemberStatus["status"], language: LanguageMode) {
  const labels: Record<MemberStatus["status"], { en: string; ja: string }> = {
    進行中: { en: "In Progress", ja: "進行中" },
    完了: { en: "Done", ja: "完了" },
    ブロック: { en: "Blocked", ja: "ブロック" },
    待機中: { en: "Waiting", ja: "待機中" },
  };
  return labels[value][language];
}

function notificationDisplay(item: AresNotification, language: LanguageMode) {
  if (language === "en") {
    if (item.id === "discord-general") return { title: item.title, body: "New message available", time: "2m ago" };
    if (item.id === "github-pr") return { title: item.title, body: item.body, time: "15m ago" };
    if (item.id === "calendar-checkin") return { title: "Calendar", body: "10:30 - 11:00 Demo check-in", time: "1h ago" };
  }

  if (item.id === "calendar-checkin") {
    return { title: "カレンダー", body: "10:30 - 11:00 定例チェックイン", time: item.time };
  }

  return { title: item.title, body: item.body, time: item.time };
}

const TODAY_STATE_STORAGE_KEY = "ares.todayState.v1";
const REVIEW_STATE_STORAGE_KEY = "ares.reviewState.v1";
const MEMBERS_STATE_STORAGE_KEY = "ares.members.v1";

const LEGACY_TODAY_STORAGE_KEYS = [
  "ares-timer-seconds",
  "ares-stopwatch-seconds",
  "ares-projects",
  "ares-study-status",
  "ares-study-memo",
] as const;

const LEGACY_REVIEW_STORAGE_KEYS = [
  "ares-command-log",
  "ares-daily-review-note",
] as const;

type TodayLocalState = {
  activeGroupId: string;
  timerSeconds: number;
  stopwatchSeconds: number;
  projects: LocalAresProject[];
  studyStatus: StudyStatus;
  studyMemo: string;
};

type ReviewLocalState = {
  commandLog: CommandLogEntry[];
  dailyReviewNote: string;
};

const DEFAULT_TODAY_STATE: TodayLocalState = {
  activeGroupId: "recipe",
  timerSeconds: 25 * 60,
  stopwatchSeconds: 0,
  projects: defaultProjects,
  studyStatus: "学習中",
  studyMemo: "",
};

const DEFAULT_REVIEW_STATE: ReviewLocalState = {
  commandLog: [],
  dailyReviewNote: "",
};

const DEFAULT_MEMBERS_STATE: Record<string, AresMember[]> = {};
type GitHubProjectsSummarySourceState =
  | { status: "not_checked" }
  | {
      status: "included";
      projectTitle: string;
      returnedItemCount: number;
      readOnly: true;
    }
  | { status: "unavailable" };

type GitHubReadTestResult = {
  ok?: boolean;
  error?: string;
  statusCode?: number;
  source?: string;
  readOnly?: boolean;
  writesDisabled?: boolean;
  owner?: {
    type: string;
    login: string;
  };
  project?: {
    title: string;
    url: string;
    number: number;
    closed: boolean;
    itemCount: number;
  };
  items?: Array<{
    title: string;
    url: string;
    type: string;
    state: string;
    issueNumber: string;
    repo: string;
    updatedAt: string;
    safeNextAction: string;
    fields: {
      status: string;
      assignees: string;
      dueDate: string;
      area: string;
    };
  }>;
};

type GitHubProjectsRouteResult = {
  ok?: boolean;
  error?: unknown;
  source?: unknown;
  readOnly?: unknown;
  writesDisabled?: unknown;
  owner?: {
    type?: unknown;
    login?: unknown;
  };
  project?: {
    title?: unknown;
    url?: unknown;
    number?: unknown;
    closed?: unknown;
    itemCount?: unknown;
    returnedItemCount?: unknown;
  };
  items?: Array<{
    title?: unknown;
    url?: unknown;
    type?: unknown;
    status?: unknown;
    assignees?: unknown;
    labels?: unknown;
    updatedAt?: unknown;
    bodyExcerpt?: unknown;
    fields?: {
      dueDate?: unknown;
      area?: unknown;
    };
  }>;
};

type GitHubProjectsSummarySnapshot = {
  source: string;
  readOnly: true;
  project: {
    title: string;
    itemCount: number;
    returnedItemCount: number;
  };
  items: Array<{
    title: string;
    type: string;
    status: string;
    assignees: string[];
    labels: string[];
    updatedAt: string;
    dueDate: string;
    area: string;
  }>;
};

type GitHubWorkspaceRouteResult = {
  ok?: boolean;
  error?: unknown;
  source?: unknown;
  readOnly?: unknown;
  writesDisabled?: unknown;
  owner?: unknown;
  repoCount?: unknown;
  fetchedAt?: unknown;
  requiredEnv?: unknown;
  repos?: Array<{
    name?: unknown;
    description?: unknown;
    url?: unknown;
    updatedAt?: unknown;
    pushedAt?: unknown;
    defaultBranch?: unknown;
    latestCommit?: {
      summary?: unknown;
      committedDate?: unknown;
      url?: unknown;
      oid?: unknown;
    };
    openIssuesCount?: unknown;
    openPrCount?: unknown;
    recentlyUpdatedIssues?: unknown;
    recentlyUpdatedPrs?: unknown;
    status?: unknown;
    safeNextAction?: unknown;
    readOnly?: unknown;
    writesDisabled?: unknown;
  }>;
};

type GitHubWorkspaceResult = {
  ok: boolean;
  error?: string;
  statusCode: number;
  source: string;
  readOnly: boolean;
  writesDisabled: boolean;
  owner: string;
  repoCount: number;
  fetchedAt: string;
  requiredEnv: string[];
  repos: Array<{
    name: string;
    description: string;
    url: string;
    updatedAt: string;
    pushedAt: string;
    defaultBranch: string;
    latestCommit: {
      summary: string;
      committedDate: string;
      url: string;
      oid: string;
    };
    openIssuesCount: number;
    openPrCount: number;
    status: string;
    safeNextAction: string;
    readOnly: boolean;
    writesDisabled: boolean;
  }>;
};

type GitHubCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

type GitHubPR = {
  number: number;
  title: string;
  author: string;
  createdAt: string;
  isDraft: boolean;
};

type GitHubIssue = {
  number: number;
  title: string;
  author: string;
  createdAt: string;
  labels: string[];
};

type GitHubActivity = {
  commits: GitHubCommit[];
  pullRequests: GitHubPR[];
  issues: GitHubIssue[];
  fetchedAt: string;
};

type ProjectSummary = {
  summary: string;
  generatedAt: string;
};

const defaultIntegrationState: Record<IntegrationKey, {
  name: string;
  source: string;
  mode: IntegrationMode;
  status: IntegrationStatus;
  requiredEnv: string[];
  notes: string;
}> = {
  github: {
    name: "GitHub Projects",
    source: "Project / Issue / PR",
    mode: "mock",
    status: "read_only_display",
    requiredEnv: ["GITHUB_TOKEN", "GITHUB_USER", "GITHUB_ORG", "GITHUB_PROJECT_NUMBER"],
    notes: "Read-only preview for GitHub Projects metadata and normalized project items.",
  },
  discord: {
    name: "Discord Webhook",
    source: "Manual Approved Posts",
    mode: "live",
    status: "live_ready",
    requiredEnv: ["DISCORD_DASHBOARD_WEBHOOK_URL"],
    notes: "Manual approved posting only. No automatic Discord posts are triggered from the dashboard.",
  },
  openai: {
    name: "OpenAI API",
    source: "AI PM Summary",
    mode: "mock",
    status: "planned",
    requiredEnv: ["OPENAI_API_KEY"],
    notes: "AI PM Summary, Today’s Top 3, and study-day explanations.",
  },
  weather: {
    name: "Weather API",
    source: "Weather Card",
    mode: "mock",
    status: "planned",
    requiredEnv: ["WEATHER_API_KEY"],
    notes: "Live weather data for the static demo weather card.",
  },
  market: {
    name: "Market API",
    source: "Market Card",
    mode: "mock",
    status: "planned",
    requiredEnv: ["MARKET_API_KEY"],
    notes: "ETF and index data for the static market card.",
  },
  calendar: {
    name: "Google Calendar",
    source: "Calendar / Schedule",
    mode: "mock",
    status: "planned",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    notes: "Today’s schedule and future focus-block support.",
  },
};

const integrationOrder: IntegrationKey[] = ["discord", "github", "openai", "weather", "market", "calendar"];

const integrationDisplayCopy: Record<IntegrationKey, Record<LanguageMode, {
  source: string;
  notes: string;
  next: string;
}>> = {
  github: {
    ja: {
      source: "Projects / Issues / PR",
      notes: "v0.86 demo lock: GitHub ProjectsはRead-only。Demo boardとProject Statusに安全に表示します。",
      next: "次はデモ後に、読み取ったProject itemからAI PM Summaryとブロッカー検出をRead-onlyで試します。",
    },
    en: {
      source: "Projects / Issues / PRs",
      notes: "v0.86 demo lock: GitHub Projects stays read-only and appears safely in the Demo board and Project Status.",
      next: "Next after demo: try read-only AI PM Summary and blocker detection from Project items.",
    },
  },
  discord: {
    ja: {
      source: "AI Summary / Manual approved post",
      notes: "Discord投稿は手動承認ゲート経由のみ。自動投稿はありません。",
      next: "次はWebhook設定後に、承認済みAI Summary投稿だけを最終QAします。",
    },
    en: {
      source: "AI Summary / Manual approved post",
      notes: "Discord posting is limited to the manual approval gate. No automatic posting is active.",
      next: "Next: after webhook configuration, final-QA approved AI Summary posting only.",
    },
  },
  openai: {
    ja: {
      source: "AI PM Summary",
      notes: "Projectデータから要約・今日のTop 3・学習補助を生成する予定。",
      next: "次はローカルのProjectデータからAI PM Summaryを生成するRouteを作ります。",
    },
    en: {
      source: "AI PM Summary",
      notes: "Planned generation for summaries, Today’s Top 3, and study support from project data.",
      next: "Next: create a server-side route that generates AI PM Summary from local project data.",
    },
  },
  weather: {
    ja: {
      source: "Weather Card",
      notes: "静的な天気カードをLiveデータに置き換える候補。",
      next: "次は現在の静的カードをサーバー側APIの値に置き換えます。",
    },
    en: {
      source: "Weather Card",
      notes: "Candidate replacement for the current static weather card.",
      next: "Next: replace the current static card with a server-side API-backed value.",
    },
  },
  market: {
    ja: {
      source: "Market Card",
      notes: "ETF・指数データを表示する将来連携。",
      next: "次は現在の静的カードをサーバー側APIの値に置き換えます。",
    },
    en: {
      source: "Market Card",
      notes: "Future ETF and index data integration.",
      next: "Next: replace the current static card with a server-side API-backed value.",
    },
  },
  calendar: {
    ja: {
      source: "Calendar / Schedule",
      notes: "今日の予定と集中ブロックの候補を扱う将来連携。",
      next: "次は現在の静的カードをサーバー側APIの値に置き換えます。",
    },
    en: {
      source: "Calendar / Schedule",
      notes: "Future integration for today’s schedule and focus-block candidates.",
      next: "Next: replace the current static card with a server-side API-backed value.",
    },
  },
};

const readinessToneStyles: Record<ReadinessTone, string> = {
  local: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
  readOnly: "border-blue-400/35 bg-blue-500/10 text-blue-100",
  manual: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  apiReady: "border-indigo-400/35 bg-indigo-500/10 text-indigo-100",
  future: "border-slate-400/30 bg-slate-700/35 text-slate-200",
  demo: "border-amber-400/35 bg-amber-500/10 text-amber-100",
};

const connectionReadinessItems: Array<{
  key: string;
  feature: string;
  source: string;
  status: string;
  mode: string;
  remaining: string;
  nextStep: string;
  tone: ReadinessTone;
}> = [
  {
    key: "project-board",
    feature: "Project Board",
    source: "Seed + LocalStorage",
    status: "Usable locally",
    mode: "Local state",
    remaining: "Replace local project state with live source mapping.",
    nextStep: "Choose the first live project source and map fields read-only.",
    tone: "local",
  },
  {
    key: "github-projects",
    feature: "GitHub Projects",
    source: GITHUB_PROJECTS_CANONICAL_ROUTE,
    status: "Read-only route ready",
    mode: "Read-only",
    remaining: "Token/config, field mapping, and production read QA.",
    nextStep: "Connect env values later and keep writes disabled.",
    tone: "readOnly",
  },
  {
    key: "ai-summary",
    feature: "AI Summary",
    source: "Draft generation surface",
    status: "Draft workflow ready",
    mode: "API-ready draft",
    remaining: "Model configuration and final prompt QA.",
    nextStep: "Wire model credentials later; keep Discord separate.",
    tone: "apiReady",
  },
  {
    key: "discord",
    feature: "Discord",
    source: "AI draft approval gate",
    status: "Manual approved post only",
    mode: "Manual-only",
    remaining: "Webhook config and final posting QA.",
    nextStep: "Test only the approved-summary post path after setup.",
    tone: "manual",
  },
  {
    key: "daily-review",
    feature: "Daily Review",
    source: "Local notes + command log",
    status: "Usable locally",
    mode: "Local/manual",
    remaining: "Optional live sync target.",
    nextStep: "Decide whether notes sync to GitHub, Calendar, or storage.",
    tone: "local",
  },
  {
    key: "calendar",
    feature: "Calendar",
    source: "Schedule surface",
    status: "Not connected",
    mode: "Future connector",
    remaining: "OAuth, read scopes, and event normalization.",
    nextStep: "Add read-only calendar connection later.",
    tone: "future",
  },
  {
    key: "gmail",
    feature: "Gmail / Inbox",
    source: "Future inbox context",
    status: "Not connected",
    mode: "Future connector",
    remaining: "OAuth, read scopes, and message summarization rules.",
    nextStep: "Add read-only inbox context only after account login exists.",
    tone: "future",
  },
  {
    key: "weather",
    feature: "Weather",
    source: "Header demo widget",
    status: "Static demo",
    mode: "Demo data",
    remaining: "Weather API selection and server-side fetch.",
    nextStep: "Replace static demo weather value after API setup.",
    tone: "demo",
  },
  {
    key: "market",
    feature: "Market",
    source: "Header demo widget",
    status: "Static demo",
    mode: "Demo data",
    remaining: "Market data provider and server-side fetch.",
    nextStep: "Replace static index values after API setup.",
    tone: "demo",
  },
];

function readLocalStorageJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : null;
  } catch {
    return null;
  }
}

function writeLocalStorageJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeLocalStorageItem(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // LocalStorage can be blocked in private or embedded browser contexts.
  }
}

function resolveStateAction<T>(value: React.SetStateAction<T>, current: T) {
  return typeof value === "function" ? (value as (previous: T) => T)(current) : value;
}

function migrateTodayState() {
  const timerSeconds = readLocalStorageJson<number>("ares-timer-seconds");
  const stopwatchSeconds = readLocalStorageJson<number>("ares-stopwatch-seconds");
  const projects = readLocalStorageJson<LocalAresProject[]>("ares-projects");
  const studyStatus = readLocalStorageJson<StudyStatus>("ares-study-status");
  const studyMemo = readLocalStorageJson<string>("ares-study-memo");
  const hasLegacyTodayState = [
    timerSeconds,
    stopwatchSeconds,
    projects,
    studyStatus,
    studyMemo,
  ].some((value) => value !== null);

  if (!hasLegacyTodayState) {
    return null;
  }

  const nextStudyStatus =
    studyStatus === "学習中" || studyStatus === "完了" || studyStatus === "未完了" || studyStatus === "困ってる"
      ? studyStatus
      : DEFAULT_TODAY_STATE.studyStatus;

  return {
    activeGroupId: DEFAULT_TODAY_STATE.activeGroupId,
    timerSeconds: typeof timerSeconds === "number" ? timerSeconds : DEFAULT_TODAY_STATE.timerSeconds,
    stopwatchSeconds: typeof stopwatchSeconds === "number" ? stopwatchSeconds : DEFAULT_TODAY_STATE.stopwatchSeconds,
    projects: Array.isArray(projects) ? projects : DEFAULT_TODAY_STATE.projects,
    studyStatus: nextStudyStatus,
    studyMemo: typeof studyMemo === "string" ? studyMemo : DEFAULT_TODAY_STATE.studyMemo,
  };
}

function migrateReviewState() {
  const commandLog = readLocalStorageJson<CommandLogEntry[]>("ares-command-log");
  const dailyReviewNote = readLocalStorageJson<string>("ares-daily-review-note");

  if (commandLog === null && dailyReviewNote === null) {
    return null;
  }

  return {
    commandLog: Array.isArray(commandLog) ? commandLog : DEFAULT_REVIEW_STATE.commandLog,
    dailyReviewNote: typeof dailyReviewNote === "string" ? dailyReviewNote : DEFAULT_REVIEW_STATE.dailyReviewNote,
  };
}

function usePersistentState<T>(key: string, fallback: T, migrate?: () => T | null) {
  const fallbackRef = useRef(fallback);
  const [state, setState] = useState<T>(fallback);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (stored) {
        setState(JSON.parse(stored) as T);
      } else {
        const migrated = migrate?.();
        if (migrated) {
          setState(migrated);
        }
      }
    } catch {
      setState(fallbackRef.current);
    } finally {
      setIsHydrated(true);
    }
  }, [key, migrate]);

  useEffect(() => {
    if (!isHydrated) return;
    writeLocalStorageJson(key, state);
  }, [isHydrated, key, state]);

  return [state, setState] as const;
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatStopwatch(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function todayStamp() {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function safeSummaryText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, GITHUB_PROJECTS_SUMMARY_TEXT_LIMIT) : fallback;
}

function safeSummaryNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeSummaryStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeSummaryText(item))
    .filter(Boolean)
    .slice(0, GITHUB_PROJECTS_SUMMARY_ARRAY_LIMIT);
}

function normalizeGitHubWorkspaceResult(data: GitHubWorkspaceRouteResult, statusCode: number): GitHubWorkspaceResult {
  const requiredEnv = safeSummaryStringArray(data.requiredEnv);

  if (!data.ok || data.readOnly !== true || data.writesDisabled !== true) {
    return {
      ok: false,
      statusCode,
      error: typeof data.error === "string" ? data.error : GITHUB_WORKSPACE_SAFE_FAILURE_MESSAGE,
      source: safeSummaryText(data.source, "github-workspace-readonly"),
      readOnly: data.readOnly === true,
      writesDisabled: data.writesDisabled === true,
      owner: safeSummaryText(data.owner),
      repoCount: safeSummaryNumber(data.repoCount),
      fetchedAt: safeSummaryText(data.fetchedAt),
      requiredEnv: requiredEnv.length > 0 ? requiredEnv : ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPOS"],
      repos: [],
    };
  }

  const repos = (data.repos ?? []).map((repo) => ({
    name: safeSummaryText(repo.name, "Unknown repo"),
    description: safeSummaryText(repo.description),
    url: safeSummaryText(repo.url),
    updatedAt: safeSummaryText(repo.updatedAt),
    pushedAt: safeSummaryText(repo.pushedAt),
    defaultBranch: safeSummaryText(repo.defaultBranch),
    latestCommit: {
      summary: safeSummaryText(repo.latestCommit?.summary),
      committedDate: safeSummaryText(repo.latestCommit?.committedDate),
      url: safeSummaryText(repo.latestCommit?.url),
      oid: safeSummaryText(repo.latestCommit?.oid),
    },
    openIssuesCount: safeSummaryNumber(repo.openIssuesCount),
    openPrCount: safeSummaryNumber(repo.openPrCount),
    status: safeSummaryText(repo.status, "Quiet"),
    safeNextAction: safeSummaryText(repo.safeNextAction, "No immediate GitHub action."),
    readOnly: repo.readOnly === true,
    writesDisabled: repo.writesDisabled === true,
  }));

  return {
    ok: true,
    statusCode,
    source: safeSummaryText(data.source, "github-workspace-readonly"),
    readOnly: true,
    writesDisabled: true,
    owner: safeSummaryText(data.owner),
    repoCount: safeSummaryNumber(data.repoCount, repos.length),
    fetchedAt: safeSummaryText(data.fetchedAt),
    requiredEnv: requiredEnv.length > 0 ? requiredEnv : ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPOS"],
    repos,
  };
}

function formatGitHubWorkspaceDate(value: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function timeAgo(dateStr: string, lang: LanguageMode = "ja"): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff)) return lang === "en" ? "Unknown date" : "日時不明";
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return lang === "en" ? "Less than 1 hour ago" : "1時間未満";
  if (hours < 24) return lang === "en" ? `${hours}h ago` : `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return lang === "en" ? `${days}d ago` : `${days}日前`;
}

function formatGitHubActivityFetchedAt(value: string, language: LanguageMode) {
  if (!value) return language === "en" ? "Not fetched" : "未取得";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "en" ? "Not fetched" : "未取得";

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderSummary(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={i}>{part}</span>;
  });
}

function gitHubWorkspaceStatusClass(status: string) {
  if (status === "Needs Review") return "border-violet-400/45 bg-violet-500/15 text-violet-100";
  if (status === "Needs Triage") return "border-amber-400/45 bg-amber-500/15 text-amber-100";
  if (status === "Active") return "border-emerald-400/45 bg-emerald-500/15 text-emerald-100";
  if (status === "Unavailable") return "border-red-400/45 bg-red-500/15 text-red-100";
  return "border-slate-500/45 bg-slate-700/30 text-slate-200";
}

function gitHubProjectItemUrlParts(url: string) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
  if (!match) return { repo: "", issueNumber: "" };

  return {
    repo: match[2],
    issueNumber: `#${match[3]}`,
  };
}

function gitHubProjectSafeNextAction(status: string, type: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("stuck")) return "Review blocker context.";
  if (normalized.includes("review")) return "Review latest project item state.";
  if (normalized.includes("todo") || normalized.includes("ready")) return "Pick up when demo work resumes.";
  if (normalized.includes("done") || normalized.includes("closed") || normalized.includes("complete")) return "No immediate action.";
  if (type === "PullRequest") return "Check PR status.";
  if (type === "Issue") return "Check issue status.";
  return "Review item status.";
}

function normalizeGitHubProjectsForSummary(data: GitHubProjectsRouteResult): GitHubProjectsSummarySnapshot | null {
  if (!data.ok || data.readOnly !== true || !data.project) {
    return null;
  }

  const items = (data.items ?? []).slice(0, GITHUB_PROJECTS_SUMMARY_ITEM_LIMIT).map((item) => ({
    title: safeSummaryText(item.title, "Untitled item"),
    type: safeSummaryText(item.type, "Unknown"),
    status: safeSummaryText(item.status),
    assignees: safeSummaryStringArray(item.assignees),
    labels: safeSummaryStringArray(item.labels),
    updatedAt: safeSummaryText(item.updatedAt),
    dueDate: safeSummaryText(item.fields?.dueDate),
    area: safeSummaryText(item.fields?.area),
  }));

  return {
    source: safeSummaryText(data.source, "github-projects-readonly"),
    readOnly: true,
    project: {
      title: safeSummaryText(data.project.title, "Untitled project"),
      itemCount: safeSummaryNumber(data.project.itemCount),
      returnedItemCount: safeSummaryNumber(data.project.returnedItemCount, items.length),
    },
    items,
  };
}

async function fetchGitHubProjectsForSummary() {
  try {
    const response = await fetch(GITHUB_PROJECTS_CANONICAL_ROUTE, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => ({}))) as GitHubProjectsRouteResult;
    return normalizeGitHubProjectsForSummary(data);
  } catch {
    return null;
  }
}

function normalizeGitHubProjectsForPreview(data: GitHubProjectsRouteResult, statusCode: number): GitHubReadTestResult {
  if (!data.ok || data.readOnly !== true || !data.project) {
    return {
      ok: false,
      statusCode,
      error: typeof data === "object" && data && "error" in data && typeof data.error === "string" ? data.error : GITHUB_SAFE_FAILURE_MESSAGE,
      source: safeSummaryText(data.source, "github-projects-readonly"),
      readOnly: data.readOnly === true,
      writesDisabled: data.writesDisabled === true,
      owner: {
        type: safeSummaryText(data.owner?.type),
        login: safeSummaryText(data.owner?.login),
      },
    };
  }

  return {
    ok: true,
    statusCode,
    source: safeSummaryText(data.source, "github-projects-readonly"),
    readOnly: true,
    writesDisabled: data.writesDisabled === true,
    owner: {
      type: safeSummaryText(data.owner?.type),
      login: safeSummaryText(data.owner?.login),
    },
    project: {
      title: safeSummaryText(data.project.title, "Untitled project"),
      url: safeSummaryText(data.project.url),
      number: safeSummaryNumber(data.project.number),
      closed: data.project.closed === true,
      itemCount: safeSummaryNumber(data.project.itemCount),
    },
    items: (data.items ?? []).map((item) => {
      const status = safeSummaryText(item.status);
      const url = safeSummaryText(item.url);
      const urlParts = gitHubProjectItemUrlParts(url);
      const type = safeSummaryText(item.type, "Unknown");
      return {
        title: safeSummaryText(item.title, "Untitled item"),
        url,
        type,
        state: status,
        issueNumber: urlParts.issueNumber,
        repo: urlParts.repo,
        updatedAt: safeSummaryText(item.updatedAt),
        safeNextAction: gitHubProjectSafeNextAction(status, type),
        fields: {
          status,
          assignees: safeSummaryStringArray(item.assignees).join(", "),
          dueDate: safeSummaryText(item.fields?.dueDate),
          area: safeSummaryText(item.fields?.area),
        },
      };
    }),
  };
}

function isGitHubMissingConfigStatus(statusCode: number | undefined) {
  return statusCode === 400 || statusCode === 503;
}

function isDueSoon(dueDate: string) {
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromToday = new Date(today);
  sevenDaysFromToday.setDate(today.getDate() + 7);

  return due >= today && due <= sevenDaysFromToday;
}

function githubItemLabels(item: NonNullable<GitHubReadTestResult["items"]>[number]) {
  const status = item.fields.status || "";
  const normalizedState = item.state.toLowerCase();
  const normalizedStatus = status.toLowerCase();
  const labels: Array<{ text: string; className: string }> = [];

  if (["blocked", "stuck", "needs review"].some((word) => normalizedStatus.includes(word))) {
    labels.push({
      text: "Blocked / Attention Needed",
      className: "border-red-400/45 bg-red-500/15 text-red-200",
    });
  }

  if (!item.fields.dueDate) {
    labels.push({
      text: "No Due Date",
      className: "border-slate-500/50 bg-slate-700/35 text-slate-300",
    });
  } else if (isDueSoon(item.fields.dueDate)) {
    labels.push({
      text: "Due Soon",
      className: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    });
  }

  if (["done", "closed", "completed"].some((word) => normalizedState.includes(word) || normalizedStatus.includes(word))) {
    labels.push({
      text: "Done",
      className: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
    });
  }

  return labels;
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-2xl border border-cyan-300/12 bg-slate-950/55 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl",
        "ring-1 ring-white/[0.025]",
        className
      )}
    >
      {children}
    </section>
  );
}

function Pill({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold", className)} title={title}>
      {children}
    </span>
  );
}

const trustLabelToneStyles = {
  local: "border-cyan-400/15 bg-cyan-500/[0.035] text-cyan-200/70",
  real: "border-emerald-400/15 bg-emerald-500/[0.035] text-emerald-200/70",
  manual: "border-blue-400/15 bg-blue-500/[0.035] text-blue-200/70",
  preview: "border-amber-400/15 bg-amber-500/[0.035] text-amber-200/70",
  demo: "border-amber-300/15 bg-amber-400/[0.035] text-amber-200/70",
  mock: "border-slate-400/15 bg-slate-700/20 text-slate-400",
  ai: "border-indigo-400/15 bg-indigo-500/[0.035] text-indigo-200/70",
  github: "border-blue-400/15 bg-blue-500/[0.035] text-blue-200/70",
} as const;

type TrustLabelTone = keyof typeof trustLabelToneStyles;

function TrustMeta({
  items,
  className,
}: {
  items: Array<{ label: string; value: string; tone: TrustLabelTone }>;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-1 text-[8px] font-medium leading-none opacity-45", className)}>
      {items.map((item) => (
        <span
          key={`${item.label}-${item.value}`}
          className={cx("rounded border px-1.5 py-0.5", trustLabelToneStyles[item.tone])}
        >
          <span className="uppercase tracking-wide opacity-60">{item.label}:</span>{" "}
          <span>{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function CompactTrustMeta({
  items,
  className,
}: {
  items: Array<{ label: string; value: string; tone: TrustLabelTone }>;
  className?: string;
}) {
  return (
    <div
      className={cx("text-[9px] font-medium leading-relaxed text-slate-700", className)}
      title={items.map((item) => `${item.label}: ${item.value}`).join(" / ")}
    >
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${item.value}`}>
          {index > 0 && <span className="mx-1.5 text-slate-800">/</span>}
          <span className="opacity-75">{item.value}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function DisclosureHeader({
  icon: Icon,
  title,
  description,
  badge,
  isExpanded,
  onToggle,
  language = "ja",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  language?: LanguageMode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Icon className="mt-0.5 shrink-0 text-slate-400" size={20} />
        <div className="min-w-0 flex-1">
          <h2 className="whitespace-normal break-words text-lg font-bold text-slate-100">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge}
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          type="button"
        >
          {isExpanded ? (language === "en" ? "Collapse" : "折りたたむ") : (language === "en" ? "Expand" : "展開")}
          <ChevronDown size={14} className={cx("transition", isExpanded && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}

function CollapsibleBlock({
  title,
  description,
  badge,
  children,
  language = "ja",
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  language?: LanguageMode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-3 rounded-xl border border-white/8 bg-slate-950/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <button
            onClick={() => setIsExpanded((current) => !current)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            type="button"
          >
            {isExpanded ? (language === "en" ? "Collapse" : "折りたたむ") : (language === "en" ? "Expand" : "展開")}
            <ChevronDown size={13} className={cx("transition", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>
      {isExpanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Sidebar({
  language,
  timerMode,
  setTimerMode,
  timerSeconds,
  stopwatchSeconds,
  setTimerRunning,
  setStopwatchRunning,
  resetTimer,
  resetStopwatch,
}: {
  language: LanguageMode;
  timerMode: TimerMode;
  setTimerMode: React.Dispatch<React.SetStateAction<TimerMode>>;
  timerSeconds: number;
  stopwatchSeconds: number;
  setTimerRunning: (running: boolean) => void;
  setStopwatchRunning: (running: boolean) => void;
  resetTimer: () => void;
  resetStopwatch: () => void;
}) {
  const t = uiText[language];
  const isEnglish = language === "en";

  const activeTime = timerMode === "timer" ? formatSeconds(timerSeconds) : formatStopwatch(stopwatchSeconds);

  return (
    <aside className="flex w-[176px] shrink-0 flex-col border-r border-white/10 bg-slate-950/70 px-2.5 py-4 lg:w-[220px] xl:w-[274px] xl:px-4">
      <div className="mb-5 flex min-w-0 items-center gap-2 px-2 lg:gap-3 lg:px-3">
        <div className="relative grid h-10 w-10 place-items-center">
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl" />
          <img
            src="/brand/sydney-console-mark.png"
            alt="Sydney Console mark"
            className="relative h-10 w-10 object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="truncate tracking-[0.28em] text-white xl:tracking-[0.38em]">SYDNEY</div>
          <div className="truncate text-xs tracking-[0.12em] text-slate-400 xl:tracking-[0.22em]">CONSOLE</div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-2.5 text-sm text-cyan-100 shadow-[0_0_35px_rgba(37,99,235,0.14)]">
        <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/70">
          {language === "en" ? "Current workspace" : "現在のワークスペース"}
        </div>
        <div className="mt-0.5 font-bold">{t.dashboard}</div>
      </div>

      <GlassCard className="mt-4 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">{language === "en" ? "TIMER" : "タイマー"}</div>
          <div className="text-xl font-semibold tabular-nums text-white">{activeTime}</div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-slate-950/60 p-1 text-xs">
          <button
            onClick={() => setTimerMode("timer")}
            className={cx(
              "rounded-md py-1.5 transition",
              timerMode === "timer" ? "bg-blue-500/35 text-cyan-100" : "text-slate-400 hover:text-white"
            )}
          >
            {language === "en" ? "Timer" : "タイマー"}
          </button>
          <button
            onClick={() => setTimerMode("stopwatch")}
            className={cx(
              "rounded-md py-1.5 transition",
              timerMode === "stopwatch" ? "bg-blue-500/35 text-cyan-100" : "text-slate-400 hover:text-white"
            )}
          >
            {language === "en" ? "Stopwatch" : "ストップウォッチ"}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>{timerMode === "timer" ? (language === "en" ? "Focus" : "集中タイム") : (language === "en" ? "Elapsed" : "計測中")}</span>
          <span className="flex items-center gap-1">
            <Bell size={13} /> 09:49
          </span>
        </div>

        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={() => (timerMode === "timer" ? setTimerRunning(true) : setStopwatchRunning(true))}
            className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.28)] transition hover:scale-105"
            aria-label="start"
          >
            <Play size={15} fill="currentColor" />
          </button>
          <button
            onClick={() => (timerMode === "timer" ? setTimerRunning(false) : setStopwatchRunning(false))}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-900 text-slate-200 transition hover:bg-white/10"
            aria-label="pause"
          >
            <Pause size={15} />
          </button>
          <button
            onClick={() => (timerMode === "timer" ? resetTimer() : resetStopwatch())}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-900 text-slate-200 transition hover:bg-white/10"
            aria-label="reset"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </GlassCard>

      <GlassCard className="mt-3 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            <Bell size={14} className="text-blue-300" /> {t.notifications}
          </div>
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
            Demo
          </span>
        </div>
        <div className="space-y-1.5">
          {notifications.slice(0, 3).map((item) => {
            const { title, body, time } = notificationDisplay(item, language);

            return (
              <div key={item.id} className="rounded-lg border border-white/8 bg-slate-950/35 px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded border border-white/10 bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                      {item.type}
                    </span>
                    <div className="min-w-0 truncate text-xs font-bold text-slate-100">{title}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500">{time}</span>
                </div>
                <div className="truncate text-[11px] leading-relaxed text-slate-400">{body}</div>
              </div>
            );
          })}
        </div>
      </GlassCard>

    </aside>
  );
}

function TopInfoCards({
  addLog,
  isStudyExpanded,
  language,
  projects,
  setIsStudyExpanded,
  setLanguage,
  studyMemo,
  studyStatus,
  setStudyMemo,
  setStudyStatus,
}: {
  addLog: (text: string) => void;
  isStudyExpanded: boolean;
  language: LanguageMode;
  projects: AresProject[];
  setIsStudyExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setLanguage: React.Dispatch<React.SetStateAction<LanguageMode>>;
  studyMemo: string;
  studyStatus: StudyStatus;
  setStudyMemo: React.Dispatch<React.SetStateAction<string>>;
  setStudyStatus: React.Dispatch<React.SetStateAction<StudyStatus>>;
}) {
  const [dateTimeDisplay, setDateTimeDisplay] = useState<DateTimeDisplay | null>(null);
  const [weatherDisplay, setWeatherDisplay] = useState<WeatherDisplay>({
    status: "loading",
    temperatureC: null,
    condition: language === "en" ? "Loading weather" : "天気を取得中",
    updatedAt: "",
  });

  useEffect(() => {
    const updateDateTime = () => setDateTimeDisplay(formatLocalDateTime(new Date(), language));
    updateDateTime();
    const intervalId = window.setInterval(updateDateTime, 30_000);
    return () => window.clearInterval(intervalId);
  }, [language]);

  useEffect(() => {
    let isMounted = true;
    const hasConfiguredWeatherLocation = configuredWeatherLatitude !== null && configuredWeatherLongitude !== null;

    if (!hasConfiguredWeatherLocation) {
      setWeatherDisplay({
        status: "unavailable",
        temperatureC: null,
        condition: language === "en" ? "Weather not configured" : "天気は未設定",
        updatedAt: "",
      });
      return undefined;
    }

    const fetchConfiguredWeather = async () => {
      setWeatherDisplay((current) => ({
        ...current,
        status: current.temperatureC === null ? "loading" : current.status,
        condition: current.temperatureC === null
          ? language === "en" ? "Loading weather" : "天気を取得中"
          : current.condition,
      }));

      try {
        const params = new URLSearchParams({
          latitude: String(configuredWeatherLatitude),
          longitude: String(configuredWeatherLongitude),
          current_weather: "true",
          temperature_unit: "celsius",
          timezone: "auto",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          current_weather?: {
            temperature?: number;
            weathercode?: number;
            time?: string;
          };
        };

        if (!response.ok || typeof data.current_weather?.temperature !== "number") {
          throw new Error("Weather unavailable");
        }

        if (!isMounted) return;
        setWeatherDisplay({
          status: "ready",
          temperatureC: data.current_weather.temperature,
          condition: weatherCodeLabel(data.current_weather.weathercode ?? -1, language),
          updatedAt: data.current_weather.time || new Date().toISOString(),
        });
      } catch {
        if (!isMounted) return;
        setWeatherDisplay({
          status: "unavailable",
          temperatureC: null,
          condition: language === "en" ? "Weather unavailable" : "天気取得不可",
          updatedAt: "",
        });
      }
    };

    fetchConfiguredWeather();
    const intervalId = window.setInterval(fetchConfiguredWeather, 15 * 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [language]);

  const weatherUpdatedAt = formatWeatherUpdatedAt(weatherDisplay.updatedAt, language);
  const blockerCount = projects.filter((project) => project.blocker.trim().length > 0).length;
  const focusHours = topTasks.reduce((total, task) => {
    const estimate = Number.parseFloat(task.estimate);
    return Number.isFinite(estimate) ? total + estimate : total;
  }, 0);
  const topFocusProject = sortProjectsForAttention(projects)[0];

  return (
    <div className="min-w-0 space-y-2">
      <GlassCard className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 xl:gap-x-4">
        <div className="flex min-w-0 items-center gap-2 sm:min-w-[210px]">
          <CalendarDays size={15} className="text-blue-400" />
          <div className="min-w-0">
            <div className="truncate text-[11px] text-slate-500">{dateTimeDisplay?.dateLabel ?? "Local Time"}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tabular-nums text-white">{dateTimeDisplay?.timeLabel ?? "--:--"}</span>
              <span className="text-[11px] text-slate-400">
                {dateTimeDisplay ? `${dateTimeDisplay.periodLabel} ${dateTimeDisplay.timezoneLabel}` : "Local"}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/8 lg:block" />

        <div className="flex items-center gap-2">
          <CloudSun className="text-amber-300" size={20} />
          <div>
            <div className="text-sm font-bold text-white">
              {weatherDisplay.temperatureC === null ? "--" : `${Math.round(weatherDisplay.temperatureC)}°C`}{" "}
              <span className="text-xs font-medium text-slate-300">Demo City</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {weatherDisplay.condition}
              {weatherDisplay.status === "ready" && weatherUpdatedAt
                ? ` / ${language === "en" ? "Updated" : "更新"} ${weatherUpdatedAt}`
                : weatherDisplay.status === "loading"
                  ? ` / ${language === "en" ? "Fetching" : "取得中"}`
                  : ` / ${language === "en" ? "No live claim" : "Live表示なし"}`}
            </div>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/8 lg:block" />

        <div className="min-w-0 text-xs sm:min-w-[245px]">
          <div className="mb-0.5 font-semibold text-blue-300">
            {language === "en" ? "Today Focus" : "今日のフォーカス"}{" "}
            <span className="text-slate-500">{language === "en" ? "Action context" : "行動コンテキスト"}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-300">
            <span>
              {language === "en" ? "Focus" : "フォーカス"}{" "}
              <span className="tabular-nums text-slate-100">{focusHours.toFixed(1)}h</span>
            </span>
            <span>
              {language === "en" ? "Blockers" : "ブロッカー"}{" "}
              <span className={cx("tabular-nums", blockerCount > 0 ? "text-amber-200" : "text-emerald-200")}>
                {blockerCount}
              </span>
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-slate-600">
            {topFocusProject
              ? `${language === "en" ? "Top now" : "トップ"}: ${topFocusProject.name}`
              : language === "en" ? "No local projects loaded." : "Local project data not loaded."}
          </div>
        </div>

        <div className="hidden h-8 w-px bg-white/8 lg:block" />

        <button
          onClick={() => setIsStudyExpanded((current) => !current)}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/55 px-2.5 py-1.5 text-left transition hover:bg-white/10 sm:min-w-[150px]"
          type="button"
        >
          <Code2 size={15} className="text-cyan-300" />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">{language === "en" ? "Active Focus" : "アクティブフォーカス"}</div>
            <div className="truncate text-[11px] text-slate-500">
              {focusStatusLabel(studyStatus, language)} / {language === "en" ? "Local focus status" : "学習状況"}
            </div>
          </div>
          <ChevronDown size={13} className={cx("ml-auto text-slate-500 transition", isStudyExpanded && "rotate-180")} />
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/55 p-1 text-xs sm:ml-auto">
          <button
            onClick={() => setLanguage("ja")}
            className={cx(
              "rounded-md px-2 py-1 font-bold transition",
              language === "ja" ? "bg-cyan-500/25 text-cyan-100" : "text-slate-400 hover:text-white"
            )}
            type="button"
          >
            日本語
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={cx(
              "rounded-md px-2 py-1 font-bold transition",
              language === "en" ? "bg-cyan-500/25 text-cyan-100" : "text-slate-400 hover:text-white"
            )}
            type="button"
          >
            EN
          </button>
        </div>
      </GlassCard>
      {isStudyExpanded && (
        <PythonStudyTopCard
          addLog={addLog}
          isExpanded={isStudyExpanded}
          language={language}
          setIsExpanded={setIsStudyExpanded}
          studyMemo={studyMemo}
          studyStatus={studyStatus}
          setStudyMemo={setStudyMemo}
          setStudyStatus={setStudyStatus}
        />
      )}
    </div>
  );
}

function LanguageToggle({
  language,
  setLanguage,
}: {
  language: LanguageMode;
  setLanguage: React.Dispatch<React.SetStateAction<LanguageMode>>;
}) {
  return (
    <GlassCard className="flex min-h-[54px] items-center justify-end gap-2 px-3 py-2">
      <span className="mr-1 text-xs font-semibold text-slate-500">UI</span>
      <button
        onClick={() => setLanguage("ja")}
        className={cx(
          "rounded-lg px-3 py-1.5 text-xs font-bold transition",
          language === "ja" ? "bg-cyan-500/25 text-cyan-100" : "text-slate-400 hover:text-white"
        )}
        type="button"
      >
        日本語
      </button>
      <button
        onClick={() => setLanguage("en")}
        className={cx(
          "rounded-lg px-3 py-1.5 text-xs font-bold transition",
          language === "en" ? "bg-cyan-500/25 text-cyan-100" : "text-slate-400 hover:text-white"
        )}
        type="button"
      >
        English
      </button>
    </GlassCard>
  );
}

function WorkspaceTabs({
  activeTab,
  onChange,
  language,
}: {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  language: LanguageMode;
}) {
  const isEnglish = language === "en";
  const tabs: Array<{ key: WorkspaceTab; label: string; description: string }> = [
    { key: "board", label: "Board", description: isEnglish ? "Projects" : "プロジェクト" },
    { key: "today", label: "Today", description: isEnglish ? "Focus" : "フォーカス" },
    { key: "ai", label: "AI Tools", description: isEnglish ? "Summary" : "サマリー" },
    { key: "review", label: "Review", description: isEnglish ? "Wrap-up" : "振り返り" },
  ];

  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cx(
            "flex min-w-[92px] flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition sm:flex-none sm:px-3",
            activeTab === tab.key
              ? "border border-cyan-300/25 bg-cyan-500/15 text-cyan-100"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          )}
          type="button"
        >
          <span className="min-w-0 truncate text-sm font-bold">{tab.label}</span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-60">{tab.description}</span>
        </button>
      ))}
    </div>
  );
}

function ProjectGroupTabs({
  groups,
  projects,
  activeGroupId,
  onChange,
  language,
}: {
  groups: ProjectGroup[];
  projects: LocalAresProject[];
  activeGroupId: string;
  onChange: (groupId: string) => void;
  language: LanguageMode;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-1.5">
      {groups.map((group) => {
        const projectCount = projects.filter((project) => project.groupId === group.id).length;
        return (
          <button
            key={group.id}
            onClick={() => onChange(group.id)}
            className={cx(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition hover:bg-gray-800 hover:text-white",
              activeGroupId === group.id
                ? "border-gray-500 bg-gray-800 text-white"
                : "border-gray-700 bg-gray-900 text-gray-400"
            )}
            type="button"
          >
            <span className={cx("h-[7px] w-[7px] rounded-full", projectGroupDotStyles[group.color] ?? projectGroupDotStyles.blue)} />
            <span>{group.name}</span>
            <span className="tabular-nums">{projectCount}</span>
          </button>
        );
      })}
      <button
        aria-label={language === "en" ? "Group creation is planned for a future version." : "グループ追加は今後のバージョンで対応予定です。"}
        className="ml-auto inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-900/45 px-3 py-2 text-sm font-bold text-slate-500"
        disabled
        title={language === "en" ? "Group creation is planned for a future version." : "グループ追加は今後のバージョンで対応予定です。"}
        type="button"
      >
        <Plus size={14} /> {language === "en" ? "Add (Planned)" : "追加予定"}
      </button>
    </div>
  );
}

function ProjectGroupMembersSection({
  activeGroupId,
  members,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  language,
}: {
  activeGroupId: string;
  members: AresMember[];
  onAddMember: (groupId: string, member: Omit<AresMember, "id">) => void;
  onUpdateMember: (groupId: string, member: AresMember) => void;
  onRemoveMember: (groupId: string, memberId: string) => void;
  language: LanguageMode;
}) {
  const emptyDraft: Omit<AresMember, "id"> = {
    name: "",
    role: "Dev",
    currentTask: "",
    status: "Active",
  };
  const [draft, setDraft] = useState<Omit<AresMember, "id">>(emptyDraft);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<AresMember | null>(null);

  const startEditing = (member: AresMember) => {
    setEditingMemberId(member.id);
    setEditingDraft(member);
  };

  const cancelEditing = () => {
    setEditingMemberId(null);
    setEditingDraft(null);
  };

  const saveEditing = () => {
    if (!editingDraft) return;
    onUpdateMember(activeGroupId, editingDraft);
    cancelEditing();
  };

  const addDraftMember = () => {
    if (!draft.name.trim()) return;
    onAddMember(activeGroupId, {
      ...draft,
      name: draft.name.trim(),
      currentTask: draft.currentTask.trim(),
    });
    setDraft(emptyDraft);
  };

  return (
    <GlassCard className="mb-3 border-gray-700 bg-gray-900 p-4 shadow-none">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-gray-100">{language === "en" ? "Members" : "メンバー"}</h2>
        <span className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] font-bold text-gray-400">
          Secondary
        </span>
      </div>

      {members.length === 0 ? (
        <div className="rounded-md border border-gray-800 bg-gray-950/40 px-3 py-3 text-sm text-gray-500">
          {language === "en" ? "No members in this group" : "このグループにメンバーはいません"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-800">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-gray-950/45 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 font-semibold">{language === "en" ? "Name" : "名前"}</th>
                <th className="px-3 py-2 font-semibold">{language === "en" ? "Role" : "役割"}</th>
                <th className="px-3 py-2 font-semibold">{language === "en" ? "Current Task" : "現在のタスク"}</th>
                <th className="px-3 py-2 font-semibold">{language === "en" ? "Status" : "ステータス"}</th>
                <th className="px-3 py-2 font-semibold">{language === "en" ? "Actions" : "操作"}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isEditing = editingMemberId === member.id && editingDraft;

                return (
                  <tr key={member.id} className="border-b border-gray-800 last:border-b-0">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingDraft.name}
                          onChange={(event) => setEditingDraft({ ...editingDraft, name: event.target.value })}
                          className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-100">{member.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editingDraft.role}
                          onChange={(event) => setEditingDraft({ ...editingDraft, role: event.target.value as MemberRole })}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
                        >
                          {aresMemberRoles.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-300">{member.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingDraft.currentTask}
                          onChange={(event) => setEditingDraft({ ...editingDraft, currentTask: event.target.value })}
                          className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-300">{member.currentTask || (language === "en" ? "Unset" : "未設定")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editingDraft.status}
                          onChange={(event) => setEditingDraft({ ...editingDraft, status: event.target.value as AresMember["status"] })}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
                        >
                          {aresMemberStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cx("rounded px-2 py-1 text-xs font-semibold", memberStatusStyles[member.status])}>
                          {member.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEditing}
                            disabled={!editingDraft.name.trim()}
                            className="text-xs text-teal-300 hover:text-teal-100 disabled:cursor-not-allowed disabled:text-gray-600"
                            type="button"
                          >
                            {language === "en" ? "Save" : "保存"}
                          </button>
                          <button onClick={cancelEditing} className="text-xs text-gray-400 hover:text-gray-200" type="button">
                            {language === "en" ? "Cancel" : "キャンセル"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditing(member)} className="text-xs text-gray-400 hover:text-gray-200" type="button">
                            {language === "en" ? "Edit" : "編集"}
                          </button>
                          <button onClick={() => onRemoveMember(activeGroupId, member.id)} className="text-xs text-red-400 hover:text-red-300" type="button">
                            {language === "en" ? "Delete" : "削除"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-[minmax(120px,0.9fr)_120px_minmax(160px,1.2fr)_130px_auto]">
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder={language === "en" ? "Name" : "名前"}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none placeholder:text-gray-500"
        />
        <select
          value={draft.role}
          onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as MemberRole }))}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
        >
          {aresMemberRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <input
          value={draft.currentTask}
          onChange={(event) => setDraft((current) => ({ ...current, currentTask: event.target.value }))}
          placeholder={language === "en" ? "Assigned task" : "担当タスク"}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none placeholder:text-gray-500"
        />
        <select
          value={draft.status}
          onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AresMember["status"] }))}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 outline-none"
        >
          {aresMemberStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button
          onClick={addDraftMember}
          disabled={!draft.name.trim()}
          className="rounded bg-teal-800 px-3 py-1 text-sm text-teal-100 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
          type="button"
        >
          {language === "en" ? "Add" : "追加"}
        </button>
      </div>
    </GlassCard>
  );
}

function SystemReadinessCard({ language, isSecondary = false }: { language: LanguageMode; isSecondary?: boolean }) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(!isSecondary);
  const usableNowCount = connectionReadinessItems.filter((item) => item.tone === "local" || item.tone === "manual").length;
  const guardedCount = connectionReadinessItems.filter((item) => item.tone === "readOnly" || item.tone === "apiReady").length;
  const futureCount = connectionReadinessItems.filter((item) => item.tone === "future" || item.tone === "demo").length;
  const showDetails = !isSecondary || isExpanded;
  const summary = [
    {
      label: isEnglish ? "Usable now" : "今使える",
      value: usableNowCount,
      tone: "text-emerald-200",
    },
    {
      label: isEnglish ? "Guarded/API-ready" : "接続準備済み",
      value: guardedCount,
      tone: "text-blue-200",
    },
    {
      label: isEnglish ? "Needs connection" : "接続待ち",
      value: futureCount,
      tone: "text-amber-200",
    },
  ];

  return (
    <GlassCard className={cx("mb-3 p-3", isSecondary && "border-white/10 bg-slate-950/30 shadow-none")}>
      <div className={cx("flex min-w-0 flex-wrap items-start justify-between gap-3", showDetails && "mb-3")}>
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <Webhook size={isSecondary ? 16 : 18} className={cx("shrink-0", isSecondary ? "text-slate-400" : "text-cyan-300")} />
            <h2 className={cx("min-w-0 whitespace-normal break-words font-black", isSecondary ? "text-base text-slate-200" : "text-lg text-white")}>
              {isEnglish ? "Connection Readiness" : "Connection Readiness"}
            </h2>
            <Pill className="border-slate-500/25 bg-slate-900/35 text-slate-400">Readiness</Pill>
            {isSecondary && (
              <span className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px] font-bold text-slate-500">
                Secondary
              </span>
            )}
          </div>
          <p className={cx("max-w-4xl text-xs leading-relaxed", isSecondary ? "text-slate-500" : "text-slate-400")}>
            {isEnglish
              ? "Sydney Console is running in local/demo/read-only/manual-only mode. External account connections are not active yet."
              : "Sydney Console は Local / Demo / Read-only / Manual-only モードで稼働中です。外部アカウント接続はまだ有効ではありません。"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <div className={cx("grid min-w-[220px] grid-cols-3 gap-1.5", isSecondary && "opacity-75")}>
            {summary.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/8 bg-slate-950/35 px-2 py-1.5">
                <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className={cx(isSecondary ? "text-base" : "text-lg", "font-black tabular-nums", item.tone)}>{item.value}</div>
              </div>
            ))}
          </div>
          {isSecondary && (
            <button
              onClick={() => setIsExpanded((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              type="button"
            >
              {isExpanded ? (isEnglish ? "Collapse" : "折りたたむ") : (isEnglish ? "Expand" : "展開")}
              <ChevronDown size={14} className={cx("transition", isExpanded && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="grid min-w-0 gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {connectionReadinessItems.map((item) => (
            <div key={item.key} className="min-w-0 rounded-lg border border-white/8 bg-slate-950/30 px-3 py-2">
              <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{item.feature}</div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{item.source}</div>
                </div>
                <Pill className={readinessToneStyles[item.tone]}>{item.mode}</Pill>
              </div>
              <div className="grid min-w-0 gap-1.5 text-[11px] leading-relaxed text-slate-300 sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="font-bold text-slate-500">{isEnglish ? "Status:" : "Status:"}</span>{" "}
                  <span className="font-semibold text-slate-100">{item.status}</span>
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-500">{isEnglish ? "Remaining:" : "Remaining:"}</span>{" "}
                  <span className="break-words">{item.remaining}</span>
                </div>
              </div>
              <div className="mt-2 rounded-md border border-white/8 bg-slate-900/45 px-2 py-1.5 text-[11px] leading-relaxed text-slate-400">
                <span className="font-bold text-slate-300">{isEnglish ? "Safe next:" : "Safe next:"}</span>{" "}
                <span className="break-words">{item.nextStep}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function CompactTopThreeCompanion({ language, projects }: { language: LanguageMode; projects: AresProject[] }) {
  const t = uiText[language];
  const items = useMemo(
    () => sortProjectsForAttention(projects).slice(0, 3),
    [projects]
  );

  return (
    <GlassCard className="p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Target size={16} className="text-cyan-300" /> {t.top3}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Companion</span>
      </div>
      <div className="space-y-2">
        {items.map((project, index) => (
          <div key={project.id} className="rounded-lg border border-white/8 bg-slate-950/35 px-2.5 py-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/80 text-[11px] font-black text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 truncate text-xs font-bold text-white">{project.name}</div>
              <Pill className={priorityStyles[project.priority]}>{priorityLabel(project.priority, language)}</Pill>
              <span className="text-xs tabular-nums text-slate-400">{project.progress}%</span>
            </div>
            <div className="truncate pl-7 text-[11px] leading-relaxed text-slate-400">{project.nextAction}</div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-white/8 bg-slate-950/35 px-2.5 py-2 text-xs text-slate-400">
            {language === "en" ? "No local projects yet." : "Local project はまだありません。"}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function TopThreeCard({
  language,
  projects,
  isSecondary = false,
}: {
  language: LanguageMode;
  projects: AresProject[];
  isSecondary?: boolean;
}) {
  const t = uiText[language];
  const isEnglish = language === "en";
  const sortedDecisionProjects = useMemo(
    () => sortProjectsForAttention(projects),
    [projects]
  );
  const topProjectTasks = useMemo(() => {
    const sortedProjects = sortedDecisionProjects.slice(0, 3);

    if (sortedProjects.length === 0) {
      return [
        {
          id: "empty-project-state",
          title: language === "en" ? "Add a local project and next action" : "Local project と次のアクションを追加",
          priority: "低" as const,
          progressLabel: "--",
        },
      ];
    }

    return sortedProjects.map((project) => {
      const nextAction = project.nextAction.trim() || (language === "en" ? "Write the next action" : "次のアクションを書く");
      return {
        id: project.id,
        title: `${project.name}: ${nextAction}`,
        priority: project.priority,
        progressLabel: `${project.progress}%`,
      };
    });
  }, [language, sortedDecisionProjects]);

  const nextRecommendedProject = sortedDecisionProjects[0] ?? null;
  const nextRecommendedAction =
    nextRecommendedProject?.nextAction.trim() ||
    (isEnglish ? "Pick one active project and write the next action" : "稼働中Projectを1つ選び、次のアクションを書く");
  const blockerProjects = sortedDecisionProjects.filter((project) => project.blocker.trim().length > 0);
  const blockerPreview = blockerProjects.slice(0, 2);

  return (
    <GlassCard
      className={cx(
        isSecondary
          ? "min-w-0 overflow-hidden border-white/10 bg-slate-950/35 p-3 shadow-none"
          : "min-w-0 overflow-hidden border-cyan-300/20 bg-slate-950/60 p-4 shadow-[0_22px_90px_rgba(14,165,233,0.12)]"
      )}
    >
      <div className={cx("flex min-w-0 flex-wrap items-start justify-between gap-3", isSecondary ? "mb-2.5" : "mb-3")}>
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cx(
              "grid shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-500/15 text-cyan-100",
              isSecondary ? "h-8 w-8" : "h-9 w-9"
            )}
          >
            <Target size={isSecondary ? 17 : 20} />
          </div>
          <div className="min-w-0">
            <div
              className={cx(
                "text-[10px] font-bold uppercase tracking-[0.16em]",
                isSecondary ? "text-slate-500" : "text-cyan-200/90"
              )}
            >
              {isSecondary ? "Supporting Review" : isEnglish ? "Act Now / Next Action / Blockers" : "今やる判断 / 次の一手 / ブロッカー"}
            </div>
            <h2 className={cx("font-black tracking-tight text-white", isSecondary ? "text-base" : "text-2xl")}>
              {t.top3}
            </h2>
            <p className="truncate text-xs text-slate-400">{t.top3Sub}</p>
          </div>
        </div>
        <div>
          <Pill
            className={blockerProjects.length > 0 ? priorityStyles["高"] : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"}
            title={isEnglish ? "Projects with a blocker note in local project data" : "Local project data にブロッカーがある件数"}
          >
            {blockerProjects.length > 0
              ? isEnglish ? `${blockerProjects.length} blockers` : `${blockerProjects.length}件 ブロッカー`
              : isEnglish ? "Clear" : "ブロッカーなし"}
          </Pill>
        </div>
      </div>

      <div className={cx("grid min-w-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.55fr)] xl:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.55fr)]", isSecondary ? "gap-2.5" : "gap-2.5")}>
        <div className="min-w-0 space-y-2">
          {topProjectTasks.map((task, index) => (
            <div
              key={task.id}
              className={cx(
                "flex min-w-0 items-center overflow-hidden rounded-lg border bg-slate-950/45 shadow-[inset_2px_0_0_rgba(34,211,238,0.18)]",
                priorityLeftBorderStyles[task.priority],
                isSecondary
                  ? "min-h-10 gap-2 border-white/8 px-2.5 py-1.5 xl:gap-2.5"
                  : "min-h-12 gap-2.5 border-cyan-300/12 px-3 py-2 xl:gap-3"
              )}
            >
              <span
                className={cx(
                  "grid shrink-0 place-items-center rounded-full font-black",
                  index === 0 && "bg-red-900/40 text-red-400",
                  index === 1 && "bg-amber-900/40 text-amber-400",
                  index === 2 && "bg-teal-900/40 text-teal-400",
                  isSecondary
                    ? "h-5 w-5 text-[11px] shadow-none"
                    : "h-5 w-5 text-[11px] shadow-none"
                )}
              >
                {index + 1}
              </span>
              <span className={cx("min-w-0 flex-1 truncate font-bold text-white", isSecondary ? "text-xs" : "text-sm")}>{task.title}</span>
              <Pill className={cx("shrink-0", priorityStyles[task.priority])}>{priorityLabel(task.priority, language)}</Pill>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">{task.progressLabel}</span>
            </div>
          ))}
        </div>

        <div className="min-w-0 space-y-2">
          <div className={cx("rounded-lg border border-cyan-300/25 bg-cyan-500/12", isSecondary ? "p-2.5" : "p-3")}>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-cyan-100">
              <Zap size={13} /> {isEnglish ? "Do Next" : "次にやる"}
            </div>
            <div className={cx("line-clamp-2 font-black leading-snug text-white", isSecondary ? "text-sm" : "text-lg")}>{nextRecommendedAction}</div>
            {nextRecommendedProject && (
              <div className="mt-1 truncate text-[11px] font-semibold text-cyan-100/70">{nextRecommendedProject.name}</div>
            )}
          </div>

          <div className={cx(
            "rounded-md border p-2.5",
            blockerProjects.length > 0
              ? "border-red-800/50 bg-red-950/60"
              : "border-emerald-300/15 bg-emerald-500/8"
          )}>
            <div className={cx(
              "mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide",
              blockerProjects.length > 0 ? "text-red-400" : "text-emerald-200/85"
            )}>
              {blockerProjects.length > 0 ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
              {isEnglish ? "Watch Blockers" : "ブロッカー確認"}
            </div>
            {blockerPreview.length > 0 ? (
              <div className="space-y-1">
                {blockerPreview.map((project) => (
                  <div key={project.id} className="line-clamp-1 text-xs leading-relaxed text-red-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-red-400">{project.name}:</span> {project.blocker}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-semibold text-emerald-100">
                {isEnglish ? "No local blockers flagged." : "Local blocker はありません。"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-2">
        <CompactTrustMeta
          items={[
            { label: "Source", value: "Local", tone: "local" },
            { label: "Trust", value: "Manual", tone: "manual" },
            { label: "Updated", value: "LocalState", tone: "local" },
          ]}
        />
        <button className="text-xs font-medium text-blue-300 hover:text-cyan-200">{t.allTasks}</button>
      </div>
    </GlassCard>
  );
}

function AiSummaryCard({
  commandLog,
  defaultAdvancedTools = false,
  language,
  projects,
  studyStatus,
}: {
  commandLog: CommandLogEntry[];
  defaultAdvancedTools?: boolean;
  language: LanguageMode;
  projects: AresProject[];
  studyStatus: StudyStatus;
}) {
  const isEnglish = language === "en";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [generatedSummaryDraft, setGeneratedSummaryDraft] = useState("");
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAiSummaryApproved, setIsAiSummaryApproved] = useState(false);
  const [isPostingApprovedDraft, setIsPostingApprovedDraft] = useState(false);
  const [approvedDraftPostStatus, setApprovedDraftPostStatus] = useState("");
  const [approvedDraftPostError, setApprovedDraftPostError] = useState("");
  const [showAdvancedSummaryTools, setShowAdvancedSummaryTools] = useState(defaultAdvancedTools);
  const [githubProjectsSummarySource, setGitHubProjectsSummarySource] = useState<GitHubProjectsSummarySourceState>({
    status: "not_checked",
  });
  const approvedDraftPostInFlightRef = useRef(false);
  const latest = commandLog[0];
  const sampleProject = projects.find((project) => project.status !== "完了") ?? projects[0];
  const blockerProjects = projects.filter((project) => project.blocker.trim().length > 0);
  const blockerPreview = blockerProjects
    .slice(0, 2)
    .map((project) => `${project.name}: ${project.blocker}`)
    .join(" / ");
  const selectedProjectPreview = sampleProject ? `${sampleProject.name} (${projectStatusLabel(sampleProject.status, language)}, ${sampleProject.progress}%)` : "No local project selected";
  const projectHealth = blockerProjects.length > 0
    ? `${projects.length} projects, ${blockerProjects.length} blocker${blockerProjects.length === 1 ? "" : "s"} to review`
    : `${projects.length} projects, no blockers flagged`;
  const summaryStatus = "Draft preview only / manual review required";
  const currentBlockers = blockerPreview || "No local blockers flagged";
  const recentProgress = latest ? latest.text : sampleProject ? `${sampleProject.name}: ${sampleProject.phase}` : "No recent command log yet";
  const nextRecommendedAction = sampleProject?.nextAction || "Pick one active project and write the next action";
  const sourceStatus = "Local UI state only / summary route draft request only";
  const pythonStudyStatus = `Day ${studyDay.dayNumber}: ${focusStatusLabel(studyStatus, language)}`;
  const latestCommandLog = latest ? `${latest.time} - ${latest.text}` : "No command log item available";
  const mockInputPayload = {
    selectedProject: selectedProjectPreview,
    projectHealth,
    summaryStatus,
    currentBlockers,
    recentProgress,
    nextRecommendedAction,
    sourceStatus,
    pythonStudyStatus,
    latestCommandLog,
  };
  const previewRows = [
    {
      label: "Selected project",
      value: selectedProjectPreview,
    },
    {
      label: "Project health",
      value: projectHealth,
    },
    {
      label: "Summary status",
      value: summaryStatus,
    },
    {
      label: "Current blockers",
      value: currentBlockers,
    },
    {
      label: "Recent progress",
      value: recentProgress,
    },
    {
      label: "Next recommended action",
      value: nextRecommendedAction,
    },
    {
      label: "Source status",
      value: sourceStatus,
    },
    {
      label: "Learning sprint status",
      value: pythonStudyStatus,
    },
    {
      label: "Latest command log",
      value: latestCommandLog,
    },
  ];
  const readinessItems = [
    { label: "Mock input preview ready", status: "ready" },
    { label: "Copy mock input ready", status: "ready" },
    { label: "Local project/study context ready", status: "ready" },
    { label: "Generate button produces draft preview only", status: "guardrail" },
    { label: "Summary route request does not post to Discord", status: "guardrail" },
    { label: "OpenAI API is guarded by server configuration", status: "guardrail" },
    { label: "Existing backend generation route is reused", status: "guardrail" },
    { label: "Discord behavior unchanged", status: "guardrail" },
  ];
  const approvalGateItems = [
    "Future AI summary must be reviewed by user",
    "Posting remains manual until approved",
    "Discord posting is not triggered from this card",
    "Generate Summary creates draft preview only",
    "Post Approved Draft to Discord requires explicit approval",
  ];
  const approvedDraftPostFeedback = (() => {
    if (isPostingApprovedDraft) {
      return {
        message: "Posting approved draft to Discord...",
        tone: "pending",
      };
    }

    if (approvedDraftPostStatus) {
      return {
        message: approvedDraftPostStatus,
        tone: "success",
      };
    }

    if (approvedDraftPostError) {
      return {
        message: approvedDraftPostError,
        tone: approvedDraftPostError === APPROVED_DRAFT_POST_FAILURE_MESSAGE ? "error" : "warning",
      };
    }

    if (!generatedSummaryDraft) {
      return {
        message: APPROVED_DRAFT_POST_NO_DRAFT_MESSAGE,
        tone: "warning",
      };
    }

    if (!isAiSummaryApproved) {
      return {
        message: APPROVED_DRAFT_POST_NEEDS_APPROVAL_MESSAGE,
        tone: "warning",
      };
    }

    return {
      message: "Ready to post after explicit click.",
      tone: "ready",
    };
  })();
  const approvedDraftPostFeedbackClass = cx(
    "mt-2 rounded-lg border px-3 py-2 text-xs font-semibold leading-relaxed",
    approvedDraftPostFeedback.tone === "success" && "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    approvedDraftPostFeedback.tone === "pending" && "border-blue-400/25 bg-blue-500/10 text-blue-100",
    approvedDraftPostFeedback.tone === "ready" && "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    approvedDraftPostFeedback.tone === "warning" && "border-amber-400/25 bg-amber-500/10 text-amber-100",
    approvedDraftPostFeedback.tone === "error" && "border-red-400/25 bg-red-500/10 text-red-100"
  );
  const githubProjectsSourceDisplay = (() => {
    if (githubProjectsSummarySource.status === "included") {
      return {
        label: "GitHub Projects source: included",
        detail: `${githubProjectsSummarySource.projectTitle} / ${githubProjectsSummarySource.returnedItemCount} item${githubProjectsSummarySource.returnedItemCount === 1 ? "" : "s"} returned`,
        pill: "Read-only",
        className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
        pillClassName: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200",
      };
    }

    if (githubProjectsSummarySource.status === "unavailable") {
      return {
        label: "GitHub Projects source: unavailable / not configured",
        detail: GITHUB_PROJECTS_SUMMARY_UNAVAILABLE_MESSAGE,
        pill: "Safe",
        className: "border-amber-400/25 bg-amber-500/10 text-amber-100",
        pillClassName: "border-amber-400/45 bg-amber-500/15 text-amber-200",
      };
    }

    return {
      label: "GitHub Projects source: not checked yet",
      detail: "Generate Summary will check the read-only source and continue safely.",
      pill: "Pending",
      className: "border-slate-400/20 bg-slate-900/45 text-slate-200",
      pillClassName: "border-slate-500/50 bg-slate-700/35 text-slate-300",
    };
  })();

  const copyMockInput = async () => {
    const didCopy = await safeCopyText(JSON.stringify(mockInputPayload, null, 2));

    if (didCopy) {
      setCopyStatus("copied");
      return;
    }

    setCopyStatus("failed");
  };

  const handleGenerateSummary = async () => {
    setGeneratedSummaryDraft("");
    setAiSummaryError("");
    setIsAiSummaryApproved(false);
    setApprovedDraftPostStatus("");
    setApprovedDraftPostError("");
    setGitHubProjectsSummarySource({ status: "not_checked" });
    setIsGeneratingSummary(true);

    try {
      const githubProjects = await fetchGitHubProjectsForSummary();
      setGitHubProjectsSummarySource(
        githubProjects
          ? {
              status: "included",
              projectTitle: githubProjects.project.title,
              returnedItemCount: githubProjects.project.returnedItemCount,
              readOnly: true,
            }
          : { status: "unavailable" }
      );

      const summaryPayload = {
        ...mockInputPayload,
        sourceStatus: githubProjects
          ? `${mockInputPayload.sourceStatus} / GitHub Projects read-only source included`
          : `${mockInputPayload.sourceStatus} / ${GITHUB_PROJECTS_SUMMARY_UNAVAILABLE_MESSAGE}`,
        ...(githubProjects ? { githubProjects } : {}),
      };

      const response = await fetch("/api/ai/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(summaryPayload),
      });

      if (!response.ok) {
        setAiSummaryError(
          response.status === 503
            ? "AI summary generation is not configured yet. Add OPENAI_API_KEY later to enable this."
            : "AI summary generation failed safely. Review the mock input and try again later."
        );
        return;
      }

      const data = (await response.json()) as { draft?: unknown };
      const draft = typeof data.draft === "string" ? data.draft.trim() : "";

      if (!draft) {
        setAiSummaryError("AI summary generation returned no draft. Please try again later.");
        return;
      }

      setGeneratedSummaryDraft(draft);
    } catch {
      setAiSummaryError("AI summary generation is unavailable right now. Please try again later.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handlePostApprovedDraftToDiscord = async () => {
    const draft = generatedSummaryDraft.trim();

    if (!draft) {
      setApprovedDraftPostStatus("");
      setApprovedDraftPostError(APPROVED_DRAFT_POST_NO_DRAFT_MESSAGE);
      return;
    }

    if (!isAiSummaryApproved) {
      setApprovedDraftPostStatus("");
      setApprovedDraftPostError(APPROVED_DRAFT_POST_NEEDS_APPROVAL_MESSAGE);
      return;
    }

    if (approvedDraftPostInFlightRef.current) {
      return;
    }

    if (approvedDraftPostStatus) {
      return;
    }

    setApprovedDraftPostStatus("");
    setApprovedDraftPostError("");
    approvedDraftPostInFlightRef.current = true;
    setIsPostingApprovedDraft(true);

    try {
      const response = await fetch("/api/integrations/discord/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft,
          approved: true,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        setApprovedDraftPostError(APPROVED_DRAFT_POST_FAILURE_MESSAGE);
        return;
      }

      setApprovedDraftPostStatus(data.message || "Approved AI summary posted to Discord.");
    } catch {
      setApprovedDraftPostError(APPROVED_DRAFT_POST_FAILURE_MESSAGE);
    } finally {
      approvedDraftPostInFlightRef.current = false;
      setIsPostingApprovedDraft(false);
    }
  };

  return (
    <GlassCard className="p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-300" size={20} />
          <div>
            <h2 className="text-lg font-bold text-white">AI PM Summary Prep</h2>
            <p className="mt-0.5 text-xs text-slate-500">Draft Preview / No Discord Posting</p>
          </div>
        </div>
        <Pill className="border-blue-400/50 bg-blue-500/15 text-blue-200">{isEnglish ? "Draft Only" : "ドラフトのみ"}</Pill>
      </div>

      <CompactTrustMeta
        className="mb-2"
        items={[
          { label: "Source", value: "Local + AI", tone: "ai" },
          { label: "Trust", value: "Preview", tone: "preview" },
          { label: "Updated", value: "On generate", tone: "manual" },
        ]}
      />

      <div className="mb-2 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs leading-relaxed text-blue-100">
        Generate Summary requests a draft from the AI summary route only. Discord posting remains separate.
      </div>

      <div className={cx("mb-2 rounded-lg border px-3 py-2 text-xs leading-relaxed", githubProjectsSourceDisplay.className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold">{githubProjectsSourceDisplay.label}</div>
          <Pill className={githubProjectsSourceDisplay.pillClassName}>{githubProjectsSourceDisplay.pill}</Pill>
        </div>
        <div className="mt-1 text-[11px] leading-relaxed opacity-90">{githubProjectsSourceDisplay.detail}</div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={handleGenerateSummary}
          disabled={isGeneratingSummary}
          className={cx(
            "rounded-xl border px-4 py-2.5 text-sm font-bold transition",
            isGeneratingSummary
              ? "cursor-wait border-slate-500/40 bg-slate-800/50 text-slate-400"
              : "border-indigo-300/35 bg-indigo-500/20 text-indigo-100 hover:border-indigo-200/60 hover:bg-indigo-500/30"
          )}
          type="button"
        >
          {isGeneratingSummary ? (isEnglish ? "Generating..." : "生成中...") : (isEnglish ? "Generate Summary" : "サマリー生成")}
        </button>
        <button
          onClick={() => setShowAdvancedSummaryTools((current) => !current)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          type="button"
        >
          {showAdvancedSummaryTools ? "Less" : "Tools"}
          <ChevronDown size={14} className={cx("transition", showAdvancedSummaryTools && "rotate-180")} />
        </button>
      </div>

      {(generatedSummaryDraft || aiSummaryError) && (
        <div className="mt-3 rounded-xl border border-indigo-400/20 bg-slate-950/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">AI Summary Draft Preview</h3>
            <Pill className="border-amber-400/45 bg-amber-500/15 text-amber-200">{isEnglish ? "Draft Only" : "ドラフトのみ"}</Pill>
          </div>
          {generatedSummaryDraft && (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{generatedSummaryDraft}</p>
          )}
          {aiSummaryError && (
            <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {aiSummaryError}
            </div>
          )}
          <div className="mt-3 rounded-lg border border-white/8 bg-slate-900/50 p-3">
            <label className={cx(
              "flex items-start gap-2 text-xs font-semibold leading-relaxed",
              generatedSummaryDraft ? "cursor-pointer text-slate-200" : "cursor-not-allowed text-slate-500"
            )}>
              <input
                checked={isAiSummaryApproved}
                disabled={!generatedSummaryDraft}
                onChange={(event) => setIsAiSummaryApproved(event.target.checked)}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-950 text-indigo-400 disabled:cursor-not-allowed"
              />
              <span>Approve AI draft for manual Discord posting</span>
            </label>
            <div className={cx(
              "mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
              isAiSummaryApproved
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                : "border-amber-400/25 bg-amber-500/10 text-amber-100"
            )}>
              {isAiSummaryApproved
                ? "Approved for manual Discord posting. No message has been posted yet."
                : "Manual approval required before Discord posting."}
            </div>
          </div>
        </div>
      )}

      {showAdvancedSummaryTools && (
        <div className="mt-2">
      <CollapsibleBlock
        title="AI Summary Input Preview"
        description="Mock payload and copy helper for draft generation."
        badge={<Pill className="border-indigo-400/40 bg-indigo-500/15 text-indigo-200">{isEnglish ? "Mock Only" : "モックのみ"}</Pill>}
        language={language}
      >
        <div className="rounded-xl border border-indigo-400/20 bg-slate-950/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">AI Summary Input Preview</h3>
            <Pill className="border-indigo-400/40 bg-indigo-500/15 text-indigo-200">{isEnglish ? "Mock Only" : "モックのみ"}</Pill>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">Mock input preview for draft generation only.</p>
          <div className="mb-3">
            <button
              onClick={copyMockInput}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-300/35 hover:bg-indigo-500/10 hover:text-indigo-100"
              type="button"
            >
              Copy Mock Input
            </button>
            {copyStatus !== "idle" && (
              <div className={cx(
                "mt-2 text-xs",
                copyStatus === "copied" ? "text-emerald-300" : "text-amber-300"
              )}>
                {copyStatus === "copied" ? "Copied mock input" : "Copy unavailable — select text manually"}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {previewRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/8 bg-slate-900/50 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{row.label}</div>
                <div className="mt-1 break-words text-xs leading-relaxed text-slate-200">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="AI Integration Readiness Checklist"
        description="Detailed guardrails for future AI route wiring."
        badge={<Pill className="border-amber-400/40 bg-amber-500/15 text-amber-200">{isEnglish ? "Guardrails" : "ガードレール"}</Pill>}
        language={language}
      >
        <div className="rounded-xl border border-amber-400/20 bg-slate-950/35 p-3">
          <h3 className="mb-2 text-sm font-bold text-white">AI Integration Readiness Checklist</h3>
          <div className="space-y-1.5">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-start gap-2 rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-2">
                <span className={cx(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black",
                  item.status === "ready"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-amber-500/20 text-amber-200"
                )}>
                  {item.status === "ready" ? "✓" : "!"}
                </span>
                <span className="min-w-0 text-xs leading-relaxed text-slate-200">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Manual Review / Approval Gate"
        description="Review rules before a future approved Discord post."
        badge={<Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">Manual</Pill>}
        language={language}
      >
        <div className="rounded-xl border border-blue-400/20 bg-slate-950/35 p-3">
          <h3 className="mb-1.5 text-sm font-bold text-white">Manual Review / Approval Gate</h3>
          <p className="mb-2.5 text-xs leading-relaxed text-slate-400">
            Approval only unlocks the manual post button. It does not send anything by itself.
          </p>
          <div className="space-y-1.5">
            {approvalGateItems.map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-white/8 bg-slate-900/50 px-2.5 py-2">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-500/20 text-[10px] font-black text-blue-200">
                  !
                </span>
                <span className="min-w-0 text-xs leading-relaxed text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Summary Context Preview"
        description="Project health, blockers, recent progress, and next action."
        badge={<Pill className="border-slate-400/35 bg-slate-700/35 text-slate-200">Preview</Pill>}
        language={language}
      >
        <div className="space-y-3 rounded-xl border border-white/8 bg-slate-950/35 p-3 text-sm leading-relaxed">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/8 bg-slate-900/50 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Project health</div>
              <div className="mt-1 font-semibold text-emerald-200">Mock: Stable, with review needed on active work.</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-slate-900/50 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Summary status</div>
              <div className="mt-1 font-semibold text-blue-200">Mock Draft / Waiting for future AI connection.</div>
            </div>
          </div>

          <div className="rounded-lg border border-white/8 bg-slate-900/50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Current blockers</div>
            <p className="mt-1 text-slate-300">Mock: Confirm project blockers, GitHub preview risks, and learning sprint status before generating a real PM summary.</p>
          </div>

          <div className="rounded-lg border border-white/8 bg-slate-900/50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent progress</div>
            <p className="mt-1 text-slate-300">
              {latest ? `Local context available from latest log: ${latest.text}` : "Mock: Recent project updates will appear here after future summary wiring."}
            </p>
          </div>

          <div className="rounded-lg border border-white/8 bg-slate-900/50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Next recommended action</div>
            <p className="mt-1 text-slate-300">Mock: Pick one active project, resolve one blocker, then write a short Daily Review note.</p>
          </div>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Manual Discord Post Gate"
        description="Approval-gated Discord posting controls stay available but tucked away."
        badge={<Pill className="border-emerald-400/45 bg-emerald-500/15 text-emerald-200">{isEnglish ? "Explicit Click Only" : "明示クリックのみ"}</Pill>}
        language={language}
      >
        <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Manual Discord Post Gate</h3>
            <Pill className="border-emerald-400/45 bg-emerald-500/15 text-emerald-200">{isEnglish ? "Explicit Click Only" : "明示クリックのみ"}</Pill>
          </div>
          <button
            onClick={handlePostApprovedDraftToDiscord}
            disabled={!generatedSummaryDraft || !isAiSummaryApproved || isPostingApprovedDraft || Boolean(approvedDraftPostStatus)}
            className={cx(
              "w-full rounded-lg border px-3 py-2 text-xs font-bold transition",
              !generatedSummaryDraft || !isAiSummaryApproved || isPostingApprovedDraft || approvedDraftPostStatus
                ? "cursor-not-allowed border-slate-500/40 bg-slate-800/50 text-slate-400"
                : "border-emerald-300/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-500/25"
            )}
            type="button"
          >
            {isPostingApprovedDraft ? "Posting..." : "Post Approved Draft to Discord"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            AI Summary approval-gated Discord post. Requires generated draft, manual approval, and this explicit click.
          </p>
          <div className={approvedDraftPostFeedbackClass}>
            {approvedDraftPostFeedback.message}
          </div>
        </div>
      </CollapsibleBlock>
        </div>
      )}
    </GlassCard>
  );
}

function PythonStudyTopCard({
  addLog,
  isExpanded,
  language,
  setIsExpanded,
  studyMemo,
  studyStatus,
  setStudyMemo,
  setStudyStatus,
}: {
  addLog: (text: string) => void;
  isExpanded: boolean;
  language: LanguageMode;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  studyMemo: string;
  studyStatus: StudyStatus;
  setStudyMemo: React.Dispatch<React.SetStateAction<string>>;
  setStudyStatus: React.Dispatch<React.SetStateAction<StudyStatus>>;
}) {
  const t = uiText[language];
  const isEnglish = language === "en";

  const updateStatus = (status: StudyStatus) => {
    setStudyStatus(status);
    addLog(
      isEnglish
        ? `Active Focus updated to ${focusStatusLabel(status, language)}`
        : `アクティブフォーカスを「${focusStatusLabel(status, language)}」に更新`
    );
  };

  return (
    <GlassCard className="px-4 py-2.5">
      <button
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        type="button"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-500/10 text-cyan-200">
            <Code2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{isEnglish ? "Active Focus" : "アクティブフォーカス"}</div>
            <div className="truncate text-sm font-bold text-white">Day {studyDay.dayNumber}: {studyDay.title}</div>
            {!isExpanded && studyMemo.trim() && (
              <div className="mt-0.5 truncate text-xs text-slate-500">{studyMemo.trim()}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill className={cx("gap-1", statusStyles[studyStatus])}>{focusStatusLabel(studyStatus, language)}</Pill>
          <ChevronDown size={16} className={cx("text-slate-500 transition", isExpanded && "rotate-180")} />
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <CompactTrustMeta
            className="mb-3"
            items={[
              { label: "Source", value: "Local", tone: "local" },
              { label: "Trust", value: "Manual", tone: "manual" },
              { label: "Updated", value: "LocalStorage", tone: "local" },
            ]}
          />
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-4xl font-black text-cyan-300">Day {studyDay.dayNumber}</div>
            <div className="mt-3 text-lg font-bold text-cyan-300">{t.theme}: {studyDay.title}</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{studyDay.summary}</p>
            <div className="mt-5 border-t border-white/10 pt-4 text-sm">
              <span className="font-bold text-cyan-300">{t.completion}:</span>{" "}
              <span className="text-slate-200">{studyDay.criteria}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => updateStatus("完了")}
                className={cx(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-bold transition",
                  studyStatus === "完了"
                    ? "border-emerald-300 bg-emerald-500/45 text-white shadow-[0_0_22px_rgba(16,185,129,0.25)]"
                    : "border-emerald-400/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                )}
                type="button"
              >
                <CheckCircle2 size={18} /> {t.done}
              </button>
              <button
                onClick={() => updateStatus("未完了")}
                className={cx(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-bold transition",
                  studyStatus === "未完了"
                    ? "border-amber-300 bg-amber-500/40 text-white shadow-[0_0_22px_rgba(245,158,11,0.22)]"
                    : "border-amber-400/45 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                )}
                type="button"
              >
                <span className="h-4 w-4 rounded-full border-2 border-current" /> {t.incomplete}
              </button>
              <button
                onClick={() => updateStatus("困ってる")}
                className={cx(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-bold transition",
                  studyStatus === "困ってる"
                    ? "border-red-300 bg-red-500/40 text-white shadow-[0_0_22px_rgba(239,68,68,0.22)]"
                    : "border-red-400/45 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                )}
                type="button"
              >
                <TriangleAlert size={17} /> {t.stuck}
              </button>
            </div>
            <textarea
              value={studyMemo}
              onChange={(event) => setStudyMemo(event.target.value)}
              placeholder={t.studyMemo}
              className="mt-4 h-20 w-full resize-none rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "GitHub") return <Github size={24} className="text-white" />;
  if (type === "Calendar") return <CalendarDays size={24} className="text-red-300" />;
  return <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-sm font-black text-white">D</div>;
}

function NotificationsCard({ language }: { language: LanguageMode }) {
  const t = uiText[language];
  const [tab, setTab] = useState("すべて");
  const filtered = tab === "すべて" ? notifications : notifications.filter((item) => item.type === tab);

  return (
    <GlassCard className="p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="text-slate-300" size={20} />
          <h2 className="text-lg font-bold text-white">Notifications</h2>
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            Demo data
          </span>
        </div>
        <Settings size={18} className="text-slate-400" />
      </div>
      <CompactTrustMeta
        className="mb-2"
        items={[
          { label: "Source", value: "Mock", tone: "mock" },
          { label: "Trust", value: "Demo", tone: "demo" },
          { label: "Updated", value: "Static", tone: "preview" },
        ]}
      />
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-white/8 bg-slate-950/40 p-1 text-xs">
        {[
          { key: "すべて", label: t.all },
          { key: "Discord", label: t.discord },
          { key: "GitHub", label: t.github },
          { key: "Calendar", label: t.calendar },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cx(
              "rounded-md py-1.5 transition",
              tab === item.key ? "bg-blue-500/45 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 rounded-lg border border-amber-300/15 bg-amber-400/5 px-3 py-1.5 text-[11px] text-amber-100/80">
        Sample dashboard notifications for demo visibility. These are not live system events.
      </div>
      <div className="mt-2 space-y-1.5">
        {filtered.map((item) => {
          const display = notificationDisplay(item, language);
          return (
            <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-slate-950/30 px-2.5 py-2">
              <NotificationIcon type={item.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{display.title}</div>
                <div className="truncate text-xs text-slate-400">{display.body}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {display.time}
                <span className="h-2 w-2 rounded-full bg-blue-400" />
              </div>
            </div>
          );
        })}
      </div>
      <button className="mt-2 w-full text-xs font-medium text-blue-300 hover:text-cyan-200">{t.allNotifications}</button>
    </GlassCard>
  );
}

function ProjectRow({
  project,
  language,
  onOpenProject,
}: {
  project: AresProject;
  language: LanguageMode;
  onOpenProject: (project: AresProject) => void;
}) {
  const t = uiText[language];
  const needsAttention = project.blocker.trim().length > 0 || project.priority === "高";
  return (
    <div
      className={cx(
        "grid min-h-10 min-w-[700px] grid-cols-[minmax(140px,1.05fr)_minmax(96px,0.55fr)_minmax(170px,1.35fr)_78px_64px_64px] items-center gap-2 border-t px-2.5 py-1.5 transition first:border-t-0",
        needsAttention
          ? "border-amber-300/12 bg-amber-500/[0.035] hover:bg-amber-500/[0.055]"
          : "border-white/8 hover:bg-white/[0.025]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500 text-[11px] font-bold text-white">{project.rank}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{project.name}</div>
          <div className="truncate text-[11px] text-slate-500">{project.phase}</div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="w-9 text-sm font-semibold text-white tabular-nums">{project.progress}%</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cx("h-full rounded-full", priorityProgressStyles[project.priority])}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>
      <div className="min-w-0 text-xs leading-relaxed text-slate-200">
        <div className="truncate">{project.nextAction}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
          <CalendarDays size={13} /> {project.due}
        </div>
      </div>
      <div className="flex items-center">
        <Pill className={statusStyles[project.status]}>{projectStatusLabel(project.status, language)}</Pill>
      </div>
      <div className="flex items-center gap-1.5">
        <Pill className={priorityStyles[project.priority]}>{priorityLabel(project.priority, language)}</Pill>
        {project.blocker.trim() && (
          <span className="h-2 w-2 rounded-full bg-amber-300" title={project.blocker} />
        )}
      </div>
      <button
        onClick={() => onOpenProject(project)}
        className="inline-flex items-center justify-center rounded-md border border-blue-400/25 bg-blue-500/10 px-1.5 py-1 text-[11px] font-bold text-blue-100 transition hover:bg-blue-500/20"
        type="button"
        title={t.details}
      >
        {t.detailsShort}
      </button>
    </div>
  );
}

function LocalProjectResponsiveCard({
  project,
  language,
  onOpenProject,
}: {
  project: AresProject;
  language: LanguageMode;
  onOpenProject: (project: AresProject) => void;
}) {
  const t = uiText[language];
  const needsAttention = project.blocker.trim().length > 0 || project.priority === "高";

  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border bg-slate-950/35 p-3",
        needsAttention ? "border-amber-300/14 bg-amber-500/[0.035]" : "border-white/8"
      )}
    >
      <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
            {project.rank}
          </span>
          <div className="min-w-0">
            <div className="break-words text-sm font-bold leading-snug text-white">{project.name}</div>
            <div className="mt-0.5 break-words text-[11px] leading-snug text-slate-500">{project.phase}</div>
          </div>
        </div>
        <button
          onClick={() => onOpenProject(project)}
          className="shrink-0 rounded-md border border-blue-400/25 bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-100 transition hover:bg-blue-500/20"
          type="button"
          title={t.details}
        >
          {t.detailsShort}
        </button>
      </div>

      <div className="mb-2 min-w-0">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Progress</span>
          <span className="text-sm font-black tabular-nums text-white">{project.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cx("h-full rounded-full", priorityProgressStyles[project.priority])}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
        <Pill className={statusStyles[project.status]}>{projectStatusLabel(project.status, language)}</Pill>
        <Pill className={priorityStyles[project.priority]}>{priorityLabel(project.priority, language)}</Pill>
        {project.blocker.trim() && (
          <span className="rounded-md border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-200">
            Blocker
          </span>
        )}
      </div>

      <div className="min-w-0 rounded-md border border-white/8 bg-slate-950/35 px-2.5 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t.nextAction}</div>
        <div className="mt-1 break-words text-xs font-semibold leading-relaxed text-slate-100">{project.nextAction}</div>
        {project.due && (
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
            <CalendarDays size={13} className="shrink-0" />
            <span className="min-w-0 break-words">{project.due}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GitHubWorkspaceOverview({
  data,
  error,
  isLoading,
  language,
  lastFetchedAt,
  onFetch,
}: {
  data: GitHubWorkspaceResult | null;
  error: string | null;
  isLoading: boolean;
  language: LanguageMode;
  lastFetchedAt: string;
  onFetch: () => void;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const repos = data?.ok ? data.repos : [];
  const requiredEnv = data?.requiredEnv ?? ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPOS"];
  const hasRows = repos.length > 0;

  return (
    <GlassCard className="mb-3 border-white/10 bg-slate-950/35 p-3 shadow-none">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <button
          onClick={() => setIsExpanded((current) => !current)}
          className="min-w-0 flex-1 text-left"
          type="button"
        >
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <Github size={16} className="shrink-0 text-slate-400" />
            <h2 className="min-w-0 whitespace-normal break-words text-base font-black text-slate-200">
              GitHub Workspace Overview
            </h2>
            <Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Read-only" : "読み取り専用"}</Pill>
            <Pill className="border-slate-500/45 bg-slate-700/30 text-slate-200">{isEnglish ? "Writes Disabled" : "書き込み無効"}</Pill>
            {hasRows ? (
              <span className="rounded-md border border-slate-500/25 bg-slate-900/40 px-2 py-1 text-[11px] font-bold text-slate-500">
                {repos.length} repos
              </span>
            ) : null}
          </div>
          <p className="max-w-4xl text-[11px] leading-relaxed text-slate-600">
            Read-only GitHub source. No dashboard writes.
          </p>
          {lastFetchedAt ? (
            <p className="mt-1 text-[11px] font-semibold text-slate-600">
              Last checked: {formatGitHubWorkspaceDate(lastFetchedAt)}
            </p>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs font-bold text-slate-400">
            Secondary
          </span>
          <button
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            type="button"
          >
            {isExpanded ? (isEnglish ? "Collapse" : "折りたたむ") : (isEnglish ? "Expand" : "展開")}
            <ChevronDown size={14} className={cx("transition", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <div className="mb-3 flex justify-end">
            <button
              onClick={onFetch}
              disabled={isLoading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-500/35 bg-slate-800/60 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/35 hover:bg-blue-500/15 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
              {isLoading ? "Fetching..." : "Fetch Workspace Overview"}
            </button>
          </div>

          {!hasRows ? (
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="text-sm font-bold text-slate-100">
                {error || GITHUB_WORKSPACE_NOT_CONFIGURED_MESSAGE}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {requiredEnv.map((env) => (
                  <code key={env} className="rounded-md border border-slate-500/45 bg-slate-900/70 px-2 py-1 text-[11px] font-bold text-slate-300">
                    {env}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                This section only reads normalized repo activity after local env setup. It never exposes token values.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-2">
              {repos.map((repo) => (
                <div
                  key={repo.name}
                  className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 p-3 text-xs text-slate-300"
                >
                  <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {repo.url ? (
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-w-0 whitespace-normal break-words text-sm font-black leading-snug text-blue-100 hover:text-cyan-200"
                        >
                          {repo.name}
                        </a>
                      ) : (
                        <div className="min-w-0 whitespace-normal break-words text-sm font-black leading-snug text-slate-100">{repo.name}</div>
                      )}
                      <div className="mt-1 min-w-0 whitespace-normal break-words text-[11px] text-slate-500">
                        {repo.defaultBranch ? `Default: ${repo.defaultBranch}` : repo.description || "No description"}
                      </div>
                    </div>
                    <Pill className={gitHubWorkspaceStatusClass(repo.status)}>{repo.status}</Pill>
                  </div>

                  <div className="mb-2 grid min-w-0 gap-2 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-white/8 bg-slate-950/35 px-3 py-2">
                      <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">Last updated</div>
                      <div className="font-semibold text-slate-200">
                        {formatGitHubWorkspaceDate(repo.pushedAt || repo.updatedAt)}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/8 bg-slate-950/35 px-3 py-2">
                      <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">Latest commit</div>
                      <div className="truncate font-semibold text-slate-100">
                        {repo.latestCommit.summary || "No commit summary"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        {formatGitHubWorkspaceDate(repo.latestCommit.committedDate)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-md border border-amber-300/15 bg-amber-500/[0.055] px-2 py-1 font-bold text-amber-100">
                      Issues <span className="tabular-nums">{repo.openIssuesCount}</span>
                    </span>
                    <span className="rounded-md border border-violet-300/15 bg-violet-500/[0.055] px-2 py-1 font-bold text-violet-100">
                      PRs <span className="tabular-nums">{repo.openPrCount}</span>
                    </span>
                  </div>

                  <div className="rounded-lg border border-cyan-300/10 bg-cyan-500/[0.04] px-3 py-2">
                    <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-200/70">Safe Next Action</div>
                    <div className="whitespace-normal break-words text-xs font-semibold leading-relaxed text-slate-200">
                      {repo.safeNextAction}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function GitHubActivitySection({
  activity,
  error,
  isLoading,
  language,
  onRefresh,
}: {
  activity: GitHubActivity | null;
  error: string | null;
  isLoading: boolean;
  language: LanguageMode;
  onRefresh: () => void;
}) {
  const isEnglish = language === "en";
  const commits = activity?.commits ?? [];
  const pullRequests = activity?.pullRequests ?? [];
  const issues = activity?.issues ?? [];
  const isRepoConfigHint = error === GITHUB_ACTIVITY_REPO_NOT_CONFIGURED_MESSAGE;

  return (
    <GlassCard className="mb-3 border-white/10 bg-slate-950/35 p-3 shadow-none">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <Github size={16} className="shrink-0 text-slate-400" />
            <h2 className="min-w-0 whitespace-normal break-words text-base font-black text-slate-200">
              GitHub Activity
            </h2>
            <Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Read-only" : "読み取り専用"}</Pill>
          </div>
          <p className="max-w-4xl text-[11px] leading-relaxed text-slate-600">
            Commits, open PRs, and open Issues from the read-only GitHub REST API.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gray-400 transition hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-white/8 bg-slate-950/25 px-3 py-3 text-sm text-slate-500">
          {isEnglish ? "Loading GitHub Activity..." : "GitHub Activityを取得中..."}
        </div>
      ) : error ? (
        <div
          className={cx(
            "rounded-xl border bg-slate-950/25 px-3 py-3 text-sm font-semibold",
            isRepoConfigHint ? "border-white/8 text-slate-500" : "border-red-400/20 text-red-300"
          )}
        >
          {error}
        </div>
      ) : (
        <div className="space-y-3">
          <section className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
              <Code2 size={15} className="shrink-0 text-teal-300" />
              <h3 className="text-sm font-black text-slate-200">Recent Commits</h3>
              <span className="rounded-md border border-slate-500/25 bg-slate-900/40 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                {isEnglish ? "Latest 5" : "最新5件"}
              </span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-white/8 bg-slate-950/25 p-2">
              {commits.length > 0 ? (
                commits.map((commit) => (
                  <div key={commit.sha} className="grid min-w-0 gap-2 rounded-lg bg-slate-900/35 px-2.5 py-2 text-xs sm:grid-cols-[68px_minmax(0,1fr)_96px_72px]">
                    <span className="font-mono text-xs font-bold text-teal-400">{commit.sha}</span>
                    <span className="min-w-0 truncate font-semibold text-slate-100">{commit.message}</span>
                    <span className="min-w-0 truncate text-slate-400">{commit.author}</span>
                    <span className="whitespace-nowrap text-slate-500">{timeAgo(commit.date, language)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2.5 py-2 text-sm text-slate-500">{isEnglish ? "No commits" : "コミットはありません"}</div>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
              <GitHubIconForActivity />
              <h3 className="text-sm font-black text-slate-200">Open PRs</h3>
              <span className="rounded-md border border-violet-300/15 bg-violet-500/[0.055] px-2 py-0.5 text-[11px] font-bold text-violet-100">
                {pullRequests.length}
              </span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-white/8 bg-slate-950/25 p-2">
              {pullRequests.length > 0 ? (
                pullRequests.map((pullRequest) => (
                  <div key={pullRequest.number} className="grid min-w-0 gap-2 rounded-lg bg-slate-900/35 px-2.5 py-2 text-xs sm:grid-cols-[48px_minmax(0,1fr)_90px_72px]">
                    <span className="font-black tabular-nums text-violet-200">#{pullRequest.number}</span>
                    <span className="min-w-0 truncate font-semibold text-slate-100">
                      {pullRequest.isDraft ? (
                        <span className="mr-1.5 rounded bg-gray-800 px-1 text-xs text-gray-400">Draft</span>
                      ) : null}
                      {pullRequest.title}
                    </span>
                    <span className="min-w-0 truncate text-slate-400">{pullRequest.author}</span>
                    <span className="whitespace-nowrap text-slate-500">{timeAgo(pullRequest.createdAt, language)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2.5 py-2 text-sm text-slate-500">{isEnglish ? "No open PRs" : "オープン中のPRはありません"}</div>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
              <TriangleAlert size={15} className="shrink-0 text-amber-300" />
              <h3 className="text-sm font-black text-slate-200">Open Issues</h3>
              <span className="rounded-md border border-amber-300/15 bg-amber-500/[0.055] px-2 py-0.5 text-[11px] font-bold text-amber-100">
                {issues.length}
              </span>
            </div>
            <div className="space-y-1.5 rounded-xl border border-white/8 bg-slate-950/25 p-2">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <div key={issue.number} className="grid min-w-0 gap-2 rounded-lg bg-slate-900/35 px-2.5 py-2 text-xs sm:grid-cols-[48px_minmax(0,1fr)_90px_72px]">
                    <span className="font-black tabular-nums text-amber-200">#{issue.number}</span>
                    <span className="min-w-0 truncate font-semibold text-slate-100">
                      {issue.labels.map((label) => (
                        <span key={label} className="mr-1.5 rounded bg-gray-800 px-1 text-xs text-gray-300">
                          {label}
                        </span>
                      ))}
                      {issue.title}
                    </span>
                    <span className="min-w-0 truncate text-slate-400">{issue.author}</span>
                    <span className="whitespace-nowrap text-slate-500">{timeAgo(issue.createdAt, language)}</span>
                  </div>
                ))
              ) : (
                <div className="px-2.5 py-2 text-sm text-slate-500">{isEnglish ? "No open issues" : "オープン中のIssueはありません"}</div>
              )}
            </div>
          </section>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2 text-[11px] font-semibold text-slate-500">
            <span>{isEnglish ? "Last updated:" : "最終更新:"} {formatGitHubActivityFetchedAt(activity?.fetchedAt ?? "", language)}</span>
            <span className="rounded-md border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs font-bold text-slate-400">
              Secondary
            </span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function GitHubIconForActivity() {
  return <ListChecks size={15} className="shrink-0 text-violet-300" />;
}

function AIProjectSummarySection({
  summary,
  error,
  isLoading,
  hasActivity,
  language,
  onGenerate,
}: {
  summary: ProjectSummary | null;
  error: string | null;
  isLoading: boolean;
  hasActivity: boolean;
  language: LanguageMode;
  onGenerate: () => void;
}) {
  const isEnglish = language === "en";
  return (
    <GlassCard className="mb-3 border-white/10 bg-slate-950/35 p-3 shadow-none">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <Sparkles size={16} className="shrink-0 text-purple-300" />
            <h2 className="min-w-0 whitespace-normal break-words text-base font-black text-slate-200">
              {isEnglish ? "AI Project Summary" : "AI プロジェクトサマリー"}
            </h2>
            <span className="rounded border border-purple-800/50 bg-purple-900/40 px-2 py-0.5 text-xs font-bold text-purple-400">
              {isEnglish ? "Draft Only" : "ドラフトのみ"}
            </span>
          </div>
          <p className="max-w-4xl text-[11px] leading-relaxed text-slate-600">
            {isEnglish
              ? "Manual draft using GitHub Activity and Local Project Status only."
              : "GitHub ActivityとLocal Project Statusだけを使う手動生成のドラフトです。"}
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={!hasActivity || isLoading}
          className="shrink-0 rounded bg-teal-800 px-3 py-1 text-sm font-bold text-teal-100 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {isLoading ? (isEnglish ? "Analyzing..." : "分析中...") : (isEnglish ? "Generate" : "生成する")}
        </button>
      </div>

      {!hasActivity ? (
        <div className="rounded-md border border-gray-700 bg-gray-900 p-4 text-sm leading-relaxed text-gray-400">
          {isEnglish
            ? "Please fetch GitHub Activity before clicking Generate."
            : "「生成する」ボタンを押す前に、先にGitHub Activityを取得してください。"}
        </div>
      ) : isLoading ? (
        <div className="rounded-md border border-gray-700 bg-gray-900 p-4 text-sm leading-relaxed text-gray-400">
          {isEnglish ? "Analyzing..." : "分析中..."}
        </div>
      ) : error ? (
        <div className="text-sm font-semibold text-red-400">{error}</div>
      ) : summary ? (
        <div className="space-y-2">
          <div className="whitespace-pre-wrap rounded-md border border-gray-700 bg-gray-900 p-4 text-sm leading-relaxed text-gray-200">
            {renderSummary(summary.summary)}
          </div>
          <div className="text-xs font-semibold text-gray-500">
            {language === "en"
              ? `Generated ${timeAgo(summary.generatedAt, language)} · AI draft`
              : `${timeAgo(summary.generatedAt, language)} に生成 · このサマリーはAIによるドラフトです`}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-gray-700 bg-gray-900 p-4 text-sm leading-relaxed text-gray-400">
          {isEnglish
            ? "Click Generate to analyze the latest GitHub activity and project status with AI."
            : "「生成する」ボタンを押すと、GitHubの最新情報とプロジェクト状況をAIが分析します。"}
        </div>
      )}
    </GlassCard>
  );
}

function RecipeGitHubProjectBoard({
  data,
  error,
  isLoading,
  language,
  lastFetchedAt,
  onFetch,
}: {
  data: GitHubReadTestResult | null;
  error: string | null;
  isLoading: boolean;
  language: LanguageMode;
  lastFetchedAt: string;
  onFetch: () => void;
}) {
  const isEnglish = language === "en";
  const project = data?.ok ? data.project : null;
  const owner = data?.owner;
  const items = data?.ok ? data.items ?? [] : [];
  const requiredEnv = ["GITHUB_TOKEN", "GITHUB_USER", "GITHUB_ORG", "GITHUB_PROJECT_NUMBER"];

  return (
    <GlassCard className="mb-3 border-blue-300/25 bg-slate-950/70 p-4 shadow-[0_24px_90px_rgba(14,165,233,0.13)]">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <Github size={19} className="shrink-0 text-blue-200" />
            <h2 className="min-w-0 whitespace-normal break-words text-xl font-black text-white">
              Demo GitHub Project Board
            </h2>
            <Pill className="border-cyan-300/40 bg-cyan-500/15 text-cyan-100">{isEnglish ? "Primary Surface" : "メイン画面"}</Pill>
            <Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Read-only" : "読み取り専用"}</Pill>
            <Pill className="border-slate-500/45 bg-slate-700/30 text-slate-200">{isEnglish ? "Writes Disabled" : "書き込み無効"}</Pill>
          </div>
          <p className="max-w-4xl text-[11px] leading-relaxed text-slate-500">
            GitHub Projects read-only source. No create, edit, assign, label, or comment controls.
          </p>
          {lastFetchedAt ? (
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              Last checked: {formatGitHubWorkspaceDate(lastFetchedAt)}
            </p>
          ) : null}
        </div>
        <button
          onClick={onFetch}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-300/40 bg-blue-500/20 px-3 py-2 text-xs font-bold text-blue-50 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Fetching..." : "Fetch Demo Project Board"}
        </button>
      </div>

      {!project ? (
        <div className="rounded-xl border border-white/6 bg-slate-950/25 p-3">
          <div className="text-sm font-bold text-slate-100">
            {error || "Connect GitHub Project env vars locally to load the Demo board."}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requiredEnv.map((env) => (
              <code key={env} className="rounded-md border border-slate-500/25 bg-slate-900/45 px-2 py-1 text-[11px] font-semibold text-slate-400">
                {env}
              </code>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
            Configure exactly one owner value: GITHUB_USER or GITHUB_ORG. Token values stay server-side and are never displayed here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-blue-300/15 bg-blue-500/[0.055] px-3 py-2 text-xs">
            <div className="min-w-0">
              <span className="font-bold uppercase tracking-wide text-slate-500">Owner</span>{" "}
              <span className="font-semibold text-slate-200">{owner?.type || "owner"} / {owner?.login || "not returned"}</span>
            </div>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <div className="min-w-0">
              <span className="font-bold uppercase tracking-wide text-slate-500">Project</span>{" "}
              <span className="font-semibold text-slate-200">#{project.number || "?"} {project.title}</span>
            </div>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <div>
              <span className="font-bold uppercase tracking-wide text-slate-500">Items</span>{" "}
              <span className="font-black tabular-nums text-blue-100">{project.itemCount}</span>
            </div>
            <span className="ml-auto rounded-md border border-slate-500/20 bg-slate-900/40 px-2 py-1 font-semibold text-slate-500">
              Read-only / Manual fetch
            </span>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.url || item.title}-${index}`}
                className="min-w-0 rounded-xl border border-white/8 bg-slate-950/30 p-3 transition hover:border-blue-300/20 hover:bg-blue-500/[0.035]"
              >
                <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                      <span className="shrink-0 rounded-md border border-white/10 bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-300">
                        {item.issueNumber || "Item"}
                      </span>
                      <Pill className={gitHubWorkspaceStatusClass(item.fields.status || item.state || "Quiet")}>
                        {item.fields.status || item.state || "Not set"}
                      </Pill>
                    </div>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="block min-w-0 whitespace-normal break-words text-sm font-black leading-snug text-blue-100 hover:text-cyan-200">
                        {item.title}
                      </a>
                    ) : (
                      <div className="min-w-0 whitespace-normal break-words text-sm font-black leading-snug text-slate-100">{item.title}</div>
                    )}
                  </div>
                  <div className="min-w-0 text-right text-[11px] font-semibold text-slate-500">
                    <div className="truncate">{item.fields.assignees || "Unassigned"}</div>
                    <div className="whitespace-nowrap">{formatGitHubWorkspaceDate(item.updatedAt)}</div>
                  </div>
                </div>

                <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="truncate">
                    <span className="font-bold uppercase tracking-wide text-slate-600">Repo</span>{" "}
                    <span className="font-semibold text-slate-400">{item.repo || "Not linked"}</span>
                  </span>
                  <span className="font-semibold text-slate-600">{item.type}</span>
                </div>

                <div className="rounded-lg border border-cyan-300/10 bg-cyan-500/[0.045] px-3 py-2">
                  <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-200/70">Safe Next Action</div>
                  <div className="text-xs font-semibold leading-relaxed text-slate-200">{item.safeNextAction}</div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="rounded-xl border border-white/8 bg-slate-950/25 px-3 py-3 text-sm text-slate-400">
                No GitHub project items returned.
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function GitHubProjectStatusPreview({
  githubResult,
  isTestingGitHub,
  language,
  onFetchGitHubPreview,
}: {
  githubResult: GitHubReadTestResult | null;
  isTestingGitHub: boolean;
  language: LanguageMode;
  onFetchGitHubPreview: () => void;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const project = githubResult?.ok ? githubResult.project : null;
  const items = githubResult?.ok ? (githubResult.items ?? []).slice(0, 5) : [];

  return (
    <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4">
      <DisclosureHeader
        icon={Github}
        title="GitHub Projects Preview"
        description="Canonical read-only preview. Sydney Console does not modify GitHub items."
        badge={<Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Read-only" : "読み取り専用"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />

      {isExpanded && (
        <>
          <div className="mb-3 mt-4 flex justify-end">
            <button
              onClick={onFetchGitHubPreview}
              disabled={isTestingGitHub}
              className="shrink-0 rounded-lg border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {isTestingGitHub ? "Fetching..." : "Fetch Canonical Preview"}
            </button>
          </div>
          <TrustMeta
            className="mb-3"
            items={[
              { label: "Source", value: "GitHub Projects", tone: "github" },
              { label: "Mode", value: "Read-only", tone: "real" },
              { label: "Route", value: GITHUB_PROJECTS_CANONICAL_ROUTE, tone: "preview" },
              { label: "Writes", value: "Disabled", tone: "manual" },
            ]}
          />

          {project ? (
            <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Project title</div>
              <div className="text-sm font-bold text-slate-100">{project.title}</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Item count</div>
              <div className="text-sm font-bold text-slate-100">{project.itemCount}</div>
            </div>
            <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Project state</div>
              <Pill className={project.closed ? "border-slate-500/50 bg-slate-700/35 text-slate-300" : "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"}>
                {project.closed ? "Closed" : "Open"}
              </Pill>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">First 5 GitHub items</div>
            <div className="space-y-2">
              {items.map((item, index) => {
                const labels = githubItemLabels(item);
                return (
                  <div key={`${item.type}-${item.title}-${index}`} className="rounded-lg border border-white/8 bg-slate-950/35 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 font-bold text-slate-100">{item.title || "Untitled item"}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {labels.map((label) => (
                          <Pill key={label.text} className={label.className}>{label.text}</Pill>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                      <div><span className="text-slate-500">Type:</span> {item.type || "Not set"}</div>
                      <div><span className="text-slate-500">State:</span> {item.state || "Not set"}</div>
                      <div><span className="text-slate-500">Status:</span> {item.fields.status || "Not set"}</div>
                      <div><span className="text-slate-500">Due date:</span> {item.fields.dueDate || "Not set"}</div>
                      <div><span className="text-slate-500">Area:</span> {item.fields.area || "Not set"}</div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3 text-sm text-slate-400">
                  No GitHub project items returned.
                </div>
              )}
            </div>
          </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/8 bg-slate-950/35 p-3 text-sm text-slate-300">
              {githubResult ? (
                <span className="text-amber-200">
                  {isGitHubMissingConfigStatus(githubResult.statusCode) ? GITHUB_MISSING_ENV_MESSAGE : GITHUB_SAFE_FAILURE_MESSAGE}
                </span>
              ) : (
                "Fetch the canonical read-only route to preview GitHub Projects safely."
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectStatusCard({
  projects,
  language,
  onOpenProject,
}: {
  projects: AresProject[];
  language: LanguageMode;
  onOpenProject: (project: AresProject) => void;
}) {
  const t = uiText[language];
  const [sortMode, setSortMode] = useState<LocalProjectSortMode>("status");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const statusRank = (status: ProjectStatus) => {
    const index = PROJECT_STATUS_ORDER.indexOf(status);
    return index === -1 ? PROJECT_STATUS_ORDER.length : index;
  };
  const priorityRank = (priority: AresProject["priority"]) => ({ "高": 0, "中": 1, "低": 2 })[priority];
  const sortedProjects = useMemo(() => {
    const items = [...projects];
    items.sort((a, b) => {
      if (sortMode === "priority") {
        return priorityRank(a.priority) - priorityRank(b.priority) || a.rank - b.rank;
      }
      if (sortMode === "progress") {
        return b.progress - a.progress || a.rank - b.rank;
      }
      if (sortMode === "due") {
        return a.due.localeCompare(b.due, "ja") || a.rank - b.rank;
      }
      if (sortMode === "attention") {
        const attentionA = (a.blocker.trim().length > 0 ? 0 : 2) + (a.priority === "高" ? 0 : 1);
        const attentionB = (b.blocker.trim().length > 0 ? 0 : 2) + (b.priority === "高" ? 0 : 1);
        return attentionA - attentionB || a.rank - b.rank;
      }
      return statusRank(a.status) - statusRank(b.status) || a.rank - b.rank;
    });
    return items;
  }, [projects, sortMode]);
  const visibleProjects = showAllProjects ? sortedProjects : sortedProjects.slice(0, 3);
  const hasHiddenProjects = sortedProjects.length > visibleProjects.length;
  const activeCount = projects.filter((project) => project.status !== "完了" && project.status !== "保留").length;
  const blockedCount = projects.filter((project) => project.blocker.trim().length > 0).length;
  const averageProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
    : 0;

  return (
    <GlassCard className="flex max-h-[calc(100vh-190px)] min-h-0 flex-col overflow-hidden border-white/10 bg-slate-950/35 p-3 shadow-none">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <LineChart className="text-slate-400" size={18} />
          <h2 className="text-base font-bold text-slate-200">Local Project Status</h2>
          <span className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px] font-bold text-slate-500">
            Secondary
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAllProjects((current) => !current)}
            className="text-xs font-medium text-blue-300 hover:text-cyan-200"
            type="button"
          >
            {showAllProjects
              ? language === "en" ? "Show less" : "少なく表示"
              : t.showAll}
          </button>
          <label className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-slate-500">{language === "en" ? "Sort" : "並び替え"}</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as LocalProjectSortMode)}
              className="bg-transparent font-bold text-slate-200 outline-none"
            >
              <option value="status">{t.sort}</option>
              <option value="attention">{language === "en" ? "Attention first" : "要確認順"}</option>
              <option value="priority">{language === "en" ? "Priority" : "優先度順"}</option>
              <option value="progress">{language === "en" ? "Progress" : "進捗順"}</option>
              <option value="due">{language === "en" ? "Due date" : "期限順"}</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-3 gap-2">
        {[
          { label: "Active", value: activeCount, tone: "text-cyan-200" },
          { label: "Blocked", value: blockedCount, tone: blockedCount > 0 ? "text-amber-200" : "text-emerald-200" },
          { label: "Avg", value: `${averageProgress}%`, tone: "text-emerald-200" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/8 bg-slate-950/35 px-2.5 py-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className={cx("text-sm font-black tabular-nums", item.tone)}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-100">
        <ListChecks size={17} className="text-cyan-300" /> Local Projects
        <span className="text-[11px] font-medium text-slate-600">
          {visibleProjects.length}/{sortedProjects.length}
        </span>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/25">
        <div className="grid gap-2 p-2 xl:hidden">
          {visibleProjects.map((project) => (
            <LocalProjectResponsiveCard
              key={project.id}
              project={project}
              language={language}
              onOpenProject={onOpenProject}
            />
          ))}
        </div>
        <div className="hidden min-w-0 xl:block">
          <div className="sticky top-0 z-10 grid min-w-[700px] grid-cols-[minmax(140px,1.05fr)_minmax(96px,0.55fr)_minmax(170px,1.35fr)_78px_64px_64px] gap-2 border-b border-white/8 bg-slate-950/95 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <div>{t.project}</div>
            <div>Progress</div>
            <div>{t.nextAction}</div>
            <div>Status</div>
            <div>{t.priority}</div>
            <div>{t.detailsShort}</div>
          </div>
          {visibleProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              language={language}
              onOpenProject={onOpenProject}
            />
          ))}
        </div>
      </div>
      {hasHiddenProjects && (
        <div className="mt-2 text-right text-[11px] text-slate-600">
          {language === "en"
            ? `${sortedProjects.length - visibleProjects.length} more local project${sortedProjects.length - visibleProjects.length === 1 ? "" : "s"} hidden`
            : `あと${sortedProjects.length - visibleProjects.length}件を非表示`}
        </div>
      )}
    </GlassCard>
  );
}

function ProjectIntelligenceView({
  projects,
  members,
  language,
}: {
  projects: AresProject[];
  members: MemberStatus[];
  language: LanguageMode;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedValue = selectedProject?.id ?? "";
  const activeProjects = projects.filter((project) => project.status !== "完了" && project.status !== "保留");
  const blockedProjects = projects.filter((project) => project.blocker.trim().length > 0);
  const highPriorityProjects = projects.filter((project) => project.priority === "高");
  const averageProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
    : 0;
  const attentionQueue = sortProjectsForAttention(projects).slice(0, 4);
  const memberSourceStyles: Record<MemberStatus["source"], string> = {
    manual: "border-cyan-400/45 bg-cyan-500/15 text-cyan-200",
    github: "border-blue-400/45 bg-blue-500/15 text-blue-200",
    discord: "border-indigo-400/45 bg-indigo-500/15 text-indigo-200",
  };
  const memberSourceLabels: Record<MemberStatus["source"], string> = {
    manual: "手動",
    github: "GitHub",
    discord: "Discord",
  };
  const metrics = [
    {
      label: isEnglish ? "Active projects" : "稼働中プロジェクト",
      value: activeProjects.length,
      tone: "text-cyan-200",
    },
    {
      label: isEnglish ? "Needs attention" : "確認が必要",
      value: blockedProjects.length,
      tone: blockedProjects.length > 0 ? "text-amber-200" : "text-emerald-200",
    },
    {
      label: isEnglish ? "High priority" : "高優先度",
      value: highPriorityProjects.length,
      tone: "text-red-200",
    },
    {
      label: isEnglish ? "Avg progress" : "平均進捗",
      value: `${averageProgress}%`,
      tone: "text-emerald-200",
    },
  ];
  const runAnalyze = () => {};

  return (
    <GlassCard className="overflow-hidden border-white/10 bg-slate-950/35 p-3 shadow-none">
      <DisclosureHeader
        icon={Search}
        title="Project Intelligence View v1"
        description={
          isEnglish
            ? "Secondary read-only project analysis."
            : "補助用の Read-only 分析パネル。"
        }
        badge={<Pill className="border-slate-400/30 bg-slate-700/25 text-slate-300">{isEnglish ? "Read-only" : "読み取り専用"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />

      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4 opacity-70"
            items={[
              { label: "Source", value: "Local", tone: "local" },
              { label: "Trust", value: "Manual", tone: "manual" },
              { label: "Updated", value: "LocalStorage", tone: "local" },
            ]}
          />

          <div className="mb-3 min-w-0 rounded-xl border border-white/8 bg-slate-950/30 p-3">
        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-100">{isEnglish ? "Analyze Project" : "Analyze Project"}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {isEnglish
                ? "Important constraints: no API call, no AI call, no Discord post, no GitHub write."
                : "Important constraints: API呼び出しなし / AI呼び出しなし / Discord投稿なし / GitHub書き込みなし。"}
            </div>
          </div>
          <Pill className="border-slate-400/30 bg-slate-700/25 text-slate-300">Manual</Pill>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={selectedValue}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="min-h-11 min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-300/50"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={runAnalyze}
            disabled={!selectedProject}
            className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-500/12 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-800/50 disabled:text-slate-400"
            type="button"
          >
            Analyze
          </button>
        </div>
          </div>

          <div className="mb-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className={cx("mt-1 text-xl font-black tabular-nums", item.tone)}>{item.value}</div>
          </div>
        ))}
          </div>

          <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/35 p-3">
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-100">
              <Target size={17} className="text-blue-300" />
              <span className="min-w-0 truncate">{isEnglish ? "Selected Project Details" : "Selected Project Details"}</span>
            </div>
            <Pill className="border-slate-400/30 bg-slate-700/25 text-slate-300">
              {isEnglish ? "Static-derived" : "Static-derived"}
            </Pill>
          </div>
          {selectedProject && (
            <div className="mb-3 rounded-lg border border-white/8 bg-slate-950/25 p-3">
              <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-white">{selectedProject.name}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">{selectedProject.phase}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill className={statusStyles[selectedProject.status]}>{projectStatusLabel(selectedProject.status, language)}</Pill>
                  <Pill className={priorityStyles[selectedProject.priority]}>{priorityLabel(selectedProject.priority, language)}</Pill>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-3">
                <span className="w-12 text-xl font-semibold text-white tabular-nums">{selectedProject.progress}%</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={cx("h-full rounded-full", priorityProgressStyles[selectedProject.priority])}
                    style={{ width: `${selectedProject.progress}%` }}
                  />
                </div>
              </div>
              <div className="grid min-w-0 gap-2 text-xs leading-relaxed text-slate-300 xl:grid-cols-2">
                <div>
                  <span className="font-bold text-slate-500">{isEnglish ? "Blocker / risk:" : "Blocker / risk:"}</span>{" "}
                  <span className={selectedProject.blocker ? "font-semibold text-amber-200" : "text-slate-400"}>
                    {selectedProject.blocker || "None flagged"}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500">{isEnglish ? "Next action:" : "Next action:"}</span> {selectedProject.nextAction}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {attentionQueue.map((project) => (
              <div key={project.id} className="min-w-0 rounded-lg border border-white/8 bg-slate-900/45 px-3 py-2.5">
                <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{project.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{project.phase} / {project.progress}%</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill className={statusStyles[project.status]}>{projectStatusLabel(project.status, language)}</Pill>
                    <Pill className={priorityStyles[project.priority]}>{priorityLabel(project.priority, language)}</Pill>
                  </div>
                </div>
                <div className="grid min-w-0 gap-2 text-xs leading-relaxed text-slate-300 xl:grid-cols-2">
                  <div>
                    <span className="font-bold text-slate-500">{isEnglish ? "Next:" : "次:"}</span> {project.nextAction}
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">{isEnglish ? "Risk:" : "リスク:"}</span> {project.blocker || "None flagged"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-white/8 bg-slate-950/35 p-3">
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-100">
              <ListChecks size={17} className="text-emerald-300" />
              <span className="min-w-0 truncate">{isEnglish ? "Member Status" : "Member Status"}</span>
            </div>
            <Pill className="border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
              {members.length} {isEnglish ? "members" : "名"}
            </Pill>
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="min-w-0 rounded-lg border border-white/8 bg-slate-900/45 px-3 py-2.5">
                <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{member.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{member.project}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill className={statusStyles[member.status]}>{memberStatusLabel(member.status, language)}</Pill>
                    <Pill className={memberSourceStyles[member.source]}>{memberSourceLabels[member.source]}</Pill>
                  </div>
                </div>
                <div className="space-y-1 text-xs leading-relaxed text-slate-300">
                  <div><span className="font-bold text-slate-500">{isEnglish ? "Task:" : "Task:"}</span> {member.currentTask}</div>
                  <div>
                    <span className="font-bold text-slate-500">{isEnglish ? "Blocker:" : "Blocker:"}</span>{" "}
                    <span className={member.blocker ? "font-semibold text-amber-200" : "text-slate-400"}>
                      {member.blocker || "None flagged"}
                    </span>
                  </div>
                  <div><span className="font-bold text-slate-500">{isEnglish ? "Next:" : "Next:"}</span> {member.nextAction}</div>
                  <div className="text-slate-500">{isEnglish ? "Last update" : "Last update"}: {member.lastUpdate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function MiniPanel({
  icon: Icon,
  title,
  items,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
      <div className={cx("mb-2 flex items-center gap-2 font-bold", accent)}>
        <Icon size={18} /> {title}
      </div>
      <CompactTrustMeta
        className="mb-2"
        items={[
          { label: "Source", value: "Manual", tone: "manual" },
          { label: "Trust", value: "Preview", tone: "preview" },
          { label: "Updated", value: "Static", tone: "preview" },
        ]}
      />
      <ul className="space-y-1.5 text-sm leading-relaxed text-slate-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyNotesPanel({ language }: { language: LanguageMode }) {
  const isEnglish = language === "en";

  return (
    <CollapsibleBlock
      title="Weekly Notes"
      description="Highlights, risks, and next-week prep."
      badge={<Pill className="border-slate-400/35 bg-slate-700/35 text-slate-200">Manual</Pill>}
      language={language}
    >
      <div className="grid grid-cols-3 gap-3">
        <MiniPanel icon={Trophy} title={isEnglish ? "Weekly Highlights" : "今週のハイライト"} accent="text-emerald-300" items={["Demo Integration QA moved the release checklist forward", "Research Bot response latency improved in the sample flow", "Demo App sample data direction is ready for review"]} />
        <MiniPanel icon={TriangleAlert} title={isEnglish ? "Risks & Notes" : "リスク & 注意事項"} accent="text-amber-300" items={["Research Bot rate-limit behavior still needs a safe test", "Demo App sample data model is the current blocker", "Research tasks need one more priority pass"]} />
        <MiniPanel icon={CalendarDays} title={isEnglish ? "Next Week Prep" : "次の週の準備"} accent="text-blue-300" items={["Start the next Demo Integration validation pass", "Continue Research Bot UX improvements", "Draft the Demo App read-only data API"]} />
      </div>
    </CollapsibleBlock>
  );
}

function ProjectDetailModal({
  project,
  language,
  onClose,
  onProgressChange,
  onStatusCycle,
  onTaskToggle,
  onEditProject,
  onArchiveProject,
  onDeleteProject,
  addLog,
}: {
  project: LocalAresProject | null;
  language: LanguageMode;
  onClose: () => void;
  onProgressChange: (id: string, delta: number) => void;
  onStatusCycle: (id: string) => void;
  onTaskToggle: (projectId: string, taskKey: LocalProjectTaskKey, checked: boolean) => void;
  onEditProject: (project: AresProject) => void;
  onArchiveProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  addLog: (text: string) => void;
}) {
  if (!project) return null;

  const isEnglish = language === "en";
  const modalCopy = {
    progress: isEnglish ? "Current Progress" : "現在の進捗",
    minus: isEnglish ? "Progress -5%" : "進捗 -5%",
    plus: isEnglish ? "Progress +5%" : "進捗 +5%",
    status: isEnglish ? "Change Status" : "ステータス変更",
    edit: isEnglish ? "Edit" : "編集",
    archive: isEnglish ? "Archive" : "保留にする",
    delete: isEnglish ? "Delete" : "削除",
    localOnlyActions: isEnglish ? "Local-only demo controls" : "ローカル専用デモ操作",
    localOnlyActionsHelp: isEnglish
      ? "Closed by default for demo. These controls only update LocalStorage and never write to GitHub, Discord, or external services."
      : "デモでは閉じた状態です。この操作はLocalStorageだけを更新し、GitHub / Discord / 外部サービスには書き込みません。",
    nextAction: isEnglish ? "Next Action" : "次のアクション",
    blocker: isEnglish ? "Blocker / Note" : "ブロッカー / メモ",
    addBlockerLog: isEnglish ? "Add blocker log and close" : "ブロッカー確認をログに追加して閉じる",
    today: isEnglish ? "Today’s Tasks" : "今日のタスク",
    integrations: isEnglish ? "Planned Integrations" : "連携予定",
    memo: isEnglish ? "Sydney Console Decision Memo" : "Sydney Console 判断メモ",
    addReviewLog: isEnglish ? "Add review log and close" : "レビューをログに追加して閉じる",
    memoBody: isEnglish
      ? "Before API integration, this view fixes the next best action in a human-readable format. After GitHub integration, this can be generated from Issues, PRs, and Project Items."
      : "今はAPI接続前なので、ここでは「次にやるべき1手」を人間が確認しやすい形で固定します。GitHub連携後はIssue/PR/Project Itemから自動生成する想定です。",
  };

  const todayTasks: Array<{ key: LocalProjectTaskKey; label: string }> = isEnglish
    ? [
        { key: "next-action", label: `Complete one next action for ${project.name}` },
        { key: "blocker-note", label: "Clarify one blocker and leave a note" },
        { key: "handoff-note", label: "Create a short handoff note for the next thread" },
      ]
    : [
        { key: "next-action", label: `${project.name} の次アクションを1つ完了する` },
        { key: "blocker-note", label: "ブロッカーを1つ整理してメモに残す" },
        { key: "handoff-note", label: "次スレッド用の短い引き継ぎメモを作る" },
      ];

  const connectionItems = [
    { label: "GitHub Issue", value: isEnglish ? "Not Connected" : "未接続", tone: "未接続" },
    { label: isEnglish ? "Discord Notification" : "Discord通知", value: "Manual Post Only", tone: "Mock" },
    { label: isEnglish ? "OpenAI Summary" : "OpenAI要約", value: isEnglish ? "Planned" : "接続予定", tone: "接続予定" },
    { label: isEnglish ? "Local Save" : "Local保存", value: "Mock", tone: "Mock" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[82vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#06111f]/95 shadow-[0_24px_90px_rgba(0,0,0,0.52)] md:max-w-3xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-slate-950/85 px-4 py-2.5 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-xs font-bold text-white">{project.rank}</span>
              <h2 className="min-w-0 truncate text-xl font-black text-white">{project.name}</h2>
              <Pill className={statusStyles[project.status]}>{projectStatusLabel(project.status, language)}</Pill>
              <Pill className={priorityStyles[project.priority]}>{priorityLabel(project.priority, language)}</Pill>
            </div>
            <p className="text-xs text-slate-400">
              {project.phase} / {project.due}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="close project detail"
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 space-y-2.5 overflow-auto p-3">
          <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-bold text-cyan-200">{modalCopy.progress}</div>
                <div className="text-xl font-black tabular-nums text-white">{project.progress}%</div>
              </div>
              <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={cx("h-full rounded-full", priorityProgressStyles[project.priority])}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="rounded-lg border border-white/8 bg-slate-900/35 px-3 py-2 text-xs leading-relaxed text-slate-400">
                {modalCopy.localOnlyActionsHelp}
              </div>
              <details className="mt-2 rounded-lg border border-slate-500/20 bg-slate-950/35">
                <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-300 transition hover:text-white">
                  {modalCopy.localOnlyActions}
                </summary>
                <div className="space-y-2 border-t border-white/8 p-2">
                  <div className="grid min-w-0 grid-cols-3 gap-2">
                    <button
                      onClick={() => onProgressChange(project.id, -5)}
                      className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                      type="button"
                    >
                      {modalCopy.minus}
                    </button>
                    <button
                      onClick={() => onProgressChange(project.id, 5)}
                      className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25"
                      type="button"
                    >
                      {modalCopy.plus}
                    </button>
                    <button
                      onClick={() => onStatusCycle(project.id)}
                      className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25"
                      type="button"
                    >
                      {modalCopy.status}
                    </button>
                  </div>
                  <div className="grid min-w-0 grid-cols-3 gap-2">
                    <button
                      onClick={() => onEditProject(project)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/15 px-2.5 py-1.5 text-xs font-bold text-blue-100 transition hover:bg-blue-500/25"
                      type="button"
                    >
                      <Edit3 size={14} /> {modalCopy.edit}
                    </button>
                    <button
                      onClick={() => onArchiveProject(project.id)}
                      className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/25"
                      type="button"
                    >
                      {modalCopy.archive}
                    </button>
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-100 transition hover:bg-red-500/25"
                      type="button"
                    >
                      <Trash2 size={14} /> {modalCopy.delete}
                    </button>
                  </div>
                </div>
              </details>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-2 font-bold text-emerald-200">{modalCopy.today}</div>
              <div className="space-y-1.5">
                {todayTasks.map((task) => (
                  <label key={task.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/6 bg-slate-900/45 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/5">
                    <input
                      checked={project.todayTaskCompletions?.[task.key] === true}
                      onChange={(event) => onTaskToggle(project.id, task.key, event.target.checked)}
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-cyan-400"
                    />
                    <span className="leading-relaxed">{task.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-1.5 font-bold text-cyan-200">{modalCopy.nextAction}</div>
              <p className="text-sm leading-relaxed text-slate-200">{project.nextAction}</p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays size={14} /> {project.due}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-1.5 font-bold text-amber-200">{modalCopy.blocker}</div>
              <p className="line-clamp-3 text-sm leading-relaxed text-slate-300">{project.blocker}</p>
              <button
                onClick={() => {
                  addLog(`${project.name} のブロッカー確認: ${project.blocker}`);
                  onClose();
                }}
                className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/20"
                type="button"
              >
                {modalCopy.addBlockerLog}
              </button>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-blue-200">{modalCopy.integrations}</div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {connectionItems.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-slate-900/45 px-2 py-1">
                    <span className="text-[10px] font-semibold text-slate-500">{item.label}</span>
                    <Pill className={statusStyles[item.tone]}>{item.value}</Pill>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="mb-1.5 font-bold text-indigo-200">{modalCopy.memo}</div>
              <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                {modalCopy.memoBody}
              </p>
              <button
                onClick={() => {
                  addLog(`${project.name} の詳細レビューを実施`);
                  onClose();
                }}
                className="mt-2 w-full rounded-lg border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/25"
                type="button"
              >
                {modalCopy.addReviewLog}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectFormModal({
  mode,
  language,
  initialProject,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  language: LanguageMode;
  initialProject: AresProject | null;
  onClose: () => void;
  onSave: (project: AresProject | Omit<AresProject, "id" | "rank">) => void;
}) {
  const [form, setForm] = useState(() => {
    if (initialProject) {
      return {
        name: initialProject.name,
        phase: initialProject.phase,
        progress: initialProject.progress,
        status: initialProject.status,
        nextAction: initialProject.nextAction,
        due: initialProject.due,
        priority: initialProject.priority,
        blocker: initialProject.blocker,
        note: initialProject.note,
        color: initialProject.color,
      };
    }
    return EMPTY_PROJECT_FORM;
  });

  const isEnglish = language === "en";
  const formCopy = {
    description: isEnglish
      ? "Local project management form before API integration. Saved data is stored in LocalStorage."
      : "API連携前のローカル管理用フォームです。保存内容はLocalStorageに保持されます。",
    name: isEnglish ? "Project Name" : "プロジェクト名",
    phase: isEnglish ? "Phase" : "フェーズ",
    progress: isEnglish ? "Progress %" : "進捗%",
    due: isEnglish ? "Due" : "期限",
    status: isEnglish ? "Status" : "ステータス",
    priority: isEnglish ? "Priority" : "優先度",
    color: isEnglish ? "Color" : "色",
    note: isEnglish ? "Note Link Label" : "メモリンク表示",
    nextAction: isEnglish ? "Next Action" : "次のアクション",
    blocker: isEnglish ? "Blocker / Note" : "ブロッカー / メモ",
    cancel: isEnglish ? "Cancel" : "キャンセル",
    save: isEnglish ? "Save" : "保存",
  };

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    if (mode === "edit" && initialProject) {
      onSave({
        ...initialProject,
        ...form,
        name: trimmedName,
        progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
      });
      return;
    }

    onSave({
      ...form,
      name: trimmedName,
      progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
    });
  };

  const title = mode === "edit" ? (isEnglish ? "Edit Project" : "プロジェクト編集") : (isEnglish ? "New Project" : "新規プロジェクト");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/78 p-6 backdrop-blur-md">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#06111f]/95 shadow-[0_30px_120px_rgba(0,0,0,0.58)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/85 px-6 py-5">
          <div>
            <h2 className="text-2xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {formCopy.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-6">
          <FormField label={formCopy.name}>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder={isEnglish ? "Example: Demo workflow" : "例: Job Search LLM"}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </FormField>

          <FormField label={formCopy.phase}>
            <input
              value={form.phase}
              onChange={(event) => updateField("phase", event.target.value)}
              placeholder="Example: MVP planning"
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </FormField>

          <FormField label={formCopy.progress}>
            <input
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(event) => updateField("progress", Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            />
          </FormField>

          <FormField label={formCopy.due}>
            <input
              value={form.due}
              onChange={(event) => updateField("due", event.target.value)}
              placeholder={isEnglish ? "Example: Demo milestone" : "例: 5/30 (金) まで"}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </FormField>

          <FormField label={formCopy.status}>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as ProjectStatus)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              {PROJECT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{projectStatusLabel(status, language)}</option>
              ))}
            </select>
          </FormField>

          <FormField label={formCopy.priority}>
            <select
              value={form.priority}
              onChange={(event) => updateField("priority", event.target.value as AresProject["priority"])}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              <option value="高">{priorityLabel("高", language)}</option>
              <option value="中">{priorityLabel("中", language)}</option>
              <option value="低">{priorityLabel("低", language)}</option>
            </select>
          </FormField>

          <FormField label={formCopy.color}>
            <select
              value={form.color}
              onChange={(event) => updateField("color", event.target.value as AresProject["color"])}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              <option value="blue">blue</option>
              <option value="teal">teal</option>
              <option value="purple">purple</option>
              <option value="orange">orange</option>
            </select>
          </FormField>

          <FormField label={formCopy.note}>
            <input
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder={isEnglish ? "Example: Demo notes ->" : "例: 詳細ノート →"}
              className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </FormField>

          <div className="col-span-2">
            <FormField label={formCopy.nextAction}>
              <textarea
                value={form.nextAction}
                onChange={(event) => updateField("nextAction", event.target.value)}
                placeholder="次にやるべきことを1文で書く"
                className="h-20 w-full resize-none rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />
            </FormField>
          </div>

          <div className="col-span-2">
            <FormField label={formCopy.blocker}>
              <textarea
                value={form.blocker}
                onChange={(event) => updateField("blocker", event.target.value)}
                placeholder="詰まっていること、注意点、未接続の項目など"
                className="h-20 w-full resize-none rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />
            </FormField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-slate-950/55 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            type="button"
          >
            {formCopy.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-5 py-2.5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
          >
            {formCopy.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function CommandFooter({ projects }: { projects: AresProject[] }) {
  const average = Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length);
  const blocked = projects.filter((project) => project.note === "対応中" || project.blocker.includes("待ち") || project.blocker.includes("リスク")).length;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { icon: LineChart, label: "MVP Readiness", value: `${average}%`, tone: average >= 70 ? "text-teal-400" : average >= 40 ? "text-amber-400" : "text-red-400", source: "Local", trust: "Manual" },
        { icon: TimerReset, label: "Today Focus", value: "5.0h", tone: "text-gray-200", source: "Manual", trust: "Preview" },
        { icon: Zap, label: "Blocked Items", value: String(blocked), tone: blocked > 0 ? "text-red-400" : "text-teal-400", source: "Local", trust: "Manual" },
        { icon: Search, label: "Next Review", value: "17:30", tone: "text-blue-300", source: "Manual", trust: "Preview" },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <GlassCard key={item.label} className="flex min-w-0 items-center gap-2.5 border-white/10 bg-slate-950/30 px-3 py-2 shadow-none">
            <Icon className={cx("shrink-0", item.tone)} size={17} />
            <div className="min-w-0">
              <div className="truncate text-[11px] text-slate-500">{item.label}</div>
              <div className={cx("text-2xl font-medium", item.tone)}>{item.value}</div>
              <CompactTrustMeta
                className="mt-1"
                items={[
                  { label: "Source", value: item.source, tone: item.source === "Local" ? "local" : "manual" },
                  { label: "Trust", value: item.trust, tone: item.trust === "Manual" ? "manual" : "preview" },
                ]}
              />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function DailyReviewPanel({
  commandLog,
  clearLocalData,
  dailyReviewNote,
  setDailyReviewNote,
  language,
}: {
  commandLog: CommandLogEntry[];
  clearLocalData: () => void;
  dailyReviewNote: string;
  setDailyReviewNote: React.Dispatch<React.SetStateAction<string>>;
  language: LanguageMode;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const memoHelper = isEnglish
    ? "Save today's notes and next steps locally."
    : "今日の気づき・次にやることをローカル保存します。";
  const memoPlaceholder = isEnglish
    ? "Write today's progress, notes, and next move..."
    : "今日の進捗、気づき、明日の一手を書く...";

  return (
    <GlassCard className="mt-4 p-4">
      <DisclosureHeader
        icon={CheckCircle2}
        title="Daily Review"
        description={isEnglish ? "Local notes, saved logs, and reset tools." : "Localメモ、保存ログ、リセット操作。"}
        badge={<Pill className="border-emerald-400/40 bg-emerald-500/15 text-emerald-200">{isEnglish ? "Local Test" : "ローカルテスト"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />
      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4"
            items={[
              { label: "Source", value: "Local", tone: "local" },
              { label: "Trust", value: "Manual", tone: "manual" },
              { label: "Updated", value: "LocalStorage", tone: "local" },
            ]}
          />
          <div className="mb-3 rounded-xl border border-white/8 bg-slate-950/35 p-3">
            <div className="mb-1 text-sm font-bold text-emerald-200">Daily Review Memo</div>
            <p className="mb-2 text-xs leading-relaxed text-slate-400">{memoHelper}</p>
            <textarea
              value={dailyReviewNote}
              onChange={(event) => setDailyReviewNote(event.target.value)}
              placeholder={memoPlaceholder}
              className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-[1.1fr_1fr] gap-3">
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="mb-2 text-sm font-bold text-cyan-200">今日の保存ログ</div>
              <div className="max-h-28 space-y-2 overflow-auto pr-1 text-xs text-slate-300">
                {commandLog.length === 0 ? (
                  <div className="text-slate-500">まだ操作ログはありません。</div>
                ) : (
                  commandLog.slice(0, 5).map((log, index) => (
                    <div key={`${log.id ?? `${log.time}-${log.text}`}-${index}`} className="rounded-lg border border-white/5 bg-slate-900/50 px-3 py-2">
                      <span className="text-slate-500">{log.time}</span> — {log.text}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="mb-2 text-sm font-bold text-amber-200">テスト操作</div>
              <p className="mb-3 text-xs leading-relaxed text-slate-400">
                LocalStorageの状態を初期化して、初回起動状態に戻せます。API連携前のQAで使います。
              </p>
              <button
                onClick={clearLocalData}
                className="w-full rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/25"
              >
                Local Data Reset
              </button>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function statusLabel(status: IntegrationStatus, language: LanguageMode, key?: IntegrationKey) {
  const isEnglish = language === "en";
  if (status === "mock_ready") return "Mock Ready";
  if (status === "live_ready") return key === "discord" ? "Manual Post Only" : "Setup Ready";
  if (status === "needs_env") return "Needs .env";
  if (status === "prep_ready") return "Prep Ready";
  if (status === "read_only_test" || status === "read_only_display") return "Read-only Preview";
  if (status === "connected") return isEnglish ? "Connected" : "Connected";
  if (status === "planned") return isEnglish ? "Planned" : "Planned";
  return isEnglish ? "Not Configured" : "未設定";
}

function statusClass(status: IntegrationStatus) {
  if (status === "mock_ready") return "border-cyan-400/50 bg-cyan-500/15 text-cyan-200";
  if (status === "live_ready") return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200";
  if (status === "needs_env") return "border-amber-400/50 bg-amber-500/15 text-amber-200";
  if (status === "prep_ready") return "border-blue-400/50 bg-blue-500/15 text-blue-200";
  if (status === "read_only_test" || status === "read_only_display") return "border-blue-400/50 bg-blue-500/15 text-blue-200";
  if (status === "connected") return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200";
  if (status === "planned") return "border-slate-500/50 bg-slate-700/35 text-slate-300";
  return "border-slate-500/50 bg-slate-700/35 text-slate-300";
}

function queueStatusLabel(key: IntegrationKey, language: LanguageMode) {
  if (key === "discord") return "Manual Post Only";
  if (key === "github") return "Read-only Preview";
  return "Planned";
}

function DailySummaryPanel({
  language,
  projects,
  studyStatus,
  addLog,
}: {
  language: LanguageMode;
  projects: AresProject[];
  studyStatus: StudyStatus;
  addLog: (text: string) => void;
}) {
  const [isSendingDailySummary, setIsSendingDailySummary] = useState(false);
  const [dailySummaryResult, setDailySummaryResult] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isEnglish = language === "en";

  const sendDailySummaryToDiscord = async () => {
    setIsSendingDailySummary(true);
    setDailySummaryResult(null);

    try {
      const response = await fetch("/api/integrations/discord/daily-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topTasks,
          projects,
          study: {
            dayNumber: studyDay.dayNumber,
            title: studyDay.title,
            criteria: studyDay.criteria,
            status: studyStatus,
          },
          focusMessage: "小さく前進し、確実に積み上げることが最大の近道です。",
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !data.ok) {
        const errorMessage = data.error || "Daily summary notification failed.";
        setDailySummaryResult(errorMessage);
        addLog(`Daily Summary Discord通知失敗: ${errorMessage}`);
        return;
      }

      setDailySummaryResult(data.message || "Daily summary sent to Discord successfully.");
      addLog("Daily SummaryをDiscordへ送信");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setDailySummaryResult(message);
      addLog(`Daily Summary Discord通知失敗: ${message}`);
    } finally {
      setIsSendingDailySummary(false);
    }
  };

  return (
    <GlassCard className="mt-4 p-4">
      <DisclosureHeader
        icon={Sparkles}
        title={isEnglish ? "Daily Summary" : "日次サマリー"}
        description={
          isEnglish
            ? "Manual Discord summary action, separate from AI Summary."
            : "AI Summaryとは別の手動Discordサマリー送信。"
        }
        badge={<Pill className="border-emerald-400/40 bg-emerald-500/15 text-emerald-200">{isEnglish ? "Manual Post Only" : "手動投稿のみ"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />
      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4"
            items={[
              { label: "Source", value: "Local", tone: "local" },
              { label: "Trust", value: "Manual", tone: "manual" },
              { label: "Updated", value: "On click", tone: "manual" },
            ]}
          />
          <p className="mb-3 text-sm leading-relaxed text-slate-300">
            {isEnglish
              ? "Legacy/manual dashboard summary action. Separate from the AI Summary approval gate."
              : "通常の手動サマリー送信。AI Summary の承認ゲートとは別です。"}
          </p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="text-xs text-slate-500">{isEnglish ? "Projects" : "プロジェクト"}</div>
              <div className="mt-1 text-xl font-black text-white">{projects.length}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="text-xs text-slate-500">{isEnglish ? "Active Focus" : "アクティブフォーカス"}</div>
              <div className="mt-1 text-xl font-black text-cyan-300">Day {studyDay.dayNumber}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
              <div className="text-xs text-slate-500">{isEnglish ? "Top Tasks" : "Topタスク"}</div>
              <div className="mt-1 text-xl font-black text-white">{topTasks.length}</div>
            </div>
          </div>
          <button
            onClick={sendDailySummaryToDiscord}
            disabled={isSendingDailySummary}
            className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {isSendingDailySummary
              ? isEnglish
                ? "Sending..."
                : "送信中..."
              : isEnglish
                ? "Send Daily Summary"
                : "Daily Summaryを送信"}
          </button>
          {dailySummaryResult && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-200">
              {dailySummaryResult}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

function RoadmapPanel({ language }: { language: LanguageMode }) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const items: Array<{ title: string; status: string; tone: string }> = isEnglish
    ? [
        { title: "Discord stable", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub Projects prep", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub read-only API", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub read-only display", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "Demo lock", status: "Current", tone: "border-blue-400/35 bg-blue-500/10 text-blue-200" },
        { title: "Local console stable", status: "Target", tone: "border-slate-400/25 bg-slate-700/20 text-slate-300" },
      ]
    : [
        { title: "Discord stable", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub Projects prep", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub read-only API", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "GitHub read-only display", status: "Done", tone: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200" },
        { title: "Demo lock", status: "Current", tone: "border-blue-400/35 bg-blue-500/10 text-blue-200" },
        { title: "Local console stable", status: "Target", tone: "border-slate-400/25 bg-slate-700/20 text-slate-300" },
      ];

  return (
    <GlassCard className="mt-4 p-4">
      <DisclosureHeader
        icon={Target}
        title="Demo Checkpoint"
        description={isEnglish ? "Manual milestone tracker for the current dashboard phase." : "現在フェーズ用の手動マイルストーン。"}
        badge={<Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Read-only Preview" : "読み取りプレビュー"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />
      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4"
            items={[
              { label: "Source", value: "Manual", tone: "manual" },
              { label: "Trust", value: "Preview", tone: "preview" },
              { label: "Updated", value: "Static", tone: "preview" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            {items.map((item, index) => (
              <div key={item.title} className="rounded-xl border border-white/8 bg-slate-950/35 p-3">
                <div className="mb-2 text-xs font-bold text-slate-500">0{index + 1}</div>
                <div className="text-sm font-bold text-slate-100">{item.title}</div>
                <Pill className={cx("mt-2", item.tone)}>{item.status}</Pill>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}

function GitHubReadOnlyTestPanel({
  language,
  githubResult,
  isTestingGitHub,
  onTestGitHubProjectsRead,
}: {
  language: LanguageMode;
  githubResult: GitHubReadTestResult | null;
  isTestingGitHub: boolean;
  onTestGitHubProjectsRead: () => void;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);
  const envStatus = githubResult?.ok ? "Connected locally" : isGitHubMissingConfigStatus(githubResult?.statusCode) ? "Needs local value" : "Local only";

  return (
    <GlassCard className="mt-4 p-4">
      <DisclosureHeader
        icon={Github}
        title="GitHub Projects"
        description={
          isEnglish
            ? "Canonical read-only detail panel for GitHub Projects."
            : "GitHub ProjectsのCanonical read-only詳細パネル。"
        }
        badge={<Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{isEnglish ? "Canonical Read" : "公式読み取り"}</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />
      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4"
            items={[
              { label: "Source", value: "GitHub Projects", tone: "github" },
              { label: "Mode", value: "Read-only", tone: "real" },
              { label: "Writes", value: "Disabled", tone: "manual" },
              { label: "Updated", value: "On fetch", tone: "manual" },
            ]}
          />
          <p className="text-sm leading-relaxed text-slate-300">
            {isEnglish
              ? "Reads the canonical GitHub Projects route and displays normalized item fields without exposing secret values."
              : "Canonical GitHub Projects routeを読み取り、秘密値を表示せずに正規化済みItemフィールドだけを表示します。"}
          </p>
          <div className="mt-2 rounded-lg border border-white/6 bg-slate-950/25 px-3 py-2 text-[11px] text-slate-500">
            Route: <code className="break-all text-slate-400">{GITHUB_PROJECTS_CANONICAL_ROUTE}</code>
          </div>
          <div className="mt-3 rounded-xl border border-white/8 bg-slate-950/35 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {isEnglish ? "Required env vars" : "必要な env 変数"}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["GITHUB_TOKEN", "GITHUB_USER", "GITHUB_ORG", "GITHUB_PROJECT_NUMBER"].map((env) => (
                <div key={env} className="rounded-lg border border-white/8 bg-slate-900/70 px-2 py-2">
                  <code className="block text-xs text-slate-200">{env}</code>
                  <span className="mt-1 inline-flex rounded-md border border-slate-500/50 bg-slate-700/35 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                    {envStatus}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Configure exactly one owner value: GITHUB_USER or GITHUB_ORG.
            </p>
          </div>
          <button
            onClick={onTestGitHubProjectsRead}
            disabled={isTestingGitHub}
            className="mt-3 w-full rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {isTestingGitHub
              ? isEnglish ? "Fetching..." : "取得中..."
              : "Fetch Canonical GitHub Projects Read"}
          </button>
          {githubResult && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-200">
              {githubResult.ok && githubResult.project ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/8 bg-slate-900/45 p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Project title</div>
                      <div className="text-sm font-bold text-emerald-200">{githubResult.project.title}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-900/45 p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</div>
                      <div className="text-sm font-bold text-slate-100">{githubResult.project.closed ? "Closed" : "Open"}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-900/45 p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Item count</div>
                      <div className="text-sm font-bold text-slate-100">{githubResult.project.itemCount}</div>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-900/45 p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Project URL</div>
                      {githubResult.project.url ? (
                        <a
                          href={githubResult.project.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-sm font-bold text-blue-200 hover:text-cyan-200"
                        >
                          {githubResult.project.url}
                        </a>
                      ) : (
                        <div className="text-sm font-bold text-slate-500">Not available</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">First project items</div>
                    <div className="space-y-2">
                      {(githubResult.items ?? []).slice(0, 10).map((item, index) => (
                        <div key={`${item.type}-${item.title}-${index}`} className="rounded-lg border border-white/8 bg-slate-900/45 p-3">
                          <div className="mb-2 font-bold text-slate-100">{item.title}</div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                            <div><span className="text-slate-500">Type:</span> {item.type || "Not set"}</div>
                            <div><span className="text-slate-500">State:</span> {item.state || "Not set"}</div>
                            <div><span className="text-slate-500">Status:</span> {item.fields.status || "Not set"}</div>
                            <div><span className="text-slate-500">Due date:</span> {item.fields.dueDate || "Not set"}</div>
                            <div><span className="text-slate-500">Area:</span> {item.fields.area || "Not set"}</div>
                          </div>
                        </div>
                      ))}
                      {(githubResult.items ?? []).length === 0 && (
                        <div className="rounded-lg border border-white/8 bg-slate-900/45 p-3 text-slate-400">
                          No project items returned.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-amber-200">
                  {isGitHubMissingConfigStatus(githubResult.statusCode) ? GITHUB_MISSING_ENV_MESSAGE : GITHUB_SAFE_FAILURE_MESSAGE}
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-600">
            {(isEnglish
              ? ["Source: GitHub Projects", "Mode: Read-only", "Route: canonical", "Writes: Disabled"]
              : ["Source: GitHub Projects", "Mode: Read-only", "Route: canonical", "Writes: Disabled"]
            ).map((item) => (
              <div key={item} className="rounded-md border border-white/6 bg-slate-950/20 px-2 py-1 font-medium">
                {item}
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}

function IntegrationPanel({
  language,
  integrations,
  onOpenIntegration,
}: {
  language: LanguageMode;
  integrations: typeof defaultIntegrationState;
  onOpenIntegration: (key: IntegrationKey) => void;
}) {
  const isEnglish = language === "en";
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <GlassCard className="mt-4 p-4">
      <DisclosureHeader
        icon={Webhook}
        title="Integration Queue"
        description={
          isEnglish
            ? "Connection roadmap. No credentials or external writes are configured here."
            : "連携ロードマップ。ここでは認証情報や外部書き込みは設定しません。"
        }
        badge={<Pill className="border-slate-500/25 bg-slate-900/35 text-slate-400">Manual Queue</Pill>}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        language={language}
      />
      {isExpanded && (
        <>
          <CompactTrustMeta
            className="mb-3 mt-4"
            items={[
              { label: "Source", value: "Manual", tone: "manual" },
              { label: "Trust", value: "Preview", tone: "preview" },
              { label: "Updated", value: "LocalStorage", tone: "local" },
            ]}
          />
          <p className="mb-3 text-sm leading-relaxed text-slate-400">
            {isEnglish
              ? "GitHub stays read-only. Discord stays manual approval only. Future account connections remain explicit setup work."
              : "GitHubはRead-onlyのまま。Discordは手動承認のみ。外部アカウント接続は今後の明示的な設定作業です。"}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {integrationOrder.map((key) => {
              const source = integrations[key];
              const display = integrationDisplayCopy[key][language];
              const Icon =
                key === "github"
                  ? Github
                  : key === "discord"
                    ? Webhook
                    : key === "openai"
                      ? Sparkles
                      : key === "calendar"
                        ? CalendarDays
                        : key === "weather"
                          ? CloudSun
                          : LineChart;

              return (
                <button
                  key={key}
                  onClick={() => onOpenIntegration(key)}
                  className="rounded-xl border border-white/8 bg-slate-950/35 p-3 text-left transition hover:border-cyan-300/25 hover:bg-cyan-500/10"
                  type="button"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Icon size={17} className="text-blue-300" /> {source.name}
                    </div>
                    <Pill className={statusClass(source.status)}>{queueStatusLabel(key, language)}</Pill>
                  </div>
                  <div className="mb-1 text-xs font-semibold text-slate-300">{display.source}</div>
                  <div className="mb-3 min-h-[34px] text-xs leading-relaxed text-slate-500">{display.notes}</div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-300">
                      {key === "discord" ? "MANUAL" : source.mode}
                    </span>
                    <span className="text-xs font-bold text-blue-300">{isEnglish ? "Configure →" : "設定 →"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
}

function IntegrationSettingsModal({
  language,
  integrationKey,
  integrations,
  onClose,
  onUpdate,
  addLog,
}: {
  language: LanguageMode;
  integrationKey: IntegrationKey | null;
  integrations: typeof defaultIntegrationState;
  onClose: () => void;
  onUpdate: (key: IntegrationKey, patch: Partial<(typeof defaultIntegrationState)[IntegrationKey]>) => void;
  addLog: (text: string) => void;
}) {
  const [isSendingDiscordTest, setIsSendingDiscordTest] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<string | null>(null);
  const [envCopyStatus, setEnvCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setEnvCopyStatus("idle");
  }, [integrationKey]);

  if (!integrationKey) return null;

  const isEnglish = language === "en";
  const item = integrations[integrationKey];
  const display = integrationDisplayCopy[integrationKey][language];
  const envTemplate = item.requiredEnv.map((key) => `${key}=`).join("\n");

  const runMockTest = () => {
    onUpdate(integrationKey, { status: "mock_ready", mode: "mock" });
    addLog(`${item.name} mock connection test passed`);
  };

  const prepareLive = () => {
    onUpdate(integrationKey, { status: "needs_env", mode: "live" });
    addLog(`${item.name} switched to Live prep mode`);
  };

  const markLiveReady = () => {
    onUpdate(integrationKey, { status: "live_ready", mode: "live" });
    addLog(`${item.name} marked as ${integrationKey === "discord" ? "Manual Post Only" : "Setup Ready"}`);
  };

  const copyEnvTemplate = async () => {
    const didCopy = await safeCopyText(envTemplate);

    if (didCopy) {
      setEnvCopyStatus("copied");
      addLog(`${item.name} .env template copied`);
      window.setTimeout(() => setEnvCopyStatus("idle"), 2000);
      return;
    }

    setEnvCopyStatus("failed");
    addLog(`${item.name} .env template copy failed`);
    window.setTimeout(() => setEnvCopyStatus("idle"), 2000);
  };

  const sendDiscordLiveTest = async () => {
    setIsSendingDiscordTest(true);
    setDiscordTestResult(null);

    try {
      const response = await fetch("/api/integrations/discord/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Sydney Console: Discord Webhook live test message.",
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !data.ok) {
        const errorMessage = data.error || "Discord webhook test failed.";
        setDiscordTestResult(errorMessage);
        onUpdate("discord", { status: "needs_env", mode: "live" });
        addLog(`Discord Webhook test failed: ${errorMessage}`);
        return;
      }

      setDiscordTestResult(data.message || "Discord test message sent successfully.");
      onUpdate("discord", { status: "live_ready", mode: "live" });
      addLog("Discord Webhook manual test passed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setDiscordTestResult(message);
      onUpdate("discord", { status: "needs_env", mode: "live" });
      addLog(`Discord Webhook test failed: ${message}`);
    } finally {
      setIsSendingDiscordTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/78 p-6 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl border border-cyan-300/20 bg-[#06111f]/95 shadow-[0_30px_120px_rgba(0,0,0,0.58)]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-slate-950/85 px-6 py-5 backdrop-blur-xl">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-white">{item.name}</h2>
              <Pill className={statusClass(item.status)}>{statusLabel(item.status, language, integrationKey)}</Pill>
              <Pill className="border-blue-400/40 bg-blue-500/15 text-blue-200">{integrationKey === "discord" ? "MANUAL" : item.mode.toUpperCase()}</Pill>
            </div>
            <p className="text-sm text-slate-400">{display.notes}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_0.9fr] gap-5 p-6">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 font-bold text-cyan-200">
                {integrationKey === "github"
                  ? isEnglish ? "Prep Status" : "準備ステータス"
                  : isEnglish ? "Connection Mode" : "接続モード"}
              </div>
              {integrationKey === "github" ? (
                <div className="rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-sm leading-relaxed text-slate-300">
                  {isEnglish
                    ? "Demo baseline keeps GitHub Projects read-only. It never writes to GitHub and never returns token values."
                    : "Demo baselineではGitHub ProjectsをRead-onlyで扱います。GitHubへの書き込みはせず、Token値も返しません。"}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={runMockTest}
                      className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/25"
                      type="button"
                    >
                      {isEnglish ? "Run Mock Test" : "Mock接続テスト"}
                    </button>
                    <button
                      onClick={prepareLive}
                      className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/25"
                      type="button"
                    >
                      {isEnglish ? "Needs .env" : "Needs .env に切替"}
                    </button>
                  </div>
                  <button
                    onClick={markLiveReady}
                    className="mt-3 w-full rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/25"
                    type="button"
                  >
                    {integrationKey === "discord"
                      ? isEnglish ? "Mark Manual Post Only" : "Manual Post Only にする"
                      : isEnglish ? "Mark Setup Ready" : "Setup Ready にする"}
                  </button>
                </>
              )}
            </div>

            {integrationKey === "discord" && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="mb-3 font-bold text-emerald-200">
                  {isEnglish ? "Discord Manual Test" : "Discord手動テスト"}
                </div>
                <p className="mb-3 text-sm leading-relaxed text-slate-300">
                  {isEnglish
                    ? "After setting DISCORD_DASHBOARD_WEBHOOK_URL in .env.local, this sends one explicit test message. No auto-posting is enabled."
                    : ".env.local に DISCORD_DASHBOARD_WEBHOOK_URL を設定したあと、明示クリックで1件だけテスト通知します。自動投稿はありません。"}
                </p>
                <button
                  onClick={sendDiscordLiveTest}
                  disabled={isSendingDiscordTest}
                  className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  {isSendingDiscordTest
                    ? isEnglish
                      ? "Sending..."
                      : "送信中..."
                    : isEnglish
                      ? "Send One Discord Test"
                      : "Discordテスト通知を送信"}
                </button>
                {discordTestResult && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs text-slate-200">
                    {discordTestResult}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 font-bold text-blue-200">{isEnglish ? "Required .env.local Values" : "必要な .env.local 項目"}</div>
              <div className="space-y-2">
                {item.requiredEnv.map((env) => (
                  <div key={env} className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-900/45 px-3 py-2">
                    <code className="text-sm text-slate-200">{env}</code>
                    <Pill className="border-slate-500/50 bg-slate-700/35 text-slate-300">{isEnglish ? "local only" : "ローカルのみ"}</Pill>
                  </div>
                ))}
              </div>
              <button
                onClick={copyEnvTemplate}
                className="mt-3 w-full rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-500/25"
                type="button"
              >
                {envCopyStatus === "copied"
                  ? isEnglish ? "Copied ✓" : "コピー済み ✓"
                  : envCopyStatus === "failed"
                    ? isEnglish ? "Copy unavailable — select manually" : "コピーできませんでした。手動で選択してください"
                    : isEnglish ? "Copy .env template" : ".envテンプレートをコピー"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 font-bold text-emerald-200">{isEnglish ? "Safe Integration Rule" : "安全な接続ルール"}</div>
              <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
                <li>• {isEnglish ? "Do not paste real secrets into the UI." : "実際のシークレットはUIに貼り付けない。"}</li>
                <li>• {isEnglish ? "Put real values only in .env.local." : "本物の値は .env.local にだけ入れる。"}</li>
                <li>• {isEnglish ? "Manual posting only; no auto-posting." : "手動投稿のみ。自動投稿はありません。"}</li>
                <li>• {isEnglish ? "One integration per version." : "1バージョンにつき1連携ずつ進める。"}</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-3 font-bold text-indigo-200">{isEnglish ? "Next Implementation Step" : "次の実装ステップ"}</div>
              <p className="text-sm leading-relaxed text-slate-300">
                {display.next}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
              type="button"
            >
              {isEnglish ? "Close" : "閉じる"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AresCommandCenter() {
  const [timerMode, setTimerMode] = useState<TimerMode>("timer");
  const [todayState, setTodayState] = usePersistentState<TodayLocalState>(
    TODAY_STATE_STORAGE_KEY,
    DEFAULT_TODAY_STATE,
    migrateTodayState
  );
  const [reviewState, setReviewState] = usePersistentState<ReviewLocalState>(
    REVIEW_STATE_STORAGE_KEY,
    DEFAULT_REVIEW_STATE,
    migrateReviewState
  );
  const [members, setMembers] = usePersistentState<Record<string, AresMember[]>>(
    MEMBERS_STATE_STORAGE_KEY,
    DEFAULT_MEMBERS_STATE
  );
  const {
    activeGroupId = DEFAULT_TODAY_STATE.activeGroupId,
    timerSeconds,
    stopwatchSeconds,
    projects,
    studyStatus,
    studyMemo,
  } = todayState;
  const { commandLog, dailyReviewNote } = reviewState;
  const setTimerSeconds: React.Dispatch<React.SetStateAction<number>> = useCallback((value) => {
    setTodayState((current) => ({ ...current, timerSeconds: resolveStateAction(value, current.timerSeconds) }));
  }, [setTodayState]);
  const setStopwatchSeconds: React.Dispatch<React.SetStateAction<number>> = useCallback((value) => {
    setTodayState((current) => ({ ...current, stopwatchSeconds: resolveStateAction(value, current.stopwatchSeconds) }));
  }, [setTodayState]);
  const setProjects: React.Dispatch<React.SetStateAction<LocalAresProject[]>> = useCallback((value) => {
    setTodayState((current) => ({ ...current, projects: resolveStateAction(value, current.projects) }));
  }, [setTodayState]);
  const setActiveGroupId = useCallback((groupId: string) => {
    setTodayState((current) => ({ ...current, activeGroupId: groupId }));
  }, [setTodayState]);
  const setCommandLog: React.Dispatch<React.SetStateAction<CommandLogEntry[]>> = useCallback((value) => {
    setReviewState((current) => ({ ...current, commandLog: resolveStateAction(value, current.commandLog) }));
  }, [setReviewState]);
  const setDailyReviewNote: React.Dispatch<React.SetStateAction<string>> = useCallback((value) => {
    setReviewState((current) => ({ ...current, dailyReviewNote: resolveStateAction(value, current.dailyReviewNote) }));
  }, [setReviewState]);
  const setStudyStatus: React.Dispatch<React.SetStateAction<StudyStatus>> = useCallback((value) => {
    setTodayState((current) => ({ ...current, studyStatus: resolveStateAction(value, current.studyStatus) }));
  }, [setTodayState]);
  const setStudyMemo: React.Dispatch<React.SetStateAction<string>> = useCallback((value) => {
    setTodayState((current) => ({ ...current, studyMemo: resolveStateAction(value, current.studyMemo) }));
  }, [setTodayState]);
  const [timerRunning, setTimerRunningState] = useState(false);
  const [stopwatchRunning, setStopwatchRunningState] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFormMode, setProjectFormMode] = useState<"create" | "edit" | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [language, setLanguage] = usePersistentState<LanguageMode>("sydney-language-mode", "ja");
  const [integrations, setIntegrations] = usePersistentState("sydney-integrations", defaultIntegrationState);
  const [selectedIntegrationKey, setSelectedIntegrationKey] = useState<IntegrationKey | null>(null);
  const [isStudyExpanded, setIsStudyExpanded] = useState(false);
  const [isTestingGitHub, setIsTestingGitHub] = useState(false);
  const [githubResult, setGitHubResult] = useState<GitHubReadTestResult | null>(null);
  const [isFetchingRecipeProjectBoard, setIsFetchingRecipeProjectBoard] = useState(false);
  const [recipeProjectBoardResult, setRecipeProjectBoardResult] = useState<GitHubReadTestResult | null>(null);
  const [recipeProjectBoardError, setRecipeProjectBoardError] = useState<string | null>(null);
  const [recipeProjectBoardLastFetchedAt, setRecipeProjectBoardLastFetchedAt] = useState("");
  const [isFetchingGitHubWorkspace, setIsFetchingGitHubWorkspace] = useState(false);
  const [githubWorkspaceData, setGitHubWorkspaceData] = useState<GitHubWorkspaceResult | null>(null);
  const [githubWorkspaceError, setGitHubWorkspaceError] = useState<string | null>(null);
  const [githubWorkspaceLastFetchedAt, setGitHubWorkspaceLastFetchedAt] = useState("");
  const [githubActivity, setGithubActivity] = useState<GitHubActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("today");
  const [isAiSummaryHighlighted, setIsAiSummaryHighlighted] = useState(false);

  const addLog = (text: string) => {
    setCommandLog((logs) => [{ id: createDailyReviewEventId(), time: todayStamp(), text }, ...logs].slice(0, 8));
  };

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const editingProject = projects.find((project) => project.id === editingProjectId) ?? null;
  const activeProjectGroupId = defaultProjectGroups.some((group) => group.id === activeGroupId)
    ? activeGroupId
    : DEFAULT_TODAY_STATE.activeGroupId;
  const activeGroupProjects = useMemo(
    () =>
      projects.filter((project) => {
        const defaultProject = defaultProjects.find((item) => item.id === project.id);
        return (project.groupId ?? defaultProject?.groupId) === activeProjectGroupId;
      }),
    [activeProjectGroupId, projects]
  );
  const activeGroupMembers = members[activeProjectGroupId] ?? [];
  const isEnglish = language === "en";
  const titleText = isEnglish ? "Sydney Console" : "Sydney Console";
  const subtitleText = isEnglish ? "Personal Project Operations Console" : "Personal Project Operations Console";

  const openAiSummaryDemoFlow = () => {
    setActiveWorkspaceTab("ai");
    setIsAiSummaryHighlighted(true);
    window.setTimeout(() => {
      document.getElementById("ai-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    window.setTimeout(() => setIsAiSummaryHighlighted(false), 2200);
  };

  const updateIntegration = (
    key: IntegrationKey,
    patch: Partial<(typeof defaultIntegrationState)[IntegrationKey]>
  ) => {
    setIntegrations((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const addMember = (groupId: string, member: Omit<AresMember, "id">) => {
    const newMember: AresMember = {
      ...member,
      id: `member-${Date.now()}`,
    };
    setMembers((prev) => ({
      ...prev,
      [groupId]: [...(prev[groupId] ?? []), newMember],
    }));
  };

  const updateMember = (groupId: string, updated: AresMember) => {
    setMembers((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).map((member) =>
        member.id === updated.id ? updated : member
      ),
    }));
  };

  const removeMember = (groupId: string, memberId: string) => {
    setMembers((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).filter((member) => member.id !== memberId),
    }));
  };

  const testGitHubProjectsRead = async () => {
    setIsTestingGitHub(true);
    setGitHubResult(null);

    try {
      const response = await fetch(GITHUB_PROJECTS_CANONICAL_ROUTE, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as GitHubProjectsRouteResult;
      const normalizedResult = normalizeGitHubProjectsForPreview(data, response.status);
      setGitHubResult(normalizedResult);

      if (!response.ok || !normalizedResult.ok) {
        addLog("GitHub Projects canonical read failed safely");
        return;
      }

      addLog(`GitHub Projects canonical read passed: ${normalizedResult.project?.title || "Project metadata read"}`);
    } catch {
      setGitHubResult({
        ok: false,
        statusCode: 0,
        error: GITHUB_SAFE_FAILURE_MESSAGE,
      });
      addLog("GitHub Projects canonical read failed safely");
    } finally {
      setIsTestingGitHub(false);
    }
  };

  const fetchRecipeProjectBoard = async () => {
    setIsFetchingRecipeProjectBoard(true);
    setRecipeProjectBoardError(null);

    try {
      const response = await fetch(GITHUB_PROJECTS_CANONICAL_ROUTE, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as GitHubProjectsRouteResult;
      const normalizedResult = normalizeGitHubProjectsForPreview(data, response.status);
      setRecipeProjectBoardLastFetchedAt(new Date().toISOString());

      if (!response.ok || !normalizedResult.ok) {
        setRecipeProjectBoardResult(normalizedResult);
        setRecipeProjectBoardError(response.status === 503 ? "Connect GITHUB_TOKEN, exactly one of GITHUB_USER or GITHUB_ORG, and GITHUB_PROJECT_NUMBER in .env.local to load the Demo board." : normalizedResult.error || GITHUB_SAFE_FAILURE_MESSAGE);
        addLog("Demo GitHub Project Board read failed safely");
        return;
      }

      setRecipeProjectBoardResult(normalizedResult);
      addLog(`Demo GitHub Project Board read passed: ${normalizedResult.project?.title || "Project metadata read"}`);
    } catch {
      setRecipeProjectBoardResult(null);
      setRecipeProjectBoardLastFetchedAt(new Date().toISOString());
      setRecipeProjectBoardError(GITHUB_SAFE_FAILURE_MESSAGE);
      addLog("Demo GitHub Project Board read failed safely");
    } finally {
      setIsFetchingRecipeProjectBoard(false);
    }
  };

  const fetchGitHubWorkspaceOverview = async () => {
    setIsFetchingGitHubWorkspace(true);
    setGitHubWorkspaceError(null);

    try {
      const response = await fetch(GITHUB_WORKSPACE_ROUTE, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as GitHubWorkspaceRouteResult;
      const normalizedResult = normalizeGitHubWorkspaceResult(data, response.status);
      const checkedAt = new Date().toISOString();
      setGitHubWorkspaceLastFetchedAt(checkedAt);

      if (!response.ok || !normalizedResult.ok) {
        setGitHubWorkspaceData(normalizedResult);
        setGitHubWorkspaceError(response.status === 503 ? GITHUB_WORKSPACE_NOT_CONFIGURED_MESSAGE : normalizedResult.error || GITHUB_WORKSPACE_SAFE_FAILURE_MESSAGE);
        addLog("GitHub Workspace read failed safely");
        return;
      }

      setGitHubWorkspaceData(normalizedResult);
      addLog(`GitHub Workspace read passed: ${normalizedResult.repoCount} repos`);
    } catch {
      setGitHubWorkspaceData(null);
      setGitHubWorkspaceLastFetchedAt(new Date().toISOString());
      setGitHubWorkspaceError(GITHUB_WORKSPACE_SAFE_FAILURE_MESSAGE);
      addLog("GitHub Workspace read failed safely");
    } finally {
      setIsFetchingGitHubWorkspace(false);
    }
  };

  const fetchGitHubActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await fetch(GITHUB_ACTIVITY_ROUTE, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
        throw new Error(errorMessage.includes("GITHUB_REPO") ? GITHUB_ACTIVITY_REPO_NOT_CONFIGURED_MESSAGE : errorMessage);
      }
      const data: GitHubActivity = await res.json();
      setGithubActivity(data);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspaceTab === "board") {
      fetchGitHubActivity();
    }
  }, [activeWorkspaceTab, fetchGitHubActivity]);

  const fetchProjectSummary = useCallback(async () => {
    if (!githubActivity) return;

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const projectsPayload = todayState.projects.map((project) => ({
        name: project.name,
        progress: project.progress ?? 0,
        status: project.status,
        priority: project.priority,
        nextAction: project.nextAction ?? "",
        blockerNote: project.blocker ?? "",
      }));

      const res = await fetch(PROJECT_SUMMARY_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: githubActivity,
          projects: projectsPayload,
          language,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
      }

      const data: ProjectSummary = await res.json();
      setProjectSummary(data);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Summary generation failed");
    } finally {
      setSummaryLoading(false);
    }
  }, [githubActivity, todayState.projects, language]);

  const openEditProject = (project: AresProject) => {
    setEditingProjectId(project.id);
    setProjectFormMode("edit");
  };

  const closeProjectForm = () => {
    setProjectFormMode(null);
    setEditingProjectId(null);
  };

  const saveProject = (projectInput: AresProject | Omit<AresProject, "id" | "rank">) => {
    if (projectFormMode === "edit" && "id" in projectInput) {
      setProjects((items) =>
        items.map((project) => (project.id === projectInput.id ? { ...project, ...projectInput } : project))
      );
      addLog(`${projectInput.name} を編集`);
      closeProjectForm();
      return;
    }

    const newProject: LocalAresProject = {
      ...(projectInput as Omit<AresProject, "id" | "rank">),
      id: `project-${Date.now()}`,
      groupId: activeProjectGroupId,
      rank: projects.length + 1,
    };

    setProjects((items) => [...items, newProject]);
    addLog(`${newProject.name} を新規追加`);
    closeProjectForm();
  };

  const archiveProject = (id: string) => {
    setProjects((items) =>
      items.map((project) => {
        if (project.id !== id) return project;
        addLog(`${project.name} を保留に変更`);
        return { ...project, status: "保留" };
      })
    );
  };

  const deleteProject = (id: string) => {
    const target = projects.find((project) => project.id === id);
    if (!target) return;

    const confirmed = window.confirm(`本当に「${target.name}」を削除しますか？\n\nThis action cannot be undone.`);
    if (!confirmed) {
      addLog(`${target.name} の削除をキャンセル`);
      return;
    }

    setProjects((items) =>
      items
        .filter((project) => project.id !== id)
        .map((project, index) => ({ ...project, rank: index + 1 }))
    );
    addLog(`${target.name} を削除`);
    setSelectedProjectId(null);
  };

  const changeProjectProgress = (id: string, delta: number) => {
    setProjects((items) =>
      items.map((project) => {
        if (project.id !== id) return project;
        const nextProgress = Math.min(100, Math.max(0, project.progress + delta));
        addLog(`${project.name} の進捗を ${nextProgress}% に更新`);
        return { ...project, progress: nextProgress };
      })
    );
  };

  const cycleProjectStatus = (id: string) => {
    const order = PROJECT_STATUS_ORDER;
    setProjects((items) =>
      items.map((project) => {
        if (project.id !== id) return project;
        const next = order[(order.indexOf(project.status) + 1) % order.length];
        addLog(`${project.name} のステータスを「${next}」に更新`);
        return { ...project, status: next };
      })
    );
  };

  const toggleProjectTask = (projectId: string, taskKey: LocalProjectTaskKey, checked: boolean) => {
    setProjects((items) =>
      items.map((project) =>
        project.id === projectId
          ? {
              ...project,
              todayTaskCompletions: {
                ...project.todayTaskCompletions,
                [taskKey]: checked,
              },
            }
          : project
      )
    );
  };

  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((value) => Math.max(0, value - 1));
      }, 1000);
    } else {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerRunning, setTimerSeconds]);

  useEffect(() => {
    if (!stopwatchRunning) return undefined;
    const id = window.setInterval(() => {
      setStopwatchSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [stopwatchRunning, setStopwatchSeconds]);

  useEffect(() => {
    if (timerSeconds <= 0) setTimerRunningState(false);
  }, [timerSeconds]);

  const setTimerRunning = (value: boolean) => {
    setTimerRunningState(value);
    addLog(value ? "集中タイマーを開始" : "集中タイマーを一時停止");
  };

  const setStopwatchRunning = (value: boolean) => {
    setStopwatchRunningState(value);
    addLog(value ? "ストップウォッチを開始" : "ストップウォッチを一時停止");
  };

  const resetTimer = () => {
    setTimerRunningState(false);
    setTimerSeconds(25 * 60);
    addLog("集中タイマーを25:00にリセット");
  };

  const resetStopwatch = () => {
    setStopwatchRunningState(false);
    setStopwatchSeconds(0);
    addLog("ストップウォッチをリセット");
  };

  const clearLocalData = () => {
    const confirmed = window.confirm(
      isEnglish
        ? "Reset local dashboard data and return to the first-run demo state?\n\nThis clears local notes, logs, and saved dashboard state on this device."
        : "ローカルのダッシュボードデータを初期化し、初回起動状態に戻しますか？\n\nこの端末のローカルメモ、ログ、保存済みダッシュボード状態が消去されます。"
    );
    if (!confirmed) {
      addLog(isEnglish ? "Local data reset canceled" : "LocalStorage初期化をキャンセル");
      return;
    }

    removeLocalStorageItem(TODAY_STATE_STORAGE_KEY);
    removeLocalStorageItem(REVIEW_STATE_STORAGE_KEY);
    removeLocalStorageItem(MEMBERS_STATE_STORAGE_KEY);
    LEGACY_TODAY_STORAGE_KEYS.forEach(removeLocalStorageItem);
    LEGACY_REVIEW_STORAGE_KEYS.forEach(removeLocalStorageItem);
    removeLocalStorageItem("sydney-integrations");
    removeLocalStorageItem("sydney-study-status-summary");
    setTimerRunningState(false);
    setStopwatchRunningState(false);
    setTimerSeconds(25 * 60);
    setStopwatchSeconds(0);
    setActiveGroupId(DEFAULT_TODAY_STATE.activeGroupId);
    setProjects(defaultProjects);
    setCommandLog([]);
    setDailyReviewNote("");
    setMembers({});
    setSelectedProjectId(null);
    setProjectFormMode(null);
    setEditingProjectId(null);
    setSelectedIntegrationKey(null);
    setIntegrations(defaultIntegrationState);
    setStudyStatus("学習中");
    setStudyMemo("");
    setIsStudyExpanded(false);
    setGitHubResult(null);
    setRecipeProjectBoardResult(null);
    setRecipeProjectBoardError(null);
    setRecipeProjectBoardLastFetchedAt("");
    setGitHubWorkspaceData(null);
    setGitHubWorkspaceError(null);
    setGitHubWorkspaceLastFetchedAt("");
    addLog("LocalStorageを初期化");
  };

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <div className="flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_30%),linear-gradient(135deg,#020617,#06101f_48%,#020617)]">
        <Sidebar
          language={language}
          timerMode={timerMode}
          setTimerMode={setTimerMode}
          timerSeconds={timerSeconds}
          stopwatchSeconds={stopwatchSeconds}
          setTimerRunning={setTimerRunning}
          setStopwatchRunning={setStopwatchRunning}
          resetTimer={resetTimer}
          resetStopwatch={resetStopwatch}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 xl:px-5 xl:py-3">
          <header className="mb-2.5 flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-white">{titleText}</h1>
                <p className="max-w-full text-xs font-medium text-blue-300">{subtitleText}</p>
              </div>
              <button
                onClick={openAiSummaryDemoFlow}
                className="inline-flex max-w-full rounded-full border border-white/10 bg-slate-900/45 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:border-indigo-200/40 hover:text-indigo-100"
                type="button"
              >
                {language === "en" ? "AI Summary demo flow" : "AI Summary デモフロー"}
              </button>
            </div>
            <TopInfoCards
              addLog={addLog}
              isStudyExpanded={isStudyExpanded}
              language={language}
              projects={projects}
              setIsStudyExpanded={setIsStudyExpanded}
              setLanguage={setLanguage}
              studyMemo={studyMemo}
              studyStatus={studyStatus}
              setStudyMemo={setStudyMemo}
              setStudyStatus={setStudyStatus}
            />
          </header>

          <WorkspaceTabs activeTab={activeWorkspaceTab} onChange={setActiveWorkspaceTab} language={language} />

          {activeWorkspaceTab === "board" && (
            <div className="min-h-0 min-w-0">
              <ProjectGroupTabs
                groups={defaultProjectGroups}
                projects={projects}
                activeGroupId={activeProjectGroupId}
                onChange={setActiveGroupId}
                language={language}
              />
              <ProjectGroupMembersSection
                activeGroupId={activeProjectGroupId}
                members={activeGroupMembers}
                onAddMember={addMember}
                onUpdateMember={updateMember}
                onRemoveMember={removeMember}
                language={language}
              />
              <RecipeGitHubProjectBoard
                data={recipeProjectBoardResult}
                error={recipeProjectBoardError}
                isLoading={isFetchingRecipeProjectBoard}
                language={language}
                lastFetchedAt={recipeProjectBoardLastFetchedAt}
                onFetch={fetchRecipeProjectBoard}
              />
              <ProjectStatusCard
                projects={activeGroupProjects}
                language={language}
                onOpenProject={(project) => setSelectedProjectId(project.id)}
              />
              <GitHubWorkspaceOverview
                data={githubWorkspaceData}
                error={githubWorkspaceError}
                isLoading={isFetchingGitHubWorkspace}
                language={language}
                lastFetchedAt={githubWorkspaceLastFetchedAt}
                onFetch={fetchGitHubWorkspaceOverview}
              />
              <GitHubActivitySection
                activity={githubActivity}
                error={activityError}
                isLoading={activityLoading}
                language={language}
                onRefresh={fetchGitHubActivity}
              />
              <AIProjectSummarySection
                summary={projectSummary}
                error={summaryError}
                isLoading={summaryLoading}
                hasActivity={githubActivity !== null}
                language={language}
                onGenerate={fetchProjectSummary}
              />
            </div>
          )}

          {activeWorkspaceTab === "today" && (
            <div className="min-w-0 space-y-3">
              <ProjectGroupTabs
                groups={defaultProjectGroups}
                projects={projects}
                activeGroupId={activeProjectGroupId}
                onChange={setActiveGroupId}
                language={language}
              />
              <TopThreeCard language={language} projects={activeGroupProjects} isSecondary={isStudyExpanded} />
              <CommandFooter projects={activeGroupProjects} />
              <ProjectIntelligenceView
                projects={activeGroupProjects}
                members={memberStatuses}
                language={language}
              />
              <SystemReadinessCard language={language} isSecondary />
            </div>
          )}

          {activeWorkspaceTab === "ai" && (
            <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <section
                id="ai-summary"
                className={cx(
                  "scroll-mt-6 rounded-2xl transition duration-500",
                  isAiSummaryHighlighted && "ring-2 ring-indigo-300/70 ring-offset-2 ring-offset-slate-950"
                )}
              >
                <AiSummaryCard
                  commandLog={commandLog}
                  defaultAdvancedTools
                  language={language}
                  projects={projects}
                  studyStatus={studyStatus}
                />
              </section>
              <div className="space-y-3">
                <GitHubProjectStatusPreview
                  githubResult={githubResult}
                  isTestingGitHub={isTestingGitHub}
                  language={language}
                  onFetchGitHubPreview={testGitHubProjectsRead}
                />
                <GitHubReadOnlyTestPanel
                  language={language}
                  githubResult={githubResult}
                  isTestingGitHub={isTestingGitHub}
                  onTestGitHubProjectsRead={testGitHubProjectsRead}
                />
                <IntegrationPanel
                  language={language}
                  integrations={integrations}
                  onOpenIntegration={setSelectedIntegrationKey}
                />
              </div>
            </div>
          )}

          {activeWorkspaceTab === "review" && (
            <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-3">
                <DailyReviewPanel
                  commandLog={commandLog}
                  clearLocalData={clearLocalData}
                  dailyReviewNote={dailyReviewNote}
                  setDailyReviewNote={setDailyReviewNote}
                  language={language}
                />
                <DailySummaryPanel
                  language={language}
                  projects={projects}
                  studyStatus={studyStatus}
                  addLog={addLog}
                />
              </div>
              <div className="space-y-3">
                <RoadmapPanel language={language} />
                <WeeklyNotesPanel language={language} />
              </div>
            </div>
          )}
        </main>
      </div>
      <ProjectDetailModal
        project={selectedProject}
        language={language}
        onClose={() => setSelectedProjectId(null)}
        onProgressChange={changeProjectProgress}
        onStatusCycle={cycleProjectStatus}
        onTaskToggle={toggleProjectTask}
        onEditProject={openEditProject}
        onArchiveProject={archiveProject}
        onDeleteProject={deleteProject}
        addLog={addLog}
      />
      {projectFormMode && (
        <ProjectFormModal
          mode={projectFormMode}
          language={language}
          initialProject={projectFormMode === "edit" ? editingProject : null}
          onClose={closeProjectForm}
          onSave={saveProject}
        />
      )}
      <IntegrationSettingsModal
        language={language}
        integrationKey={selectedIntegrationKey}
        integrations={integrations}
        onClose={() => setSelectedIntegrationKey(null)}
        onUpdate={updateIntegration}
        addLog={addLog}
      />
    </div>
  );
}
