/**
 * D-13 响应式断点
 * 移动端适配：提供断点判断 hook，供各 Shell 和页面使用
 */
import { useEffect, useState } from "react";

export const BREAKPOINTS = {
  /** 手机：≤ 640px */
  mobile: 640,
  /** 平板：≤ 1024px */
  tablet: 1024,
} as const;

export interface ResponsiveInfo {
  /** 是否为手机视口 */
  isMobile: boolean;
  /** 是否为平板视口 */
  isTablet: boolean;
  /** 视口宽度 */
  width: number;
}

/**
 * 响应式断点 hook
 *
 * @example
 * const { isMobile } = useResponsive();
 * return isMobile ? <MobileView /> : <DesktopView />;
 */
export function useResponsive(): ResponsiveInfo {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1280; // SSR 默认桌面
    return window.innerWidth;
  });

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    isMobile: width <= BREAKPOINTS.mobile,
    isTablet: width <= BREAKPOINTS.tablet,
    width,
  };
}
