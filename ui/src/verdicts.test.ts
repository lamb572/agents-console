/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import { handedIn, verdictView } from "./verdicts";

describe("verdictView", () => {
  it("reads a Prove verdict as its result and where its evidence is", () => {
    expect(verdictView("prove", { prove: "fail", evidence: "runs/prove-1.evidence/run.txt" })).toEqual({
      kind: "prove",
      result: "fail",
      evidence: "runs/prove-1.evidence/run.txt",
    });
  });

  it("reads a Review verdict as its findings, clean when there are none", () => {
    const finding = { severity: "must" as const, title: "Shell injection", detail: "the todo text reaches a shell unescaped" };
    expect(verdictView("review", { findings: [finding] })).toEqual({ kind: "review", findings: [finding] });
    expect(verdictView("review", { findings: [] })).toEqual({ kind: "review", findings: [] });
  });

  it("reads a Decide verdict as its choice, its fixes and what it dropped", () => {
    const fix = { title: "Typo", reason: "cheap" };
    expect(verdictView("decide", { decide: "another-round", fixes: [fix] })).toEqual({
      kind: "decide",
      choice: "another-round",
      fixes: [fix],
      dropped: [],
    });
  });

  it("shows a verdict its node's kind does not read as the JSON the agent wrote", () => {
    expect(verdictView("review", { findings: "none" })).toEqual({ kind: "raw", text: '{\n  "findings": "none"\n}' });
    expect(verdictView("finish", "https://github.com/o/r/pull/1")).toEqual({
      kind: "raw",
      text: '"https://github.com/o/r/pull/1"',
    });
  });

  it("has nothing to show when the Outcome carried no verdict", () => {
    expect(verdictView("review", undefined)).toBeNull();
    expect(verdictView("agent", null)).toBeNull();
  });
});

describe("handedIn", () => {
  const plan = {
    nodes: [
      { id: "qa", kind: "prove" },
      { id: "security", kind: "review" },
      { id: "reviewed", kind: "gate" },
      { id: "finish", kind: "finish" },
    ],
  };
  const tickets = [
    {
      ticketId: "qa-1",
      node: "qa",
      status: "done" as const,
      outcome: { summary: "All checks pass.", verdict: { prove: "pass", evidence: "runs/qa-1.txt" } },
    },
    {
      ticketId: "security-1",
      node: "security",
      status: "done" as const,
      outcome: { summary: "One finding.", verdict: { findings: [{ severity: "must", title: "T", detail: "D" }] } },
    },
    { ticketId: "code-1", node: "code", status: "in-progress" as const, outcome: null },
  ];

  it("lists what each blocker of a Gate's hold handed in, in blocker order", () => {
    expect(handedIn({ node: "reviewed", blockedBy: ["security-1", "qa-1", "code-1"] }, tickets, plan)).toEqual([
      {
        ticketId: "security-1",
        node: "security",
        status: "done",
        summary: "One finding.",
        verdict: { kind: "review", findings: [{ severity: "must", title: "T", detail: "D" }] },
      },
      {
        ticketId: "qa-1",
        node: "qa",
        status: "done",
        summary: "All checks pass.",
        verdict: { kind: "prove", result: "pass", evidence: "runs/qa-1.txt" },
      },
      { ticketId: "code-1", node: "code", status: "in-progress", summary: null, verdict: null },
    ]);
  });

  it("lists them for the Finish's hold too", () => {
    expect(handedIn({ node: "finish", blockedBy: ["qa-1"] }, tickets, plan)?.map((h) => h.ticketId)).toEqual(["qa-1"]);
  });

  it("is null for a Ticket that is not a Gate's or the Finish's", () => {
    expect(handedIn({ node: "security", blockedBy: ["qa-1"] }, tickets, plan)).toBeNull();
    expect(handedIn({ node: null, blockedBy: ["qa-1"] }, tickets, plan)).toBeNull();
    expect(handedIn({ node: "reviewed", blockedBy: ["qa-1"] }, tickets, null)).toBeNull();
  });
});
