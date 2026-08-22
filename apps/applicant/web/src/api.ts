const BASE = "/api/applicant";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "请求失败 " + res.status);
  }
  return res.json() as Promise<T>;
}

export type PositionStatus = "waiting" | "applied" | "written" | "interview" | "offer" | "rejected";
export interface Position {
  id: string;
  company: string;
  title: string;
  city: string;
  salary: string;
  source: string;
  status: PositionStatus;
  jdRaw: string;
  notes: string;
  appliedUrl?: string;
  updatedAt: string;
}

export const api = {
  listPositions: (status?: string) =>
    request<Position[]>(status ? "/positions?status=" + encodeURIComponent(status) : "/positions"),
  getPosition: (id: string) => request<Position>("/positions/" + id),
  createPosition: (input: unknown) => request<Position>("/positions", { method: "POST", body: JSON.stringify(input) }),
  updatePosition: (id: string, patch: unknown) =>
    request<Position>("/positions/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  parseJd: (text: string) =>
    request<{ company: string; title: string; city: string; salary: string; requirements: string[]; duties: string[]; keywords: string[] }>(
      "/positions/parse-jd",
      { method: "POST", body: JSON.stringify({ text }) }
    ),
  generateGreeting: (id: string) => request<{ greeting: string }>("/positions/" + id + "/greeting", { method: "POST" }),
  parseImage: (form: FormData) =>
    request<{ company: string; title: string; city: string; salary: string; requirements: string[]; duties: string[]; keywords: string[] }>(
      "/positions/parse-image",
      { method: "POST", body: form }
    ),
  listInterviews: (positionId: string) => request<Interview[]>("/positions/" + positionId + "/interviews"),
  createInterview: (positionId: string, input: { round: number; qaNotes: string; reflection: string }) =>
    request<Interview>("/positions/" + positionId + "/interviews", { method: "POST", body: JSON.stringify(input) }),
  analyzeInterview: (id: string) => request<Interview>("/interviews/" + id + "/analyze", { method: "POST" }),
  exportInterviewUrl: (id: string) => BASE + "/interviews/" + id + "/export.md",
  listResumes: () => request<Resume[]>("/resumes"),
  createResume: (input: { name: string; contentText: string }) => request<Resume>("/resumes", { method: "POST", body: JSON.stringify(input) }),
  analyzeResume: (id: string) => request<Record<string, unknown>>("/resumes/" + id + "/analyze", { method: "POST" }),
  rewriteResume: (id: string, input: { sectionType: string; originalText: string; positionId?: string }) =>
    request<Record<string, unknown>>("/resumes/" + id + "/rewrite", { method: "POST", body: JSON.stringify(input) }),
  matchResume: (id: string, positionId: string) => request<Record<string, unknown>>("/resumes/" + id + "/match/" + positionId, { method: "POST" }),
  resumeQuota: () => request<{ configured: boolean; quota: unknown; error?: string }>("/meta/quota"),
};

export interface Interview {
  id: string;
  positionId: string;
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  analysis: InterviewAnalysis | null;
}

export interface Resume {
  id: string;
  name: string;
  version: number;
  source: string;
  contentText: string;
  clawcvSessionId: string | null;
  lastAnalysis: Record<string, unknown> | null;
  createdAt: string;
}

export interface InterviewAnalysis {
  questions?: Array<{ category: string; question: string; comment: string }>;
  quality?: string;
  suggestions?: string[];
  actionItems?: string[];
}
