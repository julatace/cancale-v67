// ════════════════════════════════════════════════════════════════════════════
//  BANC « BORDEREAU SUPPRIMÉ APRÈS LE VERSEMENT » (15 nov. ; récit :
//  docs/passation/2026-11-15-purge-bordereaux.md ; règle : api/_lib/purge-bordereaux.js ;
//  audit : scripts/audit-purge-bordereaux.cjs).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur` + deux
//  bordereaux « déjà traités » : 62002 (vente finalisée) dont le serveur a retiré le PDF
//  (`pdfPurged`, `filename` gardé, PDF null) et 62001 (en route) qui a encore le sien.
//  À 390 px tactile et 1512 px. Mesuré sur data-* (jamais un libellé seul) :
//   S1 Colis → « bordereaux déjà traités » → « Les voir » : la ligne 62002 porte
//      `data-bord-supprime="versement"` et AUCUN bouton d'impression ; 62001 garde le sien ;
//   S2 la phrase est dite (texte non vide), aucune erreur, pas de débordement.
//  Réglages : `BANC_PORT` (défaut 9733), `LARGEURS=390,1512`, `SHOTS=<dossier>`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9733';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map((x) => Number(x.trim())).filter(Boolean);
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

let ko = 0;
const dit = (bon, cle, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  l.push({ id: 'email_bord_62002', data: { type: 'bordereau', transaction: '62002', filename: 'bordereau-62002.pdf', pdfB64: null, pdfTamponneB64: null, pdfPurged: true, pdfPurgedAt: iso(0.1), pdfPurgeRaison: 'versement',
    modele: 'Asics 550 crème taille 42', account: 'vendeuse_a', uid: '111', suivi: 'MR62002', transporteur: 'mondialrelay', receivedAt: iso(9), dateLimite: '01/11/2026 10 h 00' } });
  l.push({ id: 'email_bord_62001', data: { type: 'bordereau', transaction: '62001', filename: 'bordereau-62001.pdf', pdfB64: 'JVBERi0x', modele: 'New Balance Samba OG noire taille 41', account: 'vendeuse_a', uid: '111', suivi: 'MR62001', receivedAt: iso(3), dateLimite: '10/11/2026 10 h 00' } });
  return l;
};

async function un(nav, W) {
  const T = `[${W}px]`;
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab: 'cat_bord' });
  try {
    await o.pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 }).catch(() => {});
    await o.pg.click('[data-colis-onglet-choix="envoyer"]').catch(() => {});
    await o.pg.waitForSelector('[data-bords-faits-voir]', { timeout: 25000 }).catch(() => {});
    await o.pg.click('[data-bords-faits-voir]').catch(() => {});
    await o.pg.waitForSelector('[data-bord-supprime]', { timeout: 10000 }).catch(() => {});
    await attendre(800);
    const r = await o.pg.evaluate(() => {
      const faits = document.querySelector('[data-bords-faits]');
      const lignes = faits ? [...(faits.parentElement || document).querySelectorAll('[data-bord-supprime], [data-imprime="1"]')] : [];
      const sup = [...document.querySelectorAll('[data-bord-supprime]')];
      const ligneDe = (e) => e && e.parentElement;
      return {
        faits: faits ? Number(faits.getAttribute('data-bords-faits')) : null,
        supprimes: sup.map((e) => ({ raison: e.getAttribute('data-bord-supprime'), texte: e.innerText.trim(), bouton: !!(ligneDe(e) && ligneDe(e).querySelector('[data-imprime="1"]')), titre: ligneDe(e) ? ligneDe(e).innerText : '' })),
        reimprimer: [...document.querySelectorAll('[data-imprime="1"]')].filter((b) => /Réimprimer/.test(b.innerText)).map((b) => (b.parentElement ? b.parentElement.innerText : '')),
        n: lignes.length,
        debord: document.documentElement.scrollWidth > window.innerWidth + 1,
        garde: /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.test(document.body.innerText),
      };
    });
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await o.pg.evaluate(() => { const e = document.querySelector('[data-bord-supprime]'); if (e) e.scrollIntoView({ block: 'center' }); }).catch(() => {}); await attendre(400); await o.pg.screenshot({ path: path.join(SHOTS, `bord-supprime-${W}.png`) }).catch(() => {}); }
    dit(r.faits === 2, 'S1', `${T} deux bordereaux déjà traités`, JSON.stringify(r));
    dit(r.supprimes.length === 1 && r.supprimes[0].raison === 'versement' && !r.supprimes[0].bouton && /Asics/.test(r.supprimes[0].titre), 'S1', `${T} 62002 : « supprimé après le versement », aucun bouton d’impression`, JSON.stringify(r.supprimes));
    dit(r.reimprimer.length === 1 && /Samba/.test(r.reimprimer[0]), 'S1', `${T} 62001 garde « Réimprimer »`, JSON.stringify(r.reimprimer));
    dit(r.supprimes[0] && r.supprimes[0].texte.length > 10 && !r.debord && !r.garde && !o.journal.erreurs.length, 'S2', `${T} la phrase est dite, ni erreur ni débordement`, JSON.stringify({ t: r.supprimes[0] && r.supprimes[0].texte, debord: r.debord, err: o.journal.erreurs }));
  } finally { await o.ctx.close().catch(() => {}); }
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try { for (const W of LARGEURS) await un(nav, W).catch((e) => dit(false, 'S0', `[${W}] au bout`, String(e && e.message).slice(0, 300))); }
  catch (e) { dit(false, 'S0', 'le banc a pu aller au bout', String(e && e.stack || e)); }
  finally { await nav.close().catch(() => {}); NV.srv.close(); }
  console.log(ko ? `\n❌ ${ko} KO` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
