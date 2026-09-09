// 下载品牌三层字体的 woff2（ latin 子集 + 中文走系统回退，控制仓库体积）
// 中文 Noto Sans/Serif SC 全量巨大（>8MB/字重），策略：
//   - 拉丁字符/数字（JetBrains Mono + Source Serif 4 + Noto Sans 拉丁）走 woff2 本地
//   - 中文字形继续走系统栈（PingFang/微软雅黑/宋体）——中文等宽/衬线的系统回退质量高
// 这样等宽数字、衬线英文标题两大识别度信号 100% 本地化，中文不掉链子
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "..", "packages", "ui", "fonts");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Google Fonts CSS2 API：拉 latin 子集 woff2 直链
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Noto+Sans:ital,wght@0,400;0,500;0,600&display=swap";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

(async () => {
  const cssRes = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
  if (!cssRes.ok) throw new Error("css fetch " + cssRes.status);
  const css = await cssRes.text();
  // 解析 @font-face 块：只取 unicode-range 含 U+0000-00FF（latin）的块
  const blocks = css.split("@font-face").slice(1);
  const picked = [];
  for (const b of blocks) {
    const isLatin = /U\+0000-00FF/.test(b);
    if (!isLatin) continue;
    const family = (b.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (b.match(/font-weight:\s*([\d\s..,]+)/) || [])[1]?.trim();
    const style = (b.match(/font-style:\s*(\w+)/) || [])[1] || "normal";
    const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (family && url) picked.push({ family, weight, style, url });
  }
  console.log("latin faces found:", picked.length);
  for (const f of picked) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(f.url + " -> " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const safe = f.family.replace(/\s+/g, "") + "-" + (f.weight || "400").replace(/[^\d]/g, "") + "-" + f.style + ".woff2";
    fs.writeFileSync(path.join(OUT, safe), buf);
    console.log("saved", safe, buf.length, "bytes");
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
