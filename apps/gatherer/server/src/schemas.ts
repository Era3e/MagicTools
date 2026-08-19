import { z } from "zod";

export const enrichSchema = z.object({
  summary: z.string().default(""),
  category: z.string().default(""),
  keywords: z.array(z.string()).default([]),
});

export const sourceInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["rss", "json_api", "web"]).default("rss"),
  url: z.string().default(""),
  cron: z.string().default(""),
  options: z.record(z.unknown()).default({}),
});
