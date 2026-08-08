// Tableau de bord minimal : perf des articles + suggestions de l'assistant.
// Lecture seule — aucune action externe. Il lit /api/items (proxy → API).

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface Item {
  id: string; title: string; brand?: string | null; price: number;
  views: number; favourites: number; ageDays: number; score: number;
  decision: { action: string; reason: string; urgency: string };
  pricing: { recommendedPrice: number; deltaPct: number; urgency: string };
}

const ACTION_LABEL: Record<string, string> = {
  improve_listing: "🛠️ Améliorer la fiche",
  adjust_price: "🏷️ Ajuster le prix",
  no_action: "✅ Rien à faire",
};
const scoreColor = (s: number) => (s >= 80 ? "#0f6b4f" : s >= 55 ? "#b7791f" : "#c53030");

function App() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setErr("API injoignable — lance-la avec `npm run dev`."));
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>RESELL AI — Tableau de bord</h1>
      <p style={{ color: "#6b7480", marginTop: -8 }}>
        Performance de tes articles et ce que l'assistant te <b>suggère</b>. Aucune action n'est faite à ta place.
      </p>
      {err && <div style={{ color: "#c53030" }}>{err}</div>}
      {!items && !err && <div>Chargement…</div>}
      {items && (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} style={{ background: "#fff", border: "1px solid #e2e6ea", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, background: scoreColor(it.score) + "18", color: scoreColor(it.score), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{it.score}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{it.title}</div>
                  <div style={{ color: "#6b7480", fontSize: 12 }}>
                    {(it.brand || "—")} · {it.price} € · 👁 {it.views} · ❤ {it.favourites} · {it.ageDays} j en ligne
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700 }}>{ACTION_LABEL[it.decision.action] || it.decision.action}</div>
                  {it.decision.action === "adjust_price" && (
                    <div style={{ fontSize: 12, color: scoreColor(50) }}>→ {it.pricing.recommendedPrice} € ({it.pricing.deltaPct}%)</div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "#3a4149", marginTop: 8, lineHeight: 1.5 }}>{it.decision.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
