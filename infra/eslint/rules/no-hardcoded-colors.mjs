// ESLint 自定义规则：禁止业务代码里硬编码颜色值。
//
// 触发场景（任一命中即报错）：
//   1) 任意字符串匹配十六进制色：#fff / #FF5733 / #aarrggbb / #rgb（3/4/6/8 位）
//   2) 任意字符串匹配颜色函数：rgb(..) / rgba(..) / hsl(..) / hsla(..) / hwb / lab / lch / oklab / oklch
//   3) JSX style={{ colorKey: "..." }} 中色键（color / backgroundColor / borderColor ...）
//
// 合法豁免（完全不 report，不阻塞 CI）：
//   - packages/ui/src/tokens.ts ：平台颜色 tokens 唯一源头
//   - packages/ui/ 目录 或 apps/项目/web/src/App.tsx 中，顶层 const 声明的色板常量对象（变量名尾匹配 THEME | TOKENS | PALETTE | COLORS | DECK | CATALOG），其属性值是色值（各应用主题 + 外壳主题合法定义点）
//   - packages/ui/ 或 apps/项目/web/src/App.tsx 中，顶层对象属性名命中主题白名单（UserShellTheme 六字段 + AdminShell token 键 + 常见应用扩展键）
//   - 节点所在行有显式 eslint-disable 注释（ESLint 原生机制）
//
// 接入：见仓库根 eslint.config.mjs plugins["@mt/rules"]

// ----------- 匹配模式 -----------
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN_RE =
  /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklch|oklab|color)\s*\(/i;

// JSX style 属性中属于「颜色」的 key（AntD + CSS DOM 标准常见色属性）
const COLOR_KEYS = new Set([
  "color",
  "backgroundColor",
  "background",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "accentColor",
  "columnRuleColor",
  "fill",
  "stroke",
  "stopColor",
  "floodColor",
  "lightingColor",
]);

// 合法主题/外壳字段白名单（packages/ui + App.tsx 中顶层对象，命中键名即豁免）
const THEME_WHITELIST_KEYS = new Set([
  // UserShellTheme 六字段
  "primary",
  "background",
  "ink",
  "muted",
  "displayFont",
  "bodyFont",
  // AdminShell 控制台外壳 token 键
  "siderBg",
  "siderText",
  "siderActive",
  "accent",
  "bgLayout",
  "bgContainer",
  "border",
  // 各应用前台主题常见扩展键（应用间可复用）
  "panel",
  "rule",
  "paper",
  "card",
  "brick",
  "sky",
  "green",
  "bg",
  "mono",
  "sans",
  "display",
  "body",
]);

// 顶层色板常量对象命名白名单（变量名中出现）
const PALETTE_CONST_NAME_RE = /(?:THEME|TOKENS|PALETTE|COLORS|DECK|CATALOG)$/i;

// ----------- 工具 -----------
function isColorString(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return HEX_COLOR_RE.test(v) || COLOR_FN_RE.test(v);
}

function isInPackagesUITokens(filePath) {
  return filePath.replace(/\\/g, "/").endsWith("/packages/ui/src/tokens.ts");
}
function isInPackagesUI(filePath) {
  return filePath.replace(/\\/g, "/").includes("/packages/ui/");
}
function isAppTsxRoot(filePath) {
  // apps/<name>/web/src/App.tsx
  return /apps[\\/][^/\\]+[\\/]web[\\/]src[\\/]App\.tsx$/.test(filePath);
}

// 判断一个 ObjectExpression 是否是「顶层色板常量对象」：
//   - 直接位于 Program.body 的 VariableDeclaration
//   - 变量名命中 PALETTE_CONST_NAME_RE
// 并且只在 packages/ui 目录或 apps-项目-web-src-App.tsx 路径中生效（其它文件定义色板仍按违规处理）。
function isTopLevelPaletteObject(objExpr, filename) {
  if (!objExpr || objExpr.type !== "ObjectExpression") return false;
  if (!isInPackagesUI(filename) && !isAppTsxRoot(filename)) return false;
  const decl = objExpr.parent;
  if (!decl || decl.type !== "VariableDeclarator") return false;
  const varDecl = decl.parent;
  if (!varDecl || varDecl.type !== "VariableDeclaration") return false;
  if (varDecl.parent?.type !== "Program") return false;
  const id = decl.id;
  if (!id || id.type !== "Identifier") return false;
  return PALETTE_CONST_NAME_RE.test(id.name);
}

// 判定属性节点是否是合法主题定义：顶层色板对象的属性，或属性键名命中白名单且位于合法文件
function isExemptThemeProperty(propNode, filename) {
  if (!propNode || propNode.type !== "Property") return false;
  const objExpr = propNode.parent;
  if (isTopLevelPaletteObject(objExpr, filename)) return true;
  // 兜底：属性键名在 THEME_WHITELIST_KEYS 中，且位于 packages/ui 或 App.tsx
  if (!isInPackagesUI(filename) && !isAppTsxRoot(filename)) return false;
  const keyName = propNode.key?.type === "Identifier" ? propNode.key.name :
    propNode.key?.type === "Literal" ? String(propNode.key.value) : null;
  return !!keyName && THEME_WHITELIST_KEYS.has(keyName);
}

// 色值节点是否位于被豁免的主题属性值位置
function isInsideExemptThemeValue(node, filename) {
  if (!node) return false;
  const parent = node.parent;
  if (parent?.type === "Property" && parent.value === node) {
    return isExemptThemeProperty(parent, filename);
  }
  // 也允许数组成员（如主题 token 数组 ["#fff", "#000"]）命中时，其父 Property 是豁免对象
  if (parent?.type === "ArrayExpression") {
    return isInsideExemptThemeValue(parent, filename);
  }
  return false;
}

// ----------- 规则主体 -----------
const noHardcodedColors = {
  meta: {
    type: "problem",
    docs: {
      description:
        "禁止业务代码硬编码颜色值，统一使用 tokens.color 或合法 UserShellTheme 定义（ui-spec 强制规则 2）。",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      hardcodedColor:
        "硬编码颜色值 '{{ value }}' 不允许在此处出现。请使用 @mt/ui tokens.color（或页面通过 useTheme() 取应用主题色）。如确为主题色合法定义点：在 apps 项目 App.tsx 的顶层 *_THEME 常量内赋值，或加 eslint-disable 注释说明理由。",
    },
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    if (isInPackagesUITokens(filename)) {
      // tokens.ts 平台颜色源头，完全不查
      return {};
    }

    function report(node, value) {
      if (isInsideExemptThemeValue(node, filename)) {
        return; // 合法主题定义点，完全豁免，不 report
      }
      context.report({
        node,
        messageId: "hardcodedColor",
        data: { value: String(value) },
      });
    }

    function getAncestorPropertyKey(node) {
      let cur = node;
      while (cur) {
        if (cur.type === "Property" && cur.key) {
          if (cur.key.type === "Identifier") return cur.key.name;
          if (cur.key.type === "Literal") return String(cur.key.value);
        }
        cur = cur.parent;
      }
      return null;
    }

    return {
      // 1) 所有字符串字面量：检查是否是颜色值
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!isColorString(node.value)) return;

        // 直接字符串：查父 Property 名是不是颜色 key
        const propKey = getAncestorPropertyKey(node);
        if (propKey && COLOR_KEYS.has(propKey)) {
          // 命中颜色属性 + 色值：必报
          report(node, node.value);
          return;
        }
        // 非颜色属性（如 className 里恰好是 '#fff' 文本 —— 这里不查，但仍建议查一下：如果父是 JSXAttribute=style 或 ObjectExpression 属性是颜色）
        // 我们放宽：仅当它是某个对象属性值或 style 才报，纯变量字符串放过
        const parent = node.parent;
        if (!parent) return;
        if (
          parent.type === "Property" ||
          parent.type === "JSXExpressionContainer" ||
          parent.type === "ConditionalExpression" ||
          parent.type === "AssignmentExpression"
        ) {
          report(node, node.value);
        }
      },

      // 2) TemplateLiteral：如果 quasis[0].raw 是 '#' + hex 色值开头，也提示（虽不完整但给 warning）
      TemplateLiteral(node) {
        for (const q of node.quasis) {
          const v = (q.value && (q.value.raw || q.value.cooked)) || "";
          const trimmed = v.trim();
          if (isColorString(trimmed) || /^#(?:[0-9a-f]{2,8}|\$\{)/i.test(trimmed)) {
            report(node, trimmed.slice(0, 16));
            break;
          }
        }
      },
    };
  },
};

export default {
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
  },
};
