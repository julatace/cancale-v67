// ════════════════════════════════════════════════════════════════════════════
//  UN CLIENT ÉNORME ET NEUF PETITS, CÔTÉ SERVEUR (11 nov., lot « limites-client »)
//
//  Le vendeur 0 reçoit, en plus du gabarit (`_base-volume.cjs`), le client
//  INVENTÉ de `scripts/bancs/_gros-client.cjs` : 10 comptes de plus, 5 000
//  annonces, 20 000 ventes, 3 000 e-mails. Les 9 autres sont des vendeurs
//  « type ». On exécute les VRAIES routes (`api/ship-reminders.js` matin et
//  soir, `api/widget.js`) contre le faux PostgREST et on mesure, PAR VENDEUR :
//  temps, requêtes, Ko envoyés par la base (égress Supabase), taille de réponse.
//
//  Lancer : node scripts/charge/gros-client.cjs [--json sortie.json] [--lent 4]
//    --lent k : chaque requête du GROS vendeur attend k ms par 100 Ko rendus
//               (une base qui peine sur ses grosses lignes, comme en vrai).
//  ⚠️ Jamais un appel à la production (voir `_faux-postgrest.cjs`).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const { creerBase } = require('./_faux-postgrest.cjs');
const { preparer, appeler, semer } = require('./_routes.cjs');
const { fabriquerGros } = require(path.join(__dirname, '..', 'bancs', '_gros-client.cjs'));

const arg = (nom, def) => { const i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1] : def; };
const SORTIE = arg('json', null);
const LENT = Number(arg('lent', 0));
const Ko = (o) => Math.round(o / 1024);

// Pose le gros client chez `owner` (lignes + comptes). Rend le nombre de lignes posées.
function poserGros(B, owner, opts = {}) {
  const g = fabriquerGros(opts);
  for (const l of g.lignes) {
    if (l.id === 'main') { const m = B.ligne(owner, 'main'); B.poser(owner, 'main', { ...(m ? m.data : {}), vinted_annonce_numeros: { ...((m && m.data.vinted_annonce_numeros) || {}), ...l.data.vinted_annonce_numeros } }); continue; }
    B.poser(owner, l.id, l.data);
  }
  B.poser(owner, '__comptes_en_plus', g.accounts.map((a) => ({ vinted_user_id: a.vinted_user_id, login: a.login, domain: a.domain, created_at: a.created_at, updated_at: a.updated_at })));
  return g.lignes.length;
}

async function mesurer({ budgetMs = null, lent = LENT } = {}) {
  const B = creerBase({ vendeurs: 10 });
  preparer(B);
  const graines = await semer(B);
  const gros = B.owners[0];
  const poses = poserGros(B, gros);
  if (budgetMs) process.env.VRM_CRON_BUDGET_MS = String(budgetMs);
  // Une base qui peine sur les grosses lignes : le délai suit les octets rendus.
  if (lent > 0) {
    const r0 = B.repondre.bind(B);
    B.repondre = async (q) => { const rep = await r0(q); const h = q.headers || {}; const auth = String(h.authorization || h.Authorization || ''); if (rep.texte.length > 50000 && (String(q.url).includes(gros) || auth.includes(gros))) await new Promise((ok) => setTimeout(ok, Math.round((rep.texte.length / 102400) * lent))); return rep; };
  }
  const rapport = { lignes_gros: poses, scenarios: [] };
  for (const [et, q] of [['cron-matin', {}], ['cron-soir', { moment: 'soir' }]]) {
    B.remettre();
    const r = await appeler(B, 'ship-reminders', { query: q, headers: { authorization: 'Bearer secret-cron-banc' } }, et);
    const bilans = (r.corps && r.corps.bilans) || [];
    const pv = B.compteurs.parVendeur;
    const lignes = B.owners.map((o, i) => {
      const b = bilans.find((x) => x.owner === o) || {};
      return { vendeur: i === 0 ? 'GROS' : 'petit' + i, ms: b.ms ?? null, requetes: (pv[o] || {}).n || 0, Ko_sortis: Ko((pv[o] || {}).sortis || 0), servi: !!bilans.find((x) => x.owner === o && !x.erreur && !x.reporte), reporte: !!b.reporte };
    });
    const petits = lignes.slice(1);
    rapport.scenarios.push({ scenario: et, code: r.code, total_ms: r.ms, lot: r.corps && r.corps.lot, gros: lignes[0], petits_servis: petits.filter((x) => x.servi).length,
      petits_ms_max: Math.max(0, ...petits.map((x) => x.ms || 0)), petits_Ko_moyen: Math.round(petits.reduce((a, x) => a + x.Ko_sortis, 0) / petits.length), detail: lignes });
  }
  // Le widget : une réponse par vendeur (le gros et un petit).
  for (const [nom, i] of [['widget-gros', 0], ['widget-petit', 1]]) {
    B.remettre();
    const r = await appeler(B, 'widget', { query: { k: graines.jetonWidget(i) } }, nom);
    rapport.scenarios.push({ scenario: nom, code: r.code, ms: r.ms, requetes: r.requetes, Ko_sortis_base: Ko(r.octetsSortis), Ko_reponse: Ko(Buffer.byteLength(JSON.stringify(r.corps || ''))) });
  }
  return rapport;
}

module.exports = { mesurer, poserGros };

if (require.main === module) {
  (async () => {
    const t0 = Date.now();
    const rapport = await mesurer();
    for (const s of rapport.scenarios) { const { detail, ...court } = s; console.log(JSON.stringify(court)); if (detail) for (const d of detail) console.log('   ', JSON.stringify(d)); }
    console.log(JSON.stringify({ lignes_gros: rapport.lignes_gros, duree_s: Math.round((Date.now() - t0) / 1000) }));
    if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify(rapport, null, 1));
    process.exit(0);
  })().catch((e) => { console.error('banc planté : ' + (e && e.stack || e)); process.exit(1); });
}
