// ════════════════════════════════════════════════════════════════════════════
//  BANC « FINITION ÉCRAN PAR ÉCRAN » (15 nov.) — Julien : « tout doit être parfait », « je veux que ça
//  soit pro », « j'aime pas trop les écritures… enlève les écritures ». Récit : docs/passation/2026-11-15-finition-ecrans.md.
//
//  Il parcourt TOUS les écrans de la passe — Ma journée ; Ventes (À expédier, Envoyés, la fiche d'une vente,
//  la feuille d'impression) ; Achats (À retirer, À vérifier) ; Annonces, Stock et la fiche d'une paire ;
//  Leboncoin, eBay, Vestiaire ; Argent (résumé, factures, URSSAF, statistiques) ; Messages ; E-mails ;
//  Paramètres ; Communauté ; la loupe ; le disque « + » et son éventail — à 390 tactile ET 1512, clair ET
//  sombre, sur une base INVENTÉE (`_base-messages-stock.cjs` : 3 comptes, 1 000 annonces, 1 000 conversations,
//  1 000 e-mails ; garde réseau : rien ne sort). Il mesure, sur l'app RENDUE (§6.4 : géométrie et styles
//  calculés, jamais un libellé) :
//    D  aucun débordement horizontal : la page (`scrollWidth > innerWidth`) ni un élément visible qui sort
//       de l'écran à droite (hors bandes qui défilent de côté exprès : `overflow-x:auto|scroll`) ;
//    C  aucun chevauchement entre deux éléments interactifs visibles, ni entre deux textes visibles
//       (feuilles de texte) d'une même zone — l'intersection > 2 px dans les deux sens, hors parents/enfants,
//       hors couches posées exprès par-dessus (position fixed/sticky, feuilles, voiles) ;
//    E  aucun texte visible coupé par des points de suspension (`text-overflow:ellipsis` et
//       `scrollWidth > clientWidth`) sur les libellés de la passe — la liste `SURVEILLES` ; les autres coupes
//       sont RAPPORTÉES (jamais cachées), pas jugées : une liste de 1 000 titres longs se coupe, c'est voulu ;
//    T  cibles tactiles ≥ 44 px (390 tactile) : tout bouton/lien/rôle bouton visible dans la zone de l'écran ;
//    F  typographie : aucune espace ordinaire (ou fin de ligne) avant « : ; ? ! » ni entre un nombre et « € » /
//       entre « N° » et son nombre dans un texte visible des libellés surveillés.
//  `SHOTS=<dossier>` range une capture par écran (à REGARDER, §6.2) ; `ECRANS=journee,ventes` · `LARGEURS=390` ·
//  `THEMES=clair` restreignent ; `BANC_DIST=…` juge un autre build (avant/après) ; `CAPTURE=1` capture sans juger.
//  Un banc ne meurt pas, il rapporte : chaque écran qui ne s'ouvre pas est dit, avec sa raison.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const OUT = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const VOULUS = liste('ECRANS', '');
const CAPTURE = process.env.CAPTURE === '1';
const PLEIN = process.env.PLEIN === '1';

const attendre = (pg, sel, t = 8000) => pg.waitForSelector(sel, { timeout: t }).catch(() => null);
const toucher = async (o, sel) => {
  const l = o.pg.locator(sel).first();
  if (!(await l.count())) return false;
  await l.scrollIntoViewIfNeeded().catch(() => {});
  if (o.tel) await l.tap({ timeout: 6000 }).catch(() => l.click({ timeout: 4000, force: true }).catch(() => {}));
  else await l.click({ timeout: 6000 }).catch(() => {});
  await o.pg.waitForTimeout(700);
  return true;
};
// Chaque écran : son adresse, ce qu'il faut toucher pour l'atteindre, et la zone jugée.
const ECRANS = [
  { nom: 'journee', url: '/?tab=journee' },
  { nom: 'ventes', url: '/?tab=cat_bord' },
  { nom: 'ventes-envoyes', url: '/?tab=cat_bord', avant: (o) => toucher(o, '[data-colis-onglet-choix="envoyes"]') },
  { nom: 'ventes-fiche', url: '/?tab=cat_bord', zone: ['.vrm-fp', '.vrm-fs'], avant: async (o) => { const ok = await toucher(o, '[data-bord-card] .vrm-colis-titre'); await attendre(o.pg, '.vrm-fp, .vrm-fs', 5000); return ok; } },
  { nom: 'impression', url: '/?tab=cat_bord', zone: ['.vrm-fs', '.vrm-fp', '[data-lot]'], avant: async (o) => { await toucher(o, 'button[data-lot-ouvrir]'); return !!(await attendre(o.pg, '[data-lot]', 6000)); } },
  { nom: 'achats', url: '/?tab=achats' },
  { nom: 'achats-verifier', url: '/?tab=achats', avant: async (o) => { await o.pg.evaluate(() => { const e = document.querySelector('[data-achats-averifier], [data-repli="averifier"], [data-retirer-verifier]'); if (e) e.scrollIntoView({ block: 'start' }); }); return true; } },
  { nom: 'annonces', url: '/?tab=annonces' },
  { nom: 'stock', url: '/?tab=garage' },
  { nom: 'fiche-paire', url: '/?tab=journee', zone: ['[data-fiche-paire]', '.vrm-fs', '.vrm-fp'], avant: async (o) => { await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1203' }))); return !!(await attendre(o.pg, '[data-fiche-paire]', 8000)); } },
  { nom: 'leboncoin', url: '/?tab=plat_leboncoin' },
  { nom: 'ebay', url: '/?tab=plat_ebay' },
  { nom: 'vestiaire', url: '/?tab=plat_vestiaire' },
  { nom: 'argent', url: '/?tab=argent' },
  { nom: 'factures', url: '/?tab=invoices' },
  { nom: 'urssaf', url: '/?tab=argent_declarer' },
  { nom: 'stats', url: '/?tab=dashboard' },
  { nom: 'messages', url: '/?tab=messages' },
  { nom: 'emails', url: '/?tab=emails' },
  { nom: 'parametres', url: '/?tab=settings' },
  { nom: 'communaute', url: '/?tab=communaute' },
  { nom: 'loupe', url: '/?tab=journee', zone: ['[data-recherche-panneau]', '.vrm-hdr-recherche', '.vrm-fs'], avant: async (o) => {
    if (o.tel) await toucher(o, 'button[data-recherche-loupe]'); else { await o.pg.mouse.click(5, 300); await o.pg.keyboard.press('Control+K'); await o.pg.waitForTimeout(600); }
    return true; } },
  { nom: 'disque', tel: true, url: '/?tab=journee', zone: ['.sb-eventail', '[data-sb-disque]'], avant: (o) => toucher(o, '[data-sb-disque]') },
];

// Les libellés de la passe (corrigés ici) : une coupe « … » y est un ROUGE. Sélecteurs CSS (data-* et classes).
const SURVEILLES = [
  '.vrm-hdr-titre', '.sb-tete-titre', '.sb-tete-lib', '.sb-tuile-lib', '.sb-tuile-chiffre', '.sb-chiffre-affiche',
  '[data-finition]', '.vrm-ecran-titre', '.sb-seg', '.vrm-tab', '[data-colis-onglet-choix]', '[data-nav-entree]',
  '.sb-touche', '.sb-lien', '.sb-btn-plein', '.vrm-seg-btn', '.sb-lame',
  // corrigés par la passe (15 nov.) : la bande du Stock, la ligne « colis pressés » de Ma journée, les actions de la loupe,
  // la sous-ligne des réglages, le mot du plein, les rangées de Paramètres.
  '.vrm-ui-bande-l', '.vrm-day-task-note', '.vrm-day-task-title', '[data-recherche-groupe="action"] [data-recherche-info]', '.vrm-set-desc', '.sb-btn-plein-mot',
  '.vrm-pop-chip', '.vrm-hdr-recherche-fermer', '.vrm-jv2-ma-semaine',
];

function mesurerPage({ tactile, zone, surveilles }) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false;
    if (el.closest('[inert],[aria-hidden="true"],.sr-only,.vrm-sr,[data-sr-seul]')) return false;
    const cs = getComputedStyle(el);
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return false;
    return true;
  };
  // Un élément est-il découpé par un ancêtre qui le rogne (overflow hidden/auto) au point où il est invisible ?
  const rogne = (el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY)) {
        const q = p.getBoundingClientRect();
        if (r.right <= q.left + 1 || r.left >= q.right - 1 || r.bottom <= q.top + 1 || r.top >= q.bottom - 1) return true;
      }
    }
    return false;
  };
  // Le bord droit VU : un ancêtre qui rogne (overflow hidden/clip) coupe ce qui le dépasse — ce qui est coupé ne déborde pas de l'écran.
  const droiteVue = (el) => { let d = el.getBoundingClientRect().right; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) d = Math.min(d, p.getBoundingClientRect().right); } return d; };
  const bandeDeCote = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const roots = [...new Set(zone.flatMap((s) => [...document.querySelectorAll(s)]))].filter(vis);
  const out = { debordePage: null, deborde: [], chevauche: [], coupes: [], coupesAutres: [], cibles: [], typo: [], racines: roots.length };
  const se = document.scrollingElement || document.documentElement;
  if (se.scrollWidth > vw + 1) out.debordePage = `${se.scrollWidth} > ${vw}`;
  const nom = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
    const d = [...el.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => a.name).join(',');
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}${d ? '[' + d + ']' : ''} « ${t} »`;
  };
  const couche = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.position === 'fixed' || cs.position === 'sticky') return p; } return null; };
  const tous = roots.flatMap((r) => [r, ...r.querySelectorAll('*')]);
  const vus = new Set();
  const inter = [], textes = [];
  for (const el of tous) {
    if (vus.has(el)) continue; vus.add(el);
    if (!vis(el) || rogne(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // D : élément qui sort de l'écran à droite (hors bandes qui défilent de côté)
    if (r.right > vw + 1 && r.width < vw * 3 && !bandeDeCote(el) && !el.closest('svg') && droiteVue(el) > vw + 1) out.deborde.push(`${nom(el)} droite=${Math.round(droiteVue(el))}`);
    const estInter = el.matches('button, a[href], [role="button"], [role="tab"], [role="switch"], input:not([type="hidden"]), select, textarea, summary');
    if (estInter && !el.closest('svg') && !el.parentElement.closest('button, a[href], [role="button"], summary')) inter.push(el);
    const aTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (aTexte && !el.closest('svg')) textes.push(el);
    // E : coupes par points de suspension
    if (aTexte && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      const dit = nom(el);
      if (surveilles.some((s) => { try { return el.matches(s) || !!el.closest(s); } catch (_) { return false; } })) out.coupes.push(dit); else out.coupesAutres.push(dit);
    }
    // F : typographie française des textes visibles surveillés
    if (aTexte) {
      const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      if (/[0-9A-Za-zÀ-ÿ»)] [:;?!](\s|$)/.test(t) || /\d [€%]/.test(t) || /N° \d/.test(t) || /« | »/.test(t)) {
        if (surveilles.some((s) => { try { return el.matches(s) || !!el.closest(s); } catch (_) { return false; } })) out.typo.push(`${nom(el)} ⟨${t.trim().slice(0, 60)}⟩`);
      }
    }
  }
  // T : cibles
  if (tactile) for (const el of inter) {
    const r = el.getBoundingClientRect();
    if (el.matches('input[type="checkbox"],input[type="radio"]') && el.closest('label')) continue;
    if (el.matches('input,textarea,select') && r.width >= 44 && r.height >= 36) continue;
    // un lien DANS une phrase (texte courant) n'est pas une cible isolée
    if (el.matches('a[href]') && getComputedStyle(el).display === 'inline' && el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 20)) continue;
    if (Math.round(r.height) < 44 || Math.round(r.width) < 44) {
      // la cible peut être agrandie par un pseudo-élément (::before inset négatif) : on la juge par elementFromPoint autour
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const atteint = (x, y) => { const e = document.elementFromPoint(x, y); return e && (e === el || el.contains(e)); };
      // La cible RÉELLE : la suite de points (pas de 1 px) autour du centre où le doigt tombe sur elle — un pseudo-élément
      // qui l'agrandit compte, une touche enfoncée (décalée d'1 px) aussi ; 43 px suffisent (l'arrondi d'un puits de 44).
      const etendue = (axe) => { let n = 1; for (let d = 1; d <= 30 && atteint(axe === 'y' ? cx : cx - d, axe === 'y' ? cy - d : cy); d++) n++; for (let d = 1; d <= 30 && atteint(axe === 'y' ? cx : cx + d, axe === 'y' ? cy + d : cy); d++) n++; return n; };
      const haut = Math.max(r.height, etendue('y') >= 43 ? 44 : 0);
      const large = Math.max(r.width, etendue('x') >= 43 ? 44 : 0);
      if (haut < 44 || large < 44) out.cibles.push(`${nom(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  // C : chevauchements (interactifs entre eux ; textes entre eux), même couche, ni parent ni enfant.
  // La zone d'un élément : la racine jugée la plus proche (le contenu glisse SOUS la barre du bas et la tête :
  // deux zones différentes ne se « chevauchent » pas, c'est la barre qui le recouvre, voulu).
  const zoneDe = (el) => { let best = null; for (const r of roots) if (r.contains(el) && (!best || best.contains(r))) best = r; return best; };
  // Un texte se juge par la boîte de SES lettres (Range), pas par la boîte de son élément : un « ⓘ » dont la cible
  // de 44 px déborde exprès (marges négatives) sur la ligne d'au-dessus ne fait pas se heurter deux TEXTES.
  const boiteTexte = (e) => { let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity; for (const n of e.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(n); for (const q of g.getClientRects()) { if (q.width < 1) continue; L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); } } return R > L ? { left: L, top: T, right: R, bottom: B } : e.getBoundingClientRect(); };
  const chev = (l, sorte) => {
    const rs = l.map((e) => [e, sorte === 'textes' ? boiteTexte(e) : e.getBoundingClientRect(), couche(e), zoneDe(e)]);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const [a, ra, ca, za] = rs[i], [b, rb, cb, zb] = rs[j];
      if (a.contains(b) || b.contains(a) || ca !== cb || za !== zb) continue;
      // un bouton posé EXPRÈS dans une rangée (puce « copier le code » sur la ligne d'un e-mail) : entièrement dedans,
      // ce n'est pas un chevauchement de boutons ; ce qui s'y heurte VRAIMENT (l'heure sous la puce) est jugé par les textes.
      // (même chose pour l'icône posée DANS un champ : le micro au bout de la recherche, à 4 px près.)
      if (sorte === 'boutons' && ((rb.left >= ra.left - 4 && rb.right <= ra.right + 4 && rb.top >= ra.top - 4 && rb.bottom <= ra.bottom + 4) || (ra.left >= rb.left - 4 && ra.right <= rb.right + 4 && ra.top >= rb.top - 4 && ra.bottom <= rb.bottom + 4))) continue;
      // hors de l'écran visible de la zone (sous la barre du bas / la tête) : la barre le recouvre
      const x0 = Math.max(ra.left, rb.left), y0 = Math.max(ra.top, rb.top);
      const dessus = document.elementFromPoint(Math.min(vw - 1, x0 + 1), Math.min(vh - 1, y0 + 1));
      if (dessus && !(za && za.contains(dessus))) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) {
        // l'un des deux est-il vraiment dessiné au point commun ? (un élément caché derrière un autre opaque n'est pas un chevauchement VU)
        const x = Math.max(ra.left, rb.left) + w / 2, y = Math.max(ra.top, rb.top) + h / 2;
        const top = document.elementFromPoint(x, y);
        // (un texte dans un bouton dont les enfants ne prennent pas le pointeur : le bouton « au-dessus » est son ancêtre, il est vu)
        const voitA = top && (top === a || a.contains(top) || top.contains(a)), voitB = top && (top === b || b.contains(top) || top.contains(b));
        if (!voitA && !voitB) continue;
        out.chevauche.push(`${sorte} : ${nom(a)} ⟂ ${nom(b)} (${Math.round(w)}×${Math.round(h)})`);
      }
    }
  };
  chev(inter, 'boutons');
  chev(textes, 'textes');
  for (const k of ['deborde', 'chevauche', 'coupes', 'coupesAutres', 'cibles', 'typo']) out[k] = [...new Set(out[k])];
  return out;
}

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  let v = 0, r = 0; const rouges = [], autres = [];
  const dit = (ok, quoi, detail) => { if (ok) { v++; console.log('✅', quoi); } else { r++; rouges.push(quoi); console.log('❌', quoi, detail ? '— ' + String(detail).slice(0, 1400) : ''); } };
  try {
    for (const W of LARG) for (const t of THEMES) for (const e of ECRANS) {
      if (VOULUS.length && !VOULUS.includes(e.nom)) continue;
      if (e.tel && W >= 600) continue;   // le disque « + » n'existe qu'au téléphone (barre du bas)
      const tag = `${e.nom}-${W}-${t}`;
      let o;
      try {
        o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: B.baseVolume(), url: e.url, api: B.apiVolume });
        await P.pret(o.pg);
        let atteint = true;
        if (e.avant) atteint = await e.avant(o);
        await o.pg.waitForTimeout(900);
        if (OUT) await o.pg.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: PLEIN });
        if (CAPTURE) { console.log(tag, atteint ? '' : '(pas atteint)', o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : ''); continue; }
        const zone = e.zone || ['.vrm-main', '.vrm-hdr', '.vrm-tabbar'];
        const m = await o.pg.evaluate(mesurerPage, { tactile: o.tel, zone, surveilles: SURVEILLES });
        dit(m.racines > 0, `${tag} : l'écran est rendu`, `racines=${m.racines} atteint=${atteint}`);
        dit(o.erreurs.length === 0, `${tag} : aucune erreur de page`, o.erreurs.join(' | '));
        dit(!m.debordePage && !m.deborde.length, `${tag} : D rien ne déborde de côté`, [m.debordePage, ...m.deborde.slice(0, 6)].filter(Boolean).join(' · '));
        dit(!m.chevauche.length, `${tag} : C aucun chevauchement`, m.chevauche.slice(0, 8).join(' · '));
        dit(!m.coupes.length, `${tag} : E aucun libellé de la passe coupé par « … »`, m.coupes.slice(0, 8).join(' · '));
        if (o.tel) dit(!m.cibles.length, `${tag} : T cibles ≥ 44 px`, m.cibles.slice(0, 8).join(' · '));
        dit(!m.typo.length, `${tag} : F espaces insécables avant « : ; ? ! », « € », « N° »`, m.typo.slice(0, 6).join(' · '));
        if (m.coupesAutres.length) autres.push(`${tag} : ${m.coupesAutres.length} coupe(s) hors passe — ${m.coupesAutres.slice(0, 4).join(' · ')}`);
      } catch (err) { dit(false, `${tag} : l'écran s'ouvre`, String(err && err.message || err).slice(0, 300)); }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  } finally { await nav.close(); P.srv.close(); }
  if (CAPTURE) return;
  if (autres.length) { console.log('\nRAPPORTÉ (non jugé) — coupes « … » hors des libellés de la passe :'); autres.forEach((x) => console.log('  ·', x.slice(0, 600))); }
  console.log(`\n${v} ✅ · ${r} ❌`);
  if (r) { console.log('Rouges :\n  ' + rouges.join('\n  ')); process.exitCode = 1; }
})();
