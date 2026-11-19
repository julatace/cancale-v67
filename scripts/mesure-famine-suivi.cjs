#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  MESURE (pas un audit : elle RAPPORTE, code de sortie 0) — LE N° DE SUIVI DES ACHATS EST-IL ENCORE LU
//  QUAND LE COMPTE A DÉJÀ LU AUTRE CHOSE DANS L'HEURE ? (19 nov., chantier colis-achat-auto)
//
//  Julien : « quand je fais l'achat, l'extension doit capter le numéro de suivi ». Mesuré sur sa base le 19 nov. :
//  aucune ligne `harvest_{uid}_suivi_{tx}` n'a été écrite depuis le 11 nov. par une extension ≥ 5.341, et sur son
//  compte d'achat principal 36 achats en cours sur 38 n'ont pas leur n° — donc 15 colis à retirer sur 15 sans contenu.
//
//  Cette mesure exécute le VRAI background.js (scripts/_fond-vm.cjs) : trois achats expédiés sans n° (dont un au
//  point relais), une réponse de suivi qui porte le n°, et N lectures déjà faites dans l'heure par les autres
//  lecteurs (dates de versement, relevés, preuves, import de l'historique). Elle dit combien de suivis sont lus.
//  Constat sur la 5.408 : dès 7 lectures dans l'heure, AUCUN suivi n'est lu tant que les lecteurs prioritaires ont
//  encore du travail (ou que leur reste n'est pas su) — la classe « suivi » passe sous leur réserve (13 lectures sur
//  20), et les rattrapages de fond (`tickVersements` : 15/h ; import : jusqu'à 20/h) tiennent le compteur au-dessus.
//
//  (5.409, fait : docs/passation/2026-11-19-colis-achat-auto.md §11 ; contrôle : audit-suivi-colis-ext.) Le changement est
//  décrit dans docs/passation/2026-11-19-colis-achat-auto.md §5. Cette mesure deviendra son contrôle : avec le
//  correctif, la colonne « réserves pas sues » doit lire au moins les achats expédiés sans n° (rangs 0 et 1).
//  `BG_SRC=chemin/background.js` pour juger une autre version.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
const BG = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const H = (h) => new Date(Date.now() - h * 3600000).toISOString();
const commande = (tx, status, tus = 'waiting', h = 48) => ({ transaction_id: Number(tx), title: `Achat banc ${String(tx).slice(-3)}`, status, transaction_user_status: tus, date: H(h) });
// La forme mesurée de `journey_summary` (panel_formes_suivi, 17 nov.) : carriers[].tracking_code, current_carrier, details[].
const journey = (n) => ({ journey_summary: { status: 'in_transit', user_side: 'buyer', actions: [], carriers: [{ code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 }], current_carrier: { code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 },
  details: [{ status: 'shipped', message: 'Colis expédié', timestamp: H(20), cell_type: 'default', carrier: { code: 'MONDIAL', tracking_code: n, is_current: true, priority: 1 } }] } });

(async () => {
  console.log('lectures déjà faites dans l’heure │ réserves des lecteurs prioritaires │ suivis lus │ n° rangés');
  const lignesSortie = [];
  for (const deja of [0, 3, 6, 7, 8, 12, 15]) {
    for (const dues of ['pas sues', 'vides']) {
      const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [
        commande('32000000201', 'Colis disponible au point relais', 'needs_action', 30), commande('32000000202', 'Colis expédié', 'waiting', 40), commande('32000000203', 'Colis expédié', 'waiting', 50)] } } };
      let lus = '?', ecrits = '?';
      try {
        const f = faireFond({ src: BG, lignes, connecte: '111', vinted: (req) => {
          const m = /\/transactions\/(\d+)(\/shipment\/journey_summary)?$/.exec(req.chemin);
          if (!m) return { status: 200, body: { user: { id: 111 } } };
          return { status: 200, body: m[2] ? journey('8' + m[1].slice(-7)) : { transaction: { id: Number(m[1]) } } };
        } });
        const t = Date.now();
        f.store.vrmLectures = { '111': Array.from({ length: deja }, (_, i) => t - 60000 * (i + 1)) };
        if (dues === 'vides') f.store.vrmLecturesDues = { '111': { versement: { reste: 0, at: t }, releve: { reste: 0, at: t }, retrait: { reste: 0, at: t }, preuve: { reste: 0, at: t } } };
        await f.ctx.capterSuivisAchats('111');
        lus = f.j.vinted.filter((v) => /journey_summary/.test(v.chemin)).length;
        ecrits = Object.keys(lignes).filter((k) => /_suivi_/.test(k)).length;
      } catch (e) { lus = 'erreur'; ecrits = String(e && e.message).slice(0, 60); }
      lignesSortie.push({ deja, dues, lus, ecrits });
      console.log(`${String(deja).padStart(32)} │ ${dues.padEnd(36)} │ ${String(lus).padStart(10)} │ ${String(ecrits).padStart(9)}`);
    }
  }
  const affames = lignesSortie.filter((l) => l.dues === 'pas sues' && l.deja >= 7 && l.lus === 0).length;
  console.log(affames ? `\n⚠️  Avec 7 lectures ou plus dans l'heure et des réserves pas sues, le suivi des achats n'est PAS lu (${affames} cas sur 4) : un colis arrivé au point relais reste « Contenu pas encore lu ».`
    : '\n✅ Le suivi des achats expédiés sans n° est lu même quand le compte a déjà lu dans l’heure.');
  process.exit(0);
})();
