import assert from "node:assert/strict";
import test from "node:test";
import { buildJevTaskEvaluation, normalizeJevTaskEvaluation } from "./jevPrediction.ts";

test("builds bounded duration and project choices without exposing project ids as choice keys", () => {
  const evaluation = buildJevTaskEvaluation({
    task: { title: "  Finish mechanics problem set  ", estimatedMinutes: 31 },
    projects: [
      { id: "project-private-id", title: "ESAT Physics", notes: "Mechanics and electricity" },
      { id: "done-project", title: "Archived", completed: true },
    ],
  });

  assert.equal(evaluation.state.task.title, "Finish mechanics problem set");
  assert.equal(Object.keys(evaluation.questions.duration.criteria).length, 16);
  assert.deepEqual(Object.keys(evaluation.questions.project.criteria), ["unassigned", "p0"]);
  assert.equal(evaluation.projectIdByChoice.p0, "project-private-id");
});

test("omits optional state fields when no estimate or history is available", () => {
  const evaluation = buildJevTaskEvaluation({ task: { title: "Review electricity mistakes" } });

  assert.deepEqual(evaluation.state, { task: { title: "Review electricity mistakes" } });
});

test("normalizes typed Jev answers and keeps field confidence separate", () => {
  const prediction = normalizeJevTaskEvaluation({
    answers: {
      duration: { type: "choice", choice: "m45", probabilities: { m30: 0.18, m45: 0.82 } },
      project: { type: "choice", choice: "p0", probabilities: { unassigned: 0.08, p0: 0.92 } },
    },
    providerMetadata: { typesafe: { confidence: { duration: 0.76, project: 0.88 } } },
  }, { p0: "physics" });

  assert.equal(prediction.durationMinutes, 45);
  assert.equal(prediction.projectId, "physics");
  assert.equal(prediction.durationConfidence, 0.76);
  assert.equal(prediction.projectConfidence, 0.88);
  assert.equal(prediction.confidence, 0.76);
});

test("rejects unknown choices and treats unassigned as an intentional empty project", () => {
  const prediction = normalizeJevTaskEvaluation({
    answers: {
      duration: { type: "choice", choice: "m999", probabilities: { m999: 1 } },
      project: { type: "choice", choice: "unassigned", probabilities: { unassigned: 0.7, p0: 0.3 } },
    },
  }, { p0: "physics" });

  assert.equal(prediction.durationMinutes, undefined);
  assert.equal(prediction.projectId, undefined);
  assert.equal(prediction.projectConfidence, 0.7);
});
