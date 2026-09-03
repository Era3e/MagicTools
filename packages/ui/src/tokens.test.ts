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
    // v2.1 升级：Linear 四级表面阶梯 + 深蓝调画布
    expect(tokens.dark.background).toBe("#0e1218");
    expect(tokens.dark.surface0).toBe("#14181f");
    expect(tokens.dark.surface1).toBe("#181d26");
    expect(tokens.dark.surface2).toBe("#1e2530");
    expect(tokens.dark.surface3).toBe("#252e3b");
    expect(tokens.dark.surface4).toBe("#2d3848");
    expect(tokens.dark.border).toBe("#2a3340");
    expect(tokens.dark.primary).toBe("#6e8bad");
    // v2.1 新增：透明度文字层级
    expect(tokens.dark.textPrimary).toContain("rgba(245, 247, 250");
    expect(tokens.dark.hairline).toContain("rgba(255, 255, 255, 0.07)");
  });

  it("后台外壳令牌取自暗色板", () => {
    expect(tokens.admin.siderBg).toBe("#0e1218");
    expect(tokens.admin.contentBg).toBe("#0e1218");
    expect(tokens.admin.border).toBe("#2a3340");
  });

  it("海拔体系为墨调投影且分层递进", () => {
    expect(tokens.shadow.card).toContain("inset 0 1px 0");
    expect(tokens.shadow.modal).toContain("0 16px 36px");
  });

  it("质感工艺层（craft）就位：发丝线/氛围光/侧栏渐变/噪点/渐变描边", () => {
    expect(tokens.craft.hairline).toContain("rgba(20, 33, 48, 0.08)");
    expect(tokens.craft.glowDark).toContain("radial-gradient");
    expect(tokens.craft.glowDarkSecondary).toContain("radial-gradient"); // v2.1 多层环境光
    expect(tokens.craft.siderGrad).toContain("linear-gradient");
    expect(tokens.craft.noise).toContain("data:image/svg+xml");
    expect(tokens.craft.noiseOpacity).toBe(0.045); // v2.1 Linear 标准透明度
    expect(tokens.craft.cardBorderGradient).toContain("linear-gradient"); // v2.1 渐变描边
    expect(tokens.craft.hoverSpotlight).toContain("radial-gradient"); // v2.1 悬浮聚光灯
    expect(tokens.craft.dark.hairline).toContain("rgba(255, 255, 255, 0.07)");
  });

  it("暗色投影体系（Stripe 双层 + 焦点环）就位", () => {
    expect(tokens.shadow.darkCard).toContain("inset 0 1px 0");
    expect(tokens.shadow.darkCardHover).toContain("inset 0 1px 0");
    expect(tokens.shadow.darkDropdown).toContain("inset 0 1px 0");
    expect(tokens.shadow.focusRing).toContain("0 0 0 3px");
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
