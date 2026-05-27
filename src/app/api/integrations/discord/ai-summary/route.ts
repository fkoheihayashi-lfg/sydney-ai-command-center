import { NextResponse } from "next/server";

type AiSummaryRequest = {
  draft?: unknown;
  approved?: unknown;
};

const MAX_DRAFT_LENGTH = 3500;

function safeDraft(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_DRAFT_LENGTH);
}

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_DASHBOARD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Discord webhook is not configured.",
      },
      { status: 503 }
    );
  }

  let payload: AiSummaryRequest;

  try {
    payload = (await request.json()) as AiSummaryRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  const draft = safeDraft(payload.draft);

  if (!draft) {
    return NextResponse.json(
      {
        ok: false,
        error: "Approved AI summary draft is required.",
      },
      { status: 400 }
    );
  }

  if (payload.approved !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: "Manual approval is required before posting.",
      },
      { status: 403 }
    );
  }

  const discordPayload = {
    content: "Sydney Console Approved AI Summary Draft",
    embeds: [
      {
        title: "Approved AI Summary Draft",
        description: draft,
        color: 5763719,
        fields: [
          {
            name: "Review status",
            value: "Manually reviewed and posted through Sydney Console.",
            inline: false,
          },
          {
            name: "Source",
            value: "Sydney Console AI summary draft",
            inline: false,
          },
        ],
        footer: {
          text: "Sydney Console approved AI draft",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Discord webhook request failed.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Approved AI summary posted to Discord.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Discord posting failed.",
      },
      { status: 500 }
    );
  }
}
