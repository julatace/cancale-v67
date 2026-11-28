// api/ai.js — aujourd'hui : le DÉTOURAGE Photoroom de l'écran Vestiaire (`?mode=detourage`, /api/detourage par
// réécriture) et rien d'autre.
//
// ⚠️⚠️ (28 nov. 2026, lot ia-sans-cle) AUCUNE IA NE PASSE PLUS PAR LE SERVEUR. Julien : « je ne veux pas avoir à mettre
//    de clé, ni pour moi ni pour les utilisateurs, débrouille-toi ». Les anciens modes de cette route — la rédaction
//    d'annonce (retirée de l'interface le 30 sept.), l'aide à la réponse (`reply`, plus appelée par rien) et l'assistant
//    de rangement (`rangement`, sur la clé du vendeur ou celle du serveur) — sont RETIRÉS : l'IA tourne dans le
//    navigateur (src/iaNavigateur.js, le modèle intégré à Chrome, sur l'appareil), sinon l'assistant guidé par règles.
//    Plus aucun appel à un fournisseur d'IA, plus aucune clé lue (ni `AI_API_KEY`, ni la clé d'un vendeur).
//    Une ancienne app (onglet resté ouvert) qui appelle encore ces modes reçoit 410 `retire` : son écran retombe déjà
//    sur ses règles (« pas su » ≠ « oui »). Ne pas remettre d'IA serveur sans une décision de Julien (CLAUDE.md §2.9).
// Le fichier reste parce que le plan Hobby plafonne à 12 fonctions et que le détourage vit ici.

import './_lib/sans-bruit.js';
import { handleDetourage } from './_lib/detourage.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');   // (11 nov., B116) la réponse dépend de la session
  if (req.query && req.query.mode === 'detourage') return handleDetourage(req, res);
  // Tout le reste : l'IA est dans le navigateur. Aucune clé lue, aucun appel sortant.
  res.status(410).json({ ok: false, ready: false, reason: 'retire', moteur: 'navigateur',
    message: "L'IA de VRM tourne maintenant dans ton navigateur, sans clé : recharge la page." });
}
