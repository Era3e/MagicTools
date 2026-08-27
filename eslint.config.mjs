import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import mtRules from "./infra/eslint/rules/no-hardcoded-colors.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/e2e/snapshots/**",
      "**/*.config.{js,ts,mjs}",
      "infra/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@mt/rules": mtRules },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      // ===== 方案 P1-1：硬编码色值静态门禁 =====
      // error 阻塞 CI；仅 packages/ui 合法主题定义点降级为 warning（规则内部判定）
      // 豁免：/* eslint-disable-next-line @mt/rules/no-hardcoded-colors -- 理由 */
      "@mt/rules/no-hardcoded-colors": "error",
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  }
);
