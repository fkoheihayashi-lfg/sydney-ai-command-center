import { NextResponse } from "next/server";

type GitHubUser = {
  login?: string | null;
};

type GitHubLabel = {
  name?: string | null;
};

type GitHubFieldValue = {
  text?: string | null;
  name?: string | null;
  date?: string | null;
  users?: {
    nodes?: GitHubUser[] | null;
  } | null;
  field?: {
    name?: string | null;
  } | null;
};

type GitHubProjectItem = {
  content?: {
    __typename?: string;
    title?: string | null;
    url?: string | null;
    state?: string | null;
    body?: string | null;
    bodyText?: string | null;
    updatedAt?: string | null;
    assignees?: {
      nodes?: GitHubUser[] | null;
    } | null;
    labels?: {
      nodes?: GitHubLabel[] | null;
    } | null;
  } | null;
  fieldValues?: {
    nodes?: GitHubFieldValue[] | null;
  } | null;
};

type GitHubProjectV2 = {
  title?: string | null;
  url?: string | null;
  closed?: boolean | null;
  items?: {
    totalCount?: number | null;
    nodes?: GitHubProjectItem[] | null;
  } | null;
};

type GitHubGraphQLResponse = {
  data?: {
    owner?: {
      projectV2?: GitHubProjectV2 | null;
    } | null;
  };
  errors?: unknown[];
};

type ProjectOwnerType = "organization" | "user";

type ProjectV2Data = {
  title: string;
  url: string;
  number: number;
  closed: boolean;
  itemCount: number;
  returnedItemCount: number;
  items: Array<{
    title: string;
    type: string;
    url: string;
    status: string;
    assignees: string[];
    labels: string[];
    updatedAt: string;
    bodyExcerpt: string;
    fields: {
      dueDate: string;
      area: string;
    };
  }>;
};

const SOURCE = "github-projects-readonly";
const MAX_ITEMS = 20;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_LENGTH = 500;

const baseResponse = {
  source: SOURCE,
  readOnly: true,
  writesDisabled: true,
};

function buildQuery(ownerType: ProjectOwnerType) {
  const ownerField = ownerType === "organization" ? "organization" : "user";

  return `
  query SydneyGitHubProjectsReadOnly($login: String!, $projectNumber: Int!, $itemLimit: Int!) {
    owner: ${ownerField}(login: $login) {
      projectV2(number: $projectNumber) {
        title
        url
        closed
        items(first: $itemLimit) {
          totalCount
          nodes {
            content {
              __typename
              ... on Issue {
                title
                url
                state
                bodyText
                updatedAt
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                labels(first: 10) {
                  nodes {
                    name
                  }
                }
              }
              ... on PullRequest {
                title
                url
                state
                bodyText
                updatedAt
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                labels(first: 10) {
                  nodes {
                    name
                  }
                }
              }
              ... on DraftIssue {
                title
                body
                updatedAt
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldUserValue {
                  users(first: 10) {
                    nodes {
                      login
                    }
                  }
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
}

function safeText(value: unknown, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function normalizeType(typeName: string | undefined) {
  if (typeName === "Issue") return "Issue";
  if (typeName === "PullRequest") return "PullRequest";
  if (typeName === "DraftIssue") return "DraftIssue";
  return "Unknown";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function collectLogins(users: GitHubUser[] = []) {
  return unique(users.map((user) => safeText(user.login)));
}

function collectLabels(labels: GitHubLabel[] = []) {
  return unique(labels.map((label) => safeText(label.name)));
}

function fieldValue(value: GitHubFieldValue) {
  const users = collectLogins(value.users?.nodes ?? []);
  if (users.length > 0) return users.join(", ");
  return safeText(value.text || value.name || value.date);
}

function collectFields(values: GitHubFieldValue[] = []) {
  const fields = {
    status: "",
    assignees: [] as string[],
    dueDate: "",
    area: "",
  };

  values.forEach((value) => {
    const fieldName = safeText(value.field?.name).toLowerCase();
    const normalized = fieldValue(value);
    if (!fieldName || !normalized) return;

    if (fieldName === "status") fields.status = normalized;
    if (fieldName === "assignees" || fieldName === "assignee") fields.assignees = normalized.split(", ");
    if (fieldName === "due date" || fieldName === "duedate" || fieldName === "due") fields.dueDate = normalized;
    if (fieldName === "area") fields.area = normalized;
  });

  fields.assignees = unique(fields.assignees);

  return fields;
}

function safeStatus(statusField: string, state: unknown) {
  return statusField || safeText(state);
}

function parseProjectNumbers() {
  const projectNumbersValue = safeText(process.env.GITHUB_PROJECT_NUMBERS);
  const projectNumberValue = safeText(process.env.GITHUB_PROJECT_NUMBER);
  const rawValues = projectNumbersValue
    ? projectNumbersValue.split(",")
    : projectNumberValue
      ? [projectNumberValue]
      : [];

  return rawValues
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function fetchProjectV2({
  token,
  ownerType,
  login,
  projectNumber,
}: {
  token: string;
  ownerType: ProjectOwnerType;
  login: string;
  projectNumber: number;
}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "SYDNEY-Command-Center",
    },
    body: JSON.stringify({
      query: buildQuery(ownerType),
      variables: {
        login,
        projectNumber,
        itemLimit: MAX_ITEMS,
      },
    }),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => ({}))) as GitHubGraphQLResponse;

  if (!response.ok || result.errors?.length) {
    return {
      ok: false as const,
      status: response.status,
    };
  }

  const project = result.data?.owner?.projectV2;

  if (!project) {
    return {
      ok: false as const,
      status: 404,
    };
  }

  const items = (project.items?.nodes ?? []).map((item) => {
    const content = item.content;
    const fields = collectFields(item.fieldValues?.nodes ?? []);
    const assignees = unique([...collectLogins(content?.assignees?.nodes ?? []), ...fields.assignees]);

    return {
      title: safeText(content?.title, "Untitled item"),
      type: normalizeType(content?.__typename),
      url: safeText(content?.url),
      status: safeStatus(fields.status, content?.state),
      assignees,
      labels: collectLabels(content?.labels?.nodes ?? []),
      updatedAt: safeText(content?.updatedAt),
      bodyExcerpt: safeText(content?.bodyText || content?.body, "", MAX_BODY_LENGTH),
      fields: {
        dueDate: fields.dueDate,
        area: fields.area,
      },
    };
  });

  return {
    ok: true as const,
    project: {
      title: safeText(project.title, "Untitled project"),
      url: safeText(project.url),
      number: projectNumber,
      closed: Boolean(project.closed),
      itemCount: project.items?.totalCount ?? items.length,
      returnedItemCount: items.length,
      items,
    } satisfies ProjectV2Data,
  };
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const org = safeText(process.env.GITHUB_ORG);
  const user = safeText(process.env.GITHUB_USER);
  const projectNumbers = parseProjectNumbers();

  if (!token || projectNumbers.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Projects integration is not configured.",
      },
      { status: 503 }
    );
  }

  if (!org && !user) {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Projects integration needs either GITHUB_ORG or GITHUB_USER.",
      },
      { status: 503 }
    );
  }

  if (org && user) {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Projects integration should configure only one owner type: GITHUB_ORG or GITHUB_USER.",
      },
      { status: 400 }
    );
  }

  const ownerType: ProjectOwnerType = org ? "organization" : "user";
  const login = org || user;

  try {
    const results = await Promise.all(
      projectNumbers.map((projectNumber) => fetchProjectV2({ token, ownerType, login, projectNumber }))
    );
    const failedResult = results.find((result) => !result.ok);

    if (failedResult && !failedResult.ok && failedResult.status !== 404) {
      return NextResponse.json(
        {
          ok: false,
          ...baseResponse,
          error: "GitHub Projects read-only request failed.",
          status: failedResult.status,
        },
        { status: failedResult.status }
      );
    }

    const projects = results.flatMap((result) => (result.ok ? [result.project] : []));
    const firstProject = projects[0];

    if (!firstProject) {
      return NextResponse.json(
        {
          ok: false,
          ...baseResponse,
          error: "GitHub Projects metadata was not found.",
        },
        { status: 404 }
      );
    }

    const allItems = projects.flatMap((project) => project.items);

    return NextResponse.json({
      ok: true,
      source: SOURCE,
      readOnly: true,
      writesDisabled: true,
      owner: {
        type: ownerType,
        login,
      },
      projects,
      project: {
        title: firstProject.title,
        url: firstProject.url,
        number: firstProject.number,
        closed: firstProject.closed,
        itemCount: firstProject.itemCount,
        returnedItemCount: firstProject.returnedItemCount,
      },
      items: allItems,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        ...baseResponse,
        error: "GitHub Projects read-only request failed.",
      },
      { status: 500 }
    );
  }
}
