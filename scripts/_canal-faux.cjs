// ════════════════════════════════════════════════════════════════════════════
//  Un `MessageChannel` de banc (5.396) : deux ports qui se répondent, une lettre
//  à la fois, recopiée (structured clone ≈ JSON pour nos lettres), livrée juste après
//  tard (comme le navigateur) ; une lettre postée AVANT que l'autre port écoute
//  attend dans sa file (comme un vrai port, démarré par `onmessage`). Rien ne
//  retient Node (contrairement au `MessageChannel` de Node, qui garde le
//  processus vivant tant qu'un port écoute).
//  Sert les bancs qui jouent le vrai capteur MAIN et le vrai relais isolé
//  (Vestiaire, Leboncoin) : le canal privé est celui du code, pas une imitation
//  de sa règle.
// ════════════════════════════════════════════════════════════════════════════
function FauxCanal() {
  const faire = () => {
    const p = { _file: [], _ecoute: null, _autre: null, ferme: false };
    Object.defineProperty(p, 'onmessage', {
      get() { return p._ecoute; },
      set(f) { p._ecoute = f; const f0 = p._file.splice(0); for (const d of f0) queueMicrotask(() => { if (p._ecoute) p._ecoute({ data: d }); }); },
    });
    p.postMessage = (d) => {
      if (p.ferme) return;
      const c = d === undefined ? undefined : JSON.parse(JSON.stringify(d));
      const o = p._autre;
      if (!o._ecoute) { o._file.push(c); return; }
      queueMicrotask(() => { if (o._ecoute) o._ecoute({ data: c }); });
    };
    p.start = () => {}; p.close = () => { p.ferme = true; };
    p.addEventListener = (t, f) => { if (t === 'message') p.onmessage = f; };
    return p;
  };
  const a = faire(), b = faire(); a._autre = b; b._autre = a;
  this.port1 = a; this.port2 = b;
}
// Le banc tient l'autre bout d'un canal qu'un capteur MAIN (inject.js) ouvre : ce que le
// capteur poste sur SON port est remis tout de suite à `recevoir` (le banc le lit aussitôt,
// comme il lisait `window.postMessage` avant la 5.396 — mais seulement par le canal).
function canalVersBanc(recevoir) {
  return function CanalBanc() {
    const p2 = { onmessage: null, postMessage() {}, start() {}, close() {} };
    const p1 = { onmessage: null, start() {}, close() {}, postMessage(d) { recevoir(d === undefined ? undefined : JSON.parse(JSON.stringify(d))); } };
    this.port1 = p1; this.port2 = p2;
  };
}
module.exports = { FauxCanal, canalVersBanc };
