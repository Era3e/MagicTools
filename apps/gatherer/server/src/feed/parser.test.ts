import { describe, it, expect, vi, afterEach } from "vitest";
import { parseFeed, parseHtml, parseJsonApi, parseRss } from "./parser";

afterEach(() => vi.unstubAllGlobals());

const RSS_XML =
  '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>' +
  '<item><title>标题A</title><link>https://x.com/a</link><description>内容A</description><pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate></item>' +
  '<item><title>标题B</title><link>https://x.com/b</link><description>内容B</description></item></channel></rss>';

describe("feed parser", () => {
  it("parseRss 提取条目字段", async () => {
    const items = await parseRss(RSS_XML);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("标题A");
    expect(items[0].url).toBe("https://x.com/a");
    expect(items[0].publishedAt).toBeTruthy();
  });

  it("parseJsonApi 按字段映射提取", async () => {
    const items = await parseJsonApi(
      { data: [{ id: 1, headline: "新闻一", href: "https://x.com/1", body: "正文" }] },
      { listPath: "data", titleField: "headline", urlField: "href", contentField: "body" }
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("新闻一");
  });

  it("parseHtml 按选择器提取标题与正文", async () => {
    const items = await parseHtml(
      "<html><body><article><h2>文章一</h2><a href='/a'>链接</a><p>段落一</p></article></body></html>",
      { itemSelector: "article", titleSelector: "h2", linkSelector: "a", contentSelector: "p" }
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("文章一");
    expect(items[0].content).toContain("段落一");
  });

  it("parseFeed 按类型分发", async () => {
    const rss = await parseFeed({ type: "rss", options: { xml: RSS_XML } } as never);
    expect(rss).toHaveLength(2);
    const json = await parseFeed({ type: "json_api", options: { json: { data: [{ t: "x", u: "https://x", c: "" }] }, mapping: { listPath: "data", titleField: "t", urlField: "u", contentField: "c" } } } as never);
    expect(json).toHaveLength(1);
  });

  it("桩模式返回固定条目", async () => {
    process.env.FEED_STUB = "1";
    const items = await parseFeed({ type: "rss" } as never);
    delete process.env.FEED_STUB;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBeTruthy();
  });
});
