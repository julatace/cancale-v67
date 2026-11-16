// ════════════════════════════════════════════════════════════════════════════
//  BANC « ARGENT MIEUX » (16 nov., lot argent-mieux) — Julien, 5 captures iPhone d'Argent : « Corrige et améliore ».
//  Récit : docs/passation/2026-11-16-argent-mieux.md
//
//  Base INVENTÉE (le dépôt est public) : un compte Vinted PRO dont 60 ventes versées le mois dernier ont
//  « deux prix chez Vinted » (la liste ≠ l'article, aucun relevé), un compte particulier (30 ventes versées
//  le mois dernier, 8 ce mois-ci, 12 finalisées sans date de versement), micro 13,4 %, rythme mensuel.
//  L'écran Ventes publie la ligne URSSAF (comme chez lui), puis Argent est ouvert segment par segment
//  (Résumé, Déclarer, Factures), 390 tactile ET 1512, clair ET sombre. Jugé SUR LA RÈGLE (data-*, nombres) :
//    C  contraste ≥ 4,5:1 (3:1 gros texte) de CHAQUE texte du segment, recomposé sur son fond réel
//       (la mesure de scripts/bancs/verre.cjs), replis fermés PUIS ouverts ;
//    G  les ventes non comptées sont GROUPÉES : la raison « deux prix » est UNE ligne (`data-nc-groupe`) qui
//       porte 60 ventes et leur total « au moins » (centimes, = la somme des prix les plus bas) ; aucun texte vu
//       n'énumère plus de 3 fois « vente(s) Vinted » (le mur d'avant) ; le détail par vente est REPLIÉ ;
//    B  « Copier » est un vrai bouton visible (fond ou bord ≥ 3:1 sur ce qui l'entoure, 44 px au doigt) ;
//    L  aucun libellé coupé en « … » dans Déclarer ;
//    M  les mesures (hauteur de Déclarer, mots, contraste min) sont écrites, pour le récit (avant/après).
//  `LARGEURS=390` `THEMES=clair` `SEGMENTS=declarer` ; `SHOTS=<dossier>` ; `BANC_DIST=<dist>` (l'arbre d'avant : ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const { mesurer: mesurerVerre } = require('./verre.cjs');
const { allerSegment } = require('./_compta.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SEGMENTS = liste('SEGMENTS', 'resume,declarer,factures');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-argent-mieux');
const DSF = Number(process.env.DSF || 1);
// Une capture ENTIÈRE du segment : l'app défile dans son conteneur (la page fait la hauteur de l'écran) — on agrandit
// la fenêtre le temps de la capture, puis on la remet.
async function capture(pg, seg, fichier) {
  const vp = pg.viewportSize();
  const h = await pg.evaluate((seg) => { const p = document.querySelector(`[data-argent-vue="${seg}"]`); return p ? Math.ceil(p.getBoundingClientRect().height) + 700 : 0; }, seg);
  await pg.setViewportSize({ width: vp.width, height: Math.min(16000, Math.max(vp.height, h)) });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: fichier });
  await pg.setViewportSize(vp);
  await pg.waitForTimeout(300);
}
fs.mkdirSync(SHOTS, { recursive: true });
const N_DEUX_PRIX = 60;

// ── La base inventée ──
const J = 86400000;
const PRO = '61000001', PART = '61000002';
function base() {
  const now = new Date();
  const moisAvant = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const jourAvant = (d, h = 10) => new Date(moisAvant.getFullYear(), moisAvant.getMonth(), d, h).toISOString();
  const jourCe = (d) => new Date(now.getFullYear(), now.getMonth(), Math.min(d, Math.max(1, now.getDate() - 1)), 10).toISOString();
  const at = new Date(Date.now() - 3600e3).toISOString();
  const accounts = [
    { id: 1001, vinted_user_id: PRO, login: 'atelier_pro_test', domain: 'www.vinted.fr', updated_at: at, created_at: at, anon_id: 'x', owner: null },
    { id: 1002, vinted_user_id: PART, login: 'perso_test', domain: 'www.vinted.fr', updated_at: at, created_at: at, anon_id: 'x', owner: null },
  ];
  const rows = [], overrides = {};
  const vente = (uid, tx, titre, prix, dVente) => ({ transaction_id: tx, title: titre, price: { amount: prix, currency_code: 'EUR' }, status: 'Commande finalisée', date: dVente, transaction_user_status: 'completed', item_id: tx + 1000000 });
  const txn = (uid, tx, prixArticle, dVers, frais) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: at, payload: { transaction: {
    id: tx, item_id: tx + 1000000, status: 450, status_title: 'Commande finalisée', status_updated_at: dVers, user_side: 'seller',
    offer: { price: { amount: prixArticle, currency_code: 'EUR' } }, service_fee: { amount: frais, currency_code: 'EUR' },
    total_amount_without_tax: { amount: (Number(prixArticle) + Number(frais)).toFixed(2), currency_code: 'EUR' } } } } });
  // Compte PRO : 60 ventes versées le mois dernier, la liste dit le prix + un écart de 0,47 € à 1,25 € (forme mesurée chez lui).
  const ventesPro = [];
  for (let i = 0; i < N_DEUX_PRIX; i++) {
    const tx = 71000000000 + i, art = 30 + (i % 25) * 2, ecart = (47 + (i * 13) % 79) / 100;
    ventesPro.push(vente(PRO, tx, `Nike Dunk inventée ${i}`, (art + ecart).toFixed(2), jourAvant(1 + (i % 25), 9)));
    rows.push(txn(PRO, tx, art.toFixed(2), jourAvant(2 + (i % 25)), (art * 0.05 + 0.7).toFixed(2)));
  }
  // Compte particulier : 30 versées le mois dernier, 8 ce mois-ci, 12 finalisées sans date de versement.
  const ventesPart = [];
  for (let i = 0; i < 30; i++) { const tx = 72000000000 + i, p = (40 + i).toFixed(2); ventesPart.push(vente(PART, tx, `Adidas Samba inventée ${i}`, p, jourAvant(1 + (i % 26), 9))); rows.push(txn(PART, tx, p, jourAvant(2 + (i % 26)), '2.70')); if (i % 3) overrides[tx] = { buyPrice: '20' }; }
  for (let i = 0; i < 8; i++) { const tx = 72100000000 + i, p = (55 + i).toFixed(2); ventesPart.push(vente(PART, tx, `Asics Gel inventée ${i}`, p, jourCe(1 + i))); rows.push(txn(PART, tx, p, jourCe(1 + i), '3.45')); }
  for (let i = 0; i < 12; i++) { const tx = 72200000000 + i; ventesPart.push(vente(PART, tx, `New Balance inventée ${i}`, (60 + i).toFixed(2), jourAvant(3 + i, 9))); }
  for (const [uid, l] of [[PRO, ventesPro], [PART, ventesPart]]) {
    rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: at, nItems: l.length, payload: { my_orders: l, pagination: { total_entries: l.length } } } });
    rows.push({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: at, nItems: 0, payload: { my_orders: [] } } });
    rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: at, nItems: 0, payload: { items: [], pagination: { total_entries: 0 } } } });
  }
  rows.push({ id: `harvest_${PRO}_profile`, data: { capturedAt: at, payload: { user: { id: Number(PRO), business: true, business_account_id: 9001 } } } });
  rows.push({ id: `harvest_${PART}_profile`, data: { capturedAt: at, payload: { user: { id: Number(PART), business: false, business_account_id: null, business_account: null } } } });
  rows.push({ id: 'lbc_ventes', data: { ventes: {} } }, { id: 'ebay_orders', data: { orders: [] } });
  const vus = { [PRO]: Date.now() - 120000, [PART]: Date.now() - 120000 };
  rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.375.0', code: '5.375.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  const a0 = '2026-11-01T10:00:00.000Z';
  const main = { vrm_bienvenue_vue: { at: a0 }, vrm_visite_vue: { at: a0 }, vrm_je_vends: { choix: 'sneakers', at: a0 }, vrm_configuration: { etat: 'fait', at: a0, statut: null, version: 1 },
    vrm_plateformes_affichees: { sites: ['vinted'], at: a0 }, vrm_parcours: { etat: 'fini', at: a0 }, vrm_bilan_minute: { vu: a0, fin: 'vu' },
    vinted_regime: 'micro', vinted_urssaf_taux: 13.4, vinted_urssaf_freq: 'mensuel', vinted_sale_overrides: overrides, vinted_accounts_hidden: [] };
  return { main: [{ id: 'main', data: main }], rows, accounts };
}

// ── La mesure, DANS la page, sur le segment montré ──
function mesurerArgent(seg) {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]'); };
  const part = document.querySelector(`[data-argent-vue="${seg}"]`);
  const out = { seg, existe: !!part };
  if (!part) return out;
  out.hauteur = Math.round(part.getBoundingClientRect().height);
  const texte = (part.innerText || '').replace(/\s+/g, ' ').trim();
  out.mots = texte ? texte.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
  // G — les groupes (data-nc-groupe) VUS et le mur d'avant : un bloc de texte vu qui énumère « N vente(s) Vinted » plus de 3 fois.
  out.groupes = [...part.querySelectorAll('[data-nc-groupe]')].filter(vis).map((g) => ({ k: g.getAttribute('data-nc-groupe'), n: Number(g.getAttribute('data-nc-n')), c: g.getAttribute('data-nc-centimes') }));
  out.murs = [];
  for (const el of part.querySelectorAll('*')) {
    if (!vis(el)) continue;
    let t = ''; for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    const k = (t.match(/\d+\s+ventes?\s+Vinted/g) || []).length;
    if (k > 3) out.murs.push(`${k}× « ${t.trim().slice(0, 60)} »`);
  }
  out.detailsOuverts = [...part.querySelectorAll('[data-nc-detail]')].filter((d) => d.open && vis(d)).length;
  out.detailsLignes = [...part.querySelectorAll('[data-nc-detail] [data-nc-vente]')].length;
  // B — le bouton « Copier »
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const rgb = (s) => { const m = String(s).match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // le fond autour : la première couleur (ou le premier arrêt d'un dégradé de fond) assez couvrante, en remontant
  const fondDe = (e) => { for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); const c = rgb(cs.backgroundColor); if (c && (c[3] == null || c[3] > 0.5)) return c; const g = (String(cs.backgroundImage).match(/rgba?\([^)]*\)/) || [])[0]; const cg = g && rgb(g); if (cg && (cg[3] == null || cg[3] > 0.5)) return cg; } return [255, 255, 255]; };
  out.copier = [...part.querySelectorAll('[data-urssaf-copier]')].filter(vis).map((b) => {
    const cs = getComputedStyle(b), bg = rgb(cs.backgroundColor), bd = rgb(cs.borderTopColor), autour = fondDe(b.parentElement);
    const fondVu = bg && (bg[3] == null || bg[3] > 0.5) ? ratio(bg.slice(0, 3), autour) : 1;
    const bordVu = parseFloat(cs.borderTopWidth) >= 1 && bd && (bd[3] == null || bd[3] > 0.5) ? ratio(bd.slice(0, 3), autour) : 1;
    return { h: Math.round(b.getBoundingClientRect().height), forme: +Math.max(fondVu, bordVu).toFixed(2) };
  });
  // L — un libellé coupé en « … » (hors rangées de liste)
  out.coupes = [...part.querySelectorAll('*')].filter(vis).filter((x) => { const c = getComputedStyle(x); return c.textOverflow === 'ellipsis' && x.scrollWidth > x.clientWidth + 1; }).map((x) => (x.textContent || '').trim().slice(0, 30));
  out.points = (texte.match(/…/g) || []).length;
  return out;
}

const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const mesures = [];

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const suf = `${W}-${th}`;
      let o;
      try {
        // L'écran Ventes publie la ligne URSSAF (comme chez lui) ; puis Argent, dans la MÊME page (navigation de l'app).
        o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: base(), url: '/?tab=cat_ventes', dsf: DSF });
        await P.pret(o.pg);
        await o.pg.waitForFunction(() => { try { const kk = Object.keys(localStorage).filter((k) => /urssaf_mois/.test(k)); const v = kk.length ? JSON.parse(localStorage.getItem(kk[0]) || 'null') : null; return !!(v && Array.isArray(v.mois) && v.mois.length); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
        if (process.env.DEBUG) console.log('DEBUG', await o.pg.evaluate(() => { const kk = Object.keys(localStorage).filter((k) => /urssaf_mois/.test(k)); const v = kk.length ? JSON.parse(localStorage.getItem(kk[0]) || 'null') : null; return kk.join(',') + ' ' + JSON.stringify(v && { nc: v.nonComptees, mois: v.mois, aDater: v.aDater && v.aDater.n }).slice(0, 1500); }));
        await o.pg.evaluate(() => { history.pushState({}, '', '/?tab=argent'); window.dispatchEvent(new PopStateEvent('popstate')); });
        await o.pg.waitForSelector('[data-argent-nav]', { timeout: 8000 }).catch(async () => { await o.pg.goto(o.pg.url().replace(/\?.*$/, '') + '?tab=argent'); });
        await o.pg.waitForSelector('[data-argent-nav]', { timeout: 20000 }).catch(() => {});
        await o.pg.waitForTimeout(1500);
        for (const seg of SEGMENTS) {
          const ici = `${seg}-${suf}`;
          await allerSegment(o.pg, seg, { attendre: 15000 });
          await o.pg.waitForTimeout(1500);
          const m = await o.pg.evaluate(mesurerArgent, seg);
          if (!m.existe) { dit(false, `${ici} : le segment est rendu`); continue; }
          await capture(o.pg, seg, path.join(SHOTS, `${ici}.png`));
          const v = await o.pg.evaluate(mesurerVerre);
          const ko = v.contraste;
          mesures.push({ ici, hauteur: m.hauteur, mots: m.mots, contrasteKo: ko.length, contrasteMin: ko.length ? Math.min(...ko.map((x) => x.k)) : null, groupes: m.groupes.length, murs: m.murs.length });
          dit(ko.length === 0, `C ${ici} : contraste AA de chaque texte, replis fermés (${v.textes} textes)`, ko.slice(0, 6).map((x) => `${x.k}<${x.seuil} « ${x.t} » (${x.c} sur ${x.f})`).join(' | '));
          if (seg === 'declarer' || seg === 'resume') {
            dit(m.murs.length === 0, `G ${ici} : aucun mur « N vente(s) Vinted · … » (plus de 3 dans un texte)`, m.murs.slice(0, 2).join(' | '));
            const dp = m.groupes.filter((g) => /deux-prix/.test(g.k));
            const somme = (() => { let c = 0; for (let i = 0; i < N_DEUX_PRIX; i++) c += (30 + (i % 25) * 2) * 100; return c; })();
            dit(dp.length >= 1 && dp.every((g) => g.n === N_DEUX_PRIX && Number(g.c) === somme), `G ${ici} : « deux prix » = UNE ligne par endroit, ${N_DEUX_PRIX} ventes, au moins ${somme / 100} €`, JSON.stringify(m.groupes).slice(0, 220));
            dit(m.detailsOuverts === 0, `G ${ici} : le détail par vente est replié`, `${m.detailsOuverts} ouvert(s)`);
          }
          if (seg === 'declarer') {
            dit(m.copier.length > 0 && m.copier.every((b) => b.h >= 44 && b.forme >= 3), `B ${ici} : « Copier » est un vrai bouton (forme ≥ 3:1, 44 px)`, JSON.stringify(m.copier));
            dit(m.coupes.length === 0, `L ${ici} : aucun libellé coupé`, m.coupes.slice(0, 4).join(' | '));
          }
          // Les replis ouverts : leur contenu aussi.
          const ouverts = await o.pg.evaluate((seg) => { const p = document.querySelector(`[data-argent-vue="${seg}"]`); let n = 0; for (const d of p.querySelectorAll('details:not([open])')) { if (d.closest('[data-nc-detail]') === d) continue; d.open = true; n++; } for (const d of p.querySelectorAll('[data-nc-detail]')) d.open = true; return n; }, seg);
          await o.pg.waitForTimeout(900);
          const v2 = await o.pg.evaluate(mesurerVerre);
          await capture(o.pg, seg, path.join(SHOTS, `${ici}-ouvert.png`));
          dit(v2.contraste.length === 0, `C ${ici} : contraste AA, ${ouverts} repli(s) ouvert(s) (${v2.textes} textes)`, v2.contraste.slice(0, 6).map((x) => `${x.k}<${x.seuil} « ${x.t} » (${x.c} sur ${x.f})`).join(' | '));
          if (seg === 'declarer' || seg === 'resume') {
            const m2 = await o.pg.evaluate(mesurerArgent, seg);
            dit(m2.murs.length === 0 && (seg !== 'declarer' || m2.detailsLignes >= N_DEUX_PRIX), `G ${ici} : ouvert, le détail est une LISTE (une ligne par vente), jamais un paragraphe`, `${m2.detailsLignes} ligne(s) · ${m2.murs.length} mur(s)`);
          }
          await o.pg.evaluate((seg) => { const p = document.querySelector(`[data-argent-vue="${seg}"]`); for (const d of p.querySelectorAll('details[open]')) d.open = false; }, seg);
        }
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log('\nMESURES ' + JSON.stringify(mesures));
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
