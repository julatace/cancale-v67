// ════════════════════════════════════════════════════════════════════════════
//  BANC « Sécurité des ventes » (15 nov., lot securite-ventes) — récit : docs/passation/2026-11-15-securite-ventes.md
//  Base INVENTÉE au volume de Julien (_base-messages-stock.cjs : 1 000 paires, 1 000 conversations, 3 comptes) +
//  Leboncoin relié, 7 ventes Vestiaire aux frais lus, profils Vinted lus « particulier », un objectif du mois.
//  Garde réseau : rien ne sort. 390 tactile ET 1512, clair ET sombre. Jugé sur la RÈGLE (data-*, nombres rendus) :
//   A  Messages : la conversation où l'acheteur écrit « I have already paid, check your email » porte UNE bannière
//      « Attention » (motif fauxPaiement), ambre — jamais rouge —, le texte lisible, aucun débordement ; une
//      conversation normale (« Je vous propose 45 € livraison comprise ») n'en porte aucune.
//   B  Fiche N°1205 : « Où vendre ? » — Vinted (particulier lu) touche le prix de l'annonce, Leboncoin aussi (ex æquo,
//      les deux « le plus »), Vestiaire ≈ prix − la commission moyenne LUE de ses 7 ventes (recalculée ici au centime),
//      eBay « pas relié » grisé et jamais « le plus » ; le prix retapé (120) recalcule tout ; cibles 44 px.
//   C  Ma journée : l'ANNEAU (pas la barre) — le centre dit la part du data-*, « encore … · ≈ … par jour jusqu’au … »,
//      le reste et le rythme = recalculés ici depuis la cible et la valeur rendues ; touché ⇒ le réglage.
//   D  Partout : un plein au plus, rien ne déborde, aucune erreur de page.
//  `VUES=390-clair,1512-sombre` pour un sous-ensemble ; `SHOTS=<dossier>` ; `DSF=2` (captures pour Julien).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');

const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-securite-ventes');
const VUES = process.env.VUES ? process.env.VUES.split(',') : null;
const DSF = Number(process.env.DSF || 1);   // (appliqué au 390 seulement : une capture 1512 à ×2 dépasse le temps d'une machine chargée)
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };

const ARNAQUE = 'I have already paid, check your email';
// 7 ventes Vestiaire aux frais lus (prix affiché `sellerPrice`, versé `sellerEarning`) — inventées.
const VC = Array.from({ length: 7 }, (_, i) => { const cPrix = 12000 + i * 3100, cFrais = Math.floor(cPrix * (0.15 + (i % 3) * 0.02)); return { id: String(91000000 + i), cPrix, cFrais }; });
function base() {
  const b = B.baseVolume();
  for (const r of b.rows) if (/_profile$/.test(r.id) && r.data.payload && r.data.payload.user) r.data.payload.user.business = false;
  // La conversation la plus récente (compte 1) : l'acheteur écrit le faux « j'ai payé, vérifie ton mail ».
  const c0 = b.rows.find((r) => /_conv_51000000000$/.test(r.id));
  const ms = c0.data.payload.conversation.messages; ms[ms.length - 1].entity.body = ARNAQUE;
  const inb = b.rows.find((r) => r.id === `harvest_${b.accounts[0].vinted_user_id}_inbox`);
  inb.data.payload.conversations[0].description = ARNAQUE;
  b.rows.push({ id: 'lbc_listings', data: { v: 1, items: {}, capturedAt: new Date().toISOString() } });
  b.rows.push({ id: 'vc_session', data: { v: 1, comptes: {} } });
  b.rows.push({ id: 'vc_listings', data: { liens: {}, items: {} } });
  b.rows.push({ id: 'vc_ventes', data: { ventes: Object.fromEntries(VC.map((v, i) => [v.id, { etat: 'Paiement envoyé', date: `2026-10-${String(2 + i * 3).padStart(2, '0')}T10:00:00Z`,
    montant: { valeur: (v.cPrix - v.cFrais) / 100, devise: 'EUR', cle: 'sellerEarning' }, prixVente: { valeur: v.cPrix / 100, devise: 'EUR', cle: 'sellerPrice' } }])) } });
  b.main[0].data.vrm_objectif_mois = { v: 1, type: 'ca', valeur: 9000, cache: {}, parMois: { '2026-11': { type: 'ca', valeur: 9000 } } };
  return b;
}
const pleins = (pg) => pg.evaluate(() => [...document.querySelectorAll('.sb-btn-plein')].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && !el.closest('[inert]'); }).length);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
// Une couleur rouge (le rouge est réservé aux doublons de N°) : teinte < 15° ou > 340°, saturée.
const ROUGE = `(c) => { const m = String(c).match(/\\d+(\\.\\d+)?/g); if (!m) return false; const [r, g, b] = m.map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40) return false; let h; if (mx === r) h = ((g - b) / (mx - mn)) * 60; else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60; else h = (4 + (r - g) / (mx - mn)) * 60; h = (h + 360) % 360; return h < 15 || h > 340; }`;

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const [W, th] of [[390, 'clair'], [390, 'sombre'], [1512, 'clair'], [1512, 'sombre']]) {
      const nom = `${W}-${th}`;
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const sombre = th === 'sombre';

      // ── A. Messages ──
      await essaie(`A ${nom}`, async () => {
        const o = await P.ouvrir(nav, { W, sombre, b: base(), url: '/?tab=messages&site=vinted', api: B.apiVolume, dsf: W < 600 ? DSF : 1 });
        try {
          await P.pret(o.pg);
          await o.pg.waitForSelector('[data-conv="51000000000"]', { timeout: 20000 });
          await o.pg.locator('[data-conv="51000000000"]').first().click();
          const ban = await o.pg.waitForSelector('[data-arnaque]', { timeout: 15000 }).catch(() => null);
          await o.pg.waitForTimeout(600);
          const i = ban ? await ban.evaluate((x, R) => { const rouge = eval(R); const cs = getComputedStyle(x); const txt = x.querySelector('[data-arnaque-phrase]');
            const r = x.getBoundingClientRect(); const ic = x.querySelector('svg'); return { m: x.getAttribute('data-arnaque'), t: (txt && txt.innerText) || '', fond: cs.backgroundColor, ombre: cs.boxShadow, rouge: rouge(cs.backgroundColor) || rouge(cs.color) || rouge(ic ? getComputedStyle(ic).stroke || ic.getAttribute('stroke') : ''),
              phrases: txt ? txt.querySelectorAll('[data-arnaque-phrase]').length + 1 : 0, l: Math.round(r.left), rr: Math.round(r.right), w: innerWidth }; }, ROUGE) : null;
          dit(i && i.m === 'fauxPaiement' && /Attention/.test(i.t) && /Vinted/.test(i.t) && /N’envoie rien|n’envoie rien/i.test(i.t), 'A · « I have already paid, check your email » ⇒ UNE bannière « Attention », le risque et le geste, Vinted nommé', JSON.stringify(i && { m: i.m, t: i.t }));
          dit(i && !i.rouge && i.l >= 0 && i.rr <= i.w, 'A · bannière ambre, jamais rouge ; dans l’écran', JSON.stringify(i && { fond: i.fond, rouge: i.rouge, l: i.l, r: i.rr }));
          if (ban) await ban.screenshot({ path: path.join(SHOTS, `arnaque-banniere-${nom}.png`) }).catch(() => {});
          await o.pg.screenshot({ path: path.join(SHOTS, `arnaque-fil-${nom}.png`), timeout: 90000 }).catch((e) => console.log('   (capture manquée : ' + String(e.message).slice(0, 60) + ')'));
          dit(await deborde(o.pg) <= 1, 'A · rien ne déborde', String(await deborde(o.pg)));
          // une conversation normale (i = 2 : « Je vous propose 45 € livraison comprise »)
          if (W < 600) { await o.pg.locator('.vrm-chat-panel .vrm-chat-back').first().click().catch(() => {}); await o.pg.waitForTimeout(700); }
          const autre = o.pg.locator('[data-conv="51000000002"]').first();
          if (await autre.count()) {
            await autre.click(); await o.pg.waitForTimeout(1500);
            const n = await o.pg.$$eval('.vrm-chat-panel [data-arnaque]', (l) => l.length);
            dit(n === 0, 'A · une conversation normale (« Je vous propose 45 € livraison comprise ») : aucune bannière', String(n));
          } else dit(false, 'A · la conversation normale est dans la liste');
          dit(!o.erreurs.length, 'A · aucune erreur de page', o.erreurs.join(' | '));
        } finally { await o.ctx.close().catch(() => {}); }
      });

      // ── B. Fiche N°1205 : « Où vendre ? » ──
      await essaie(`B ${nom}`, async () => {
        const o = await P.ouvrir(nav, { W, sombre, b: base(), url: '/?tab=journee', api: B.apiVolume, dsf: W < 600 ? DSF : 1 });
        try {
          await P.pret(o.pg);
          await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
          // (16 nov., intégration vague B) Fiche D : « Où vendre ? » est rangé avec les infos de la paire, derrière « ⋯ » →
          // « Tout voir » (la fiche tient en un écran) : on l'ouvre, le même chemin que lui.
          await o.pg.waitForSelector('.vrm-fp [data-fd-plus-ouvrir]', { timeout: 20000 }).catch(() => {});
          await o.pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
          await o.pg.waitForTimeout(300);
          await o.pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
          await o.pg.waitForTimeout(500);
          await o.pg.locator('[data-ou-vendre]').first().scrollIntoViewIfNeeded().catch(() => {});
          await o.pg.waitForSelector('[data-ou-vendre]', { timeout: 20000 });
          await o.pg.waitForFunction(() => { const v = document.querySelector('[data-ou-vendre-site="vinted"]'); return v && v.getAttribute('data-ou-vendre-etat') !== 'inconnu'; }, null, { timeout: 12000 }).catch(() => {});
          await o.pg.waitForTimeout(500);
          const lire = () => o.pg.evaluate(() => { const s = document.querySelector('[data-ou-vendre]'); const l = {};
            for (const x of s.querySelectorAll('[data-ou-vendre-site]')) { const r = x.getBoundingClientRect(); l[x.getAttribute('data-ou-vendre-site')] = { e: x.getAttribute('data-ou-vendre-etat'), t: x.getAttribute('data-ou-vendre-touche'), m: x.hasAttribute('data-ou-vendre-meilleur'), h: Math.round(r.height), op: Number(getComputedStyle(x).opacity), txt: x.innerText.replace(/\n/g, ' · ') }; }
            const ch = s.querySelector('[data-ou-vendre-saisie]'); const rc = ch.closest('label').getBoundingClientRect();
            return { prix: s.getAttribute('data-ou-vendre-prix'), meilleurs: s.getAttribute('data-ou-vendre-meilleurs'), l, champ: Math.round(rc.height), droite: Math.round(s.getBoundingClientRect().right), w: innerWidth }; });
          const a = await lire();
          const p = Number(a.prix);
          // Vestiaire : la commission moyenne de SES 7 ventes, recalculée ici
          const sP = VC.reduce((t, v) => t + v.cPrix, 0), sF = VC.reduce((t, v) => t + v.cFrais, 0);
          const vcAttendu = (c) => c - Math.ceil((c * sF) / sP - 1e-9);
          dit(p === 6500, 'B · le prix de départ = celui de l’annonce N°1205 (65 €)', a.prix);
          dit(a.l.vinted && a.l.vinted.e === 'connu' && Number(a.l.vinted.t) === p && a.l.leboncoin.e === 'connu' && Number(a.l.leboncoin.t) === p, 'B · Vinted (particulier lu) et Leboncoin : il touche le prix', JSON.stringify({ v: a.l.vinted, l: a.l.leboncoin }));
          dit(a.l.vestiaire && a.l.vestiaire.e === 'estime' && Number(a.l.vestiaire.t) === vcAttendu(p) && /≈/.test(a.l.vestiaire.txt) && /7 dernières ventes/.test(a.l.vestiaire.txt), `B · Vestiaire ≈ ${vcAttendu(p) / 100} € (commission moyenne LUE de ses 7 ventes)`, JSON.stringify(a.l.vestiaire));
          dit(a.l.ebay && a.l.ebay.e === 'pasRelie' && !a.l.ebay.m && a.l.ebay.op < 0.8 && /pas relié/.test(a.l.ebay.txt), 'B · eBay sans compte relié : grisé « pas relié », jamais « le plus »', JSON.stringify(a.l.ebay));
          dit(a.meilleurs === 'vinted,leboncoin' && a.l.vinted.m && a.l.leboncoin.m && !a.l.vestiaire.m, 'B · le plus haut mis en avant (ex æquo : les deux)', a.meilleurs);
          dit(Object.values(a.l).every((x) => x.h >= 44) && a.champ >= 44, 'B · rangées et champ du prix : 44 px au moins', JSON.stringify({ h: Object.fromEntries(Object.entries(a.l).map(([k, x]) => [k, x.h])), champ: a.champ }));
          const sec = await o.pg.$('[data-ou-vendre]');
          await sec.scrollIntoViewIfNeeded().catch(() => {});
          await o.pg.waitForTimeout(300);
          await sec.screenshot({ path: path.join(SHOTS, `ou-vendre-${nom}.png`) }).catch(() => {});
          await o.pg.screenshot({ path: path.join(SHOTS, `fiche-ou-vendre-${nom}.png`), timeout: 90000 }).catch((e) => console.log('   (capture manquée : ' + String(e.message).slice(0, 60) + ')'));
          const ch = o.pg.locator('[data-ou-vendre-saisie]').first();
          await ch.fill('120');
          await o.pg.waitForTimeout(300);
          const b2 = await lire();
          dit(Number(b2.prix) === 12000 && Number(b2.l.vinted.t) === 12000 && Number(b2.l.vestiaire.t) === vcAttendu(12000), 'B · prix retapé « 120 » ⇒ tout recalculé (Vinted 120 €, Vestiaire ≈ ' + vcAttendu(12000) / 100 + ' €)', JSON.stringify({ p: b2.prix, v: b2.l.vinted.t, vc: b2.l.vestiaire.t }));
          await ch.fill('2k'); await o.pg.waitForTimeout(250);
          const b3 = await lire();
          dit(b3.prix === '' && !b3.meilleurs && ['vinted', 'leboncoin', 'vestiaire'].every((k) => b3.l[k].t === '' && /—/.test(b3.l[k].txt)), 'B · prix illisible (« 2k ») ⇒ « — », aucun meilleur, rien d’inventé', JSON.stringify(b3.l.vinted));
          dit(await deborde(o.pg) <= 1 && a.droite <= a.w, 'B · rien ne déborde', String(await deborde(o.pg)));
          dit(!o.erreurs.length, 'B · aucune erreur de page', o.erreurs.join(' | '));
        } finally { await o.ctx.close().catch(() => {}); }
      });

      // ── C. Ma journée : l'anneau ──
      await essaie(`C ${nom}`, async () => {
        const o = await P.ouvrir(nav, { W, sombre, b: base(), url: '/?tab=journee', api: B.apiVolume, dsf: W < 600 ? DSF : 1 });
        try {
          await P.pret(o.pg);
          const an = await o.pg.waitForSelector('[data-objectif-anneau]', { timeout: 20000 }).catch(() => null);
          const barre = await o.pg.$$eval('[data-carte-stats="journee"] .vrm-fu-objectif-piste', (l) => l.length).catch(() => 0);
          dit(!!an && barre === 0, 'C · Ma journée montre l’ANNEAU (plus la barre fine)', `anneau ${!!an}, barres ${barre}`);
          if (!an) return;
          await an.scrollIntoViewIfNeeded().catch(() => {});
          await o.pg.waitForTimeout(500);
          const x = await an.evaluate((e) => { const g = (k) => e.getAttribute('data-objectif' + k); const r = e.getBoundingClientRect();
            return { cible: g('-cible'), valeur: g('-valeur'), pct: g('-pct'), reste: g('-reste'), parJour: g('-par-jour'), jours: g('-jours'), centre: (e.querySelector('[data-objectif-centre]') || {}).textContent || '', phrase: (e.querySelector('[data-objectif-phrase]') || {}).textContent || '', titre: (e.querySelector('[data-objectif-tete]') || {}).textContent || '', h: Math.round(r.height), bouton: e.tagName === 'BUTTON' }; });
          const c = Number(x.cible), v = x.valeur === '' ? null : Number(x.valeur);
          dit(c === 900000, 'C · la cible est le réglage (9 000 € vendus)', x.cible);
          if (v == null) dit(x.centre === '—' && !/0\s?%/.test(x.centre), 'C · vendu pas su ⇒ « — », jamais « 0 % »', JSON.stringify(x));
          else {
            const pct = Math.max(0, Math.min(100, Math.floor((v / c) * 100)));
            dit(Number(x.pct) === pct && x.centre.replace(/\s/g, ' ').trim() === `${pct} %`, `C · le centre dit la part : ${pct} % (${v / 100} € sur ${c / 100} €)`, JSON.stringify({ pct: x.pct, centre: x.centre }));
            const reste = c - v, jours = Number(x.jours), pj = Math.ceil(reste / 100 / jours - 1e-9) * 100;
            dit(Number(x.reste) === reste && Number(x.parJour) === pj && /^encore .+ · ≈ .+ par jour jusqu’au \d{1,2} nov\.$/.test(x.phrase.replace(/\s/g, ' ')), `C · « encore ${reste / 100} € · ≈ ${pj / 100} € par jour jusqu’au … »`, JSON.stringify({ reste: x.reste, parJour: x.parJour, jours: x.jours, phrase: x.phrase }));
          }
          dit(x.bouton && x.h >= 44, 'C · l’anneau se touche (44 px) et ouvre le réglage', JSON.stringify({ bouton: x.bouton, h: x.h }));
          // Rien ne se chevauche, rien n'est rogné : l'anneau ne couvre aucune case du mois (vu le 15 nov. à 1512 : il couvrait
          // « Reçu ») et il tient dans sa tuile.
          const geo = await an.evaluate((e) => { const r = e.getBoundingClientRect(); const t = (e.closest('.sb-tuile') || e.closest('[data-carte-stats]') || e).getBoundingClientRect();
            const sur = [...document.querySelectorAll('[data-carte-stats="journee"] .vrm-fu-case')].filter((c) => { const q = c.getBoundingClientRect(); return q.width > 2 && q.right > r.left + 1 && q.left < r.right - 1 && q.bottom > r.top + 1 && q.top < r.bottom - 1; }).map((c) => c.getAttribute('data-fu-case'));
            return { sur, dedans: r.left >= t.left - 0.5 && r.right <= t.right + 0.5 && r.top >= t.top - 0.5 && r.bottom <= t.bottom + 0.5 }; });
          dit(!geo.sur.length && geo.dedans, 'C · l’anneau ne couvre aucune case et tient dans sa tuile', JSON.stringify(geo));
          // La tuile du mois entière (l'anneau dans son contexte), découpée dans l'écran après défilement.
          await an.evaluate((e) => (e.closest('.sb-tuile') || e.closest('[data-carte-stats]') || e).scrollIntoView({ block: 'center', behavior: 'instant' }));
          await o.pg.waitForTimeout(700);
          const clip = await an.evaluate((e) => { const r = (e.closest('.sb-tuile') || e.closest('[data-carte-stats]') || e).getBoundingClientRect();
            return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(innerWidth - Math.max(0, r.left - 8), r.width + 16), height: Math.min(innerHeight - Math.max(0, r.top - 8), r.height + 16) }; });
          await o.pg.screenshot({ path: path.join(SHOTS, `anneau-${nom}.png`), clip, timeout: 90000 }).catch(() => {});
          await o.pg.screenshot({ path: path.join(SHOTS, `journee-anneau-${nom}.png`), timeout: 90000 }).catch((e) => console.log('   (capture manquée : ' + String(e.message).slice(0, 60) + ')'));
          dit(await pleins(o.pg) <= 1, 'D · Ma journée : un plein au plus', String(await pleins(o.pg)));
          dit(await deborde(o.pg) <= 1, 'D · Ma journée : rien ne déborde', String(await deborde(o.pg)));
          await an.click();
          const f = await o.pg.waitForSelector('[data-carte-objectif]', { timeout: 8000 }).catch(() => null);
          dit(!!f, 'C · toucher l’anneau ouvre « Objectif » (le réglage, désactivable par « Retirer » dans Argent)');
          dit(!o.erreurs.length, 'C · aucune erreur de page', o.erreurs.join(' | '));
        } finally { await o.ctx.close().catch(() => {}); }
      });
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} securite-ventes : ${ko} rouge(s), ${ok} vert(s) (captures : ${SHOTS})`);
  process.exit(ko ? 1 : 0);
})();
