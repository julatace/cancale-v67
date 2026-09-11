// api/push.js
// ────────────────────────────────────────────────────────────────────────────
// Gestion des notifications push depuis l'app :
//   POST { action:'subscribe',   sub }       → enregistre l'appareil
//   POST { action:'unsubscribe', endpoint }  → retire l'appareil
//   POST { action:'test' }                   → envoie une notification d'essai
// ────────────────────────────────────────────────────────────────────────────

import { loadSubs, saveSubs, sendPushToAll, pushConfigure } from './_lib/push.js';

// Ce que l'app montrera tel quel : pas de vocabulaire d'informaticien, et un
// geste (§2.7). Ce n'est pas le téléphone qui est en cause — il ne faut surtout
// pas qu'il aille fouiller ses réglages de notifications.
const PAS_LU = { erreur: 'base-injoignable', message: "Je n'ai pas pu lire la liste de tes appareils : le serveur de données ne répond pas. Rien n'est perdu — réessaie dans quelques minutes." };
const PAS_ECRIT = { erreur: 'base-injoignable', message: "Je n'ai pas pu enregistrer cet appareil : le serveur de données ne répond pas. Rien n'est perdu — réessaie dans quelques minutes." };

export default async function handler(req, res) {
  // GET ?etat=1 → « le serveur peut-il envoyer ? ». Aucun secret exposé : on
  // répond oui/non. C'est la seule façon, depuis l'app, de distinguer « aucun
  // appareil abonné » de « le serveur n'a pas sa clé » — deux causes qui
  // produisent exactement le même silence côté téléphone.
  if (req.method === 'GET') {
    // ⚠️ `devices = 0` sur une lecture ratée disait « aucun appareil abonné »
    //    — exactement la confusion que ce fichier dénonce plus bas. Si la liste
    //    n'a pas pu être lue, on ne répond pas un chiffre : on dit qu'on ne
    //    sait pas, et l'app n'affiche rien (elle ignore déjà les réponses ≠ 2xx).
    const subs = await loadSubs().catch(() => null);
    if (subs === null) { res.status(503).json({ erreur: 'base-injoignable', message: "Je n'ai pas pu lire la liste de tes appareils." }); return; }
    res.status(200).json({ pret: pushConfigure(), devices: subs.length });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch (_) { res.status(400).json({ error: 'corps illisible' }); return; }

  try {
    // ⚠️⚠️ LIRE-AJOUTER-RÉÉCRIRE : SI LA LECTURE A RATÉ, ON N'ÉCRIT PAS.
    //      Sinon la liste repart de zéro et les autres téléphones de Julien
    //      sont effacés — une perte réelle, pas un affichage faux. Et tant
    //      qu'on n'a pas la confirmation d'écriture, on ne dit pas « activé » :
    //      l'app affiche déjà « Impossible d'activer » sur une réponse ≠ 2xx.
    if (body.action === 'subscribe') {
      const sub = body.sub;
      if (!sub || !sub.endpoint) { res.status(400).json({ error: 'abonnement invalide' }); return; }
      const subs = await loadSubs();
      if (subs === null) { res.status(503).json(PAS_LU); return; }
      if (!subs.some(s => s.endpoint === sub.endpoint)) subs.push(sub);
      if (!await saveSubs(subs)) { res.status(503).json(PAS_ECRIT); return; }
      res.status(200).json({ ok: true, devices: subs.length });
      return;
    }

    if (body.action === 'unsubscribe') {
      const lus = await loadSubs();
      if (lus === null) { res.status(503).json(PAS_LU); return; }
      const subs = lus.filter(s => s.endpoint !== body.endpoint);
      if (!await saveSubs(subs)) { res.status(503).json(PAS_ECRIT); return; }
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
