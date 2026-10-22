// api/push.js
// ────────────────────────────────────────────────────────────────────────────
// Gestion des notifications push depuis l'app :
//   POST { action:'subscribe',   sub }       → enregistre l'appareil
//   POST { action:'unsubscribe', endpoint }  → retire l'appareil
//   POST { action:'test' }                   → envoie une notification d'essai
// ────────────────────────────────────────────────────────────────────────────

import './_lib/sans-bruit.js';
import {nettoyerAbonnementPush} from './_lib/abonnement-push.js';
import { loadSubs, modifierSubs, sendPushToAll, pushConfigure } from './_lib/push.js';
import { contexteVendeur } from './_lib/owner.js';
import { utilisateurDe } from './_lib/session.js';
import { notifierRetraitConversation } from './email-inbound.js';

// Ce que l'app montrera tel quel : pas de vocabulaire d'informaticien, et un
// geste (§2.7). Ce n'est pas le téléphone qui est en cause — il ne faut surtout
// pas qu'il aille fouiller ses réglages de notifications.
const PAS_LU = { erreur: 'base-injoignable', message: "Je n'ai pas pu lire la liste de tes appareils : le serveur de données ne répond pas. Rien n'est perdu — réessaie dans quelques minutes." };
const PAS_ECRIT = { erreur: 'base-injoignable', message: "Je n'ai pas pu enregistrer cet appareil : le serveur de données ne répond pas. Rien n'est perdu — réessaie dans quelques minutes." };

// ⚠️⚠️ À QUI EST CET APPAREIL ? La route ne le demandait pas. Elle rangeait
//    l'abonnement dans la liste du propriétaire de l'installation : le téléphone
//    d'un second vendeur aurait reçu les ventes de Julien (et le bouton « test »
//    sonnait chez lui). Sur une base cloisonnée, on exige la session — jamais un
//    identifiant envoyé par le navigateur (session.js) — et tout se passe dans le
//    contexte de CE vendeur : lecture, écriture, envoi.
//    Base non cloisonnée (une seule boutique) : rien ne change.
const SANS_SESSION = { erreur: 'session', message: "Reconnecte-toi à VRM, puis réactive les notifications sur cet appareil." };

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control','no-store');
  const u = await utilisateurDe(req);
  if (u === undefined) { res.status(503).json({ erreur: 'connexion-injoignable', message: "Le service de connexion ne répond pas — rien n'est activé, réessaie dans un instant." }); return; }
  if (!u) { res.status(401).json(SANS_SESSION); return; }
  const owner = u.id;
  return contexteVendeur.run({ owner }, () => traiter(req, res));
}

async function traiter(req, res) {
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
    // ⚠️⚠️ ET DEUX APPAREILS EN MÊME TEMPS EN PERDAIENT UN (11 octobre, banc
    //      `notif-messages.cjs`) : l'iPhone et Chrome lisaient la même liste,
    //      ajoutaient chacun le sien et réécrivaient — le second effaçait le
    //      premier, et l'app avait répondu « activé » aux deux. `modifierSubs`
    //      n'écrit que si personne n'a écrit entre sa lecture et la sienne,
    //      sinon il relit et recommence (voir `_lib/push.js`). Et un appareil
    //      déjà inscrit ne réécrit plus la liste à chaque ouverture de l'app.
    const PAS_CONCLU = { erreur: 'base-occupee', message: "Je n'ai pas pu enregistrer cet appareil : la liste de tes appareils changeait au même moment. Rien n'est perdu — réessaie." };
    const echec = (raison) => (raison === 'lecture' ? PAS_LU : raison === 'conflit' ? PAS_CONCLU : PAS_ECRIT);
    // (21 oct.) L'EXTENSION a rangé un code de retrait NEUF lu dans une
    // conversation Vinted : « 📍 Colis à retirer ». Elle ne donne que le n° de
    // transaction ; la ligne est relue ici, au nom de CE vendeur.
    if (body.action === 'retrait') {
      const r = await notifierRetraitConversation(String(body.tx || ''));
      res.status(r.status).json(r.status === 200 ? { ok: true, envoye: !!r.envoye, ...(r.raison ? { raison: r.raison } : {}) } : { erreur: r.raison });
      return;
    }
    if (body.action === 'subscribe') {
      const sub = nettoyerAbonnementPush(body.sub);
      if (!sub || !sub.endpoint) { res.status(400).json({ error: 'abonnement invalide' }); return; }
      const r = await modifierSubs((cur) => (cur.some((s) => s && s.endpoint === sub.endpoint) ? null : [...cur, sub]));
      if (!r.ok) { res.status(503).json(echec(r.raison)); return; }
      res.status(200).json({ ok: true, devices: r.subs.length });
      return;
    }

    if (body.action === 'unsubscribe') {
      const r = await modifierSubs((cur) => {
        const reste = cur.filter((s) => !(s && s.endpoint === body.endpoint));
        return reste.length === cur.length ? null : reste;
      });
      if (!r.ok) { res.status(503).json(echec(r.raison)); return; }
      res.status(200).json({ ok: true, devices: r.subs.length });
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
    res.status(500).json({ error: 'Erreur interne. Réessaie dans un instant.' });
  }
}
