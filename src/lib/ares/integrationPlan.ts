import { Database, Github, Sparkles, Webhook } from "lucide-react";

export const integrationSources = [
  {
    name: "GitHub Projects",
    source: "Project / Issue / PR",
    status: "接続予定",
    icon: Github,
  },
  {
    name: "Discord Webhook",
    source: "通知 / チーム会話",
    status: "接続予定",
    icon: Webhook,
  },
  {
    name: "OpenAI API",
    source: "AI PM Summary生成",
    status: "接続予定",
    icon: Sparkles,
  },
  {
    name: "Local Storage",
    source: "学習状態 / タイマー",
    status: "Mock",
    icon: Database,
  },
] as const;
