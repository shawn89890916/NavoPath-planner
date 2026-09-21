export const JEV_MODEL = "typesafe-ai/jev";
export const JEV_MODEL_VERSION = JEV_MODEL;
export const TYPESAFE_JEV_MODEL = "jev-latest";
export const OPENROUTER_JEV_MODEL = "~typesafe/jev-latest";
const TYPESAFE_EVALUATION_URL = "https://api.typesafe.ai/v1/systemone";
const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

const DURATION_MINUTES = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240] as const;
const MAX_PROJECT_CHOICES = 32;

type JevProject = { id?: unknown; title?: unknown; notes?: unknown; completed?: unknown };
type JevContext = {
  task?: { title?: unknown; estimatedMinutes?: unknown; projectId?: unknown };
  projects?: JevProject[];
  preferences?: unknown;
  requestDuration?: unknown;
  requestProject?: unknown;
};

type ChoiceAnswer = {
  type?: unknown;
  choice?: unknown;
  probabilities?: unknown;
  confidence?: unknown;
};

type EvaluationResult = {
  model?: unknown;
  answers?: Record<string, ChoiceAnswer>;
  providerMetadata?: unknown;
};

type JevPredictionOptions = {
  zeroDataRetention?: boolean;
  fetcher?: typeof fetch;
};

export type JevTaskPrediction = {
  durationMinutes?: number;
  projectId?: string;
  durationConfidence?: number;
  projectConfidence?: number;
  durationProbabilities?: Record<string, number>;
  projectProbabilities?: Record<string, number>;
  confidence?: number;
  modelVersion: string;
  provider: "jev";
};

export type JevTaskEvaluation = {
  state: Record<string, unknown>;
  questions: Record<string, {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
  }>;
  projectIdByChoice: Record<string, string>;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function clampProbability(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : undefined;
}

function normalizeProbabilities(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .flatMap(([key, probability]) => {
      const normalized = clampProbability(probability);
      return normalized === undefined ? [] : [[key, normalized] as const];
    });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function selectedProbability(answer: ChoiceAnswer | undefined): number | undefined {
  if (!answer || typeof answer.choice !== "string") return undefined;
  const probabilities = normalizeProbabilities(answer.probabilities);
  return probabilities?.[answer.choice];
}

function providerConfidence(result: EvaluationResult, questionId: string): number | undefined {
  const metadata = result.providerMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const typesafe = (metadata as Record<string, unknown>).typesafe;
  if (!typesafe || typeof typesafe !== "object" || Array.isArray(typesafe)) return undefined;
  const confidence = (typesafe as Record<string, unknown>).confidence;
  if (confidence && typeof confidence === "object" && !Array.isArray(confidence)) {
    return clampProbability((confidence as Record<string, unknown>)[questionId]);
  }
  return clampProbability(confidence);
}

export function buildJevTaskEvaluation(context: JevContext): JevTaskEvaluation {
  const title = cleanText(context.task?.title, 300);
  if (!title) throw new Error("Jev task prediction requires a title");

  const projects = (Array.isArray(context.projects) ? context.projects : [])
    .filter((project) => project?.completed !== true)
    .flatMap((project) => {
      const id = cleanText(project?.id, 160);
      const projectTitle = cleanText(project?.title, 160);
      if (!id || !projectTitle) return [];
      return [{ id, title: projectTitle, notes: cleanText(project?.notes, 280) }];
    })
    .slice(0, MAX_PROJECT_CHOICES);

  const questions: JevTaskEvaluation["questions"] = {};
  if (context.requestDuration !== false) {
    questions.duration = {
      type: "choice",
      instructions: "Estimate the focused work time needed to finish this task. Choose the smallest realistic duration, including normal setup and review time.",
      criteria: Object.fromEntries(DURATION_MINUTES.map((minutes) => [
        `m${minutes}`,
        minutes < 60 ? `About ${minutes} minutes.` : `About ${minutes / 60} hours.`,
      ])),
    };
  }

  const projectIdByChoice: Record<string, string> = {};
  if (context.requestProject !== false && projects.length) {
    const projectCriteria: Record<string, string> = {
      unassigned: "No listed project is a clear semantic match.",
    };
    projects.forEach((project, index) => {
      const choice = `p${index}`;
      projectIdByChoice[choice] = project.id;
      projectCriteria[choice] = project.notes
        ? `${project.title}: ${project.notes}`
        : project.title;
    });
    questions.project = {
      type: "choice",
      instructions: "Choose the single existing project this task belongs to. Use unassigned when the wording is ambiguous or no project clearly matches.",
      criteria: projectCriteria,
    };
  }

  if (!Object.keys(questions).length) throw new Error("Jev task prediction has no requested fields");

  const currentEstimateMinutes = Number(context.task?.estimatedMinutes);
  const userHistorySummary = context.preferences && typeof context.preferences === "object"
    ? context.preferences
    : undefined;

  return {
    state: {
      task: {
        title,
        ...(Number.isFinite(currentEstimateMinutes)
          ? { currentEstimateMinutes: Math.max(15, Math.min(240, Math.round(currentEstimateMinutes))) }
          : {}),
      },
      ...(userHistorySummary ? { userHistorySummary } : {}),
    },
    questions,
    projectIdByChoice,
  };
}

export function normalizeJevTaskEvaluation(
  result: EvaluationResult,
  projectIdByChoice: Record<string, string>,
  modelVersion = JEV_MODEL_VERSION,
): JevTaskPrediction {
  const durationAnswer = result.answers?.duration;
  const durationChoice = typeof durationAnswer?.choice === "string" ? durationAnswer.choice : "";
  const durationMatch = /^m(15|30|45|60|75|90|105|120|135|150|165|180|195|210|225|240)$/.exec(durationChoice);
  const durationMinutes = durationMatch ? Number(durationMatch[1]) : undefined;
  const durationConfidence = durationMinutes === undefined
    ? undefined
    : providerConfidence(result, "duration") ?? clampProbability(durationAnswer?.confidence) ?? selectedProbability(durationAnswer);

  const projectAnswer = result.answers?.project;
  const projectChoice = typeof projectAnswer?.choice === "string" ? projectAnswer.choice : "";
  const projectId = projectChoice && projectChoice !== "unassigned" ? projectIdByChoice[projectChoice] : undefined;
  const projectConfidence = projectChoice
    ? providerConfidence(result, "project") ?? clampProbability(projectAnswer?.confidence) ?? selectedProbability(projectAnswer)
    : undefined;

  const confidences = [durationConfidence, projectConfidence].filter((value): value is number => value !== undefined);
  return {
    durationMinutes,
    projectId,
    durationConfidence,
    projectConfidence,
    durationProbabilities: normalizeProbabilities(durationAnswer?.probabilities),
    projectProbabilities: normalizeProbabilities(projectAnswer?.probabilities),
    confidence: confidences.length ? Math.min(...confidences) : undefined,
    modelVersion,
    provider: "jev",
  };
}

export async function predictTaskWithTypeSafe(
  apiKey: string,
  context: JevContext,
  options: JevPredictionOptions = {},
): Promise<JevTaskPrediction> {
  if (!apiKey.trim()) throw new Error("TYPESAFE_API_KEY is missing");
  const evaluation = buildJevTaskEvaluation(context);
  const response = await (options.fetcher || fetch)(TYPESAFE_EVALUATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TYPESAFE_JEV_MODEL,
      state: evaluation.state,
      questions: evaluation.questions,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`TypeSafe Jev ${response.status}: ${detail || response.statusText}`);
  }
  const result = await response.json() as EvaluationResult;
  const modelVersion = typeof result.model === "string" && result.model.trim()
    ? result.model.trim().slice(0, 120)
    : TYPESAFE_JEV_MODEL;
  return normalizeJevTaskEvaluation(result, evaluation.projectIdByChoice, modelVersion);
}

export async function predictTaskWithOpenRouter(
  apiKey: string,
  context: JevContext,
  options: JevPredictionOptions = {},
): Promise<JevTaskPrediction> {
  if (!apiKey.trim()) throw new Error("OPENROUTER_API_KEY is missing");
  const evaluation = buildJevTaskEvaluation(context);
  const response = await (options.fetcher || fetch)(OPENROUTER_DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_JEV_MODEL,
      state: evaluation.state,
      questions: evaluation.questions,
      provider: {
        data_collection: "deny",
        ...(options.zeroDataRetention ? { zdr: true } : {}),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`OpenRouter Jev ${response.status}: ${detail || response.statusText}`);
  }
  const result = await response.json() as EvaluationResult;
  const modelVersion = typeof result.model === "string" && result.model.trim()
    ? result.model.trim().slice(0, 120)
    : OPENROUTER_JEV_MODEL;
  return normalizeJevTaskEvaluation(result, evaluation.projectIdByChoice, modelVersion);
}

export async function predictTaskWithJev(
  apiKey: string,
  context: JevContext,
  options: JevPredictionOptions = {},
): Promise<JevTaskPrediction> {
  if (!apiKey.trim()) throw new Error("AI_GATEWAY_API_KEY is missing");
  const evaluation = buildJevTaskEvaluation(context);
  const [{ experimental_evaluate: evaluate }, { createGateway }] = await Promise.all([
    import("npm:ai@7.0.105"),
    import("npm:@ai-sdk/gateway@4.0.87"),
  ]);
  const gateway = createGateway({ apiKey });
  const result = await evaluate({
    model: gateway.evaluationModel(JEV_MODEL),
    state: evaluation.state,
    questions: evaluation.questions,
    ...(options.zeroDataRetention ? { providerOptions: { gateway: { zeroDataRetention: true } } } : {}),
  });
  return normalizeJevTaskEvaluation(result as EvaluationResult, evaluation.projectIdByChoice);
}
