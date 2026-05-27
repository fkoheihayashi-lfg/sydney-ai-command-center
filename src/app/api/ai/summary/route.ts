import { NextResponse } from "next/server";

type SummaryInputPayload = {
  selectedProject?: string;
  projectHealth?: string;
  summaryStatus?: string;
  currentBlockers?: string;
  recentProgress?: string;
  nextRecommendedAction?: string;
  sourceStatus?: string;
  pythonStudyStatus?: string;
  latestCommandLog?: string;
  githubProjects?: {
    source?: string;
    readOnly?: boolean;
    project?: {
      title?: string;
      itemCount?: number;
      returnedItemCount?: number;
    };
    items?: Array<{
      title?: string;
      type?: string;
      status?: string;
      assignees?: string[];
      labels?: string[];
      updatedAt?: string;
      dueDate?: string;
      area?: string;
    }>;
  };
};

const REQUIRED_FIELDS: Array<keyof SummaryInputPayload> = [
  "selectedProject",
  "projectHealth",
  "summaryStatus",
  "currentBlockers",
  "recentProgress",
  "nextRecommendedAction",
  "sourceStatus",
  "pythonStudyStatus",
  "latestCommandLog",
];

function validatePayload(payload: SummaryInputPayload) {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = payload[field];
    return typeof value !== "string" || value.trim().length === 0;
  });

  return missingFields;
}

function buildPrompt(payload: SummaryInputPayload) {
  return `
You are SYDNEY, an AI project command center assistant.

Create a concise, structured, action-oriented project PM summary draft from the local UI state below.

Output format:
- Use exactly these six headings:
  Current project
  Health/status
  Blockers
  Recent progress
  Next recommended action
  Source status / confidence
- Put 1-2 short bullets under each heading.
- Keep the full draft under 180 words.
- Write in plain English suitable for manual review and later posting as a project update.

Quality rules:
- Only use facts present in the payload.
- Avoid overclaiming. If the payload is mock, local, preview, or limited state, say so clearly.
- Do not imply live integrations, verified external data, or completed work unless the payload explicitly says that.
- If GitHub Projects data is present, treat it as read-only supporting source data. Do not suggest or imply GitHub writes, issue creation, assignments, project updates, or teammate actions.
- Use GitHub Projects items conservatively: mention only compact status, blockers, due dates, areas, or labels that are directly present.
- If blockers are absent, say no local blockers are flagged; do not say there are no real blockers.
- Make the next action specific and executable based on the payload.
- Treat pythonStudyStatus and latestCommandLog as supporting local context, not as the main project unless selectedProject points there.

Safety rules:
- Return only the draft text.
- Do not mention approval flow, posting mechanics, APIs, routes, environment variables, webhooks, secrets, stack traces, or raw implementation details.
- Do not include raw JSON or quote the payload field names.
- If any input appears sensitive or implementation-specific, summarize it generically or omit it.

Payload:
${JSON.stringify(payload, null, 2)}
`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractResponseText(data: unknown): string {
  if (!isRecord(data)) {
    return "";
  }

  const outputText = data.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText.trim();
  }

  const output = data.output;

  if (!Array.isArray(output)) {
    return "";
  }

  const textParts = output.flatMap((outputItem) => {
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
  });

  return textParts.join("\n").trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        { status: 503 },
      );
    }

    const payload = (await request.json()) as SummaryInputPayload;
    const missingFields = validatePayload(payload);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid summary input payload.",
          missingFields,
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
        input: buildPrompt(payload),
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "OpenAI request failed.",
          status: response.status,
          details: "Provider request failed safely. Raw provider details are not returned.",
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    const draft = extractResponseText(data);

    if (!draft) {
      return NextResponse.json(
        {
          ok: false,
          error: "OpenAI returned no summary text.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      draft,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected summary generation error.",
      },
      { status: 500 },
    );
  }
}
