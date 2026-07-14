// api/push.js
// ────────────────────────────────────────────────────────────────────────────
// Gestion des notifications push depuis l'app :
//   POST { action:'subscribe',   sub }       → enregistre l'appareil
//   POST { action:'unsubscribe', endpoint }  → retire l'appareil
//   POST { action:'test' }                   → envoie une notification d'essai
// ────────────────────────────────────────────────────────────────────────────

import { loadSubs, saveSubs, sendPushToAll } from './_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch (_) { res.status(400).json({ error: 'corps illisible' }); return; }

  try {
    if (body.action === 'subscribe') {
      const sub = body.sub;
      if (!sub || !sub.endpoint) { res.status(400).json({ error: 'abonnement invalide' }); return; }
      const subs = await loadSubs();
      if (!subs.some(s => s.endpoint === sub.endpoint)) subs.push(sub);
      await saveSubs(subs);
      res.status(200).json({ ok: true, devices: subs.length });
      return;
    }

    if (body.action === 'unsubscribe') {
      const subs = (await loadSubs()).filter(s => s.endpoint !== body.endpoint);
      await saveSubs(subs);
      res.status(200).json({ ok: true, devices: subs.length });
      return;
    }

    if (body.action === 'test') {
      const r = await sendPushToAll({
        title: '🔔 VRM — test réussi !',
        body: 'Les notifications push fonctionnent sur cet appareil.',
        tag: 'vrm-test',
        url: '/',
      });
      res.status(200).json({ ok: true, ...r });
      return;
    }

    res.status(400).json({ error: 'action inconnue' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
