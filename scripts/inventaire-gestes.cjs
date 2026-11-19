// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE DES GESTES (19 nov. — Julien : « Remets vraiment tout en question sur la
//  praticité, l'utilité de chaque bouton »).
//    npm run build && node scripts/inventaire-gestes.cjs
//
//  Un OUTIL DE MESURE, pas un contrôle (il ne juge rien, il compte) : la VRAIE app (`dist`),
//  une base INVENTÉE au volume de la sienne (`_base-messages-stock` : 3 comptes Vinted, 1 000
//  annonces numérotées, 1 000 conversations, ~1 200 ventes — aucune donnée réelle, le dépôt est
//  public), la session du banc `design-passe` (la même que `fiabilite-auto`), garde réseau.
//  À 390 px (tactile) et 1512 px, il ouvre CHAQUE écran (`ECRANS` ci-dessous), relève tout ce
//  qui se touche, puis TOUCHE chaque gabarit d'élément (une fois) pour relever ce que ce toucher
//  fait apparaître (feuille « ⋯ », menu, section dépliée, sous-onglet) — et recommence un
//  niveau plus bas dans les feuilles. Pour chaque élément :
//    écran · chemin (les touchers qui y mènent) · nombre de touchers depuis l'ouverture de l'app ·
//    libellé / nom accessible · sorte (navigation · action · réglage · information · aide) ·
//    ses `data-*` · sa zone (écran, en-tête, barre, feuille) · visible sans défiler ou non ·
//    le nombre d'exemplaires du même gabarit (une rangée répétée 1 000 fois = UNE ligne).
//  AUCUNE écriture n'a d'effet : `rest/v1` en écriture et `/api/**` sont répondus par le banc,
//  `window.open`, `print`, le presse-papier et les boîtes natives sont neutralisés ; les gestes
//  qui quittent l'app (déconnexion, paiement, suppression du compte) ne sont jamais touchés.
//
//  ⚠️ Machine partagée : UN navigateur, UNE page à la fois, chaque contexte est fermé ; jamais
//  de `pkill`. `LARGEURS=390` `ECRANS=ventes,achats` `PROFONDEUR=1|2` `MAX_CLICS=40` `MAX_ENFANTS=6`.
//  Sorties : `docs/design/inventaire-gestes.json` (tout) et
//  `docs/design/2026-11-19-inventaire-gestes.md` (les tables, par écran) — `SORTIE=<dossier>`.
//  Ce que le banc N'ATTEINT PAS (états rares, extension requise, eBay / Vestiaire connectés,
//  base vide) est complété à la main dans `docs/design/2026-11-19-audit-utilite.md`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const B = path.join(__dirname, 'bancs');
const P = require(path.join(B, 'design-passe.cjs'));
const V = require(path.join(B, '_base-messages-stock.cjs'));
const R = path.join(__dirname, '..');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const PROFONDEUR = Number(process.env.PROFONDEUR || 2);
const MAX_CLICS = Number(process.env.MAX_CLICS || 40);
const MAX_ENFANTS = Number(process.env.MAX_ENFANTS || 6);
const SORTIE = process.env.SORTIE || path.join(R, 'docs', 'design');
const VOULUS = liste('ECRANS', '');
const ATTENTE_RECHARGE = Number(process.env.ATTENTE_RECHARGE || 900);
const ATTENTE_GESTE = Number(process.env.ATTENTE_GESTE || 380);
let BASE = null;

// [identifiant, adresse, nom lisible, touchers pour l'atteindre au téléphone, à l'ordinateur, par où]
// Les touchers d'accès sont ceux de la coque d'aujourd'hui (barre du bas : Aujourd'hui · Annonces ·
// Achats · Ventes · Argent ; le reste par le menu ☰ ou la photo du profil ; colonne à l'ordinateur).
const ECRANS = [
  ['journee', '/?tab=journee', 'Aujourd’hui (Ma journée)', 0, 0, 'ouverture'],
  ['annonces', '/?tab=annonces', 'Annonces', 1, 1, 'barre'],
  ['republier', '/?tab=republier', 'Annonces › Republier', 2, 2, 'Annonces › vue'],
  ['garage', '/?tab=garage', 'Stock', 2, 1, 'Annonces › Stock (tél.) · colonne'],
  ['achats', '/?tab=achats', 'Achats', 1, 1, 'barre'],
  ['ventes', '/?tab=ventes', 'Ventes', 1, 1, 'barre'],
  ['litiges', '/?tab=litiges', 'Ventes › Litiges en cours', 2, 2, 'Ventes'],
  ['compta', '/?tab=compta', 'Argent › Résumé', 1, 1, 'barre'],
  ['dashboard', '/?tab=dashboard', 'Argent › Statistiques', 2, 2, 'Argent › segment'],
  ['invoices', '/?tab=invoices', 'Argent › Factures', 2, 2, 'Argent › segment'],
  ['prixmarche', '/?tab=prixmarche', 'Argent › Prix du marché', 3, 3, 'Argent › Statistiques'],
  ['messages', '/?tab=messages', 'Messages', 2, 1, 'menu ☰ (tél.) · colonne'],
  ['favoris', '/?tab=favoris', 'Messages › Favoris & offres', 3, 2, 'Messages › section'],
  ['emails', '/?tab=emails', 'E-mails', 2, 1, 'menu ☰ (tél.) · colonne'],
  ['communaute', '/?tab=communaute', 'Communauté', 2, 1, 'menu ☰ (tél.) · colonne'],
  ['settings', '/?tab=settings', 'Paramètres', 2, 2, 'photo du profil'],
  ['vintedaccounts', '/?tab=vintedaccounts', 'Paramètres › Comptes liés', 4, 4, 'Paramètres › catégorie'],
  ['masques', '/?tab=masques', 'Achats masqués', 3, 3, 'Achats › ⋯'],
  ['organisation', '/?tab=organisation', 'Organisation', 4, 4, 'Paramètres › Stock et rangement'],
  ['trancher', '/?tab=trancher', 'À trancher', 1, 1, 'carte de Ma journée'],
  ['semaine', '/?tab=semaine', 'Ma semaine', 1, 1, 'Ma journée'],
  ['catalog', '/?tab=catalog', 'Catalogue (ancien écran)', 9, 9, 'lien seul'],
  ['stockvinted', '/?tab=stockvinted', 'Stock Vinted (ancien écran)', 9, 9, 'lien seul'],
  ['inventory', '/?tab=inventory', 'Inventaire (ancien écran)', 9, 9, 'lien seul'],
  // Deux états ouverts par un événement de l'app (le même que touche une rangée / la loupe).
  ['fiche', '/?tab=journee', 'La fiche d’une paire', 2, 2, 'une rangée › la paire', 'fiche'],
  ['loupe', '/?tab=journee', 'La loupe (recherche)', 1, 1, 'en-tête', 'loupe'],
];

// ── DANS LA PAGE : tout ce qui se touche, regroupé par gabarit. ─────────────────────────────
function relever() {
  const SEL = 'button, a[href], [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=link], [role=option], summary, input:not([type=hidden]), select, textarea, [onclick], label[for]';
  const vh = window.innerHeight, vw = window.innerWidth;
  const rendu = (e) => {
    if (!e.getClientRects().length) return false;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    if (e.closest('[inert], [aria-hidden="true"]')) return false;
    const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1;
  };
  const nomDe = (e) => {
    const al = e.getAttribute('aria-label'); if (al) return al.trim();
    const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) {
      const id = e.id && document.querySelector('label[for="' + CSS.escape(e.id) + '"]');
      const lab = id || e.closest('label');
      return ((lab && lab.innerText) || e.getAttribute('placeholder') || e.getAttribute('name') || e.getAttribute('title') || '').trim();
    }
    const t = (e.innerText || '').replace(/\s+/g, ' ').trim(); if (t) return t;
    const img = e.querySelector('img[alt], svg[aria-label], [title]');
    return (e.getAttribute('title') || (img && (img.getAttribute('alt') || img.getAttribute('aria-label') || img.getAttribute('title'))) || '').trim();
  };
  const dataDe = (e) => { const o = {}; for (const a of e.attributes) if (a.name.startsWith('data-') && !/^data-(inv|radix|state$)/.test(a.name)) o[a.name.slice(5)] = String(a.value).slice(0, 40); return o; };
  const fixe = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };
  const zoneDe = (e) => {
    if (e.closest('[role=menu]')) return 'menu';
    if (e.closest('[role=dialog], [aria-modal="true"], .vrm-fs, .vrm-fp, .v2-feuille-hote')) return 'feuille';
    if (e.closest('nav.vrm-sidebar')) return 'colonne';
    if (e.closest('header.vrm-app-header')) return 'en-tête';
    const n = e.closest('nav');
    if (n && !n.closest('main')) { const r = n.getBoundingClientRect(); return r.top > vh * 0.75 ? 'barre du bas' : 'navigation'; }
    if (e.closest('main')) return 'écran';
    const f = fixe(e);
    if (f) { const r = f.getBoundingClientRect(); if (r.height < 120 && r.top > vh * 0.7) return 'barre du bas'; if (r.height < 120 && r.top < 80) return 'en-tête'; return 'feuille'; }
    return 'hors écran principal';
  };
  const gabarit = (e) => { const p = []; for (let x = e, i = 0; x && x !== document.body && i < 4; x = x.parentElement, i++) { const d = [...x.attributes].filter((a) => a.name.startsWith('data-') && !/^data-inv/.test(a.name)).map((a) => a.name.slice(5)).sort().join(','); const c = String(x.className && x.className.baseVal != null ? x.className.baseVal : x.className || '').split(/\s+/).filter((k) => /^(vrm|sb|v2|n)-/.test(k)).slice(0, 2).join('.'); p.push(x.tagName.toLowerCase() + (c ? '.' + c : '') + (d ? '[' + d + ']' : '')); } return p.join('<'); };
  const groupes = new Map();
  window.__inv = new Map();
  for (const e of document.querySelectorAll(SEL)) {
    if (!rendu(e)) continue;
    // Un <label for> qui enveloppe un champ déjà relevé, un [onclick] qui contient un bouton : pas deux fois.
    if (e.tagName === 'LABEL' && document.getElementById(e.getAttribute('for'))) continue;
    const zone = zoneDe(e), g = zone + '§' + gabarit(e);
    const nom = nomDe(e).slice(0, 90);
    const r = e.getBoundingClientRect();
    const it = { e, nom, r, data: dataDe(e) };
    if (!groupes.has(g)) groupes.set(g, []);
    groupes.get(g).push(it);
  }
  const out = [];
  const sortir = (zone, gab, items, repete) => {
    const e = items[0].e, r = items[0].r;
    const role = e.getAttribute('role') || '', tag = e.tagName.toLowerCase(), type = e.getAttribute('type') || '';
    const noms = [...new Set(items.map((x) => x.nom))];
    const cle = zone + '§' + gab + '§' + (repete ? '*' : noms[0]);
    window.__inv.set(cle, e);
    out.push({
      cle, zone, tag, role, type, n: items.length, repete,
      nom: repete ? noms.slice(0, 3).join(' · ') : noms[0], data: items[0].data,
      href: tag === 'a' ? (e.getAttribute('href') || '').slice(0, 80) : '',
      inactif: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'),
      etat: e.getAttribute('aria-expanded') != null ? 'déplie' : e.getAttribute('aria-pressed') != null || e.getAttribute('aria-selected') != null || e.getAttribute('aria-checked') != null ? 'choix' : e.getAttribute('aria-haspopup') ? 'ouvre' : '',
      sansDefiler: r.top < vh && r.bottom > 0 && r.left < vw,
      h: Math.round(r.height), l: Math.round(r.width),
    });
  };
  for (const [g, items] of groupes) {
    const [zone, gab] = g.split('§');
    const parNom = new Map(); for (const it of items) { if (!parNom.has(it.nom)) parNom.set(it.nom, []); parNom.get(it.nom).push(it); }
    // Le même gabarit sous plus de 6 noms = une rangée répétée (une liste) : UNE ligne, avec son nombre.
    if (parNom.size > 6) sortir(zone, gab, items, true);
    else for (const l of parNom.values()) sortir(zone, gab, l, false);
  }
  return { tab: (history.state || {}).vrmTab || '', elements: out, feuilles: out.filter((x) => x.zone === 'feuille' || x.zone === 'menu').length };
}

// ── LA SORTE d'un élément (heuristique dite : tag, rôle, data-*, libellé). ───────────────────
const SORTES = ['navigation', 'action', 'réglage', 'information', 'aide'];
function sorteDe(x) {
  const n = (x.nom || '').toLowerCase(), d = Object.keys(x.data || {}).join(' ').toLowerCase();
  if (/aide|\bcomment\b|pourquoi|en savoir plus|c.est quoi|^\?$/.test(n) || /(^| )(aide|bulle|explic)/.test(d)) return 'aide';
  if (['input', 'select', 'textarea'].includes(x.tag) || ['switch', 'checkbox', 'radio'].includes(x.role) || x.etat === 'choix' || x.role === 'tab') return 'réglage';
  if (x.tag === 'summary' || x.etat === 'déplie' || x.inactif) return 'information';
  if (x.tag === 'a' || ['barre du bas', 'colonne', 'navigation'].includes(x.zone) || x.role === 'link' || /^(voir|ouvrir|retour|fermer|aller|tout voir|‹|←|×|✕)/.test(n) || /(^| )(nav|aller|ouvrir|onglet|retour|fermer|lien|sous-ouvrir)/.test(d)) return 'navigation';
  return 'action';
}
const normNom = (s) => String(s || '').toLowerCase().replace(/\d+([.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim();
const DANGER = /d[ée]conn|supprimer (mon|le|ce) compte|payer|s.abonner|r[ée]silier|stripe|quitter/i;
const touchable = (x) => !x.inactif && !('aller-contenu' in (x.data || {})) && !['input', 'select', 'textarea'].includes(x.tag) && !['barre du bas', 'colonne', 'navigation'].includes(x.zone) && !DANGER.test(x.nom) && !(x.tag === 'a' && /^(https?:|mailto:|tel:)/.test(x.href));

const INIT = () => {
  try {
    window.open = () => null; window.print = () => {};
    window.confirm = () => false; window.alert = () => {}; window.prompt = () => null;
    if (navigator.clipboard) { navigator.clipboard.writeText = () => Promise.resolve(); }
    if (navigator.share) navigator.share = () => Promise.resolve();
  } catch (_) {}
};

async function toucher(pg, cle, tel) {
  const pt = await pg.evaluate((cle) => {
    const e = window.__inv && window.__inv.get(cle); if (!e || !e.isConnected) return null;
    e.scrollIntoView({ block: 'center', inline: 'center' });
    const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const s = document.elementFromPoint(x, y);
    const libre = !!s && (s === e || e.contains(s) || s.contains(e));
    if (!libre) { try { e.click(); } catch (_) {} return { fait: true }; }
    return { x, y };
  }, cle).catch(() => null);
  if (!pt) return false;
  if (pt.fait) return true;
  try { if (tel) await pg.touchscreen.tap(pt.x, pt.y); else await pg.mouse.click(pt.x, pt.y); } catch (_) { return false; }
  return true;
}

async function inventorier(nav, [id, url, nom, tTel, tOrdi, acces, special], W) {
  const tel = W < 600, base = tel ? tTel : tOrdi;
  const lignes = [];
  let o = null, clics = 0, recharges = 0, rates = 0, depot = null;
  const noter = (els, chemin, parent) => { for (const x of els) lignes.push({ ecran: id, nomEcran: nom, largeur: W, chemin, touchers: base + chemin.length + 1, sorte: sorteDe(x), nom: x.nom, zone: x.zone, tag: x.tag, role: x.role, type: x.type, etat: x.etat, n: x.n, repete: x.repete, inactif: x.inactif, sansDefiler: x.sansDefiler, h: x.h, data: x.data, href: x.href, cle: x.cle, parent: parent || '' }); };
  const ouvrirEcran = async () => {
    if (!o) {
      o = await P.ouvrir(nav, { W, sombre: false, b: BASE || (BASE = V.baseVolume()), url, api: V.apiVolume });
      o.pg.on('dialog', (d) => d.dismiss().catch(() => {}));
      await o.pg.addInitScript(INIT);
      await P.pret(o.pg);
      // L'état rangé sur l'appareil au départ : un filtre touché (site, vue) s'y enregistre — on le REPOSE à chaque
      // rechargement, sinon l'écran rouvre sur le filtre du toucher d'avant et plus rien du départ n'est retrouvé.
      depot = await o.pg.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])).catch(() => null);
    } else {
      if (depot) await o.pg.evaluate((d) => { try { const [l, s] = JSON.parse(d); localStorage.clear(); for (const [k, v] of l) localStorage.setItem(k, v); sessionStorage.clear(); for (const [k, v] of s) sessionStorage.setItem(k, v); } catch (_) {} }, depot).catch(() => {});
      // Même contexte (une seule page) : on recharge l'écran, le cache du navigateur fait le reste.
      await o.pg.goto(`http://localhost:${P.PORT}${url}`, { waitUntil: 'domcontentloaded' });
      await o.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
      await o.pg.waitForTimeout(ATTENTE_RECHARGE);
    }
    await o.pg.evaluate(INIT).catch(() => {});
    if (special === 'fiche') {
      await o.pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '1205' })));
      await o.pg.waitForSelector('[data-fiche-paire]', { timeout: 8000 }).catch(() => {});
      await o.pg.waitForTimeout(1500);
    }
    if (special === 'loupe') {
      if (tel) await o.pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
      else { await o.pg.mouse.click(5, 300); await o.pg.keyboard.press('Control+K'); }
      await o.pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
      await o.pg.waitForTimeout(800);
    }
  };
  const etat = () => o.pg.evaluate(relever).catch(() => ({ tab: '', elements: [], feuilles: 0 }));
  try {
    await ouvrirEcran();
    const e0 = await etat();
    const cles0 = new Set(e0.elements.map((x) => x.cle));
    // « Neuf » après un toucher : un NOM (chiffres neutralisés) ou une liste que l'écran de départ ne portait pas,
    // dans l'écran ou une feuille — un élément de l'en-tête ou de la barre qui change de libellé n'est pas neuf.
    const idDe = (x) => (x.repete ? '*' + x.cle : normNom(x.nom) || x.cle);
    const ids0 = new Set(e0.elements.map(idDe));
    const estNeuf = (x, connus) => !['en-tête', 'barre du bas', 'colonne', 'navigation'].includes(x.zone) && !connus.has(idDe(x));
    // Sur la fiche et la loupe, on ne relève que la feuille ouverte (le reste est l'écran dessous).
    const depart = special ? e0.elements.filter((x) => x.zone === 'feuille' || x.zone === 'menu' || x.zone === 'hors écran principal') : e0.elements;
    noter(depart.length ? depart : e0.elements, []);
    // « De retour » : le même écran, autant de feuilles ouvertes, et 92 % des éléments du départ (par nom neutralisé :
    // une heure ou un compteur qui bouge ne compte pas pour un autre état).
    const memeEtat = async () => { const e = await etat(); const la = new Set(e.elements.map(idDe)); let n = 0; for (const k of ids0) if (la.has(k)) n++; return e.tab === e0.tab && e.feuilles === e0.feuilles && n >= ids0.size * 0.92; };
    const revenir = async () => {
      for (let i = 0; i < 2; i++) { await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(220); if (await memeEtat()) { await etat(); return; } }
      recharges++; await ouvrirEcran();
      // L'écran rechargé est « de retour » quand il porte de nouveau ce que le départ portait (au plus 8 s).
      for (let i = 0; i < 12; i++) { if (await memeEtat()) break; await o.pg.waitForTimeout(300); }
    };
    if (PROFONDEUR >= 1) for (const c of (depart.length ? depart : e0.elements).filter(touchable)) {
      if (clics >= MAX_CLICS) break;
      const T0 = Date.now();
      await etat();   // repose `__inv` sur l'état de départ
      if (!(await toucher(o.pg, c.cle, tel))) { rates++; continue; }
      clics++;
      await o.pg.waitForTimeout(ATTENTE_GESTE);
      const e1 = await etat();
      const ligne = lignes.find((l) => l.cle === c.cle && !l.chemin.length);
      if (e1.tab && e1.tab !== e0.tab) { if (ligne) { ligne.mene = 'écran ' + e1.tab; ligne.sorte = 'navigation'; } await revenir(); continue; }
      const neufs = e1.elements.filter((x) => estNeuf(x, ids0));
      if (!neufs.length) { if (ligne) ligne.mene = e1.elements.length < e0.elements.length * 0.7 ? 'remplace l’écran' : 'sur place'; if (!(await memeEtat())) await revenir(); continue; }
      const feuille = neufs.some((x) => x.zone === 'feuille' || x.zone === 'menu');
      if (ligne) ligne.mene = (feuille ? 'ouvre une feuille' : 'déplie sur place') + ' (' + neufs.length + ')';
      noter(neufs, [c.nom || c.tag], c.cle);
      if (process.env.TEMPS) console.log('    ', Date.now() - T0, 'ms ·', c.nom.slice(0, 40), '→', neufs.length);
      if (PROFONDEUR >= 2 && feuille) {
        const ids1 = new Set([...ids0, ...neufs.map(idDe)]);
        let k = 0;
        for (const d of neufs.filter(touchable).filter((x) => x.zone === 'feuille' || x.zone === 'menu')) {
          if (k >= MAX_ENFANTS || clics >= MAX_CLICS * 2) break;
          if (/^(fermer|annuler|×|✕|retour|ok|terminé)$/i.test(d.nom.trim())) continue;
          // revenir à la feuille du parent
          if (k > 0) { await revenir(); await etat(); if (!(await toucher(o.pg, c.cle, tel))) break; await o.pg.waitForTimeout(ATTENTE_GESTE); await etat(); }
          if (!(await toucher(o.pg, d.cle, tel))) continue;
          k++; clics++;
          await o.pg.waitForTimeout(ATTENTE_GESTE);
          const e2 = await etat();
          const l2 = lignes.find((l) => l.cle === d.cle && l.parent === c.cle);
          if (e2.tab && e2.tab !== e0.tab) { if (l2) { l2.mene = 'écran ' + e2.tab; l2.sorte = 'navigation'; } continue; }
          const neufs2 = e2.elements.filter((x) => estNeuf(x, ids1));
          if (l2) l2.mene = neufs2.length ? 'ouvre (' + neufs2.length + ')' : 'sur place / ferme';
          if (neufs2.length) noter(neufs2, [c.nom || c.tag, d.nom || d.tag], d.cle);
        }
      }
      await revenir();
    }
    console.log(`  ${String(W).padStart(4)} · ${id.padEnd(15)} ${String(lignes.length).padStart(4)} éléments · ${clics} touchers · ${recharges} rechargements${rates ? ' · ' + rates + ' introuvables après rechargement' : ''}` + (o.erreurs.length ? ' · erreurs JS : ' + o.erreurs.slice(0, 1).join(' | ') : ''));
  } catch (e) { console.log(`  ${W} · ${id} : ÉCHEC ${String(e.message || e).slice(0, 160)}`); }
  finally { if (o) await o.ctx.close().catch(() => {}); }
  return lignes.map(({ cle, parent, ...l }) => l);
}

function ecrireRapport(tout) {
  fs.mkdirSync(SORTIE, { recursive: true });
  const anciens = (() => { try { return JSON.parse(fs.readFileSync(path.join(SORTIE, 'inventaire-gestes.json'), 'utf8')).elements || []; } catch (_) { return []; } })();
  // Un passage partiel (`ECRANS=`, `LARGEURS=`) ne remplace que ce qu'il a relevé.
  const refaits = new Set(tout.map((l) => l.ecran + '|' + l.largeur));
  const elements = [...anciens.filter((l) => !refaits.has(l.ecran + '|' + l.largeur)), ...tout];
  const ordre = ECRANS.map((e) => e[0]);
  elements.sort((a, b) => ordre.indexOf(a.ecran) - ordre.indexOf(b.ecran) || a.largeur - b.largeur || a.chemin.length - b.chemin.length || a.chemin.join('›').localeCompare(b.chemin.join('›')));
  const resume = {};
  for (const l of elements) {
    const r = resume[l.ecran] || (resume[l.ecran] = { nom: l.nomEcran });
    const k = r[l.largeur] || (r[l.largeur] = { total: 0, premierNiveau: 0, sansDefiler: 0, derriereUnToucher: 0, navigation: 0, action: 0, 'réglage': 0, information: 0, aide: 0, touchersMax: 0 });
    k.total++; k[l.sorte]++; if (!l.chemin.length) { k.premierNiveau++; if (l.sansDefiler) k.sansDefiler++; } else k.derriereUnToucher++;
    k.touchersMax = Math.max(k.touchersMax, l.touchers);
  }
  fs.writeFileSync(path.join(SORTIE, 'inventaire-gestes.json'), JSON.stringify({ v: 1, base: 'inventée (_base-messages-stock)', profondeur: PROFONDEUR, resume, elements }, null, 1));
  const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '/').replace(/\n/g, ' ');
  const md = [];
  md.push('# Inventaire des gestes — relevé par `scripts/inventaire-gestes.cjs`', '',
    'Fichier FABRIQUÉ (ne pas le corriger à la main : relancer l’outil). La vraie app, une base inventée au volume de celle de Julien,',
    'à 390 px (téléphone) et 1512 px (ordinateur). Une rangée répétée (une liste de 1 000 annonces) compte pour UNE ligne, avec son nombre.',
    '« Touchers » = nombre de touchers depuis l’ouverture de l’app pour ACTIVER l’élément (accès à l’écran + chemin + lui).',
    'La sorte est déduite (balise, rôle, `data-*`, libellé) : c’est une aide au tri, pas un jugement. Le verdict est dans `2026-11-19-audit-utilite.md`.', '');
  md.push('## Le compte, écran par écran', '', '| écran | accès | 390 : éléments (dont visibles sans défiler · derrière un toucher) | 1512 : éléments | navigation · action · réglage · information · aide (390) | touchers max |', '|---|---|---|---|---|---|');
  let T390 = 0, T1512 = 0;
  for (const [id, , nom, tT, tO, acces] of ECRANS) {
    const r = resume[id]; if (!r) continue;
    const a = r[390], b = r[1512];
    if (a) T390 += a.total; if (b) T1512 += b.total;
    md.push(`| ${nom} | ${acces} (${tT} / ${tO}) | ${a ? `${a.total} (${a.sansDefiler} · ${a.derriereUnToucher})` : '—'} | ${b ? `${b.total} (${b.sansDefiler} · ${b.derriereUnToucher})` : '—'} | ${a ? `${a.navigation} · ${a.action} · ${a['réglage']} · ${a.information} · ${a.aide}` : '—'} | ${a ? a.touchersMax : '—'} |`);
  }
  md.push(`| **Total** | | **${T390}** | **${T1512}** | | |`, '');
  for (const [id, , nom] of ECRANS) {
    for (const W of [390, 1512]) {
      const ls = elements.filter((l) => l.ecran === id && l.largeur === W); if (!ls.length) continue;
      md.push(`## ${nom} — ${W} px (${ls.length})`, '', '| chemin | libellé | sorte | zone | × | touchers | effet | data-* |', '|---|---|---|---|---|---|---|---|');
      for (const l of ls) md.push(`| ${esc(l.chemin.map((c) => c.slice(0, 28)).join(' › ')) || '(écran)'} | ${esc(l.nom.slice(0, 70)) || '*(sans nom)*'}${l.inactif ? ' *(inactif)*' : ''} | ${l.sorte} | ${l.zone}${l.chemin.length || l.sansDefiler ? '' : ' ↓'} | ${l.n > 1 ? l.n : ''} | ${l.touchers} | ${esc(l.mene || '')} | ${esc(Object.entries(l.data || {}).slice(0, 4).map(([k, v]) => (v ? `${k}=${v}` : k)).join(' ').slice(0, 70))} |`);
      md.push('');
    }
  }
  fs.writeFileSync(path.join(SORTIE, '2026-11-19-inventaire-gestes.md'), md.join('\n'));
  return { resume, T390, T1512, n: elements.length };
}

(async () => {
  if (!fs.existsSync(path.join(R, 'dist', 'index.html')) && !process.env.BANC_DIST) { console.log('✗ pas de `dist` : lance `npm run build` d’abord'); process.exit(2); }
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const tout = [];
  const t0 = Date.now();
  try {
    for (const W of LARGEURS) for (const E of ECRANS) {
      if (VOULUS.length && !VOULUS.includes(E[0])) continue;
      tout.push(...await inventorier(nav, E, W));
      ecrireRapport(tout);   // au fil de l'eau : un passage interrompu garde ce qu'il a relevé
    }
  } finally { await nav.close().catch(() => {}); P.srv.close(); }
  const r = ecrireRapport(tout);
  console.log(`\nINVENTAIRE : ${r.n} éléments (390 px : ${r.T390} · 1512 px : ${r.T1512}) en ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log('→', path.relative(R, path.join(SORTIE, 'inventaire-gestes.json')), '·', path.relative(R, path.join(SORTIE, '2026-11-19-inventaire-gestes.md')));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
