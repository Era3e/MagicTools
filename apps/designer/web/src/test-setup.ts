import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// 每个用例后清理 DOM（vitest 未开 globals，RTL 不会自动 cleanup）
afterEach(() => cleanup());

// jsdom 缺失的浏览器 API polyfill（antd 依赖 matchMedia）
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
// antd 动效会以伪元素参数调用 getComputedStyle，jsdom 不支持 → 丢弃参数
const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((elt: Element) => originalGetComputedStyle(elt)) as unknown as typeof window.getComputedStyle;
