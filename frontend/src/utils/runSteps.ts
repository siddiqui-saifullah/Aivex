import type { RunStepId, RunStepStatus } from "../config/webContainer";

export interface RunStep {
  id: RunStepId;
  status: RunStepStatus;
  detail?: string;
}

export const RUN_STEP_LABELS: Record<RunStepId, string> = {
  mount: "Preparing files",
  install: "Installing dependencies",
  start: "Starting server",
  ready: "Opening preview",
};

export const initialRunSteps = (): RunStep[] =>
  (["mount", "install", "start", "ready"] as RunStepId[]).map((id) => ({ id, status: "pending" }));
