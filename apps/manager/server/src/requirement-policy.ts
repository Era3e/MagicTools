import type { RequirementStatus } from "./requirement.repo";

export const MANUAL_TRANSITIONS: Record<RequirementStatus, readonly RequirementStatus[]> = {
  waiting: ["designing", "todo"],
  designing: ["waiting", "todo"],
  todo: ["designing", "developing"],
  developing: ["todo", "testing"],
  testing: ["developing", "accepting"],
  accepting: ["testing", "done"],
  done: [],
};

export function canTransition(from: RequirementStatus, to: RequirementStatus, origin: "manual" | "github" = "manual"): boolean {
  if (from === to) return true;
  if (origin === "manual") return MANUAL_TRANSITIONS[from].includes(to);
  // PR 是外部事实，允许补齐漏收的中间事件，但不能撤回验收或宣布产品完成。
  if (from === "accepting" || from === "done") return false;
  return to === "developing" || to === "accepting" || to === "todo";
}
