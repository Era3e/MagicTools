#!/usr/bin/env node
/**
 * 设计图 ↔ 前端实现 一致性核对脚本
 * 用法：node magictools-ui-design/scripts/check-design-consistency.mjs
 *
 * 检查项：
 *   C1 路由覆盖   —— 实现侧 App.tsx 的业务路由 ↔ 设计页文件存在性
 *   C2 导航对齐   —— USER_NAV / ADMIN_NAV 文案集合 ↔ 设计页导航集合
 *   C3 激活正确性 —— 按实现 startsWith 规则推算每页应激活项，与设计页 data-active 比对
 *   C4 画布注册   —— pages/*.html 全部注册于 .design
 *
 * 退出码：0 全部通过；1 存在 FAIL（CI 可用作门禁）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESIGN = join(ROOT, 'magictools-ui-design');
const PAGES = join(DESIGN, 'pages');

/* ---------- 路由 → 设计页映射（与 docs/design-impl-audit.md 矩阵同源） ---------- */
const APPS = [
  { name: 'applicant', web: 'apps/applicant/web/src/App.tsx', routes: {
    '/positions': 'applicant-front.html', '/positions/:id': 'applicant-position-detail.html',
    '/positions/:id/interviews': 'applicant-interview.html', '/calendar': 'applicant-calendar.html',
    '/resumes': 'applicant-resume.html', '/admin/positions': 'applicant-admin.html' } },
  { name: 'scholar', web: 'apps/scholar/web/src/App.tsx', routes: {
    '/entries': 'scholar-front.html', '/search': 'scholar-search.html', '/graph': 'scholar-graph.html',
    '/admin/settings': 'scholar-settings-admin.html', '/admin/entries': 'scholar-admin.html' } },
  { name: 'assistant', web: 'apps/assistant/web/src/App.tsx', routes: {
    '/chat': 'assistant-front.html', '/feedback': 'assistant-feedback.html',
    '/admin/feedback': 'assistant-feedback-admin.html', '/admin/intent-logs': 'assistant-admin.html' } },
  { name: 'manager', web: 'apps/manager/web/src/App.tsx', routes: {
    '/requirements': 'manager-front.html', '/requirements/:id': 'manager-requirement-detail.html',
    '/admin/requirements': 'manager-admin.html', '/admin/iterations': 'manager-iteration-admin.html' } },
  { name: 'designer', web: 'apps/designer/web/src/App.tsx', routes: {
    '/generate': 'designer-generate.html', '/studio': 'designer-studio.html',
    '/components': 'designer-components.html', '/admin/components': 'designer-admin.html',
    '/admin/history': 'designer-history-admin.html' } },
  { name: 'gatherer', web: 'apps/gatherer/web/src/App.tsx', routes: {
    '/admin/sources': 'gatherer-admin.html', '/admin/sources/:id': 'gatherer-source-detail.html',
    '/admin/sources/:sourceId/items': 'gatherer-source-detail.html' } },
  { name: 'investigator', web: 'apps/investigator/web/src/App.tsx', routes: {
    '/admin/surveys': 'investigator-admin.html', '/admin/surveys/:id': 'investigator-survey-detail.html' } },
  { name: 'assessor', web: 'apps/assessor/web/src/App.tsx', routes: {
    '/admin/requests': 'assessor-admin.html', '/admin/requests/:id': 'assessor-request-detail.html' } },
];
/* 前台壳设计页（UserShell）与后台壳设计页（AdminShell 业务导航） */
const FRONT_PAGES = ['applicant-front.html', 'scholar-front.html', 'assistant-front.html', 'assistant-feedback.html',
  'manager-front.html', 'manager-requirement-detail.html', 'designer-front.html', 'designer-generate.html',
  'designer-studio.html', 'designer-components.html', 'applicant-calendar.html', 'applicant-resume.html',
  'applicant-position-detail.html', 'applicant-interview.html', 'scholar-search.html', 'scholar-graph.html'];
const ADMIN_PAGES = ['applicant-admin.html', 'scholar-admin.html', 'scholar-settings-admin.html',
  'assistant-admin.html', 'assistant-feedback-admin.html', 'manager-admin.html', 'manager-iteration-admin.html',
  'designer-admin.html', 'designer-history-admin.html', 'gatherer-admin.html', 'gatherer-source-detail.html',
  'investigator-admin.html', 'investigator-survey-detail.html', 'assessor-admin.html', 'assessor-request-detail.html'];

const results = [];
const ok = (id, msg) => results.push({ id, level: 'PASS', msg });
const fail = (id, msg) => results.push({ id, level: 'FAIL', msg });
const info = (id, msg) => results.push({ id, level: 'INFO', msg });

/* ---------- 解析实现侧 App.tsx ---------- */
function parseApp(app) {
  const src = readFileSync(join(ROOT, app.web), 'utf8');
  const navBlock = (name) => {
    const m = src.match(new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!m) return [];
    return [...m[1].matchAll(/key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)].map(x => ({ key: x[1], label: x[2] }));
  };
  return { userNav: navBlock('USER_NAV'), adminNav: navBlock('ADMIN_NAV'), src };
}
/* 模拟实现的 selectedKey 解析（startsWith，取最长命中） */
function resolveActive(nav, pathname, fallback) {
  const hit = nav.filter(n => pathname.startsWith(n.key)).sort((a, b) => b.key.length - a.key.length)[0];
  return hit ? hit.label : (nav.find(n => n.key === fallback)?.label ?? null);
}

/* ---------- 解析设计页 ---------- */
function parseFrontPage(file) {
  const src = readFileSync(join(PAGES, file), 'utf8');
  const nav = src.match(/<nav class="us-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const items = [...nav.matchAll(/<a data-nav-key="([^"]+)"([^>]*)>([^<]+)<\/a>/g)]
    .map(m => ({ key: m[1], active: m[2].includes('data-active="true"'), label: m[3].trim(), href: m[2].match(/href="([^"]*)"/)?.[1] }));
  return { items };
}
function parseAdminPage(file) {
  const src = readFileSync(join(PAGES, file), 'utf8');
  const items = [...src.matchAll(/<a class="as-nav-item"([^>]*)>\s*<i[^>]*><\/i><span>([^<]+)<\/span>/g)]
    .map(m => { const attrs = m[1];
      return { key: attrs.match(/data-nav-key="([^"]*)"/)?.[1], label: m[2].trim(),
        active: attrs.includes('data-active="true"'), href: attrs.match(/href="([^"]*)"/)?.[1] }; });
  /* 业务项 = 指向真实页面的链接项；控制台 chrome（总览/系统设置/访问日志）为 href="#" 占位，剔除 */
  return { items: items.filter(i => i.href && i.href.endsWith('.html')) };
}

/* ---------- C1 路由覆盖 ---------- */
for (const app of APPS) {
  for (const [route, file] of Object.entries(app.routes)) {
    if (existsSync(join(PAGES, file))) ok('C1', `${app.name} ${route} → ${file}`);
    else fail('C1', `${app.name} ${route} → ${file} 设计页缺失`);
  }
}

/* ---------- C2/C3 导航对齐与激活 ---------- */
const routeOf = (file) => { for (const app of APPS) for (const [r, f] of Object.entries(app.routes)) if (f === file) return { app, route: r }; return null; };

for (const file of FRONT_PAGES) {
  const hit = routeOf(file); if (!hit) { info('C2', `${file} 无路由映射（门户/附加页）`); continue; }
  const { app, route } = hit;
  const { userNav } = parseApp(app);
  const { items } = parseFrontPage(file);
  const labels = items.map(i => i.label);
  if (userNav.length === 0) { /* 无前台导航的应用 */ continue; }
  const missing = userNav.map(n => n.label).filter(l => !labels.includes(l));
  const extra = labels.filter(l => !userNav.some(n => n.label === l));
  if (missing.length === 0 && extra.length === 0) ok('C2', `${file} 导航 ${labels.join('/')} 与 USER_NAV 一致`);
  else fail('C2', `${file} 导航不一致：缺 [${missing}] 多 [${extra}]（实现：${userNav.map(n => n.label).join('/')}）`);
  /* C3 激活 */
  const expected = resolveActive(userNav, route, userNav[0]?.key);
  const actual = items.filter(i => i.active).map(i => i.label);
  if (actual.length === 1 && actual[0] === expected) ok('C3', `${file} 激活「${expected}」正确`);
  else fail('C3', `${file} 激活为 [${actual}]，按实现应为「${expected}」`);
}
for (const file of ADMIN_PAGES) {
  const hit = routeOf(file); if (!hit) { info('C2', `${file} 无路由映射`); continue; }
  const { app, route } = hit;
  const { adminNav } = parseApp(app);
  const { items } = parseAdminPage(file);
  const labels = items.map(i => i.label);
  const missing = adminNav.map(n => n.label).filter(l => !labels.includes(l));
  const extra = labels.filter(l => !adminNav.some(n => n.label === l));
  if (missing.length === 0 && extra.length === 0) ok('C2', `${file} 业务导航 ${labels.join('/')} 与 ADMIN_NAV 一致`);
  else fail('C2', `${file} 业务导航不一致：缺 [${missing}] 多 [${extra}]（实现：${adminNav.map(n => n.label).join('/')}）`);
  const expected = resolveActive(adminNav, route, adminNav[0]?.key);
  const actual = items.filter(i => i.active).map(i => i.label);
  if (actual.length === 1 && actual[0] === expected) ok('C3', `${file} 激活「${expected}」正确`);
  else fail('C3', `${file} 激活为 [${actual}]，按实现应为「${expected}」`);
}

/* ---------- C4 画布注册 ---------- */
const design = JSON.parse(readFileSync(join(DESIGN, 'magictools-ui-design.design'), 'utf8'));
const registered = new Set(design.data.map(n => n.devMetadata?.htmlSrc));
for (const f of readdirSync(PAGES).filter(f => f.endsWith('.html'))) {
  if (registered.has(`pages/${f}`)) ok('C4', `pages/${f} 已注册画布`);
  else fail('C4', `pages/${f} 未注册画布`);
}
for (const r of registered) if (!existsSync(join(DESIGN, r))) fail('C4', `画布节点指向不存在的文件 ${r}`);

/* ---------- 输出 ---------- */
const pass = results.filter(r => r.level === 'PASS').length;
const fails = results.filter(r => r.level === 'FAIL');
for (const r of results.filter(r => r.level !== 'PASS')) console.log(`[${r.level}] ${r.id} ${r.msg}`);
console.log('─'.repeat(60));
console.log(`C1 路由覆盖 · C2 导航对齐 · C3 激活 · C4 画布注册 —— PASS ${pass} / FAIL ${fails.length} / INFO ${results.length - pass - fails.length}`);
process.exit(fails.length ? 1 : 0);
