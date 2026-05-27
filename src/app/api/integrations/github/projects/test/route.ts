import { NextResponse } from "next/server";

type GitHubFieldValue = {
  __typename?: string;
  text?: string | null;
  name?: string | null;
  date?: string | null;
  field?: {
    name?: string | null;
  } | null;
};

type GitHubProjectItem = {
  id?: string;
  content?: {
    __typename?: string;
    title?: string | null;
    url?: string | null;
    state?: string | null;
  } | null;
  fieldValues?: {
    nodes?: GitHubFieldValue[];
  } | null;
};

type GitHubGraphQLResponse = {
  data?: {
    organization?: {
      projectV2?: {
        id?: string;
        title?: string | null;
        url?: string | null;
        closed?: boolean | null;
        items?: {
          totalCount?: number;
          nodes?: GitHubProjectItem[];
        } | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const query = `
  query SydneyProjectReadOnlyTest($org: String!, $projectNumber: Int!) {
    organization(login: $org) {
      projectV2(number: $projectNumber) {
        id
        title
        url
        closed
        items(first: 10) {
          totalCount
          nodes {
            id
            content {
              __typename
              ... on Issue {
                title
                url
                state
              }
              ... on PullRequest {
                title
                url
                state
              }
              ... on DraftIssue {
                title
              }
            }
            fieldValues(first: 20) {
              nodes {
                __typename
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
              }
            }
          }
        }
      }
    }
  }
`;

function safeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 300) : fallback;
}

function normalizeType(typeName: string | undefined) {
  if (typeName === "PullRequest") return "PullRequest";
  if (typeName === "DraftIssue") return "DraftIssue";
  return "Issue";
}

function fieldValue(value: GitHubFieldValue) {
  return safeText(value.text || value.name || value.date);
}

function collectFields(values: GitHubFieldValue[] = []) {
  const fields = {
    status: "",
    assignees: "",
    dueDate: "",
    area: "",
  };

  values.forEach((value) => {
    const fieldName = safeText(value.field?.name).toLowerCase();
    const normalized = fieldValue(value);
    if (!normalized) return;

    if (fieldName === "status") fields.status = normalized;
    if (fieldName === "assignees" || fieldName === "assignee") fields.assignees = normalized;
    if (fieldName === "due date" || fieldName === "duedate" || fieldName === "due") fields.dueDate = normalized;
    if (fieldName === "area") fields.area = normalized;
  });

  return fields;
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const org = process.env.GITHUB_ORG;
  const projectNumberValue = process.env.GITHUB_PROJECT_NUMBER;
  const projectNumber = Number(projectNumberValue);

  if (!token || !org || !projectNumberValue || !Number.isInteger(projectNumber)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing GitHub Projects environment variables.",
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "SYDNEY-Command-Center-v0.14",
      },
      body: JSON.stringify({
        query,
        variables: {
          org,
          projectNumber,
        },
      }),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => ({}))) as GitHubGraphQLResponse;

    if (!response.ok || result.errors?.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "GitHub Projects read-only request failed.",
        },
        { status: response.ok ? 502 : response.status }
      );
    }

    const project = result.data?.organization?.projectV2;

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: "GitHub Projects metadata was not found.",
        },
        { status: 404 }
      );
    }

    const nodes = project.items?.nodes ?? [];
    const items = nodes.map((item) => {
      const content = item.content;
      return {
        title: safeText(content?.title, "Untitled item"),
        url: safeText(content?.url),
        type: normalizeType(content?.__typename),
        state: safeText(content?.state),
        fields: collectFields(item.fieldValues?.nodes ?? []),
      };
    });

    return NextResponse.json({
      ok: true,
      project: {
        title: safeText(project.title, "Untitled project"),
        url: safeText(project.url),
        closed: Boolean(project.closed),
        itemCount: project.items?.totalCount ?? items.length,
      },
      items,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "GitHub Projects read-only request failed.",
      },
      { status: 500 }
    );
  }
}
