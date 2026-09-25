// api/detourage.js — DÉTOURAGE d'une photo (fond retiré) via l'API Photoroom.
//
// Julien veut des photos « chaussure seule sur fond neutre » pour Vestiaire
// Collective (et ça sert aussi Leboncoin/eBay). Photoroom a une vraie API :
//   POST https://sdk.photoroom.com/v1/segment
//   header  x-api-key: <clé>
//   corps   JSON { image_file_b64: "<base64 sans préfixe>" } (l'extension a déjà
//           les OCTETS des photos Vinted — le CDN Vinted n'a pas de CORS, la
//           page seule ne peut pas les lire).
//   renvoie les OCTETS de l'image détourée (PNG).
//
// SÉCURITÉ (comme api/ai.js) : la clé Photoroom vit UNIQUEMENT dans la variable
// d'environnement Vercel PHOTOROOM_API_KEY — JAMAIS dans le code du site ni dans
// l'extension (le dépôt est public). Sans clé → 503 honnête : l'app le sait et
// ne promet rien. On ne fait JAMAIS semblant d'avoir détouré (§ « les routes
// api/ n'avaient jamais appris la leçon » : une erreur Photoroom remonte, on ne
// répond pas 200 sur un échec).

const PHOTOROOM_URL = 'https://sdk.photoroom.com/v1/segment';

export default async function handler(req, res) {
  // Santé : l'app interroge cette route pour afficher « détourage branché / non ».
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ready: !!process.env.PHOTOROOM_API_KEY });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }

  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) {
    // 503 = « pas configuré », pas un 200 mensonger. L'app retombe sur la photo
    // d'origine (aucun détourage inventé).
    res.status(503).json({ ok: false, reason: 'no-key',
      error: 'Détourage indisponible : la clé Photoroom (PHOTOROOM_API_KEY) n\'est pas configurée sur Vercel.' });
    return;
  }

  const b = req.body || {};
  // On accepte le base64 nu OU un data-URL (`data:image/jpeg;base64,...`).
  const b64 = typeof b.b64 === 'string' ? b.b64.replace(/^data:image\/[\w+.-]+;base64,/, '').trim() : '';
  if (!b64) { res.status(400).json({ ok: false, error: 'image manquante (champ b64)' }); return; }
  // Fond blanc par défaut (VC/eBay préfèrent un fond neutre à la transparence).
  // On n'accepte qu'une couleur hexadécimale sûre, ou 'transparent'.
  const bg = /^[0-9a-fA-F]{6}$/.test(b.bg || '') ? b.bg
    : (b.bg === 'transparent' ? 'transparent' : 'FFFFFF');

  try {
    const r = await fetch(PHOTOROOM_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'image/png' },
      body: JSON.stringify({ image_file_b64: b64, bg_color: bg, format: 'png' }),
    });
    if (!r.ok) {
      // ⚠️ ON NE MENT PAS : un refus Photoroom (clé invalide, quota, image trop
      //    grande…) remonte tel quel. Un 5xx devient 502 (Photoroom en cause),
      //    le reste garde son code (400 image, 402 quota, 403 clé…).
      let detail = ''; try { detail = (await r.text() || '').slice(0, 300); } catch (_) {}
      res.status(r.status >= 500 ? 502 : r.status).json({ ok: false, error: 'Photoroom a répondu ' + r.status, detail });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) { res.status(502).json({ ok: false, error: 'Photoroom a renvoyé une image vide' }); return; }
    res.status(200).json({ ok: true, b64: buf.toString('base64'), bytes: buf.length });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Photoroom injoignable', detail: String((e && e.message) || '').slice(0, 200) });
  }
}
