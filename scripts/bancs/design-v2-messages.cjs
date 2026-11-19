require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES ET E-MAILS, NOUVEAU DESIGN (17 nov.) — src/designV2/LigneConversation.jsx, la boîte e-mails allumée
//  (src/BoiteEmails.jsx), la règle `groupesParCompte` (src/designV2/messagesV2.js) et l'audit A8 (la confirmation
//  partagée en très grand texte).
//
//  Base INVENTÉE (`_base-messages-stock.cjs` : 1 000 conversations sur 3 comptes, 1 000 e-mails dans la forme de la
//  route) + 3 e-mails « à vérifier » et 2 e-mails mis de côté (« à rattacher »). Garde réseau : rien ne sort.
//  Formats : 390 tactile clair ET sombre, 375 × 667 en « Très grand » texte (`vrm_taille_texte`), 1512 clair.
//  Mesure, allumé :
//    M1. les COMPTES SÉPARÉS (CLAUDE.md §3, 12 nov.) : un groupe par compte, jamais deux comptes dans un groupe, un
//        compte jamais dans deux groupes, du plus récent au plus ancien DANS chaque groupe, les groupes dans l'ordre de
//        leur conversation la plus récente — comparé à la BASE (pas à l'écran) ; et la règle pure : le compte de
//        l'onglet d'abord, puis chaque autre compte ;
//    M2. au plus 1 bouton plein ; M3. cibles ≥ 44 ; M4. rien de tronqué sans « … » (et le nom de groupe entier) ;
//    M5. l'AIR : rangée ≥ 64, texte à ≥ 20 px du bord de sa carte, 32 entre deux groupes, 12 du titre à la carte,
//        ≥ 12 entre deux boutons voisins ; M6. CLS du chargement = 0 (à 0,001 près) ;
//    E1. les nombres des segments de la boîte = ceux que la ROUTE compte (même réponse) — (19 nov., lot emails-mail)
//        l'écran E-mails n'a plus de version « éteinte » : la référence d'hier (les pastilles) n'existe plus ;
//    E2. chaque segment montre les e-mails de SA rubrique ; « À traiter » = les « à vérifier » (3), jamais cachés ;
//    E3. une rangée reliée par identité porte l'étiquette N° LUE dans l'e-mail ; un code se copie ; (19 nov.) le geste
//        est dans la LECTURE (« Ce que VRM a compris »), plus un bouton par rangée — jamais deux gestes dans une rangée ;
//    E4. « Ranger » (glisser à gauche) : l'e-mail reste, replié dans « Rangés », les nombres ne bougent pas ;
//    E5. les e-mails à rattacher : une section calme, « C'est à moi » rejoue le BON e-mail (POST de SON id) ;
//    A8. la confirmation partagée en très grand texte : le plein lisible en entier, au-dessus de « Annuler ».
//  Éteint : la signature DOM de Messages (seulement : E-mails n'a plus qu'un dessin depuis le 19 nov.) = celle du même banc lancé sur le build d'avant
//  (`SIGNATURE_AVANT=…/signature-eteint.json`, écrite par chaque passage dans SHOTS).
//  `MUTATION=melange` (groupes mélangés), `MUTATION=ordre` (ordre inversé dans un groupe), `MUTATION=air` (rangée
//  serrée) : la preuve que les contrôles rougissent. Chemins déduits de __dirname.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2-messages');
fs.mkdirSync(SHOTS, { recursive: true });
const SIG_AVANT = process.env.SIGNATURE_AVANT || '';
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

// ── La base : les conversations (3 comptes) et la route des e-mails, plus « à vérifier » et « à rattacher » ──
const AVERIF = new Set([B.EMAILS[20].id, B.EMAILS[41].id, B.EMAILS[62].id]);
for (const e of B.EMAILS) if (AVERIF.has(e.id)) e.etat = 'a-verifier';
const QUARANTAINE = [{ id: 'email_reception_q1' + 'f'.repeat(60), sujet: 'Ton colis est disponible au relais', raison: 'adresse non déclarée', at: new Date().toISOString() },
  { id: 'email_reception_q2' + 'f'.repeat(60), sujet: 'Bordereau d’envoi', raison: 'adresse non déclarée', at: new Date().toISOString() }];
const posts = [];
function api(u, req) {
  const url = new URL(u);
  if (url.pathname === '/api/email-rattacher' && url.searchParams.get('mode') === 'liste') return { ok: true, emails: QUARANTAINE };
  if (url.pathname === '/api/email-rattacher' && req && req.method() === 'POST' && !url.searchParams.get('mode')) { try { posts.push(JSON.parse(req.postData() || '{}')); } catch (_) {} return { ok: true }; }
  const r = B.apiVolume(u);
  if (r && url.searchParams.get('mode') === 'journal' && !url.searchParams.get('lire')) {
    const nV = B.EMAILS.filter((e) => AVERIF.has(e.id)).length;
    if (url.searchParams.get('etat') === 'a-verifier') { const l = B.EMAILS.filter((e) => AVERIF.has(e.id)); return { ...r, suite: false, emails: l, compteurs: { ...r.compteurs, sur: l.length, aVerifier: l.length } }; }
    return { ...r, compteurs: { ...r.compteurs, aVerifier: nV } };
  }
  return r;
}
const base = () => B.baseVolume();

// L'ordre ATTENDU, tiré de la base (jamais de l'écran) : par compte, du plus récent au plus ancien ; les comptes par
// leur conversation la plus récente.
function attendu(b) {
  const g = new Map();
  for (const r of b.rows) { const m = /^harvest_(\d+)_inbox$/.exec(r.id); if (!m) continue; g.set(m[1], r.data.payload.conversations.map((c) => ({ id: String(c.id), t: Date.parse(c.updated_at) })).sort((x, y) => y.t - x.t)); }
  return [...g.entries()].map(([uid, l]) => ({ uid, ids: l.map((x) => x.id), dernier: l[0].t })).sort((a, b2) => b2.dernier - a.dernier);
}

const SIGNATURE = () => { const m = document.querySelector('.vrm-main'); if (!m) return null; const out = [];
  const pas = (e, d) => { if (d > 60 || e.matches('.vrm-fraicheur-hote, [data-temps-reel-neuf], [data-fraicheur-unique], [data-geste-disque]')) return;
    // Les jours de la boîte suivent l'HEURE du passage (« Aujourd'hui » / « Hier »), pas le code : les rangées sont relevées
    // à plat, sans leur coupure par jour.
    if (e.matches('.vrm-boite-jour')) { for (const li of e.querySelectorAll(':scope > ul > *')) pas(li, d); return; } const cl = [...e.classList].sort().join('.'); const da = [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') && !/^data-(sb-|v2|vu$|appui)/.test(n)).sort().join(',');
    out.push(d + ':' + e.tagName + (cl ? '.' + cl : '') + (da ? '[' + da + ']' : '')); for (const c of e.children) pas(c, d + 1); };
  pas(m, 0); return out; };
async function signatureStable(pg) {
  await pg.waitForTimeout(2500); let avant = null, egaux = 0;
  for (let k = 0; k < 16; k++) { const s = await pg.evaluate((f) => eval('(' + f + ')')(), SIGNATURE.toString()); if (avant && JSON.stringify(s) === JSON.stringify(avant)) { if (++egaux >= 2) return s; } else egaux = 0; avant = s; await pg.waitForTimeout(1200); }
  return avant;
}
// La pastille « Mis à jour à … » (coque) ne se pose jamais sur le grand titre.
const PASTILLE = () => { const p = document.querySelector('.vrm-neuf'), h = document.querySelector('.vrm-main h1'); if (!p || !h || !p.getClientRects().length) return { vue: false };
  const a = p.getBoundingClientRect(), b = h.getBoundingClientRect(); return { vue: true, sur: !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) }; };
const sansToasts = async (pg) => { await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(300); };

// Les mesures communes d'une zone allumée (cibles, tronqués, pleins, AIR des cartes).
const MESURE = (sel) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight * 3; };
  const zones = [...document.querySelectorAll(sel)].filter(vis);
  const out = { zones: zones.length, petites: [], tronques: [], pleins: 0, air: [], voisins: [] };
  out.pleins = [...document.querySelectorAll('.v2b-principal, .vrm-b-primaire')].filter((b) => vis(b) && !b.closest('.vrm-fs, [role="dialog"]')).length;
  for (const z of zones) {
    for (const b of z.querySelectorAll('button, a[href], input, select, [role="tab"], [role="radio"]')) {
      if (!vis(b) || b.closest('[hidden]')) continue; const r = b.getBoundingClientRect();
      const c = b.closest('label') || b; const rc = c.getBoundingClientRect();
      if (Math.round(rc.height) < 44 || Math.round(rc.width) < 44) out.petites.push({ quoi: (b.getAttribute('aria-label') || b.textContent || b.tagName).trim().slice(0, 40), h: Math.round(rc.height), w: Math.round(rc.width) });
      void r;
    }
    for (const e of z.querySelectorAll('*')) {
      if (!vis(e) || e.children.length > 3) continue; const cs = getComputedStyle(e);
      if (!e.textContent.trim()) continue;
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      if (cs.overflow !== 'visible' && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !clamp && e.clientWidth > 2 && !e.matches('img, svg, input, .v2m-av, .v2m-carte, .v2e-carte, .v2-seg, .vrm-rangee, ul, ol'))
        out.tronques.push({ quoi: e.textContent.trim().slice(0, 40), cl: String(e.className).slice(0, 40), de: e.scrollWidth, dans: e.clientWidth });
    }
  }
  // Un MOT coupé au milieu (une colonne écrasée écrit « C / o / l ») : chaque mot de ≥ 3 lettres tient sur une ligne.
  out.coupes = [];
  for (const z of zones) { const w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode()) && out.coupes.length < 8) { const el = n.parentElement; if (!el || !vis(el) || el.closest('.vrm-sr, .vrm-sr-seul, .vrm-boite-sr')) continue; const r0 = el.getBoundingClientRect(); if (r0.top > innerHeight * 2) continue;
      const re = /[\p{L}\p{N}]{3,20}/gu; let m; while ((m = re.exec(n.data))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        const tops = [...rg.getClientRects()].filter((x) => x.width > .5).map((x) => Math.round(x.top)); if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 3) { out.coupes.push(m[0]); break; } } } }
  // AIR : chaque rangée ≥ 64, son texte à ≥ 20 px des bords de SA carte.
  for (const l of document.querySelectorAll('.v2m-carte > .v2m-ligne, .v2e-carte > .v2e-q-ligne')) {
    if (!vis(l)) continue; const r = l.getBoundingClientRect(); const carte = l.parentElement.getBoundingClientRect();
    if (r.height < 63.5) out.air.push({ k: 'rangee', h: Math.round(r.height) });
    const txt = l.querySelector('.v2m-txt, .v2e-q-txt'); if (txt) { const t = txt.getBoundingClientRect(); if (carte.right - t.right < 19.5) out.air.push({ k: 'bord-droit', d: Math.round(carte.right - t.right) }); }
    const av = l.querySelector('.v2m-av'); if (av) { const a = av.getBoundingClientRect(); if (a.left - carte.left < 19.5) out.air.push({ k: 'bord-gauche', d: Math.round(a.left - carte.left) }); }
  }
  const gs = [...document.querySelectorAll('.v2m-groupe')].filter(vis);
  for (let i = 1; i < gs.length; i++) { const d = gs[i].getBoundingClientRect().top - gs[i - 1].getBoundingClientRect().bottom; if (d < 31.5) out.air.push({ k: 'entre-groupes', d: Math.round(d) }); }
  for (const g of gs) { const t = g.querySelector('.v2m-groupe-titre'), c = g.querySelector('.v2m-carte'); if (t && c) { const d = c.getBoundingClientRect().top - t.getBoundingClientRect().bottom; if (d < 11.5) out.air.push({ k: 'titre-carte', d: Math.round(d) }); }
    const n = g.querySelector('.v2m-groupe-nom'); if (n && n.scrollWidth > n.clientWidth + 1) out.tronques.push({ quoi: 'nom de groupe ' + n.textContent, de: n.scrollWidth, dans: n.clientWidth }); }
  // Deux boutons voisins sur une même ligne : ≥ 12 px.
  for (const o of document.querySelectorAll('.v2m-outils')) { const k = [...o.children].filter(vis).map((x) => x.getBoundingClientRect()); for (let i = 1; i < k.length; i++) { const d = k[i].left - k[i - 1].right; if (Math.abs(k[i].top - k[i - 1].top) < 20 && d < 11.5) out.voisins.push(Math.round(d)); } }
  return out;
};

async function ouvrirEcran(nav, { W, sombre, url, grand = false, v2 = true }) {
  const b = base();
  const o = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url, api, dsf: W < 600 ? 2 : 1 });
  const { pg } = o;
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(1200);
  if (W === 375) await pg.setViewportSize({ width: 375, height: 667 });
  // Le CLS du chargement : observé dès le premier octet du rechargement.
  // L'écran de démarrage de la coque (`.vrm-boot*`, avant React) n'est pas l'écran jugé : ses sauts sont écartés.
  await pg.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue;
    const src = (e.sources || []).map((x) => x.node).filter((n) => n && n.nodeType === 1);
    if (src.length && src.every((n) => n.closest('[class*="vrm-boot"]'))) continue; window.__cls += e.value; (window.__clsSrc = window.__clsSrc || []).push(Math.round(e.startTime) + ' ' + src.map((n) => n.tagName + '.' + String(n.className).slice(0, 40)).join(',')); } }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
  await pg.evaluate(([v2, grand]) => { localStorage.setItem('vrm_design_v2', v2 ? '1' : '0'); if (grand) localStorage.setItem('vrm_taille_texte', 'tresGrand'); }, [v2, grand]);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  return { ...o, b };
}

async function messages(nav, { W, sombre, grand = false, nom }) {
  const { ctx, pg, erreurs, b } = await ouvrirEcran(nav, { W, sombre, url: '/?tab=cat_msg', grand });
  await pg.waitForSelector('[data-v2-msg-groupe] [data-v2-conv]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(3000); await sansToasts(pg);
  if (MUT === 'melange') await pg.evaluate(() => { const g = [...document.querySelectorAll('.v2m-groupe .v2m-carte')]; if (g.length > 1) g[0].appendChild(g[1].querySelector('.v2m-ligne')); });
  if (MUT === 'ordre') await pg.evaluate(() => { const c = document.querySelector('.v2m-groupe .v2m-carte'); const l = c ? c.querySelectorAll(':scope > .v2m-ligne') : []; if (l.length > 1) c.insertBefore(l[l.length - 1], l[0]); });
  if (MUT === 'air') await pg.addStyleTag({ content: 'html body button.v2-rangee.v2m-ligne { min-height: 48px !important; padding: 4px 8px !important; }' });
  const cls = await pg.evaluate(() => window.__cls || 0);
  const lu = await pg.evaluate(() => [...document.querySelectorAll('[data-v2-msg-groupe]')].map((g) => ({ uid: g.getAttribute('data-v2-msg-groupe'), onglet: g.getAttribute('data-v2-msg-onglet'),
    convs: [...g.querySelectorAll('[data-v2-conv]')].map((c) => ({ id: c.getAttribute('data-conv'), compte: c.getAttribute('data-conv-compte'), quand: Date.parse(c.getAttribute('data-conv-quand') || '') })) })));
  const exp = attendu(b);
  const melanges = lu.filter((g) => g.convs.some((c) => c.compte !== g.uid));
  const uids = lu.map((g) => g.uid);
  const desordre = lu.filter((g) => g.convs.some((c, i) => i && c.quand > g.convs[i - 1].quand));
  dit(lu.length >= 2 && !melanges.length && new Set(uids).size === uids.length, `${nom} M1 : un groupe par compte, jamais mélangés (${lu.length} groupes)`, { groupes: lu.map((g) => g.uid + ':' + g.convs.length), melanges: melanges.map((g) => g.uid) });
  dit(lu.length >= 2 && !desordre.length, `${nom} M1 : du plus récent au plus ancien DANS chaque groupe`, desordre.map((g) => g.uid));
  const ordreAttendu = exp.map((g) => g.uid).filter((u) => uids.includes(u));
  const idsOk = lu.every((g) => { const e = exp.find((x) => x.uid === g.uid); return e && JSON.stringify(g.convs.map((c) => c.id)) === JSON.stringify(e.ids.slice(0, g.convs.length)); });
  dit(JSON.stringify(uids) === JSON.stringify(ordreAttendu) && idsOk, `${nom} M1 : groupes et conversations = la base (par compte, la plus récente d’abord)`, { lu: uids, attendu: ordreAttendu });
  const m = await pg.evaluate((f) => eval('(' + f + ')')('.v2m-tete, .v2m-outils, .v2m-liste, .v2-tete-tache'), MESURE.toString());
  dit(m.zones >= 3 && m.pleins <= 1, `${nom} M2 : au plus 1 bouton plein (${m.pleins})`);
  dit(m.zones >= 3 && !m.petites.length, `${nom} M3 : cibles ≥ 44 px`, m.petites.slice(0, 6));
  dit(m.zones >= 3 && !m.tronques.length && !m.coupes.length, `${nom} M4 : rien de tronqué sans « … », aucun mot coupé`, { tronques: m.tronques.slice(0, 6), coupes: m.coupes });
  dit(m.zones >= 3 && !m.air.length && !m.voisins.length, `${nom} M5 : l’AIR (rangée ≥ 64, 20 px du bord, 32 entre groupes, 12 titre → carte, 12 entre boutons)`, { air: m.air.slice(0, 6), voisins: m.voisins });
  dit(cls <= 0.001, `${nom} M6 : CLS du chargement = ${cls.toFixed(4)}`, await pg.evaluate(() => window.__clsSrc || []));
  // La tête : le grand titre et la cloche sur une ligne, UN segmenté, la recherche.
  const tete = await pg.evaluate(() => { const h = document.querySelector('[data-v2-msg-titre] h1'), c = document.querySelector('.vrm-app-header [data-cloche], .vrm-app-header .vrm-notifs-cloche, .vrm-app-header button[aria-label*="otification"]');
    const r = (e) => e && e.getBoundingClientRect(); const hr = r(h), cr = r(c);
    return { titre: !!h, cloche: !!c, memeLigne: !!(hr && cr && Math.abs((hr.top + hr.bottom) / 2 - (cr.top + cr.bottom) / 2) < 24), segs: document.querySelectorAll('.vrm-main .v2-seg').length, anciens: document.querySelectorAll('.vrm-main .vrm-messages-sections, .vrm-main .vrm-fav-zones, .vrm-main .vrm-msg-bar').length,
      premiere: (() => { const x = document.querySelector('[data-v2-conv]'); return x ? Math.round(x.getBoundingClientRect().top) : null; })() }; });
  // (19 nov., intégration — « VRM natif ») La coque native n'a plus de cloche dans la tête d'écran : la ligne du haut porte
  // Messages et la photo du profil (« Plus » → Notifications), le grand titre est dessous (contrat NATIF.md). Jugé : le titre, et
  // la ligne d'actions de la coque au-dessus de lui ; l'ancienne tête (cloche à côté du titre) reste acceptée.
  const coqueNat = await pg.evaluate(() => { const h = document.querySelector('[data-v2-msg-titre] h1'), a = document.querySelector('[data-n-coque-plus]'); if (!h || !a) return null; return { actionsAuDessus: a.getBoundingClientRect().bottom <= h.getBoundingClientRect().top + 2 }; });
  if (W !== 1512) dit(tete.titre && ((tete.cloche && tete.memeLigne) || !!(coqueNat && coqueNat.actionsAuDessus)), `${nom} : le grand titre, avec la cloche sur sa ligne ou les actions de la coque native au-dessus`, { ...tete, coqueNat });
  const segM = await pg.evaluate(() => { const g = document.querySelector('.v2m-tete .v2-seg'); if (!g) return null; const cs = getComputedStyle(g); return { deborde: g.scrollWidth > g.clientWidth + 1, fondu: /gradient/.test(cs.maskImage || cs.webkitMaskImage || '') }; });
  dit(segM && (!segM.deborde || segM.fondu), `${nom} : le segmenté tient dans la largeur, ou défile avec un fondu`, segM);
  dit(tete.segs === 1 && tete.anciens === 0, `${nom} : UN segmenté (Conversations · Offres · Favoris), plus les rangées d’hier`, tete);
  const pa = await pg.evaluate((f) => eval('(' + f + ')')(), PASTILLE.toString());
  dit(!pa.sur, `${nom} : la pastille « Mis à jour » ne couvre pas le titre${pa.vue ? '' : ' (pas montrée)'}`, pa);
  if (grand) { const noms = await pg.evaluate(() => [...document.querySelectorAll('.v2m-nom')].slice(0, 12).filter((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).map((n) => n.textContent));
    dit(!noms.length, `${nom} : en très grand texte, chaque pseudo se lit en entier (2 lignes au plus)`, noms); }
  if (W === 390) dit(tete.premiere != null && tete.premiere <= 422, `${nom} : la 1re conversation sur la moitié haute (y ${tete.premiere})`);
  await pg.screenshot({ path: path.join(SHOTS, `messages-${nom}.png`) });
  // Le fil : des bulles, les gestes d'hier (le champ, les réponses rapides).
  if (W === 390 && !grand) {
    await pg.click('[data-v2-conv]').catch(() => {}); await pg.waitForTimeout(2500);
    const fil = await pg.evaluate(() => ({ bulles: document.querySelectorAll('.vrm-bulle').length, moi: (() => { const x = document.querySelector('.vrm-bulle-moi .vrm-bulle'); return x ? getComputedStyle(x).backgroundColor : ''; })(), champ: !!document.querySelector('.vrm-chat-panel textarea, .vrm-chat-panel input[type="text"]') || [...document.querySelectorAll('.vrm-chat-panel a, .vrm-chat-panel button')].some((x) => /Répondre sur Vinted/.test(x.textContent || '')) }));
    const tf = await pg.evaluate(() => { const e = document.querySelector('.vrm-chat-head-s'); if (!e) return null; const cs = getComputedStyle(e); return { coupe: e.scrollHeight > e.clientHeight + 1, ellipse: [...e.querySelectorAll('*'), e].some((x) => getComputedStyle(x).textOverflow === 'ellipsis' && x.scrollWidth > x.clientWidth + 1), lignes: Math.round(e.clientHeight / parseFloat(cs.lineHeight)) }; });
    dit(tf && !tf.coupe && !tf.ellipse, `${nom} : la tête du fil (paire · compte) n’est pas coupée`, tf);
    dit(fil.bulles >= 2 && /0, 113, 227|10, 132, 255|0, 104, 214|64, 156, 255/.test(fil.moi) && fil.champ, `${nom} : le fil en bulles (les miennes en bleu), le champ de réponse (ou « Répondre sur Vinted ») gardé`, fil);
    await pg.screenshot({ path: path.join(SHOTS, `fil-${nom}.png`) });
  }
  dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.slice(0, 3));
  await ctx.close();
}

async function emails(nav, { W, sombre, grand = false, nom, ancien = null }) {
  const { ctx, pg, erreurs } = await ouvrirEcran(nav, { W, sombre, url: '/?tab=emails', grand }); void ctx;
  await pg.waitForSelector('[data-boite-email]', { timeout: 40000 }).catch(() => {});
  await pg.waitForTimeout(2500); await sansToasts(pg);
  const segs = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-boite-rubrique-v2]')].map((b) => [b.getAttribute('data-boite-rubrique-v2'), b.getAttribute('data-boite-n')])));
  // E1 (19 nov.) : les nombres des segments = ceux que la route compte sur la vue « Tout » (la même réponse, relue ici).
  const route = await pg.evaluate(async () => { try { const r = await fetch('/api/email-rattacher?mode=journal&page=0&parPage=50'); const j = await r.json(); const c = j.compteurs || {}, p = c.parRubrique || {}; const complet = !c.plus;
    return { tout: complet ? String(c.sur) : null, colis: complet ? String(p.colis) : null, ventes: complet ? String(p.ventes) : null, achats: complet ? String(p.achats) : null, atraiter: c.aVerifier > 0 ? String(c.aVerifier) : null }; } catch (_) { return null; } });
  void ancien;
  dit(!!route && ['colis', 'ventes', 'achats', 'tout', 'atraiter'].every((k) => (segs[k] == null ? null : segs[k]) === route[k]), `${nom} E1 : les nombres des segments = ceux que la route compte`, { segs, route });
  const m = await pg.evaluate((f) => eval('(' + f + ')')('[data-v2-mail-tete], [data-boite-liste]'), MESURE.toString());
  dit(m.zones >= 2 && m.pleins <= 1, `${nom} E : au plus 1 bouton plein (${m.pleins})`);
  dit(m.zones >= 2 && !m.petites.length, `${nom} E : cibles ≥ 44 px`, m.petites.slice(0, 6));
  dit(m.zones >= 2 && !m.tronques.length && !m.coupes.length, `${nom} E : rien de tronqué sans « … », aucun mot coupé`, { tronques: m.tronques.slice(0, 6), coupes: m.coupes });
  // (19 nov.) Le segmenté en haut, sur toute la largeur, sans débordement ; le compte dans la barre (ordinateur) ou dans « ⋯ »
  // (téléphone) ; « Sélectionner » dans « ⋯ ».
  const seg = await pg.evaluate(() => { const g = document.querySelector('.n-mail-seg'); if (!g) return null; const h = document.querySelector('[data-v2-mail-tete]');
    return { deborde: g.scrollWidth > g.clientWidth + 1, pleine: h ? g.getBoundingClientRect().width >= h.getBoundingClientRect().width - 1 : false,
      compte: !!document.querySelector('[data-v2-mail-compte] select, [data-v2-mail-compte-feuille] select, [data-v2-mail-plus]'), selectionnerSeul: !!document.querySelector('.vrm-serie-entree') }; });
  dit(seg && !seg.deborde && seg.pleine && seg.compte && !seg.selectionnerSeul, `${nom} E : segmenté pleine largeur sans débordement, compte dans la barre ou « ⋯ », « Sélectionner » dans « ⋯ »`, seg);
  const paE = await pg.evaluate((f) => eval('(' + f + ')')(), PASTILLE.toString());
  dit(!paE.sur, `${nom} E : la pastille « Mis à jour » ne couvre pas le titre${paE.vue ? '' : ' (pas montrée)'}`, paE);
  const cls = await pg.evaluate(() => window.__cls || 0);
  dit(cls <= 0.001, `${nom} E : CLS du chargement = ${cls.toFixed(4)}`, await pg.evaluate(() => window.__clsSrc || []));
  // E3 : l'étiquette N° = le N° LU (bordereau, vente), le code se copie, un geste par rangée sans code.
  const e3 = await pg.evaluate(() => { const faux = []; let vus = 0, gestes = 0, codes = 0;
    for (const li of document.querySelectorAll('.n-mail-item')) { const b = li.querySelector('[data-boite-email]'); if (!b) continue; const n = b.getAttribute('data-v2-num'); const et = li.querySelector('[data-v2-etiquette]');
      if (n) { vus++; if (!et || et.getAttribute('data-v2-etiquette') !== n) faux.push(b.getAttribute('data-boite-email').slice(16, 22)); }
      if (li.querySelector('[data-v2-mail-action]')) gestes++; if (li.querySelector('[data-boite-code-copier]')) codes++;
      if (li.querySelectorAll('[data-v2-mail-action]').length > 1) faux.push('deux gestes'); }
    return { vus, faux, gestes, codes }; });
  dit(e3.vus >= 5 && !e3.faux.length && e3.gestes === 0 && e3.codes >= 3, `${nom} E3 : étiquette N° lue (${e3.vus}), codes copiables (${e3.codes}), aucun bouton de geste dans les rangées (le geste est dans la lecture)`, e3);
  await pg.screenshot({ path: path.join(SHOTS, `emails-${nom}.png`) });
  // E2 : chaque segment montre SA rubrique ; « À traiter » = les 3 « à vérifier ».
  if (W === 390 && !sombre && !grand) {
    for (const [seg, test] of [['colis', (t) => t === 'colis' || t === 'codes'], ['ventes', (t) => t === 'ventes'], ['achats', (t) => t === 'achats']]) {
      await pg.click(`[data-boite-rubrique-v2="${seg}"]`, { timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(1800);
      const rs = await pg.evaluate(() => [...document.querySelectorAll('[data-boite-email]')].map((b) => b.getAttribute('data-rubrique')));
      dit(rs.length > 0 && rs.every(test), `${nom} E2 : « ${seg} » ne montre que sa rubrique (${rs.length})`, [...new Set(rs)]);
    }
    await pg.click('[data-boite-rubrique-v2="atraiter"]', { timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(1800);
    const av = await pg.evaluate(() => [...document.querySelectorAll('[data-boite-email]')].map((b) => b.getAttribute('data-etat')));
    dit(av.length === 3 && av.every((x) => x === 'a-verifier'), `${nom} E2 : « À traiter » = les 3 « à vérifier », visibles`, av);
    await pg.screenshot({ path: path.join(SHOTS, `emails-atraiter-${nom}.png`) });
    await pg.click('[data-boite-rubrique-v2="tout"]', { timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(1800);
    // E4 : glisser à gauche range ; l'e-mail reste (replié dans « Rangés »), les nombres ne bougent pas.
    const avant = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-boite-email]').length, segs: [...document.querySelectorAll('[data-boite-rubrique-v2]')].map((b) => b.getAttribute('data-boite-n')).join(',') }));
    const cible = await pg.evaluate(() => { const b = document.querySelector('[data-boite-liste] [data-boite-email]'); if (!b) return { id: '', x: 0, y: 0 }; const r = b.getBoundingClientRect(); return { id: b.getAttribute('data-boite-email'), x: r.left + r.width * 0.7, y: r.top + r.height / 2 }; });
    // Le glisser au doigt : des PointerEvent « touch » (ceux qu'écoute la rangée), vers la gauche.
    await pg.evaluate(async (c) => { const b = document.querySelector(`[data-boite-email="${c.id}"]`); if (!b) return; const ev = (t, x) => b.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: c.y, button: 0 }));
      ev('pointerdown', c.x); for (let k = 1; k <= 8; k++) { ev('pointermove', c.x - k * 18); await new Promise((r) => setTimeout(r, 16)); } ev('pointerup', c.x - 144); }, cible);
    await pg.waitForTimeout(900);
    const apres = await pg.evaluate((id) => ({ n: document.querySelectorAll('[data-boite-email]').length, range: !!document.querySelector(`[data-v2-mail-ranges] [data-boite-email="${id}"]`), segs: [...document.querySelectorAll('[data-boite-rubrique-v2]')].map((b) => b.getAttribute('data-boite-n')).join(','), stocke: (() => { try { return !!JSON.parse(localStorage.getItem('vrm_emails_ranges') || '{}')[id]; } catch (_) { return false; } })() }), cible.id);
    dit(apres.range && apres.n === avant.n && apres.segs === avant.segs && apres.stocke, `${nom} E4 : « Ranger » garde l’e-mail (replié dans « Rangés »), les nombres ne bougent pas`, { avant, apres });
    // E5 : les e-mails à rattacher, « C'est à moi » rejoue le BON.
    const q = await pg.evaluate(() => ({ n: document.querySelector('[data-v2-mail-quarantaine]') && document.querySelector('[data-v2-mail-quarantaine]').getAttribute('data-v2-mail-quarantaine'), b: document.querySelectorAll('[data-v2-mail-amoi]').length }));
    const cle = QUARANTAINE[1].id; posts.length = 0;
    await pg.click(`[data-v2-mail-amoi="${cle}"]`).catch(() => {}); await pg.waitForTimeout(1200);
    dit(q.n === '2' && q.b === 2 && posts.length === 1 && posts[0].id === cle, `${nom} E5 : « À rattacher » (2), « C’est à moi » rejoue CET e-mail`, { q, posts });
    await pg.evaluate(() => { const s = document.querySelector('[data-v2-mail-quarantaine]'); if (s) s.scrollIntoView({ block: 'center' }); });
    await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `emails-bas-${nom}.png`) });
  }
  dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.slice(0, 3));
  await ctx.close();
}

// Les nombres des pastilles d'hier (réglage éteint, la même base) : la référence de E1.
async function pastillesHier(nav) {
  const { ctx, pg } = await ouvrirEcran(nav, { W: 390, sombre: false, url: '/?tab=emails', v2: false });
  await pg.waitForSelector('[data-boite-email]', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(2000);
  const p = await pg.evaluate(() => { const n = (k) => { const b = document.querySelector(`[data-boite-rubrique="${k}"] [data-boite-n]`); return b ? b.getAttribute('data-boite-n') : null; }; return { tout: n('tout'), colis: n('colis'), ventes: n('ventes'), achats: n('achats'), atraiter: n('a-verifier') }; });
  await ctx.close(); return p;
}

async function eteint(nav, sigs) {
  // (19 nov., lot emails-mail) E-mails n'a plus de dessin « éteint » (un seul écran, natif) : seule la signature de Messages.
  for (const [id, url, attente] of [['messages', '/?tab=cat_msg', '[data-conv]']]) {
    const { ctx, pg } = await ouvrirEcran(nav, { W: 390, sombre: false, url, v2: false });
    await pg.waitForSelector(attente, { timeout: 40000 }).catch(() => {});
    sigs[id] = await signatureStable(pg);
    const v2 = await pg.evaluate(() => document.querySelectorAll('[data-v2-conv], [data-v2-msg-tete], [data-v2-mail-tete], [data-v2-mail-seg], .v2m-liste').length);
    dit(v2 === 0, `éteint : rien du nouveau design sur ${id}`, v2);
    await pg.screenshot({ path: path.join(SHOTS, `eteint-${id}.png`) });
    await ctx.close();
  }
  if (SIG_AVANT && fs.existsSync(SIG_AVANT)) {
    const ref = JSON.parse(fs.readFileSync(SIG_AVANT, 'utf8'));
    for (const id of ['messages']) {
      const a = ref[id] || [], c = sigs[id] || []; let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
      dit(a.length > 20 && a.length === c.length && i === a.length, `éteint : ${id} a le DOM d’avant (${c.length} nœuds)`, i < Math.max(a.length, c.length) ? { n: [a.length, c.length], ecart: i, avant: a[i], ici: c[i] } : undefined);
    }
  } else dit(false, 'éteint : pas de référence (SIGNATURE_AVANT) — le rendu éteint n’est pas comparé');
}

// A8 : « Se déconnecter partout » en très grand texte, 375 px — le plein se lit en entier, au-dessus d'« Annuler ».
async function confirmation(nav, v2) {
  const { ctx, pg } = await ouvrirEcran(nav, { W: 375, sombre: false, url: '/?tab=settings', grand: true, v2 }); void ctx;
  await pg.waitForTimeout(3500); await sansToasts(pg);
  const ouvert = await pg.evaluate(async () => { const b = [...document.querySelectorAll('button')].find((x) => /déconnecter partout/i.test(x.textContent || '')); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; });
  await pg.waitForTimeout(1200);
  const r = await pg.evaluate(() => { const f = document.querySelector('.vrm-fs.vrm-confirmation'); if (!f) return null; const p = f.querySelector('.vrm-b-primaire'), a = [...f.querySelectorAll('.vrm-b')].find((x) => x !== p);
    const coupe = (e) => { for (const x of [e, ...e.querySelectorAll('*')]) if (x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== 'visible') return true; const rg = document.createRange(); rg.selectNodeContents(e); const t = rg.getBoundingClientRect(), b = e.getBoundingClientRect(); return t.left < b.left - 1 || t.right > b.right + 1; };
    return { texte: p && p.textContent.trim(), coupe: p ? coupe(p) : true, dessus: p && a ? p.getBoundingClientRect().bottom <= a.getBoundingClientRect().top + 1 : false, largeur: p ? Math.round(p.getBoundingClientRect().width) : 0, h: p ? Math.round(p.getBoundingClientRect().height) : 0 }; });
  await pg.screenshot({ path: path.join(SHOTS, `confirmation-tres-grand-${v2 ? 'v2' : 'eteint'}.png`) });
  dit(ouvert && r && !r.coupe && r.dessus && r.h >= 44, `A8 (${v2 ? 'allumé' : 'éteint'}) : 375 très grand texte — « ${r && r.texte} » lisible en entier, au-dessus d’« Annuler »`, r);
  await ctx.close();
}

// La règle pure (ESM) : le compte de l'onglet d'abord, puis chaque autre compte ; le plus récent d'abord dans chacun.
async function reglePure() {
  const { groupesParCompte } = await import(path.join(__dirname, '..', '..', 'src', 'designV2', 'messagesV2.js'));
  const c = (u, t, id) => ({ u, t: t == null ? null : new Date(Date.UTC(2026, 10, 17, t)).toISOString(), id });
  const L = [c('A', 9, 1), c('B', 12, 2), c('A', 14, 3), c('C', 10, 4), c('B', 8, 5), c('A', null, 6), c('C', 11, 7)];
  const g = groupesParCompte(L, { uidDe: (x) => x.u, quand: (x) => x.t, compteOnglet: 'C' });
  const vu = g.map((x) => x.uid + ':' + x.convs.map((y) => y.id).join(',')).join(' | ');
  dit(vu === 'C:7,4 | A:3,1,6 | B:2,5', `règle : onglet d’abord, puis chaque compte par sa plus récente ; dans chacun, du plus récent au plus ancien, sans date en bas (${vu})`);
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const sigs = {};
  try {
    if (process.env.SEULEMENT === 'eteint') { await eteint(nav, sigs); throw new Error('seulement éteint'); }
    if (process.env.SEULEMENT === 'messages') { await messages(nav, { W: 390, sombre: false, nom: '390-clair' }); throw new Error('seulement messages (390 clair)'); }
    await reglePure().catch((e) => dit(false, 'règle pure : ' + String(e && e.message || e).slice(0, 200)));
    const hier = null;   // (19 nov.) plus de boîte « d’hier » : E1 compare à la route
    await messages(nav, { W: 390, sombre: false, nom: '390-clair' });
    await messages(nav, { W: 390, sombre: true, nom: '390-sombre' });
    await messages(nav, { W: 375, sombre: false, grand: true, nom: '375-tres-grand' });
    await messages(nav, { W: 1512, sombre: false, nom: '1512' });
    await emails(nav, { W: 390, sombre: false, nom: '390-clair', ancien: hier });
    await emails(nav, { W: 390, sombre: true, nom: '390-sombre', ancien: hier });
    await emails(nav, { W: 375, sombre: false, grand: true, nom: '375-tres-grand', ancien: hier });
    await emails(nav, { W: 1512, sombre: false, nom: '1512', ancien: hier });
    await confirmation(nav, false); await confirmation(nav, true);
    await eteint(nav, sigs);
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  fs.writeFileSync(path.join(SHOTS, 'signature-eteint.json'), JSON.stringify(sigs));
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2-messages : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
