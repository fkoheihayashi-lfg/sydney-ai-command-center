import { NextResponse } from "next/server";

type GitHubCommitResponse = {
  sha?: string | null;
  commit?: {
    message?: string | null;
    author?: {
      name?: string | null;
      date?: string | null;
    } | null;
  } | null;
};

type GitHubUserResponse = {
  login?: string | null;
};

type GitHubPullRequestResponse = {
  number?: number | null;
  title?: string | null;
  user?: GitHubUserResponse | null;
  created_at?: string | null;
  draft?: boolean | null;
};

type GitHubLabelResponse = {
  name?: string | null;
};

type GitHubIssueResponse = {
  number?: number | null;
  title?: string | null;
  user?: GitHubUserResponse | null;
  created_at?: string | null;
  labels?: GitHubLabelResponse[] | null;
  pull_request?: unknown;
};

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "SYDNEY-Command-Center";

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function fetchGitHubJson<T>({
  token,
  owner,
  repo,
  path,
  query,
}: {
  token: string;
  owner: string;
  repo: string;
  path: "commits" | "pulls" | "issues";
  query: Record<string, string>;
}) {
  const params = new URLSearchParams(query);
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${path}?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "GitHub API request failed.";
    throw new Error(`${path}: ${response.status} ${message}`);
  }

  return data as T;
}

function normalizeCommit(item: GitHubCommitResponse) {
  return {
    sha: safeText(item.sha).slice(0, 7),
    message: safeText(item.commit?.message, "No commit message").split("\n")[0],
    author: safeText(item.commit?.author?.name, "Unknown"),
    date: safeText(item.commit?.author?.date),
  };
}

function normalizePullRequest(item: GitHubPullRequestResponse) {
  return {
    number: safeNumber(item.number),
    title: safeText(item.title, "Untitled pull request"),
    author: safeText(item.user?.login, "unknown"),
    createdAt: safeText(item.created_at),
    isDraft: item.draft === true,
  };
}

function normalizeIssue(item: GitHubIssueResponse) {
  return {
    number: safeNumber(item.number),
    title: safeText(item.title, "Untitled issue"),
    author: safeText(item.user?.login, "unknown"),
    createdAt: safeText(item.created_at),
    labels: (item.labels ?? []).map((label) => safeText(label.name)).filter(Boolean),
  };
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const owner = safeText(process.env.GITHUB_ORG) || safeText(process.env.GITHUB_USER);
  const repo = safeText(process.env.GITHUB_REPO);

  if (!token) {
    return NextResponse.json(
      {
        error: "GITHUB_TOKEN is not configured.",
      },
      { status: 503 }
    );
  }

  if (!owner) {
    return NextResponse.json(
      {
        error: "GITHUB_USER or GITHUB_ORG is not configured.",
      },
      { status: 503 }
    );
  }

  if (!repo) {
    return NextResponse.json(
      {
        error: "GITHUB_REPO is not configured.",
      },
      { status: 503 }
    );
  }

  const [commitsResult, pullRequestsResult, issuesResult] = await Promise.allSettled([
    fetchGitHubJson<GitHubCommitResponse[]>({
      token,
      owner,
      repo,
      path: "commits",
      query: { per_page: "5" },
    }),
    fetchGitHubJson<GitHubPullRequestResponse[]>({
      token,
      owner,
      repo,
      path: "pulls",
      query: { state: "open", per_page: "10" },
    }),
    fetchGitHubJson<GitHubIssueResponse[]>({
      token,
      owner,
      repo,
      path: "issues",
      query: { state: "open", per_page: "10", pulls: "false" },
    }),
  ]);

  const commits = commitsResult.status === "fulfilled" ? commitsResult.value.map(normalizeCommit) : [];
  const pullRequests = pullRequestsResult.status === "fulfilled" ? pullRequestsResult.value.map(normalizePullRequest) : [];
  const issues = issuesResult.status === "fulfilled"
    ? issuesResult.value.filter((issue) => !issue.pull_request).map(normalizeIssue)
    : [];
  const errors = [
    commitsResult.status === "rejected" ? commitsResult.reason : null,
    pullRequestsResult.status === "rejected" ? pullRequestsResult.reason : null,
    issuesResult.status === "rejected" ? issuesResult.reason : null,
  ]
    .filter((error): error is Error => error instanceof Error)
    .map((error) => error.message);

  const payload = {
    commits,
    pullRequests,
    issues,
    fetchedAt: new Date().toISOString(),
  };

  if (errors.length > 0) {
    return NextResponse.json(
      {
        ...payload,
        error: "GitHub API read failed.",
        errors,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(payload);
}
