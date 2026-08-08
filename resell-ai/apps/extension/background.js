// Service worker : relaie les appels du panneau vers l'API RESELL AI. On passe
// par le background (avec host_permissions) pour éviter les soucis CORS depuis le
// content script. AUCUNE requête vers Vinted, aucun envoi de message : on ne fait
// que demander des SUGGESTIONS à notre propre API.

const API_BASE = "http://localhost:8787";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "resellai") return;
  (async () => {
    try {
      const opts = { method: msg.method || "POST", headers: { "Content-Type": "application/json" } };
      if (opts.method === "POST") opts.body = JSON.stringify(msg.body || {});
      const r = await fetch(`${API_BASE}${msg.path}`, opts);
      const j = await r.json().catch(() => ({}));
      sendResponse({ ok: true, data: j });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // réponse asynchrone
});
