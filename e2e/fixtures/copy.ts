// e2e 关键可见文案唯一来源：页面 Hero/报头等会被多处 spec 断言的字符串集中于此。
// 改文案时先改页面组件、再改本文件——散落各 spec 的硬编码断言是文案重构时的主要同步成本。
// 值须与页面组件实际渲染一致（PositionWall Hero / UserShell subtitle 等）。
export const COPY = {
  applicantHero: "每一次投递，都值得被认真对待。机会按周更新，简历工坊随时待命。",
  applicantControl: "APPLICANT · CONTROL",
} as const;
