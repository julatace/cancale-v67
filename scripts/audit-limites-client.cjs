// ════════════════════════════════════════════════════════════════════════════
//  UN CLIENT ÉNORME NE BLOQUE PAS LES AUTRES — CÔTÉ SERVEUR (11 nov., lot « limites-client »)
//
//  Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour
//  les autres ». On EXÉCUTE les vraies routes (`api/ship-reminders.js`,
//  `api/widget.js`, `api/compte.js`) contre le faux PostgREST de
//  `scripts/charge/` : 1 vendeur énorme (10 comptes, 5 000 annonces, 20 000
//  ventes, 3 000 e-mails — `scripts/bancs/_gros-client.cjs`) + 9 petits.
//
//   C1  le cron répond avant la coupure (Vercel coupe net) même quand la base
//       peine sur les lignes du gros (chaque requête du gros : +800 ms) ;
//   C2  les 9 petits sont servis ET notés dans le curseur du jour ;
//   C3  le gros n'est PAS noté « fait » : il est reporté (lot.reportes = 1) ;
//   C4  relancé (base redevenue rapide), le cron reprend le gros et ne refait
//       aucun petit (dejaFaits = 9) ;
//   W1  le widget d'un vendeur à EXACTEMENT 1 000 e-mails de vente répond 200
//       (un 416 à la frontière est la fin de la liste, pas une panne) ;
//   W2  … et compte les mêmes ventes qu'avec 1 001 (rien n'est perdu).
//
//  Données inventées. `--prouve` : chaque mutation rougit (§6.1).
//  Lancer : node scripts/audit-limites-client.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver } = require('./_mutations-audit.cjs');
const LIB = 'api/_lib/cron-lots.js';
const CRON = 'api/ship-reminders.js';
const ORDRE = 'api/_lib/ordre-stable.js';

const MUTATIONS = {
  'temps du vendeur non borné': [[LIB, 'if (!(tempsVendeurMs > 0) || !Number.isFinite(tempsVendeurMs)) return travail;', 'return travail;']],
  'reporté noté « fait »': [[LIB, "if (r === REPORTE) { reportes.push(o); bilans.push({ owner: o, reporte: true, raison: 'temps-vendeur', ms: maintenant() - t0 }); continue; }", "if (r === REPORTE) { reportes.push(o); faits.push(o); continue; }"]],
  'cron sans borne par vendeur': [[CRON, 'tempsVendeurMs: Number(process.env.VRM_CRON_VENDEUR_MS)', 'tempsVendeurMs0: Number(process.env.VRM_CRON_VENDEUR_MS)']],
  '416 à la frontière = panne': [[ORDRE, 'return !!m && Number(m[1]) === debut;', 'return false;']],
};

if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
  let ko = 0, ok = 0;
  const vrai = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m + (d ? ' — ' + d : '')); } else { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); } };
  const { creerBase, NEUTRE } = require('./charge/_faux-postgrest.cjs');
  const { preparer, appeler, semer } = require('./charge/_routes.cjs');
  const { poserGros } = require('./charge/gros-client.cjs');
  const { fabriquer } = require('./bancs/_base-volume.cjs');
  const COUPURE_MS = 30000;   // la coupure nette de la fonction, à l'échelle du banc

  (async () => {
    // Un gabarit léger (1 compte) pour les petits ; le gros reçoit le client énorme.
    const B = creerBase({ vendeurs: 10, gabarit: fabriquer({ comptes: 1 }) });
    preparer(B);
    const graines = await semer(B);
    const gros = B.owners[0];
    poserGros(B, gros);
    process.env.VRM_CRON_BUDGET_MS = '20000';
    process.env.VRM_CRON_VENDEUR_MS = '6000';
    // La base peine sur les lignes du GROS seulement : +800 ms par requête.
    let lent = true;
    const r0 = B.repondre.bind(B);
    const aGros = (q) => { const u = decodeURIComponent(String(q.url)); const h = q.headers || {}; return u.includes(gros) || String(h.authorization || h.Authorization || '').includes(gros); };
    B.repondre = async (q) => { if (lent && aGros(q)) await new Promise((ok) => setTimeout(ok, 800)); return r0(q); };
    const curseurDuJour = () => { const L = B.tout().filter((r) => r.owner === NEUTRE && /^cron_curseur_matin_/.test(r.id)); return L.length ? L[L.length - 1].data : null; };

    // ── C1-C3 ───────────────────────────────────────────────────────────────
    const t0 = Date.now();
    const appel = appeler(B, 'ship-reminders', { query: {}, headers: { authorization: 'Bearer secret-cron-banc' } }, 'cron-matin');
    const r = await Promise.race([appel, new Promise((ok) => setTimeout(() => ok({ coupe: true }), COUPURE_MS))]);
    const ms = Date.now() - t0;
    vrai(!r.coupe, `C1 le cron répond avant la coupure (${COUPURE_MS / 1000} s) malgré un vendeur énorme et lent`, `${ms} ms${r.coupe ? ' — COUPÉ' : ''}`);
    const bilans = (r.corps && r.corps.bilans) || [];
    const petits = B.owners.slice(1);
    const servis = petits.filter((o) => bilans.some((b) => b.owner === o && !b.erreur && !b.reporte));
    const cur = curseurDuJour();
    const notes = petits.filter((o) => cur && Array.isArray(cur.faits) && cur.faits.includes(o));
    vrai(servis.length === 9, 'C2 les 9 petits sont servis', `${servis.length}/9`);
    vrai(notes.length === 9, 'C2 … et notés dans le curseur du jour (une coupure ne les fera pas refaire)', `${notes.length}/9`);
    const lot = (r.corps && r.corps.lot) || {};
    vrai(lot.reportes === 1 && !!bilans.find((b) => b.owner === gros && b.reporte) && !(cur && (cur.faits || []).includes(gros)), 'C3 le gros est reporté, jamais noté « fait »', JSON.stringify({ reportes: lot.reportes, complet: cur && cur.complet }));

    // ── C4 : relance, base redevenue rapide ─────────────────────────────────
    lent = false;
    const r2 = await Promise.race([appeler(B, 'ship-reminders', { query: {}, headers: { authorization: 'Bearer secret-cron-banc' } }, 'cron-matin-2'), new Promise((ok) => setTimeout(() => ok({ coupe: true }), COUPURE_MS))]);
    const lot2 = (r2.corps && r2.corps.lot) || {};
    const b2 = (r2.corps && r2.corps.bilans) || [];
    vrai(!r2.coupe && lot2.dejaFaits === 9 && b2.length === 1 && b2[0].owner === gros && !b2[0].reporte && !b2[0].erreur, 'C4 relancé : le gros est repris, aucun petit refait', JSON.stringify({ dejaFaits: lot2.dejaFaits, traites: lot2.traites, reportes: lot2.reportes }));

    // ── W1-W2 : widget à la frontière exacte de 1 000 lignes ────────────────
    const ventesWidget = async (n) => {
      const W = creerBase({ vendeurs: 1, gabarit: fabriquer({ comptes: 1 }) });
      preparer(W);
      const g = await semer(W);
      for (let i = 0; i < n; i++) W.poser(W.owners[0], `email_sale_${String(i).padStart(6, '0')}`, { type: 'vente', designation: 'Paire ' + i, prix: 40, account: 'vendeur_1', receivedAt: new Date(Date.now() - (i + 40) * 864e5).toISOString() });
      // preparer() est branché une fois pour le processus : la base servie est celle de `B`
      // ⇒ on sert W en remplaçant le gestionnaire.
      const avant = B.repondre; B.repondre = W.repondre.bind(W);
      try { return await appeler(W, 'widget', { query: { k: g.jetonWidget(0) } }, 'widget'); } finally { B.repondre = avant; }
    };
    const w1000 = await ventesWidget(1000);
    vrai(w1000.code === 200, 'W1 widget : 1 000 e-mails de vente (frontière exacte) ⇒ 200, pas « base injoignable »', `${w1000.code} ${JSON.stringify(w1000.corps).slice(0, 80)}`);
    const w1001 = await ventesWidget(1001);
    const ship = (x) => JSON.stringify(x && x.corps && x.corps.ship);
    vrai(w1001.code === 200 && ship(w1000) === ship(w1001), 'W2 … et le même compte qu\'à 1 001', `${ship(w1000)} / ${ship(w1001)}`);

    console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  })().catch((e) => { console.error('❌ audit planté : ' + (e && e.stack || e)); process.exit(2); });
}
