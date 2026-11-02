/**
 * A Line Ticket's typed verdict (ADR-0040) as the Detail shows it. The engine
 * routes on the verdict an Outcome carries, and the operator who answers a
 * Gate or the Finish decides on it, so the Detail shows it whole: Prove's
 * result and evidence, Review's findings, Decide's fixes and what it dropped.
 * The kind is read from the Ticket's node, the way the engine reads it; a
 * verdict that shape does not fit shows as the JSON the agent wrote.
 */

import type { DecideItem, FindingSeverity, Outcome, TicketStatus } from "../../protocol/wire.ts";

export type VerdictView =
  | { kind: "prove"; result: "pass" | "fail"; evidence: string }
  | { kind: "review"; findings: { severity: FindingSeverity; title: string; detail: string }[] }
  | { kind: "decide"; choice: string; fixes: DecideItem[]; dropped: DecideItem[] }
  | { kind: "raw"; text: string };

/** What one Ticket feeding a hold handed in: its summary and its verdict. */
export interface HandedInView {
  ticketId: string;
  node: string | null;
  status: TicketStatus;
  summary: string | null;
  verdict: VerdictView | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string";
const SEVERITIES: readonly unknown[] = ["must", "should", "nit"];

function items(v: unknown): DecideItem[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  return v.every((i) => isRecord(i) && isText(i.title) && isText(i.reason))
    ? v.map((i) => ({ title: i.title as string, reason: i.reason as string }))
    : null;
}

function typed(kind: string | undefined, v: unknown): VerdictView | null {
  if (!isRecord(v)) return null;
  if (kind === "prove" && (v.prove === "pass" || v.prove === "fail") && isText(v.evidence)) {
    return { kind: "prove", result: v.prove, evidence: v.evidence };
  }
  if (kind === "review" && Array.isArray(v.findings)) {
    const findings = v.findings;
    if (!findings.every((f) => isRecord(f) && SEVERITIES.includes(f.severity) && isText(f.title) && isText(f.detail))) {
      return null;
    }
    return {
      kind: "review",
      findings: findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
    };
  }
  if (kind === "decide" && isText(v.decide)) {
    const fixes = items(v.fixes);
    const dropped = items(v.dropped);
    if (fixes && dropped) return { kind: "decide", choice: v.decide, fixes, dropped };
  }
  return null;
}

/** The verdict of a Ticket on a node of `kind`, or null when its Outcome carried none. */
export function verdictView(kind: string | undefined, verdict: unknown): VerdictView | null {
  if (verdict === undefined || verdict === null) return null;
  return typed(kind, verdict) ?? { kind: "raw", text: JSON.stringify(verdict, null, 2) };
}

interface HoldFacts {
  node: string | null;
  blockedBy: readonly string[];
}

interface TicketFacts {
  ticketId: string;
  node: string | null;
  status: TicketStatus;
  outcome: Pick<Outcome, "summary" | "verdict"> | null;
}

/**
 * What each Ticket a Gate's or the Finish's hold waits on handed in, in the
 * hold's blocker order: the operator answering the hold reads it there. Null
 * for any other Ticket.
 */
export function handedIn(
  hold: HoldFacts,
  tickets: readonly TicketFacts[],
  plan: { nodes: readonly { id: string; kind: string }[] } | null,
): HandedInView[] | null {
  const kindOf = (node: string | null) => plan?.nodes.find((n) => n.id === node)?.kind;
  const kind = kindOf(hold.node);
  if (kind !== "gate" && kind !== "finish") return null;
  return hold.blockedBy.flatMap((id) => {
    const ticket = tickets.find((t) => t.ticketId === id);
    if (!ticket) return [];
    return [
      {
        ticketId: id,
        node: ticket.node,
        status: ticket.status,
        summary: ticket.outcome?.summary || null,
        verdict: ticket.outcome ? verdictView(kindOf(ticket.node), ticket.outcome.verdict) : null,
      },
    ];
  });
}
