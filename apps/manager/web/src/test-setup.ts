import { configure } from "@testing-library/react";

// 等待可交互的最终态；全仓构建/测试并行时不依赖单机 1 秒调度窗口。
configure({ asyncUtilTimeout: 10000 });

// jsdom 不支持伪元素布局；AntD 滚动条测量在此环境使用元素自身样式。
const computedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element) => computedStyle(element);

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
