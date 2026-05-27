import { NextResponse } from "next/server";

type ProjectUpdateRequest = {
  projectName?: string;
  phase?: string;
  status?: string;
  progress?: number;
  priority?: string;
  nextAction?: string;
  blocker?: string;
  note?: string;
};

function safeText(value: unknown, fallback = "N/A") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 900) : fallback;
}

function progressBar(progress: number) {
  const filled = Math.round(progress / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${progress}%`;
}

function priorityColor(priority: string) {
  if (priority === "高" || priority.toLowerCase() === "high") return 15158332;
  if (priority === "中" || priority.toLowerCase() === "medium") return 16753920;
  return 5763719;
}

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_DASHBOARD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Discord webhook is not configured.",
      },
      { status: 400 }
    );
  }

  let payload: ProjectUpdateRequest;

  try {
    payload = (await request.json()) as ProjectUpdateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  const progress = typeof payload.progress === "number" ? Math.max(0, Math.min(100, payload.progress)) : 0;
  const projectName = safeText(payload.projectName, "Unknown Project");
  const status = safeText(payload.status);
  const phase = safeText(payload.phase);
  const priority = safeText(payload.priority);
  const nextAction = safeText(payload.nextAction);
  const blocker = safeText(payload.blocker, "No blocker recorded.");
  const note = safeText(payload.note, "Sydney Console");

  const discordPayload = {
    content: `Sydney Console Project Update | ${projectName}`,
    embeds: [
      {
        title: `Project Update: ${projectName}`,
        description: [
          `**Status:** ${status}`,
          `**Progress:** ${progressBar(progress)}`,
          `**Priority:** ${priority}`,
        ].join("\n"),
        color: priorityColor(priority),
        fields: [
          {
            name: "Phase / フェーズ",
            value: phase,
            inline: true,
          },
          {
            name: "Progress / 進捗",
            value: `${progress}%`,
            inline: true,
          },
          {
            name: "Status / 状態",
            value: status,
            inline: true,
          },
          {
            name: "Next Action / 次のアクション",
            value: nextAction,
            inline: false,
          },
          {
            name: "Blocker / Note / ブロッカー",
            value: blocker,
            inline: false,
          },
          {
            name: "Source",
            value: "Sydney Console local dashboard",
            inline: false,
          },
        ],
        footer: {
          text: note,
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
          error: `Discord webhook request failed with status ${response.status}.`,
          status: response.status,
          details: "Discord webhook request failed safely. Raw provider details are not returned.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Project update sent to Discord successfully.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Project update Discord send failed safely.",
      },
      { status: 500 }
    );
  }
}
