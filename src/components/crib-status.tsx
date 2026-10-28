import { Badge, type BadgeTone } from "./ui";

export const CRIB_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: "Open", tone: "amber" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Rejected", tone: "slate" },
};

export const VERDICT: Record<string, { label: string; tone: BadgeTone }> = {
  likely_valid: { label: "AI: likely valid", tone: "green" },
  likely_invalid: { label: "AI: likely invalid", tone: "red" },
  unclear: { label: "AI: unclear", tone: "amber" },
};

export function CribStatusBadge({ status }: { status: string }) {
  const s = CRIB_STATUS[status] ?? CRIB_STATUS.OPEN;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict || !VERDICT[verdict]) return null;
  return <Badge tone={VERDICT[verdict].tone}>{VERDICT[verdict].label}</Badge>;
}
