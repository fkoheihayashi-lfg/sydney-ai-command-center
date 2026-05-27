import { NextResponse } from "next/server";

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

type LocalProjectPayload = {
  name: string;
  progress: number;
  status: string;
  priority: string;
  nextAction: string;
  blockerNote: string;
};

type ProjectSummaryPayload = {
  activity: GitHubActivity;
  projects: LocalProjectPayload[];
  language: "ja" | "en";
};

const SYSTEM_PROMPT = `You are a project management assistant analyzing
a software development project's current state.
Based on GitHub activity and local project data,
provide a concise, actionable summary.

Rules:
- Be direct and specific
- Highlight risks and blockers prominently
- Suggest ONE clear next action
- Keep the summary under 200 words
- Use the same language as specified in the request`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeText(value: unknown, fallback = "", maxLength = 300) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item)).filter(Boolean).slice(0, 10);
}

function normalizePayload(value: unknown): ProjectSummaryPayload | null {
  if (!isRecord(value) || !isRecord(value.activity) || !Array.isArray(value.projects)) {
    return null;
  }

  const language = value.language === "en" ? "en" : value.language === "ja" ? "ja" : null;
  if (!language) return null;

  const activity = value.activity;
  const commits = Array.isArray(activity.commits)
    ? activity.commits.slice(0, 5).map((commit) => ({
        sha: safeText(isRecord(commit) ? commit.sha : ""),
        message: safeText(isRecord(commit) ? commit.message : ""),
        author: safeText(isRecord(commit) ? commit.author : ""),
        date: safeText(isRecord(commit) ? commit.date : ""),
      }))
    : [];
  const pullRequests = Array.isArray(activity.pullRequests)
    ? activity.pullRequests.slice(0, 10).map((pullRequest) => ({
        number: safeNumber(isRecord(pullRequest) ? pullRequest.number : 0),
        title: safeText(isRecord(pullRequest) ? pullRequest.title : ""),
        author: safeText(isRecord(pullRequest) ? pullRequest.author : ""),
        createdAt: safeText(isRecord(pullRequest) ? pullRequest.createdAt : ""),
        isDraft: isRecord(pullRequest) && pullRequest.isDraft === true,
      }))
    : [];
  const issues = Array.isArray(activity.issues)
    ? activity.issues.slice(0, 10).map((issue) => ({
        number: safeNumber(isRecord(issue) ? issue.number : 0),
        title: safeText(isRecord(issue) ? issue.title : ""),
        author: safeText(isRecord(issue) ? issue.author : ""),
        createdAt: safeText(isRecord(issue) ? issue.createdAt : ""),
        labels: safeStringArray(isRecord(issue) ? issue.labels : []),
      }))
    : [];

  return {
    activity: {
      commits,
      pullRequests,
      issues,
      fetchedAt: safeText(activity.fetchedAt),
    },
    projects: value.projects.slice(0, 20).map((project) => ({
      name: safeText(isRecord(project) ? project.name : ""),
      progress: safeNumber(isRecord(project) ? project.progress : 0),
      status: safeText(isRecord(project) ? project.status : ""),
      priority: safeText(isRecord(project) ? project.priority : ""),
      nextAction: safeText(isRecord(project) ? project.nextAction : ""),
      blockerNote: safeText(isRecord(project) ? project.blockerNote : ""),
    })),
    language,
  };
}

function formatCommits(commits: GitHubCommit[]) {
  if (commits.length === 0) return "なし";
  return commits.map((commit) => `- ${commit.sha} ${commit.message} / ${commit.author} / ${commit.date}`).join("\n");
}

function formatPullRequests(pullRequests: GitHubPR[]) {
  if (pullRequests.length === 0) return "なし";
  return pullRequests
    .map((pullRequest) => `- #${pullRequest.number} ${pullRequest.isDraft ? "[Draft] " : ""}${pullRequest.title} / ${pullRequest.author} / ${pullRequest.createdAt}`)
    .join("\n");
}

function formatIssues(issues: GitHubIssue[]) {
  if (issues.length === 0) return "なし";
  return issues
    .map((issue) => {
      const labels = issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : "";
      return `- #${issue.number}${labels} ${issue.title} / ${issue.author} / ${issue.createdAt}`;
    })
    .join("\n");
}

function formatProjects(projects: LocalProjectPayload[]) {
  if (projects.length === 0) return "なし";
  return projects
    .map((project) => {
      const blocker = project.blockerNote ? ` / blocker: ${project.blockerNote}` : "";
      return `- ${project.name}: ${project.progress}% / ${project.status} / priority ${project.priority} / next: ${project.nextAction || "未設定"}${blocker}`;
    })
    .join("\n");
}

function buildUserPrompt(payload: ProjectSummaryPayload) {
  if (payload.language === "en") {
    return `Analyze the current project status from the following data.

## Latest GitHub commits (last 5)
${formatCommits(payload.activity.commits)}

## Open PRs
${formatPullRequests(payload.activity.pullRequests)}

## Open Issues
${formatIssues(payload.activity.issues)}

## Local Project Status
${formatProjects(payload.projects)}

Please answer in this format:

**Current Status**
(2-3 sentences summarizing the overall state)

**Notable Points**
(risks, blockers, or possible delays)

**Recommended Action**
(one thing to do now)`;
  }

  return `以下のデータを元に、現在のプロジェクト状況を分析してください。

## GitHub 最新コミット（直近5件）
${formatCommits(payload.activity.commits)}

## オープン中のPR
${formatPullRequests(payload.activity.pullRequests)}

## オープン中のIssue
${formatIssues(payload.activity.issues)}

## ローカルプロジェクト状況
${formatProjects(payload.projects)}

以下の形式で回答してください:

**現在の状況**
（2-3文で全体像）

**注目すべき点**
（リスク・ブロッカー・遅延の可能性）

**推奨アクション**
（今すぐやるべき1つのこと）`;
}

function extractResponseText(data: unknown): string {
  if (!isRecord(data)) return "";

  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) return "";

  return data.output
    .flatMap((outputItem) => {
      if (!isRecord(outputItem) || outputItem.type !== "message" || !Array.isArray(outputItem.content)) {
        return [];
      }

      return outputItem.content.flatMap((contentItem) => {
        if (!isRecord(contentItem) || contentItem.type !== "output_text" || typeof contentItem.text !== "string") {
          return [];
        }

        const text = contentItem.text.trim();
        return text ? [text] : [];
      });
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured.",
        },
        { status: 503 },
      );
    }

    const payload = normalizePayload(await request.json());
    if (!payload) {
      return NextResponse.json(
        {
          error: "Invalid project summary payload.",
        },
        { status: 400 },
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildUserPrompt(payload),
          },
        ],
        max_output_tokens: 500,
        temperature: 0.3,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OpenAI project summary request failed.",
          status: response.status,
          details: "AI provider request failed. Check local configuration and try again.",
        },
        { status: 502 },
      );
    }

    const summary = extractResponseText(data);
    if (!summary) {
      return NextResponse.json(
        {
          error: "OpenAI returned no project summary text.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        error: "Project summary generation failed safely.",
      },
      { status: 502 },
    );
  }
}
