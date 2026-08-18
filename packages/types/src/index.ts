export const PROJECT_IDS = [
  "gatherer",
  "investigator",
  "assessor",
  "manager",
  "designer",
  "scholar",
  "assistant",
  "applicant",
] as const;

export type ProjectId = (typeof PROJECT_IDS)[number];

export interface DataEnvelope<T> {
  id: string;
  event: string;
  source: ProjectId;
  payload: T;
  occurredAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
