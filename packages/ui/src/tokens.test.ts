import { describe, it, expect } from "vitest";
import { tokens } from "./tokens";

describe("v2 品牌令牌（墨蓝石墨·工房感）", () => {
  it("主色/语义色来自 v2 设计系统，不再是 AntD 出厂值", () => {
    expect(tokens.color.primary).toBe("#2c4a6e");
    expect(tokens.color.success).toBe("#3a7049");
    expect(tokens.color.warning).toBe("#9a6a25");
    expect(tokens.color.error).toBe("#943d35");
    expect(tokens.color.info).toBe("#3a5f84");
  });

  it("中性与表面色对齐 v2 石墨阶", () => {
    expect(tokens.color.border).toBe("#d9dde3");
    expect(tokens.color.bgLayout).toBe("#f4f6f8");
    expect(tokens.color.bgNeutral).toBe("#eceef1");
    expect(tokens.color.bgActive).toBe("#e3eaf2");
    expect(tokens.color.bgUser).toBe("#eef1f5");
  });

  it("暗色板（一等公民）与后台表面锚点正确", () => {
    expect(tokens.dark.background).toBe("#14181f");
    expect(tokens.dark.surface0).toBe("#171c24");
    expect(tokens.dark.surface1).toBe("#1b212b");
    expect(tokens.dark.surface2).toBe("#232b37");
    expect(tokens.dark.border).toBe("#2d3644");
    expect(tokens.dark.primary).toBe("#6e8bad");
  });

  it("后台外壳令牌取自暗色板", () => {
    expect(tokens.admin.siderBg).toBe("#14181f");
    expect(tokens.admin.contentBg).toBe("#14181f");
    expect(tokens.admin.border).toBe("#2d3644");
  });

  it("海拔体系为墨调投影且分层递进", () => {
    expect(tokens.shadow.card).toContain("rgba(27, 46, 69");
    expect(tokens.shadow.modal).toContain("0 16px 36px");
  });

  it("动效与尺寸令牌就位", () => {
    expect(tokens.motion.durationFast).toBe("120ms");
    expect(tokens.motion.durationBase).toBe("200ms");
    expect(tokens.motion.easeStandard).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    expect(tokens.size.buttonMd).toBe(36);
    expect(tokens.size.input).toBe(36);
  });

  it("字体三层（衬线展示/无衬线正文/等宽数字）就位", () => {
    expect(tokens.font.display).toContain("Noto Serif SC");
    expect(tokens.font.body).toContain("Noto Sans SC");
    expect(tokens.font.mono).toContain("JetBrains Mono");
  });
});
