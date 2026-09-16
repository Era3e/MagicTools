export const REQUIREMENT_STATUSES = ["waiting", "designing", "todo", "developing", "testing", "accepting", "done"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
