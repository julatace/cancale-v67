require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  VENTES · « À RELANCER » (21 nov., ext. 5.425, `relances`) — l'écran RENDU, base INVENTÉE.
//  Julien (46) : « acheteurs qui ne finalisent pas, ou ne vont pas chercher le colis ». Les listes sont FAITES par
//  l'extension et publiées dans `vrm_relances_{uid}` (ligne projetée, jamais `select=data`) ; l'app les MONTRE.
//  Base : celle de design-passe + deux lignes `vrm_relances_*` (deux comptes, comptes séparés) : 2 à relancer sur le 1er
//  (livrée il y a 3 j ; au point relais depuis 3 j, « il reste environ 2 j », estimé), 1 sur le 2ᵉ (2ᵉ relance),
//  1 déjà relancée (jamais montrée), 1 litige absent (le fond ne le publie pas).
//  Mesure : V1 UN groupe « À relancer · 3 », replié ; V2 ouvert : un en-tête par compte, les phrases d'état, l'étiquette
//  ambre ; V3 le toucher ouvre le PANNEAU (vinted.fr ?vrm=panneau&page=commandes&action=relancer), rien n'est envoyé
//  par l'app ; V4 la lecture est PROJETÉE (pas de `select=data`) ; G aucune erreur. 1512 et 390, clair et sombre.
//  `BANC_DIST=…` juge un autre build (rouge attendu sur le code d'avant). `SHOTS=dossier` garde les captures.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-relances');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '1512,390').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const attendre = async (pg, f, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 864e5, T0 = Date.now();
function baseRelances() {
  const b = base();
  const [a0, a1] = b.accounts;
  const ligne = (uid, l) => ({ id: `vrm_relances_${uid}`, data: { v: 1, compte: String(uid), listeAt: new Date(T0 - 2 * 3600e3).toISOString(), envois: {}, liste: l } });
  b.rows.push(ligne(a0.vinted_user_id, [
    { tx: '23100000001', motif: 'livre', depuis: T0 - 3 * J, ok: true, rang: 1, raison: '', envois: 0, reste: null, estimee: null, titre: 'Nike Dunk Low gris taille 42' },
    { tx: '23100000002', motif: 'relais', depuis: T0 - 3 * J, ok: true, rang: 1, raison: '', envois: 0, reste: 2, estimee: true, titre: 'Adidas Samba OG blanches taille 40' },
    { tx: '23100000003', motif: 'relais', depuis: T0 - 6 * J, ok: false, rang: 0, raison: 'deja', envois: 1, reste: null, estimee: null, titre: 'Asics Gel-Kayano 14 taille 43' },
    { tx: '23100000004', motif: 'livre', depuis: T0 - J, ok: false, rang: 0, raison: 'trop-tot', envois: 0, reste: null, estimee: null, titre: 'Puma Suede taille 39' },
  ]));
  if (a1) b.rows.push(ligne(a1.vinted_user_id, [{ tx: '23200000001', motif: 'relais', depuis: T0 - 8 * J, ok: true, rang: 2, raison: '', envois: 1, reste: 0, estimee: true, titre: 'New Balance 550 crème taille 41' }]));
  return { b, nComptes: a1 ? 2 : 1 };
}
const mesure = () => {
  const vis = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const g = document.querySelector('[data-rlv-groupe]');
  return { groupe: g ? g.getAttribute('data-rlv-groupe') : null, n: g ? Number(g.getAttribute('data-rlv-n')) : null,
    comptes: [...document.querySelectorAll('[data-rlv-compte]')].filter(vis).map((e) => e.textContent.trim()),
    rangs: [...document.querySelectorAll('[data-rlv-rang]')].filter(vis).map((r) => ({ tx: r.getAttribute('data-rlv-rang'), texte: r.textContent.replace(/\s+/g, ' ').trim(), ambre: !!r.querySelector('[data-n-ton="ambre"]') })),
    ouverts: window.__ouverts || [] };
};
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const { b, nComptes } = baseRelances();
  const total = nComptes === 2 ? 3 : 2;
  try {
    for (const W of LARG) for (const th of THEMES) {
      console.log(`\n── Ventes · à relancer · ${W} · ${th}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=ventes' });
      const requetes = [];
      pg.on('request', (q) => { const u = decodeURIComponent(q.url()); if (/vrm_relances_/.test(u)) requetes.push(u); });
      await pg.addInitScript(() => {});
      await pg.evaluate(() => { window.__ouverts = []; window.open = (u) => { window.__ouverts.push(String(u)); return { opener: null }; }; });
      await attendre(pg, () => !!document.querySelector('[data-rlv-groupe]'), 40000);
      const m = await pg.evaluate(mesure);
      dit(m.groupe === 'replie' && m.n === total, `V1 UN groupe « À relancer · ${total} », replié (${m.groupe} · ${m.n})`);
      await pg.locator('[data-rlv-groupe] .n-groupe-repli').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(600);
      await pg.evaluate(() => { const g = document.querySelector('[data-rlv-groupe]'); if (g) g.scrollIntoView({ block: 'start' }); });
      await pg.waitForTimeout(400);
      const m2 = await pg.evaluate(mesure);
      await pg.screenshot({ path: path.join(SHOTS, `relances-${W}-${th}.png`) });
      dit(m2.rangs.length === total && !m2.rangs.some((r) => /Kayano|Puma/.test(r.texte)), `V2 ouvert : les ${total} à relancer, ni la déjà relancée ni la trop récente`, m2.rangs);
      dit(m2.comptes.length === nComptes, `V2 un en-tête par compte (comptes séparés) : ${m2.comptes.join(' | ')}`);
      const r2 = m2.rangs.find((r) => r.tx === '23100000002') || {}, r1 = m2.rangs.find((r) => r.tx === '23100000001') || {};
      dit(/Livrée il y a 3 j/.test(r1.texte) && /Au point relais depuis 3 j/.test(r2.texte) && /environ 2 j.*estimé/.test(r2.texte) && m2.rangs.every((r) => r.ambre), 'V2 les phrases (livrée, au point, garde estimée) et l’étiquette ambre', [r1.texte, r2.texte]);
      if (nComptes === 2) dit(m2.rangs.some((r) => /2e relance/.test(r.texte) && /dépassée/.test(r.texte)), 'V2 2ᵉ relance, garde dépassée (estimée) dite', m2.rangs.map((r) => r.texte));
      await pg.locator('[data-rlv-rang]').first().click({ timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const m3 = await pg.evaluate(mesure);
      dit(m3.ouverts.length === 1 && /^https:\/\/www\.vinted\.fr\/\?vrm=panneau&page=commandes&action=relancer$/.test(m3.ouverts[0]), 'V3 le toucher ouvre le PANNEAU sur Commandes → À relancer', m3.ouverts);
      dit(requetes.length >= 1 && requetes.every((u) => !/select=data(&|$)/.test(u) && /select=id,l:data->liste/.test(u)), 'V4 la lecture est projetée (jamais select=data)', requetes.slice(0, 2));
      dit(!erreurs.length, 'G aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a planté', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\nbanc ventes-relances : ${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
