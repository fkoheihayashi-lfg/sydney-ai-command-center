import { NextResponse } from "next/server";

type GitHubIssueOrPullRequest = {
  number?: number | null;
  title?: string | null;
  url?: string | null;
  updatedAt?: string | null;
  state?: string | null;
};

type GitHubCommit = {
  __typename?: string | null;
  oid?: string | null;
  messageHeadline?: string | null;
  committedDate?: string | null;
  url?: string | null;
};

type GitHubRepository = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
  updatedAt?: string | null;
  pushedAt?: string | null;
  defaultBranchRef?: {
    name?: string | null;
    target?: GitHubCommit | null;
  } | null;
  issues?: {
    totalCount?: number | null;
    nodes?: GitHubIssueOrPullRequest[] | null;
  } | null;
  pullRequests?: {
    totalCount?: number | null;
    nodes?: GitHubIssueOrPullRequest[] | null;
  } | null;
};

type GitHubWorkspaceGraphQLResponse = {
  data?: Record<string, GitHubRepository | null>;
  errors?: unknown[];
};

const SOURCE = "github-workspace-readonly";
const REQUIRED_ENV = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPOS"];
const MAX_REPOS = 20;
const RECENT_DAYS = 14;
const MAX_TEXT_LENGTH = 300;
const REPO_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

const baseResponse = {
  source: SOURCE,
  readOnly: true,
  writesDisabled: true,
  requiredEnv: REQUIRED_ENV,
};

function safeText(value: unknown, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseRepos(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((repo) => repo.trim())
        .filter(Boolean)
    )
  );
}

function isValidRepoName(repo: string) {
  return repo.length <= 100 && REPO_NAME_PATTERN.test(repo);
}

function isRecent(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;

  return Date.now() - time <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function normalizeIssueOrPullRequest(item: GitHubIssueOrPullRequest) {
  return {
    number: safeNumber(item.number),
    title: safeText(item.title, "Untitled"),
    url: safeText(item.url),
    updatedAt: safeText(item.updatedAt),
    state: safeText(item.state),
  };
}

function repoStatus(openIssuesCount: number, openPrCount: number, updatedAt: string, pushedAt: string) {
  const recentlyUpdated = isRecent(updatedAt) || isRecent(pushedAt);
  const recentlyPushed = isRecent(pushedAt);

  if (openPrCount > 0) return "Needs Review";
  if (openIssuesCount > 0 && !recentlyPushed) return "Needs Triage";
  if (recentlyUpdated || openIssuesCount > 0) return "Active";
  return "Quiet";
}

function safeNextAction(status: string) {
  if (status === "Needs Review") return "Review open pull requests.";
  if (status === "Needs Triage") return "Triage open issues before the next work block.";
  if (status === "Active") return "Check the latest commit and recent issue activity.";
  return "No immediate GitHub action.";
}

function buildWorkspaceQuery(repos: string[]) {
  const repoVariables = repos.map((_, index) => `$repo${index}: String!`).join(", ");
  const repoSelections = repos
    .map(
      (_, index) => `
        repo${index}: repository(owner: $owner, name: $repo${index}) {
          ...WorkspaceRepositoryFields
        }
      `
    )
    .join("\n");

  return `
    query SydneyGitHubWorkspaceReadOnly($owner: String!, ${repoVariables}) {
      ${repoSelections}
    }

    fragment WorkspaceRepositoryFields on Repository {
      name
      description
      url
      updatedAt
      pushedAt
      defaultBranchRef {
        name
        target {
          __typename
          ... on Commit {
            oid
            messageHeadline
            committedDate
            url
          }
        }
      }
      issues(states: OPEN, first: 5, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes {
          number
          title
          url
          updatedAt
          state
        }
      }
      pullRequests(states: OPEN, first: 5, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes {
          number
          title
          url
          updatedAt
          state
        }
      }
    }
  `;
}

function normalizeRepo(repoName: string, repo: GitHubRepository | null) {
  if (!repo) {
    return {
      name: repoName,
      description: "",
      url: "",
      updatedAt: "",
      pushedAt: "",
      defaultBranch: "",
      latestCommit: {
        summary: "",
        committedDate: "",
        url: "",
        oid: "",
      },
      openIssuesCount: 0,
      openPrCount: 0,
      recentlyUpdatedIssues: [],
      recentlyUpdatedPrs: [],
      status: "Unavailable",
      safeNextAction: "Check repo name and read access.",
      readOnly: true,
      writesDisabled: true,
    };
  }

  const updatedAt = safeText(repo.updatedAt);
  const pushedAt = safeText(repo.pushedAt);
  const openIssuesCount = safeNumber(repo.issues?.totalCount);
  const openPrCount = safeNumber(repo.pullRequests?.totalCount);
  const status = repoStatus(openIssuesCount, openPrCount, updatedAt, pushedAt);
  const latestCommit = repo.defaultBranchRef?.target?.__typename === "Commit" ? repo.defaultBranchRef.target : null;

  return {
    name: safeText(repo.name, repoName),
    description: safeText(repo.description),
    url: safeText(repo.url),
    updatedAt,
    pushedAt,
    defaultBranch: safeText(repo.defaultBranchRef?.name),
    latestCommit: {
      summary: safeText(latestCommit?.messageHeadline),
      committedDate: safeText(latestCommit?.committedDate),
      url: safeText(latestCommit?.url),
      oid: safeText(latestCommit?.oid),
    },
    openIssuesCount,
    openPrCount,
    recentlyUpdatedIssues: (repo.issues?.nodes ?? []).map(normalizeIssueOrPullRequest),
    recentlyUpdatedPrs: (repo.pullRequests?.nodes ?? []).map(normalizeIssueOrPullRequest),
    status,
    safeNextAction: safeNextAction(status),
    readOnly: true,
    writesDisabled: true,
  };
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const owner = safeText(process.env.GITHUB_OWNER);
  const repoListValue = process.env.GITHUB_REPOS;
  const repos = repoListValue ? parseRepos(repoListValue) : [];

  if (!token || !owner || !repoListValue || repos.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Workspace integration is not configured.",
      },
      { status: 503 }
    );
  }

  if (!OWNER_PATTERN.test(owner) || repos.length > MAX_REPOS || repos.some((repo) => !isValidRepoName(repo))) {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Workspace repository configuration is invalid.",
      },
      { status: 400 }
    );
  }

  try {
    const variables = repos.reduce<Record<string, string>>(
      (result, repo, index) => ({
        ...result,
        [`repo${index}`]: repo,
      }),
      { owner }
    );

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "SYDNEY-Command-Center",
      },
      body: JSON.stringify({
        query: buildWorkspaceQuery(repos),
        variables,
      }),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => ({}))) as GitHubWorkspaceGraphQLResponse;

    if (!response.ok || result.errors?.length) {
      return NextResponse.json(
        {
          ok: false,
          ...baseResponse,
          error: "GitHub Workspace read-only request failed.",
          status: response.status,
        },
        { status: response.ok ? 502 : response.status }
      );
    }

    const reposData = repos.map((repo, index) => normalizeRepo(repo, result.data?.[`repo${index}`] ?? null));

    return NextResponse.json({
      ok: true,
      source: SOURCE,
      readOnly: true,
      writesDisabled: true,
      owner,
      repoCount: reposData.length,
      fetchedAt: new Date().toISOString(),
      repos: reposData,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Workspace read-only request failed.",
      },
      { status: 500 }
    );
  }
}
