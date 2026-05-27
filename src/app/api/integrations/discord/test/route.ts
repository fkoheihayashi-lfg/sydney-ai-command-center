import { NextResponse } from "next/server";

type DiscordTestRequest = {
  message?: string;
};

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

  let payload: DiscordTestRequest = {};

  try {
    payload = (await request.json()) as DiscordTestRequest;
  } catch {
    payload = {};
  }

  const message =
    payload.message?.trim() ||
    "Sydney Console test notification: Discord Webhook integration is working.";

  const discordPayload = {
    content: message,
    embeds: [
      {
        title: "Sydney Console",
        description: "Discord Webhook live test completed from local Sydney Console dashboard.",
        color: 3447003,
        fields: [
          {
            name: "Status",
            value: "Live webhook route reached successfully.",
            inline: true,
          },
          {
            name: "Mode",
            value: "Local development",
            inline: true,
          },
        ],
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
      message: "Discord test message sent successfully.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Discord test send failed safely.",
      },
      { status: 500 }
    );
  }
}
