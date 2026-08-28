import cron from "node-cron";
import { SurveyService } from "./survey.service";
import { listSurveys, type SurveyRow } from "./survey.repo";

const registry = new Map<string, cron.ScheduledTask>();

export function isValidCron(expr: string): boolean {
  if (!expr) return false;
  try {
    return cron.validate(expr);
  } catch {
    return false;
  }
}

export function buildSchedulerStatus(tasks: Array<{ id: string; name: string; cron: string }>): {
  tasks: Array<{ surveyId: string; name: string; cron: string }>;
} {
  return { tasks: tasks.map((t) => ({ surveyId: t.id, name: t.name, cron: t.cron })) };
}

export async function startScheduler(surveyService: SurveyService): Promise<void> {
  const surveys: SurveyRow[] = await listSurveys();
  for (const survey of surveys) {
    if (survey.status !== "active" || !survey.cron || !isValidCron(survey.cron)) continue;
    const task = cron.schedule(survey.cron, () => {
      surveyService.sync(survey.id).catch((err) => {
        console.error("[scheduler] survey " + survey.name + " sync failed: " + String(err));
      });
    });
    registry.set(survey.id, task);
  }
  console.log("[scheduler] registered " + registry.size + " survey cron tasks");
}

export function stopScheduler(): void {
  for (const task of registry.values()) task.stop();
  registry.clear();
}

export async function schedulerStatus(): Promise<{
  tasks: Array<{ surveyId: string; name: string; cron: string }>;
}> {
  const surveys = await listSurveys();
  return buildSchedulerStatus(surveys.filter((s) => s.status === "active" && s.cron && isValidCron(s.cron)));
}
