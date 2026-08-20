import { randomUUID } from "node:crypto";
import { build, type Plugin } from "esbuild";
import { Injectable, NotFoundException } from "@nestjs/common";

const cache = new Map<string, string>();

function componentPlugin(code: string): Plugin {
  return {
    name: "virtual-component",
    setup(b) {
      b.onResolve({ filter: /^virtual-component$/ }, () => ({ path: "virtual-component.tsx", namespace: "virtual" }));
      b.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({ contents: code, loader: "tsx", resolveDir: process.cwd() }));
    },
  };
}

export async function buildPreviewHtml(code: string): Promise<string> {
  const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import Component from "virtual-component";
createRoot(document.getElementById("root")).render(React.createElement(Component));
`;
  const result = await build({
    stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd(), sourcefile: "preview-entry.tsx" },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    platform: "browser",
    plugins: [componentPlugin(code)],
    logLevel: "silent",
  });
  // write:false 时 esbuild 将唯一 JS 产物命名为 <stdout>（CSS 默认内联进 JS）
  const js =
    (result.outputFiles.find((f) => f.path === "<stdout>") ??
      result.outputFiles.find((f) => f.path.endsWith(".js")) ??
      result.outputFiles[0])?.text ?? "";
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px}</style></head><body><div id="root"></div><script>' +
    js +
    "</script></body></html>"
  );
}

@Injectable()
export class PreviewService {
  async preview(code: string) {
    try {
      const html = await buildPreviewHtml(code);
      const previewId = randomUUID();
      cache.set(previewId, html);
      return { ok: true, previewId };
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 500) };
    }
  }

  get(id: string) {
    const html = cache.get(id);
    if (!html) throw new NotFoundException("预览不存在或已过期");
    return html;
  }
}
