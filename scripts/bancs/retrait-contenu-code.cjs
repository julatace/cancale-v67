require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Banc : CE QU'IL Y A DANS LE COLIS, PAR SON CODE DE RETRAIT (27 nov., Julien : « Vas-y fais tout » — capture d'Achats →
//  À retirer : les codes 713 080 et 703 693, Vinted Go, 10 Rue du Bois Aurant, disaient « Contenu pas encore lu »).
//  Mesuré dans le code : l'e-mail du transporteur (n° de suivi, code) et l'e-mail Vinted de SA commande (conversation, MÊME code)
//  sont réunis par le code (`fusionnerParCode`, une identité) ; la réunion gardait la ligne du transporteur (`...m`) et PERDAIT
//  la conversation de la moitié Vinted : la ligne réunie ne trouvait plus son achat.
//  Base INVENTÉE (dépôt public) à la forme des lignes du banc retrait-double-code (forme mesurée le 23 nov.).
//  Jugé sur les data-* RENDUS : 713080 ⇒ l'achat A (transaction, photo, titre) ; 703693 ⇒ l'achat B ; un colis sans aucune
//  identité ⇒ « pas encore lu » et sa raison (« Pourquoi ? ») ; le TÉMOIN (§5, audit-identite) : un achat C au MÊME titre que A,
//  même point, mêmes jours, sans code ni conversation ⇒ jamais nommé ; deux conversations au même code ⇒ personne.
//  390 tactile et 1512, clair et sombre (`SHOTS=dossier`).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-retrait-contenu-code');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); } return c; };
const attendre = async (pg, f, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 86400000, H = 3600000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const RUE = '10 Rue des Essais', VILLE = 'Villeneuve-sur-Banc';
const LIEU_NOMME = `Relais Vinted Go, Droguerie du Banc, ${RUE}, 35400 ${VILLE}`;
const TITRE_A = 'Air Jordan 1 Mid Chicago Banc 42', TITRE_B = 'Asics Gel-Kayano 14 Banc 43', TITRE_D = 'New Balance 550 Banc 41';
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const conv = (tx) => `0000bbbb-0000-4000-8000-${String(tx).padStart(12, '0')}`;
const TX_A = 99500001, TX_B = 99500002, TX_C = 99500003, TX_D = 99500004, TX_E = 99500005;
function baseContenu() {
  const b = base();
  const uid = b.accounts[0].vinted_user_id;
  const my = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data.payload.my_orders;
  const achat = (tx, titre) => my.unshift({ transaction_id: tx, conversation_id: conv(tx), title: titre, price: { amount: '41.20', currency_code: 'EUR' }, status: DEPOSE,
    transaction_user_status: 'needs_action', date: iso(-9 * J), photo: { url: `https://images1.vinted.net/t/r${tx}/f800/p.jpeg` } });
  achat(TX_A, TITRE_A); achat(TX_B, TITRE_B); achat(TX_C, TITRE_A);   // C : le témoin, même titre que A
  achat(TX_D, TITRE_D); achat(TX_E, TITRE_D);                         // D et E : deux conversations au MÊME code
  // Les e-mails Vinted Go : n° de suivi, code, lieu du suivi (« <n° et rue>, <ville> »), aucune conversation.
  const vg = (suivi, code) => b.rows.push({ id: `email_track_vinted_${suivi}`, data: { type: 'suivi', carrier: 'vinted', suivi, status: 'available', statusLabel: 'Au point relais', subject: 'Ton colis Vinted Go est arrivé',
    receivedAt: iso(-6 * H), emailAt: iso(-6 * H), arriveLe: iso(-6 * H), code, code2: null, lieu: `${RUE}, ${VILLE}`, limite: jourParis(Date.now() + 5 * J), consigne: false, account: '' } });
  vg('1792000000000301', '713080'); vg('1792000000000302', '703693'); vg('1792000000000303', '555777'); vg('1792000000000304', '246810');
  // Les e-mails Vinted de LEUR commande (conversation = identité), au MÊME code ; aucun pour 555777 ni pour C.
  const moitie = (tx, code) => b.rows.push({ id: `email_track_autre_conv-${conv(tx)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: 'Commande mise à jour',
    receivedAt: iso(-5 * H), emailAt: iso(-5 * H), arriveLe: iso(-5 * H), code, lieu: LIEU_NOMME, limite: null, consigne: false, conv: conv(tx), source: 'vinted-commande', cleLigne: `email_track_autre_conv-${conv(tx)}`, account: b.accounts[0].login } });
  moitie(TX_A, '713 080'); moitie(TX_B, '703693'); moitie(TX_D, '246810'); moitie(TX_E, '246810');
  return b;
}
const releve = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0;
  return [...document.querySelectorAll('[data-rp-colis]')].filter(vis).map((li) => {
    const c = li.querySelector('[data-rp-contenu]'), v = li.querySelector('[data-rp-photo]'), t = li.querySelector('[data-rp-titre]'), pl = li.querySelector('[data-rp-pas-lu]');
    return { cle: li.getAttribute('data-rp-colis') || '', code: String(li.getAttribute('data-rp-code') || li.getAttribute('data-v2-code') || '').replace(/\s+/g, ''),
      contenu: c ? c.getAttribute('data-rp-contenu') : '', tx: c ? (c.getAttribute('data-rp-contenu-tx') || '') : '', photo: v ? v.getAttribute('data-rp-photo') : '', src: v ? (v.getAttribute('data-rp-photo-src') || '') : '',
      titre: t ? t.textContent.trim() : '', pasLu: !!pl, raison: pl ? pl.getAttribute('data-v2-contenu-raison') : null, pourquoi: !!li.querySelector('[data-rp-pas-lu-pourquoi]') };
  });
};

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  try {
    for (const W of [390, 1512]) for (const th of ['clair', 'sombre']) {
      const nom = `${W}-${th}`;
      console.log(`\n── 713 080 / 703 693 : ce qu'il y a dedans · ${nom}`);
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', b: baseContenu(), url: '/?tab=achats', dsf: 2 });
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {} });
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(pg, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 3);
      await pg.waitForTimeout(2000);
      const r = await pg.evaluate(releve);
      const de = (code) => r.filter((x) => x.code === code);
      const a = de('713080'), bb = de('703693'), z = de('555777');
      dit(a.length === 1 && bb.length === 1 && z.length === 1, `${nom} : une rangée par code`, r.map((x) => x.code + ':' + x.contenu));
      const A = a[0] || {}, B = bb[0] || {}, Z = z[0] || {};
      dit(A.contenu === 'relie' && A.tx === String(TX_A), `${nom} : 713 080 ⇒ l'achat de SA conversation (transaction ${TX_A})`, A);
      dit(A.photo === '1' && A.src.includes(`r${TX_A}`), `${nom} : 713 080 montre la PHOTO de cet achat`, A);
      dit(A.titre === TITRE_A && !A.pasLu, `${nom} : 713 080 montre le TITRE de cet achat, plus « pas encore lu »`, A);
      dit(B.contenu === 'relie' && B.tx === String(TX_B) && B.src.includes(`r${TX_B}`) && B.titre === TITRE_B, `${nom} : 703 693 ⇒ l'achat B, sa photo et son titre`, B);
      dit(Z.contenu === 'pas-lu' && Z.pasLu && Z.raison !== null && Z.pourquoi && !Z.tx, `${nom} : un colis sans identité reste « pas encore lu », la raison sous « Pourquoi ? »`, Z);
      dit(!r.some((x) => x.tx === String(TX_C) || x.src.includes(`r${TX_C}`)), `${nom} : le témoin (même titre que A, sans code ni conversation) n'est jamais nommé`, r.map((x) => x.tx));
      const dd = de('246810');
      dit(dd.length >= 1 && dd.every((x) => !x.tx), `${nom} : deux conversations au MÊME code ⇒ le colis du transporteur n'est pas attribué à l'une d'elles`, dd);
      const el = await pg.$('[data-rp-colis]');
      if (el) { await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `contenu-code-${nom}.png`), fullPage: false }).catch(() => {}); }
      dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
