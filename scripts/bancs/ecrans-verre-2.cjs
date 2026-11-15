// ════════════════════════════════════════════════════════════════════════════
//  BANC « ÉCRANS EN VERRE, 2 » (15 nov., maquettes validées par Julien : « tout est parfait sauf étagères »)
//  Récit : docs/passation/2026-11-15-ecrans-verre-2.md
//
//  Argent (le mois), Argent à venir, Messages (liste, conversation avec une offre), Paramètres (premier
//  écran en tuiles, une catégorie), la fiche d'une paire — sur une base INVENTÉE (1 000 paires, 1 000
//  conversations, 3 comptes : _base-messages-stock.cjs), 390 tactile ET 1512, clair ET sombre.
//  Chaque vue est capturée (SHOTS) et JUGÉE SUR SA RÈGLE (data-* et nombres rendus, jamais un libellé) :
//    A  Argent : le chiffre d'affiche « vendu » ≥ 44 px ; reçu et bénéfice côte à côte (390) ; le bénéfice
//       « au moins » dit sa couverture et le geste des prix à saisir quand il en manque ; l'argent à venir en
//       barre PAR ÉTAPE dont les parts suivent les montants rendus ; l'URSSAF et « J'ai déclaré » ;
//    V  Argent à venir : total une fois, étapes, ventes avec leur N°, le porte-monnaie « pas lu » écrit « — »
//       (jamais 0) quand il n'est pas lu ;
//    M  Messages : groupes PAR COMPTE (compte de l'onglet d'abord), du plus récent au plus ancien DANS chaque
//       groupe (data-*), le N° sur les lignes qui en ont un ; la conversation : la paire en tête, l'offre
//       comparée au prix et au prix mini, UN plein (« Proposer N € ») ;
//    P  Paramètres : le premier écran tient sans défiler (390×844) : recherche, carte Mon compte, les tuiles
//       des catégories ; une catégorie en groupes courts ; les 84 rangées et leurs id inchangés (audit) ;
//    F  la fiche : une ligne par site, prix d'achat et bénéfice, historique, trois gestes ;
//    Z  partout : rien ne déborde, cibles ≥ 44 px au doigt, un plein au plus.
//  Un banc ne meurt pas, il rapporte. `VUES=argent,messages` `LARGEURS=390` `THEMES=clair` ; `SHOTS=<dossier>` ;
//  `DSF=2` pour des captures nettes ; `BANC_DIST=<dist>` pour juger un autre arbre (l'arbre d'avant : ROUGE).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = {
  'argent-mois': '/?tab=argent', 'argent-avenir': '/?tab=argent', 'messages-liste': '/?tab=messages', 'messages-offre': '/?tab=messages',
  parametres: '/?tab=settings', 'parametres-ventes': '/?tab=settings', 'fiche-paire': '/?tab=journee',
};
const VOULUES = liste('VUES', Object.keys(VUES).join(','));
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const DSF = Number(process.env.DSF || 1);
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-ecrans-verre-2');
const CAPTURE = !!process.env.CAPTURE;   // captures seulement (aucun jugement)
fs.mkdirSync(SHOTS, { recursive: true });

const bilan = { ok: 0, ko: 0 };
const dit = (ok, quoi, detail = '') => { if (ok) bilan.ok++; else bilan.ko++; console.log(`${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

async function preparer(o, vue) {
  const pg = o.pg;
  const toucher = async (sel) => { const l = pg.locator(sel).first(); if (!(await l.count())) return false; try { if (o.tel) await l.tap({ timeout: 4000 }); else await l.click({ timeout: 4000 }); return true; } catch (_) { try { await l.evaluate((e) => e.click()); return true; } catch (__) { return false; } } };
  if (vue.startsWith('argent')) { await pg.waitForSelector('[data-argent-ecran]', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1200); }
  if (vue.startsWith('messages')) { await pg.waitForSelector('[data-fil], .vrm-msg-list', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(600); }
  if (vue.startsWith('parametres')) { await pg.waitForSelector('[data-parametres-accueil], .vrm-reglages-groupe', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(600); }
  if (vue === 'argent-avenir') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:argent-a-venir')));
    await pg.waitForSelector('[data-argent-a-venir-ecran]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(900);
  }
  if (vue === 'messages-offre') {
    // une conversation qui porte une offre (la base en met une toutes les 9 conversations)
    // la base met une offre sur la conversation n° 4 (i % 9 === 4), la 5e de la liste (de la plus récente)
    const ok = await toucher('[data-fil-offre]');
    if (!ok) { const l = pg.locator('[data-fil]').nth(4); try { if (o.tel) await l.tap({ timeout: 4000 }); else await l.evaluate((e) => e.click()); } catch (_) {} }   // à l'ordinateur, un message de la coque peut couvrir la rangée
    await pg.waitForSelector('.vrm-chat-panel .vrm-chat-history', { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(1600);
  }
  if (vue === 'parametres-ventes') {
    const ok = await toucher('[data-categorie-ouvrir="ventes"]');
    if (!ok) await toucher('[data-cat="ventes"]');
    await pg.waitForTimeout(1200);
  }
  if (vue === 'fiche-paire') {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
    await pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(1500);
  }
}

// ── La mesure, DANS la page : chaque vue rend ses nombres (jamais un libellé). ──
function mesurer(vue) {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[hidden]'); };
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m) return 0; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]); };
  const out = { vue, W: innerWidth, H: innerHeight };
  const de = document.scrollingElement;
  out.deborde = de.scrollWidth - innerWidth;
  const racine = vue.startsWith('argent-avenir') ? document.querySelector('[data-argent-a-venir-ecran]')
    : vue.startsWith('argent') ? document.querySelector('[data-argent-questions]')
    : vue === 'messages-offre' ? document.querySelector('.vrm-chat-panel')
    : vue.startsWith('messages') ? document.querySelector('[data-fils-tous]')
    : vue.startsWith('parametres') ? document.querySelector('.vrm-pm')
    : document.querySelector('[data-fiche-paire]');
  out.racine = !!racine;
  if (!racine) return out;
  // Z — cibles au doigt (390) : chaque bouton VISIBLE de la racine fait 44 px (hauteur rendue, ou sa zone ::after) ; pleins visibles
  out.petits = [...racine.querySelectorAll('button, a[href], [role="button"]')].filter(vis).filter((b) => {
    const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return false;
    const a = getComputedStyle(b, '::after'); const ext = a && a.content !== 'none' && a.position === 'absolute' ? (parseFloat(a.top) < 0 ? -parseFloat(a.top) : 0) + (parseFloat(a.bottom) < 0 ? -parseFloat(a.bottom) : 0) : 0;
    return r.height + ext < 43.5;
  }).map((b) => `${b.className || b.tagName} « ${(b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 18)} » ${Math.round(b.getBoundingClientRect().height)}`).slice(0, 6);
  out.pleins = [...document.querySelectorAll('.sb-btn-plein, .vrm-chat-btn-p, .vrm-fp-b-plein')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length;
  out.horsRacine = [...racine.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); if (r.right <= innerWidth + 1 && r.left >= -1) return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(c.overflowX)) return false; } return true; }).length;
  if (vue === 'argent-mois') {
    const q = (id) => document.querySelector(`[data-argent-q="${id}"]`);
    const n = q('vendu') && q('vendu').querySelector('.vrm-argent-w-n');
    out.vendu = n ? { fs: parseFloat(getComputedStyle(n).fontSize), clair: lum(getComputedStyle(n).color) > 0.8, carte: (() => { const bg = getComputedStyle(q('vendu')).backgroundImage; return bg !== 'none'; })() } : null;
    out.duo = q('recu') && q('benefice') ? { recu: R(q('recu').closest('.vg-carte') || q('recu')), benef: R(q('benefice').closest('.vg-carte') || q('benefice')), yQ: [R(q('recu')).y, R(q('benefice')).y] } : null;
    out.ordre = [...document.querySelectorAll('[data-argent-q]')].map((e) => e.getAttribute('data-argent-q')).join(',');
    const av = document.querySelector('section.vrm-a-venir.vg-a-venir');
    if (av) {
      const segs = [...av.querySelectorAll('.vg-av-barre .vrm-av-barre-seg')].map((s) => ({ k: (s.className.match(/is-(\w+)/) || [])[1], w: s.getBoundingClientRect().width }));
      const leg = [...av.querySelectorAll('[data-a-venir-etape][data-eur]')].map((x) => ({ k: x.getAttribute('data-a-venir-etape'), eur: Number(x.getAttribute('data-eur')) }));
      out.avenir = { total: av.getAttribute('data-a-venir'), segs, leg, etapes: (av.querySelector('[data-a-venir-etapes]') || {}).getAttribute ? av.querySelector('[data-a-venir-etapes]').getAttribute('data-a-venir-etapes') : '' };
    } else out.avenir = null;
    const u = document.querySelector('[data-argent-urssaf]');
    out.urssaf = u ? { etat: u.getAttribute('data-argent-urssaf'), apayer: u.getAttribute('data-argent-apayer'), declare: (() => { const b = u.querySelector('[data-urssaf-cest-declare]'); return b ? Math.round(b.getBoundingClientRect().height) : null; })() } : null;
    const brut = document.querySelector('.vg-a-brut');
    out.brutAuMoins = brut ? /au moins/i.test(brut.closest('.vg-a-case').innerText) : false;
  }
  if (vue === 'argent-avenir') {
    const aff = racine.querySelector('[data-av-total]');
    const total = aff ? aff.getAttribute('data-av-total') : '';
    const fr = (c) => (Number(c) / 100).toFixed(2).replace('.', ',').replace(/,00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const txt = racine.innerText.replace(/[  ]/g, ' ');
    out.av = { total, fois: total ? txt.split(fr(total)).length - 1 : null, chiffreFs: aff ? parseFloat(getComputedStyle(aff.querySelector('.sb-chiffre-affiche') || aff).fontSize) : 0,
      etapes: [...racine.querySelectorAll('[data-av-etape]:not([data-av-hors-total])')].map((x) => x.getAttribute('data-av-etape')),
      segs: [...racine.querySelectorAll('.vg-av-carte .vrm-av-barre-seg')].map((s) => (s.className.match(/is-(\w+)/) || [])[1]),
      pm: (() => { const x = racine.querySelector('[data-av-somme="dispo"]'); return x ? { eur: x.getAttribute('data-eur'), txt: x.innerText.replace(/\s+/g, ' ') } : null; })(),
      nums: [...racine.querySelectorAll('[data-av-vente][data-num]')].map((x) => ({ n: x.getAttribute('data-num'), plaque: ((x.querySelector('.sb-plaque') || {}).innerText || '').replace(/\s/g, '') })),
      ventes: racine.querySelectorAll('[data-av-vente]').length };
  }
  if (vue === 'messages-liste') {
    const G = [...document.querySelectorAll('[data-msg-groupe]')];
    out.ms = { groupes: G.map((g) => ({ cle: g.getAttribute('data-msg-groupe'), onglet: g.getAttribute('data-msg-groupe-onglet') === '1', ats: [...g.querySelectorAll('[data-fil]')].map((f) => Number(f.getAttribute('data-fil-at') || 0)) })),
      sansPlaque: [...document.querySelectorAll('[data-fil][data-fil-num]')].filter((f) => !((f.querySelector('.vg-fil-plaque') || {}).textContent || '').replace(/\s/g, '').includes(f.getAttribute('data-fil-num'))).length,
      avecNum: document.querySelectorAll('[data-fil][data-fil-num]').length,
      vues: [...document.querySelectorAll('[data-msg-vue]')].map((b) => ({ k: b.getAttribute('data-msg-vue'), h: Math.round(b.getBoundingClientRect().height), on: b.getAttribute('aria-pressed') === 'true' })),
      premiereLigne: (() => { const f = document.querySelector('[data-fil]'); return f ? Math.round(f.getBoundingClientRect().top) : null; })(),
      visibles: [...document.querySelectorAll('[data-fil]')].filter((f) => { const r = f.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length };
  }
  if (vue === 'messages-offre') {
    const pa = racine.querySelector('.vrm-chat-paire'), hi = racine.querySelector('.vrm-chat-history');
    const carte = racine.querySelector('.vrm-chat-offre');
    out.conv = { paire: !!pa && vis(pa), paireAvant: pa && hi ? pa.getBoundingClientRect().top < hi.getBoundingClientRect().top : false,
      offre: carte ? carte.getAttribute('data-offre') : null,
      proposer: (() => { const b = racine.querySelector('[data-offre-geste="proposer"]'); return b ? b.classList.contains('vrm-chat-btn-p') : null; })(),
      pleinsCarte: carte ? carte.querySelectorAll('.vrm-chat-btn-p').length : null };
  }
  if (vue === 'parametres') {
    const cats = [...document.querySelectorAll('[data-categories-reglages] [data-categorie-ouvrir]')].filter(vis);
    const tuiles = cats.filter((c) => c.classList.contains('vg-pm-tuile'));
    const barre = document.querySelector('.vrm-tabbar');
    out.pm = { cats: cats.length, ids: cats.map((c) => c.getAttribute('data-categorie-ouvrir')).join(','), tuiles: tuiles.length, colonnes: new Set(tuiles.map((t) => Math.round(t.getBoundingClientRect().left))).size,
      basDernier: tuiles.length ? Math.round(Math.max(...tuiles.map((t) => t.getBoundingClientRect().bottom))) : null, hautBarre: barre && vis(barre) ? Math.round(barre.getBoundingClientRect().top) : innerHeight,
      rangees: [...racine.querySelectorAll('.vrm-set-ligne')].filter(vis).filter((l) => !l.closest('.vrm-pm-alerte-liste')).length,
      compte: (() => { const c = document.querySelector('[data-categorie-ouvrir="compte"]'); return c ? R(c) : null; })() };
  }
  if (vue === 'parametres-ventes') {
    const t = [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-titre')].filter(vis);
    out.cat = { titres: t.length, titresClairs: t.filter((x) => lum(getComputedStyle(x).color) > 0.8).length,
      icones: [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-ic')].filter(vis).length,
      rangees: [...racine.querySelectorAll('.vrm-pm-cat .vrm-set-ligne')].filter(vis).map((l) => Math.round(l.getBoundingClientRect().height)),
      titre: (() => { const h = racine.querySelector('.vg-pm-nav-txt h2'); return h ? { fs: parseFloat(getComputedStyle(h).fontSize), clair: lum(getComputedStyle(h).color) > 0.8 } : null; })(),
      retour: (() => { const b = racine.querySelector('[data-categorie-retour]'); return b && vis(b) ? R(b) : null; })() };
  }
  if (vue === 'fiche-paire') {
    out.fp = { sites: racine.querySelectorAll('.vg-fp-site').length, tuiles: [...racine.querySelectorAll('.vrm-fp-tuile')].filter(vis).length,
      parcours: !!racine.querySelector('.vrm-fp-parcours, .vrm-fp-temps, [data-fiche-temps]'), heros: !!racine.querySelector('.vrm-fp-heros'),
      photo: (() => { const p = racine.querySelector('.vrm-fp-heros-photo'); return p ? R(p) : null; })(),
      outils: [...racine.querySelectorAll('.vrm-fp-outils > button')].filter(vis).length,
      // (15 nov., Julien : « C'est trop long ») la hauteur de la fiche, ce qui est VU (repli fermé) : identifiants, jargon, doublons
      hauteur: (() => { const c = racine.querySelector('.vrm-fp-cadre'); return c ? Math.round(c.scrollHeight) : null; })(),
      jargon: (() => { const t = racine.innerText; return (t.match(/\b(annonce|transaction|fiche) \d{6,}|journal des N°|vues par VRM|origine non enregistrée|lu dans le dressing|prix lus depuis|Modifications enregistrées sur cet appareil|à dater|même chaussure/gi) || []); })(),
      doublons: (() => { const vus = {}; for (const e of racine.querySelectorAll('button, summary, h2, h3')) { if (!vis(e)) continue; const k = (e.innerText || '').trim(); if (k.length < 4) continue; vus[k] = (vus[k] || 0) + 1; } return Object.entries(vus).filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`); })() };
  }
  return out;
}

// ── Le jugement : la RÈGLE de chaque vue, sur les nombres rendus. ──
function juger(m, suf, tel) {
  if (!m.racine) { dit(false, `${suf} : l'écran est rendu`, 'racine absente'); return; }
  dit(m.deborde <= 1 && m.horsRacine === 0, `Z ${suf} : rien ne déborde`, `page +${m.deborde} · ${m.horsRacine} élément(s) hors de l'écran`);
  if (tel) dit(!m.petits.length, `Z ${suf} : chaque cible visible fait 44 px au doigt`, m.petits.join(' | '));
  dit(m.pleins <= 1, `Z ${suf} : un plein au plus`, String(m.pleins));
  if (m.vue === 'argent-mois') {
    dit(!!m.vendu && m.vendu.fs >= 44 && m.vendu.clair && !m.vendu.carte, `A1 ${suf} : « vendu » est le chiffre d'affiche, en blanc sur le fond (≥ 44 px, sans carte)`, JSON.stringify(m.vendu));
    dit(m.ordre === 'vendu,recu,benefice,declarer', `A1 ${suf} : les quatre réponses, dans l'ordre`, m.ordre);
    if (tel) dit(!!m.duo && Math.abs(m.duo.recu.y - m.duo.benef.y) <= 1 && Math.abs(m.duo.yQ[0] - m.duo.yQ[1]) <= 1 && m.duo.recu.x < m.duo.benef.x && m.duo.recu.w < m.W * .6, `A2 ${suf} : reçu et bénéfice côte à côte`, JSON.stringify(m.duo));
    else dit(!!m.duo && Math.abs(m.duo.recu.y - m.duo.benef.y) <= 1, `A2 ${suf} : reçu et bénéfice sur la même ligne (ordinateur)`, JSON.stringify(m.duo));
    if (m.avenir) {
      const A = m.avenir, somme = A.leg.reduce((t, x) => t + x.eur, 0), wTot = A.segs.reduce((t, x) => t + x.w, 0);
      const parts = A.leg.length > 1 ? A.leg.map((x) => { const s = A.segs.find((y) => y.k === x.k); return s && somme ? Math.abs(s.w / wTot - x.eur / somme) : 1; }) : [];
      dit(A.segs.length === A.leg.length || A.leg.length <= 1, `A3 ${suf} : la barre de l'argent à venir a une part par étape`, `${A.segs.length} parts · ${A.leg.length} étapes`);
      dit(!parts.length || Math.max(...parts) < .06, `A3 ${suf} : chaque part suit le montant de son étape (± 6 points ; les écarts de 3 px comptent)`, parts.map((x) => x.toFixed(3)).join(' '));
      dit(!A.total || String(Math.round(somme)) === A.total || A.leg.length <= 1, `A3 ${suf} : les étapes font le total à venir`, `${somme} / ${A.total}`);
    } else dit(true, `A3 ${suf} : rien à venir ⇒ pas de carte (aucune carte vide)`);
    dit(!!m.urssaf, `A4 ${suf} : la carte URSSAF est là (son état : ${m.urssaf && m.urssaf.etat})`);
    if (m.urssaf && m.urssaf.declare != null) dit(m.urssaf.declare >= 44, `A4 ${suf} : « J'ai déclaré » ≥ 44 px`, String(m.urssaf.declare));
    dit(!m.brutAuMoins, `A5 ${suf} : le bénéfice brut ne dit jamais « au moins » (ce n'est pas un plancher)`);
  }
  if (m.vue === 'argent-avenir') {
    const V = m.av;
    dit(!!V && V.fois === 1, `V1 ${suf} : le total à venir est écrit UNE fois`, V && `${V.fois} fois (${V.total})`);
    dit(!!V && V.chiffreFs >= 44, `V1 ${suf} : le total en chiffre d'affiche (≥ 44 px)`, V && String(V.chiffreFs));
    dit(!!V && V.etapes.length === V.segs.length, `V2 ${suf} : une part de barre par étape`, V && `${V.etapes.join(',')} / ${V.segs.join(',')}`);
    dit(!!V && !!V.pm && (V.pm.eur !== '' || (/—/.test(V.pm.txt) && !/\b0[,.]?0*\s*€/.test(V.pm.txt))), `V3 ${suf} : le porte-monnaie pas lu dit « — », jamais 0 €`, V && JSON.stringify(V.pm));
    dit(!!V && V.nums.every((x) => x.plaque.includes(x.n)), `V4 ${suf} : chaque vente au N° connu porte sa plaque (${V ? V.nums.length : 0} sur ${V ? V.ventes : 0} montrées ; un N° pas su reste blanc)`, V && JSON.stringify(V.nums.filter((x) => !x.plaque.includes(x.n)).slice(0, 3)));
  }
  if (m.vue === 'messages-liste') {
    const S = m.ms;
    const iOng = S.groupes.findIndex((g) => g.onglet);
    dit(S.groupes.length > 0, `M1 ${suf} : les conversations sont rangées par compte (${S.groupes.length} groupe(s))`);
    dit(iOng <= 0, `M1 ${suf} : le compte de l'onglet est le premier groupe`, String(iOng));
    const desordre = S.groupes.filter((g) => g.ats.some((t, i) => i && t > g.ats[i - 1]));
    dit(!desordre.length, `M2 ${suf} : dans chaque compte, du plus récent au plus ancien`, desordre.map((g) => g.cle).join(','));
    const tetes = S.groupes.map((g) => g.ats[0] || 0).slice(iOng === 0 ? 1 : 0);
    dit(tetes.every((t, i) => !i || t <= tetes[i - 1]), `M2 ${suf} : les autres comptes, le plus récent d'abord`, tetes.join(','));
    dit(S.sansPlaque === 0, `M3 ${suf} : chaque conversation reliée à une paire montre sa plaque N° (${S.avecNum})`, String(S.sansPlaque));
    dit(S.vues.length === 3 && S.vues.every((v) => v.h >= 44) && S.vues.filter((v) => v.on).length === 1, `M4 ${suf} : « Toutes · Offres · Non lues », 44 px, un seul allumé`, JSON.stringify(S.vues));
    if (tel) dit(S.premiereLigne != null && S.premiereLigne <= 844 * 0.5 && S.visibles >= 6, `M5 ${suf} : la 1re conversation à mi-écran au plus, 6 au moins visibles`, `${S.premiereLigne} px · ${S.visibles} visibles`);
  }
  if (m.vue === 'messages-offre') {
    const K = m.conv;
    dit(K.paire && K.paireAvant, `M6 ${suf} : la paire en tête du fil`, JSON.stringify(K));
    if (K.proposer != null) dit(K.proposer === true && K.pleinsCarte === 1, `M7 ${suf} : le plein va à « Proposer N € », un seul`, JSON.stringify(K));
    else console.log(`   ℹ️ M7 ${suf} : pas d'offre à trancher ICI (offre ${K.offre || 'aucune'} : l'extension n'est pas dans ce navigateur) — la règle est jugée sur le code (audit).`);
  }
  if (m.vue === 'parametres') {
    const P = m.pm;
    dit(P.cats === 10, `P1 ${suf} : les dix catégories au premier écran`, P.ids);
    if (tel) {
      dit(P.tuiles === 9 && P.colonnes === 3, `P1 ${suf} : neuf tuiles, trois par rangée ; « Mon compte » en carte`, `${P.tuiles} tuiles · ${P.colonnes} colonnes`);
      dit(P.basDernier != null && P.basDernier <= P.hautBarre, `P2 ${suf} : le premier écran tient sans défiler (dernière tuile à ${P.basDernier} px, au-dessus de la barre du bas à ${P.hautBarre})`);
      dit(P.rangees === 0, `P2 ${suf} : aucune rangée de réglage au premier écran`, String(P.rangees));
    }
  }
  if (m.vue === 'parametres-ventes' && tel) {
    const K = m.cat;
    dit(!!K.titre && K.titre.clair && K.titre.fs >= 24, `P3 ${suf} : le titre de la catégorie, grand et en blanc sur le fond`, JSON.stringify(K.titre));
    dit(K.titres > 0 && K.titresClairs === K.titres, `P3 ${suf} : les titres de groupe en blanc sur le fond`, `${K.titresClairs}/${K.titres}`);
    dit(K.icones === 0 && K.rangees.length > 0 && K.rangees.every((h) => h >= 44), `P3 ${suf} : des rangées sans icône, ≥ 44 px`, `${K.icones} icône(s) · ${K.rangees.join(',')}`);
    dit(!!K.retour && K.retour.w >= 44 && K.retour.h >= 44, `P3 ${suf} : le rond « ‹ » ≥ 44 px`, JSON.stringify(K.retour));
  }
  if (m.vue === 'fiche-paire') {
    const F = m.fp;
    dit(F.heros && !!F.photo && F.photo.w >= 90, `F1 ${suf} : la paire en tête (photo ≥ 90 px)`, JSON.stringify(F.photo));
    dit(F.tuiles >= 2, `F2 ${suf} : prix d'achat et bénéfice en verres`, String(F.tuiles));
    dit(F.parcours, `F3 ${suf} : l'histoire de la paire`);
    if (tel) dit(F.hauteur != null && F.hauteur <= 844 * 1.5, `F4 ${suf} : la fiche tient en 1,5 écran (${F.hauteur} px ≤ ${Math.round(844 * 1.5)})`);
    dit(!F.jargon.length, `F5 ${suf} : aucun identifiant ni mot technique à l'écran`, F.jargon.slice(0, 5).join(' | '));
    dit(!F.doublons.length, `F5 ${suf} : chaque geste, chaque titre UNE fois`, F.doublons.slice(0, 5).join(' | '));
    console.log(`   ℹ️ F ${suf} : ${F.sites} ligne(s) par site, ${F.outils} geste(s)`);
  }
}

module.exports = { VUES, preparer, mesurer };
if (require.main === module) (async () => {
  // M7 (sur le code) — sans l'extension dans ce navigateur, l'offre ne se tranche pas ici : la règle du plein est lue
  // dans le code de la carte d'offre (App.jsx) — « Proposer N € » est LE plein quand une contre-offre est calculée,
  // « Accepter » ne l'est alors pas.
  {
    const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
    const i = app.indexOf("data-offre-geste=\"proposer\""), bloc = i > 0 ? app.slice(app.lastIndexOf('<div', i), app.indexOf('</div>', i)) : '';
    const prop = (bloc.match(/<button[^>]*data-offre-geste="proposer"[^>]*>/) || [''])[0];
    const acc = (bloc.match(/contre!=null \? <button[^>]*data-offre-geste="accepter"[^>]*>/) || [''])[0];
    dit(/vrm-chat-btn-p/.test(prop) && acc && !/vrm-chat-btn-p/.test(acc), 'M7 (code) : le plein de l\'offre va à « Proposer N € », pas à « Accepter »', `${prop.slice(0, 80)} | ${acc.slice(0, 60)}`);
  }
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const vue of VOULUES) {
      const suf = `${vue}-${W}-${th}`;
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b: B.baseVolume(), url: VUES[vue], api: B.apiVolume, dsf: DSF });
        await P.pret(o.pg);
        await preparer(o, vue);
        await o.pg.waitForTimeout(500);
        await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
        if (CAPTURE) { console.log('capture', suf); continue; }
        const m = await o.pg.evaluate(mesurer, vue);
        juger(m, suf, W < 600);
        if (o.erreurs.length) console.log(`   (erreurs de page : ${o.erreurs.slice(0, 2).join(' | ')})`);
      } catch (err) { dit(false, `${suf} : ouverture`, String(err.message || err).slice(0, 200)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${bilan.ok} ✅ · ${bilan.ko} ❌ (captures : ${SHOTS})`);
  process.exit(bilan.ko ? 1 : 0);
})();
