import { NextResponse } from "next/server";

type DailySummaryProject = {
  name?: string;
  phase?: string;
  status?: string;
  progress?: number;
  priority?: string;
  nextAction?: string;
  blocker?: string;
};

type DailySummaryTask = {
  title?: string;
  priority?: string;
  estimate?: string;
};

type DailySummaryRequest = {
  topTasks?: DailySummaryTask[];
  projects?: DailySummaryProject[];
  study?: {
    dayNumber?: number;
    title?: string;
    criteria?: string;
    status?: string;
  };
  focusMessage?: string;
};

function safeText(value: unknown, fallback = "N/A") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 900) : fallback;
}

function formatProjectLine(project: DailySummaryProject) {
  const name = safeText(project.name, "Unknown Project");
  const phase = safeText(project.phase);
  const status = safeText(project.status);
  const progress = typeof project.progress === "number" ? Math.max(0, Math.min(100, project.progress)) : 0;
  const priority = safeText(project.priority);

  return `• **${name}** — ${progress}% | ${phase} | ${status} | Priority: ${priority}`;
}

function formatTaskLine(task: DailySummaryTask, index: number) {
  const title = safeText(task.title, "Untitled Task");
  const priority = safeText(task.priority);
  const estimate = safeText(task.estimate, "");
  return `${index + 1}. **${title}** — Priority: ${priority}${estimate ? ` | ${estimate}` : ""}`;
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

  let payload: DailySummaryRequest;

  try {
    payload = (await request.json()) as DailySummaryRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  const topTasks = Array.isArray(payload.topTasks) ? payload.topTasks.slice(0, 5) : [];
  const projects = Array.isArray(payload.projects) ? payload.projects.slice(0, 8) : [];
  const study = payload.study ?? {};
  const focusMessage = safeText(
    payload.focusMessage,
    "小さく前進し、確実に積み上げることが最大の近道です。"
  );

  const blockerProjects = projects.filter((project) => {
    const blocker = safeText(project.blocker, "");
    return blocker !== "N/A" && blocker !== "なし" && blocker.toLowerCase() !== "none";
  });

  const discordPayload = {
    content: "Sydney Console Daily Summary | Today’s operating snapshot",
    embeds: [
      {
        title: "Daily Summary",
        description: `**Today’s Focus / 今日のフォーカス**\n${focusMessage}`,
        color: 3447003,
        fields: [
          {
            name: "Today’s Top 3 / 今日のTop 3",
            value:
              topTasks.length > 0
                ? topTasks.map(formatTaskLine).join("\n").slice(0, 1024)
                : "No priority tasks recorded.",
            inline: false,
          },
          {
            name: "Project Status / プロジェクト状況",
            value:
              projects.length > 0
                ? projects.map(formatProjectLine).join("\n").slice(0, 1024)
                : "No projects recorded.",
            inline: false,
          },
          {
            name: "Python Study / 学習",
            value: `Day ${study.dayNumber ?? "N/A"}: ${safeText(study.title)}\nCompletion: ${safeText(study.criteria)}\nStatus: ${safeText(study.status, "N/A")}`,
            inline: false,
          },
          {
            name: "Blockers / Risks / 注意事項",
            value:
              blockerProjects.length > 0
                ? blockerProjects
                    .slice(0, 5)
                    .map((project) => `• **${safeText(project.name)}** — ${safeText(project.blocker)}`)
                    .join("\n")
                    .slice(0, 1024)
                : "No active blockers recorded.",
            inline: false,
          },
        ],
        footer: {
          text: "Sydney Console",
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
      message: "Daily summary sent to Discord successfully.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Daily summary Discord send failed safely.",
      },
      { status: 500 }
    );
  }
}
