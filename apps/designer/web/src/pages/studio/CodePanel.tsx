import { useMemo } from "react";
import { Button, Tag } from "antd";
import { tokens } from "@mt/ui";

export interface CodePanelProps {
  code: string;
  dirty: boolean;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  applying?: boolean;
  error?: string | null;
  height?: number;
}

export default function CodePanel({ code, dirty, onCodeChange, onApply, applying, error, height = 260 }: CodePanelProps) {
  const lines = useMemo(() => code.split("\n").length, [code]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>源码 · {lines} 行</span>
        {dirty ? <Tag color="warning">未应用</Tag> : null}
        <span style={{ flex: 1 }} />
        <Button size="small" type={dirty ? "primary" : "default"} loading={applying} disabled={!dirty} onClick={onApply}>
          应用代码
        </Button>
      </div>
      <textarea
        data-testid="studio-code"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          height,
          resize: "vertical",
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radiusTokens.sm,
          padding: "10px 12px",
          fontFamily: tokens.font.mono,
          fontSize: 12.5,
          lineHeight: 1.7,
          background: tokens.color.bgUser,
          color: "inherit",
          outline: "none",
          tabSize: 2,
        }}
      />
      {error ? (
        <div role="alert" style={{ fontSize: 12, color: tokens.color.error, fontFamily: tokens.font.mono }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
