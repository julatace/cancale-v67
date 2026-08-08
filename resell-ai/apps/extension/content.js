// Panneau assistif RESELL AI, injecté sur la page.
//
// Il détecte un champ de saisie de message, propose des réponses (via l'API),
// et te laisse CLIQUER pour insérer le texte dans le champ. Il n'envoie JAMAIS :
// après insertion, c'est toi qui relis, ajustes et cliques « Envoyer » sur la
// plateforme. Aucune automatisation, aucun clic simulé sur un bouton d'envoi.

(() => {
  if (window.__resellaiLoaded) return;
  window.__resellaiLoaded = true;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let lastResult = null;

  // Dernier champ de message repéré sur la page (pour l'insertion au clic).
  function findMessageField() {
    const sel = 'textarea, [contenteditable="true"], input[type="text"][name*="message" i]';
    const nodes = [...document.querySelectorAll(sel)].filter((n) => n.offsetParent !== null);
    // Heuristique : le champ le plus grand visible = la zone de réponse.
    return nodes.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;
  }

  function insertIntoField(text) {
    const f = findMessageField();
    if (!f) { navigator.clipboard.writeText(text).catch(() => {}); return "copied"; }
    if (f.isContentEditable) { f.focus(); document.execCommand("insertText", false, text); }
    else { f.focus(); f.value = text; f.dispatchEvent(new Event("input", { bubbles: true })); }
    return "inserted";
  }

  function api(path, body) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "resellai", path, method: "POST", body }, (resp) => {
        resolve(resp && resp.ok ? resp.data : { ok: false });
      });
    });
  }

  function bubble() {
    if (document.getElementById("resellai-bubble") || document.getElementById("resellai-panel")) return;
    const b = document.createElement("button");
    b.id = "resellai-bubble"; b.textContent = "✍️"; b.title = "RESELL AI — suggestions";
    b.onclick = openPanel;
    document.body.appendChild(b);
  }

  function openPanel() {
    document.getElementById("resellai-bubble")?.remove();
    const p = document.createElement("div");
    p.id = "resellai-panel";
    render(p);
    document.body.appendChild(p);
  }

  function render(p) {
    const suggestions = (lastResult && lastResult.suggestions) || [];
    p.innerHTML = `
      <button class="rs-close" title="Fermer">✕</button>
      <h4>✍️ Aide à la réponse</h4>
      <div class="rs-sub">Colle le message de l'acheteur. Tu <b>insères</b> une réponse d'un clic, puis tu l'envoies toi-même.</div>
      <textarea id="rs-msg" placeholder="Message de l'acheteur…"></textarea>
      <button class="rs-go" id="rs-go">💬 Proposer des réponses</button>
      ${lastResult && lastResult.intent ? `<div class="rs-sub" style="margin-top:8px">Intention : <b>${esc(lastResult.intent)}</b>${lastResult.confidence ? ` · ${lastResult.confidence}%` : ""} ${lastResult.source === "ai" ? "· IA" : "· règles"}</div>` : ""}
      ${suggestions.map((s, i) => `
        <div class="rs-card">
          <div class="rs-tone">${esc(s.tone || "réponse")}</div>
          <div>${esc(s.text)}</div>
          <button class="rs-copy" data-i="${i}">Insérer</button>
        </div>`).join("")}`;
    p.querySelector(".rs-close").onclick = () => { p.remove(); bubble(); };
    p.querySelector("#rs-go").onclick = async () => {
      const msg = p.querySelector("#rs-msg").value.trim();
      if (!msg) return;
      p.querySelector("#rs-go").textContent = "⏳ …";
      const d = await api("/messaging/analyze", { message: msg });
      lastResult = d && d.ok ? d : { intent: "autre", suggestions: [{ tone: "info", text: "API injoignable — lance l'API (npm run dev)." }] };
      render(p);
    };
    p.querySelectorAll(".rs-copy").forEach((btn) => {
      btn.onclick = () => {
        const s = suggestions[Number(btn.dataset.i)];
        if (!s) return;
        const how = insertIntoField(s.text);
        btn.textContent = how === "inserted" ? "✓ Inséré" : "✓ Copié";
        setTimeout(() => { btn.textContent = "Insérer"; }, 1200);
      };
    });
  }

  bubble();
})();
