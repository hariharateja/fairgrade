import { Badge, type BadgeTone } from "./ui";

export const DOUBT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  AI_SUGGESTED: { label: "AI suggested", tone: "blue" },
  ESCALATED: { label: "With instructor", tone: "amber" },
  RESOLVED: { label: "Resolved", tone: "green" },
};

export const CONFIDENCE_TONE: Record<string, BadgeTone> = { high: "green", medium: "blue", low: "amber" };

export function DoubtStatusBadge({ status }: { status: string }) {
  const s = DOUBT_STATUS[status] ?? DOUBT_STATUS.AI_SUGGESTED;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
