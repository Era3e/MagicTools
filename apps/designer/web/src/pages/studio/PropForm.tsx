import { Input, Select, Switch } from "antd";
import type { PropField } from "../../canvas/registry";

export interface PropFormProps {
  fields: PropField[];
  values: Record<string, string | number | boolean>;
  onChange: (name: string, value: string | number | boolean) => void;
}

export default function PropForm({ fields, values, onChange }: PropFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {fields.map((f) => {
        const v = values[f.name];
        const label = <label htmlFor={"prop-" + f.name}>{f.label}</label>;
        if (f.type === "boolean") {
          return (
            <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {label}
              <Switch checked={Boolean(v)} onChange={(checked) => onChange(f.name, checked)} />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.name}>
              {label}
              <Select
                id={"prop-" + f.name}
                value={String(v ?? "")}
                options={f.options ?? []}
                style={{ width: "100%", marginTop: 4 }}
                onChange={(val) => onChange(f.name, f.type === "number" ? Number(val) : String(val))}
              />
            </div>
          );
        }
        return (
          <div key={f.name}>
            {label}
            <Input
              id={"prop-" + f.name}
              value={String(v ?? "")}
              style={{ marginTop: 4 }}
              onChange={(e) => onChange(f.name, f.type === "number" ? Number(e.target.value) || 0 : e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
