import { Input, Pagination, Skeleton, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Position } from "../api";
import { MAGAZINE_THEME } from "@mt/ui";
import { POSITION_STATUS_LABELS } from "../status";

const PAGE_SIZE = 9;

export default function PositionWall() {
  const [items, setItems] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listPositions()
      .then((all) => {
        const filtered = q
          ? all.filter(
              (p) =>
                p.company.toLowerCase().includes(q.toLowerCase()) ||
                p.title.toLowerCase().includes(q.toLowerCase()) ||
                (p.city ?? "").toLowerCase().includes(q.toLowerCase())
            )
          : all;
        setTotal(filtered.length);
        setItems(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <h2 style={{ fontFamily: MAGAZINE_THEME.displayFont, fontSize: 26, color: MAGAZINE_THEME.ink, margin: 0 }}>
          岗位博览 <span style={{ fontSize: 14, color: MAGAZINE_THEME.muted, fontStyle: "italic" }}>{total} 个机会在册</span>
        </h2>
        <Input.Search
          placeholder="检索公司 / 职位 / 城市"
          style={{ width: 260 }}
          allowClear
          onSearch={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton.Node key={i} active style={{ width: "100%", height: 180 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: MAGAZINE_THEME.muted, fontStyle: "italic", fontSize: 16 }}>
          尚无岗位在册——去后台录入第一条机会吧。
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {items.map((p, index) => (
            <Link
              key={p.id}
              to={"/positions/" + p.id}
              style={{
                display: "block",
                background: "#fffdf9",
                border: "1px solid #e8e2d6",
                padding: "20px 20px 16px",
                color: "inherit",
                textDecoration: "none",
                boxShadow: "0 1px 2px rgba(43,38,32,.05)",
              }}
            >
              <div
                style={{
                  fontFamily: MAGAZINE_THEME.displayFont,
                  fontSize: 11,
                  letterSpacing: 2,
                  color: MAGAZINE_THEME.muted,
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>No. {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</span>
                <span>{POSITION_STATUS_LABELS[p.status] ?? p.status}</span>
              </div>
              <h3 style={{ fontFamily: MAGAZINE_THEME.displayFont, fontSize: 20, color: MAGAZINE_THEME.ink, margin: "0 0 4px" }}>
                {p.title}
              </h3>
              <div style={{ color: MAGAZINE_THEME.primary, fontSize: 14, marginBottom: 10 }}>{p.company}</div>
              <div style={{ color: MAGAZINE_THEME.muted, fontSize: 12, display: "flex", gap: 12 }}>
                {p.city ? <span>📍 {p.city}</span> : null}
                <span>更新于 {new Date(p.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} showSizeChanger={false} />
      </div>
    </div>
  );
}
