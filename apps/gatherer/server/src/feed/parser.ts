import Parser from "rss-parser";
import * as cheerio from "cheerio";

export type SourceType = "rss" | "json_api" | "web";

export interface ParsedItem {
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
}

export interface ParseOptions {
  xml?: string;
  json?: unknown;
  html?: string;
  mapping?: { listPath?: string; titleField?: string; urlField?: string; contentField?: string };
  selectors?: { itemSelector?: string; titleSelector?: string; linkSelector?: string; contentSelector?: string };
}

function stubItems(): ParsedItem[] {
  return [
    { url: "https://stub.local/item/1", title: "桩条目：行业热点速览", content: "桩模式的采集内容一。", publishedAt: new Date().toISOString() },
    { url: "https://stub.local/item/2", title: "桩条目：岗位趋势观察", content: "桩模式的采集内容二。", publishedAt: new Date().toISOString() },
  ];
}

export async function parseRss(xml: string): Promise<ParsedItem[]> {
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).map((i) => ({
    url: i.link ?? "",
    title: i.title ?? "",
    content: (i.contentSnippet ?? i.content ?? "").trim(),
    publishedAt: i.isoDate ?? i.pubDate ?? undefined,
  }));
}

export async function parseJsonApi(json: unknown, mapping: ParseOptions["mapping"] = {}): Promise<ParsedItem[]> {
  const listPath = mapping?.listPath ?? "items";
  const raw = listPath.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), json);
  const list = Array.isArray(raw) ? raw : [];
  return list.map((row: Record<string, unknown>) => ({
    url: String(row[mapping?.urlField ?? "url"] ?? ""),
    title: String(row[mapping?.titleField ?? "title"] ?? ""),
    content: String(row[mapping?.contentField ?? "content"] ?? ""),
  }));
}

export async function parseHtml(html: string, selectors: ParseOptions["selectors"] = {}): Promise<ParsedItem[]> {
  const $ = cheerio.load(html);
  const items: ParsedItem[] = [];
  const base = $("base").attr("href") ?? "";
  $(selectors?.itemSelector ?? "article").each((_, el) => {
    const $el = $(el);
    const href = $el.find(selectors?.linkSelector ?? "a").first().attr("href") ?? "";
    items.push({
      url: href.startsWith("http") ? href : base + href,
      title: $el.find(selectors?.titleSelector ?? "h2").first().text().trim(),
      content: $el.find(selectors?.contentSelector ?? "p").text().trim(),
    });
  });
  return items;
}

export async function parseFeed(source: { type: SourceType; url?: string; options?: ParseOptions }): Promise<ParsedItem[]> {
  if (process.env.FEED_STUB === "1") return stubItems();
  const options = source.options ?? {};
  if (source.type === "rss") {
    if (options.xml) return parseRss(options.xml);
    const response = await fetch(source.url ?? "");
    if (!response.ok) throw new Error("RSS 拉取失败 " + response.status);
    return parseRss(await response.text());
  }
  if (source.type === "json_api") {
    if (options.json !== undefined) return parseJsonApi(options.json, options.mapping);
    const response = await fetch(source.url ?? "");
    if (!response.ok) throw new Error("JSON 拉取失败 " + response.status);
    return parseJsonApi(await response.json(), options.mapping);
  }
  if (options.html !== undefined) return parseHtml(options.html, options.selectors);
  const response = await fetch(source.url ?? "");
  if (!response.ok) throw new Error("网页拉取失败 " + response.status);
  return parseHtml(await response.text(), options.selectors);
}
