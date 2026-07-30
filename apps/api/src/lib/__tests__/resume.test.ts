import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveResumeStage } from "../resume";

/**
 * This decides where a candidate whose tab died is put back. Getting it wrong
 * either skips work they still owe (scoring them on an incomplete assessment)
 * or repeats work they already did.
 */

const base = {
  id: "s1",
  ticketId: "t1",
  defenceMode: "VOICE" as const,
  status: "REVIEWED",
  finalized: false,
};

const fu = (o: Partial<{ question1: string | null; question2: string | null; answer1: string | null; answer2: string | null; answeredAt: Date | null }> = {}) => ({
  question1: "Why did it break?",
  question2: null,
  answer1: null,
  answer2: null,
  answeredAt: null,
  ...o,
});

test("still being reviewed resumes to analysing, not a question", () => {
  assert.equal(resolveResumeStage({ ...base, status: "PENDING", followUp: null }).stage, "analysing");
});

test("reviewed but Q1 not generated yet resumes to analysing", () => {
  assert.equal(resolveResumeStage({ ...base, followUp: null }).stage, "analysing");
});

test("Q1 present and unanswered resumes to q1", () => {
  // The exact case that stranded a pilot candidate: the old code called this
  // "nothing to resume" and made them redo the whole assessment.
  assert.equal(resolveResumeStage({ ...base, followUp: fu() }).stage, "q1");
});

test("Q1 answered but Q2 never generated resumes to q2, not back to q1", () => {
  assert.equal(
    resolveResumeStage({ ...base, followUp: fu({ answer1: "because X" }) }).stage,
    "q2"
  );
});

test("Q2 present and unanswered resumes to q2", () => {
  assert.equal(
    resolveResumeStage({ ...base, followUp: fu({ answer1: "a", question2: "and then?" }) }).stage,
    "q2"
  );
});

test("both written answers done resumes to the verbal defence", () => {
  assert.equal(
    resolveResumeStage({
      ...base,
      followUp: fu({ answer1: "a", question2: "q2", answer2: "b", answeredAt: new Date() }),
    }).stage,
    "verbal"
  );
});

test("a candidate committed to typed keeps that channel across the resume", () => {
  const r = resolveResumeStage({
    ...base,
    defenceMode: "TYPED",
    followUp: fu({ answer1: "a", question2: "q2", answer2: "b", answeredAt: new Date() }),
  });
  assert.equal(r.defenceMode, "TYPED");
  assert.equal(r.stage, "verbal");
});

test("the deep link always carries both submission and ticket", () => {
  const r = resolveResumeStage({ ...base, followUp: fu() });
  assert.match(r.url, /resume=s1/);
  assert.match(r.url, /ticketId=t1/);
});
