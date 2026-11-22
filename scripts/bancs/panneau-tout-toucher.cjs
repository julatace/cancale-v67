// ════════════════════════════════════════════════════════════════════════════
//  BANC « TOUT TOUCHER » (22 nov., audit complet de l'extension)
//
//  Julien, 22 nov. : « audite toute l'extension, ne laisse aucun bug, que tous les boutons marchent ».
//  Le VRAI panneau (vrm-badge.js, vrm-ui.js) relié au VRAI fond (background.js en vm) par `_pont-panneau.cjs`.
//  Pour chaque page du panneau, à l'ordinateur (1512) et au téléphone (390, Orion), le banc RECENSE chaque
//  contrôle visible (bouton, lien, case, interrupteur, champ, liste, « summary ») et le TOUCHE, puis touche ce
//  que ce toucher a fait apparaître (feuille, rangée dépliée, menu : deux niveaux). Il juge :
//   · MORT     : le toucher n'a rien produit (ni message au fond, ni écriture, ni changement à l'écran, ni
//                adresse ouverte) ;
//   · MUET     : le message parti n'a reçu aucune réponse du fond (aucun gestionnaire) ;
//   · LEVÉ     : le gestionnaire du fond, ou la page, a levé ;
//   · FORME    : le fond a refusé la FORME du message (code `invalide`, `quoi`, `action`, `cle`, `geste`…) ;
//   · PETIT    : cible de moins de 44 px ; COUVERT : un autre élément reçoit le toucher à sa place ;
//   · CLÉ BRUTE: un texte visible qui est une clé de traduction (5 langues).
//  Le banc ne meurt pas, il rapporte (§6.4) : le relevé complet est écrit en JSON à côté des captures.
//  Usage : node scripts/bancs/panneau-tout-toucher.cjs [--page=annonces] [--taille=390|1512] [--langues]
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la preuve sur le code d'avant.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const P = require('./_pont-panneau.cjs');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-tout-toucher') : path.join(__dirname, 'captures', 'panneau-tout-toucher');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const SEULE = arg('page'), TAILLE = arg('taille'), LANGUES = process.argv.includes('--langues'), PROFONDEUR = Number(arg('profondeur') || 2);
const connu = require('./_panneau-connus.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 1500) : ''}`); } };

// ── Dans la page : recenser, toucher, photographier l'état.
const DANS_PAGE = () => {
  // Le panneau vit dans la racine fermée du logo ; la FENÊTRE de l'extension (popup.html) est le document lui-même.
  const racine = () => { const h = document.getElementById('vrm-badge'); return (h && h.shadowRoot) || (window.__bancFenetre ? document : null); };
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false; for (let p = el; p; p = p.parentElement) { if (p.hasAttribute && (p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true')) return false; if (p.tagName === 'DETAILS' && !p.open && el !== p && !(el.tagName === 'SUMMARY' && el.parentElement === p)) return false; } return true; };
  const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=menuitem], [role=option], [tabindex="0"]';
  const sig0 = (el) => {
    const at = Array.from(el.attributes).filter((a) => /^data-/.test(a.name) || ['type', 'name', 'role', 'aria-label'].includes(a.name)).map((a) => a.name + '=' + String(a.value).slice(0, 48)).sort().join(',');
    const t = el.tagName.toLowerCase();
    const txt = at.replace(/type=\w+,?/, '') ? '' : (el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    return t + '|' + at + (txt ? '|' + txt : '');
  };
  const lister = () => {
    const r = racine(); if (!r) return [];
    const vus = {}, out = [];
    for (const el of r.querySelectorAll(SEL)) {
      if (el.classList.contains('btn') && !el.closest('.carte')) continue;   // le rond VRM lui-même
      if (!vis(el)) continue;
      const s0 = sig0(el); vus[s0] = (vus[s0] || 0) + 1;
      const s = s0 + (vus[s0] > 1 ? '#' + vus[s0] : '');
      el.__sig = s;
      const b = el.getBoundingClientRect();
      // Le label qui porte une case : c'est LUI la cible (une case de 16 px dans une rangée de 44 px se touche par la rangée).
      const lab = (el.tagName === 'INPUT' && (el.closest('label') || (el.id && r.querySelector('label[for="' + el.id + '"]')))) || null;
      const cible = lab && vis(lab) ? lab.getBoundingClientRect() : b;
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      let couvert = null;
      if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
        const top = r.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el) && !(lab && (lab.contains(top) || top.contains(lab)))) couvert = (top.tagName + '.' + String(top.className || '').slice(0, 30));
      }
      // Le choix DÉJÀ courant d'un groupe (filtre choisi, onglet courant, bouton radio coché) : y toucher ne change rien, c'est voulu.
      const courant = ['aria-pressed', 'aria-selected', 'aria-checked'].some((a) => el.getAttribute(a) === 'true') || el.hasAttribute('aria-current') || (el.tagName === 'INPUT' && el.type === 'radio' && el.checked);
      out.push({ s, courant, tag: el.tagName, type: el.getAttribute('type') || '', off: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'), w: Math.round(cible.width), h: Math.round(cible.height), x: Math.round(b.left), y: Math.round(b.top), couvert, horsEcran: b.right < 0 || b.left > innerWidth, texte: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
    }
    return out;
  };
  const trouver = (s) => { lister(); const r = racine(); if (!r) return null; for (const el of r.querySelectorAll(SEL)) if (el.__sig === s && vis(el)) return el; return null; };
  const etat = () => {
    const r = racine(); if (!r) return '';
    let h = '';
    const marche = (n) => {
      for (const el of n.children) {
        if (el.tagName === 'STYLE') continue;
        if (!el.getClientRects().length && el.tagName !== 'DETAILS') { h += '<' + el.tagName + ' caché>'; continue; }
        h += '<' + el.tagName; for (const a of el.attributes) if (a.name !== 'style' || true) h += ' ' + a.name + '=' + a.value;
        if ('value' in el && el.tagName !== 'BUTTON' && el.tagName !== 'LI') h += ' v=' + el.value; if (el.checked) h += ' ✓'; if (el.open) h += ' ouvert';
        h += '>';
        for (const c of el.childNodes) if (c.nodeType === 3) h += c.nodeValue.trim();
        marche(el);
      }
    };
    marche(r);
    // Les textes qui bougent seuls (« il y a 5 min », l'heure) ne sont pas un effet.
    return h.replace(/il y a [^<]{1,24}|à l'instant|\d{1,2}:\d{2}(:\d{2})?|\d+ ?(s|min|h)\b/g, '~');
  };
  const agir = (s) => {
    const el = trouver(s); if (!el) return 'absent';
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
    const t = el.tagName, ty = (el.getAttribute('type') || '').toLowerCase();
    if (t === 'SELECT') { const o = Array.from(el.options).filter((x) => !x.disabled); if (o.length < 2) return 'select-1'; const i = (el.selectedIndex + 1) % el.options.length; el.selectedIndex = el.options[i].disabled ? o.indexOf(o[0]) : i; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'select'; }
    if (t === 'TEXTAREA' || (t === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(ty))) {
      el.focus();
      const v = ty === 'number' ? String((Number(el.value) || Number(el.min) || 1) + 1) : ty === 'email' ? 'banc@vrm.test' : ty === 'time' ? '10:30' : ty === 'date' ? '2026-12-01' : (el.value || '') + ' banc';
      const set = Object.getOwnPropertyDescriptor(t === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur();
      return 'saisie';
    }
    if (t === 'INPUT' && ty === 'range') { el.value = String(Number(el.value) + Number(el.step || 1)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'curseur'; }
    if (t === 'INPUT' && ty === 'file') return 'fichier';
    el.click();
    return 'clic';
  };
  const brutes = () => {
    const r = racine(); if (!r) return [];
    const out = new Set(), U = globalThis.VRM_UI;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement; if (!p || p.tagName === 'STYLE' || p.tagName === 'SCRIPT' || !vis(p)) continue;
      for (const m of n.nodeValue.split(/\s+/)) if (/^[a-z][a-z0-9]{0,6}_[a-z0-9_]{2,40}$/.test(m) && !/^(shop_sophie|julien_kicks|acheteu(r|se)_\d+|compte_banc)$/.test(m)) out.add(m);
      if (/\{[a-zA-Z_]{1,20}\}/.test(n.nodeValue) && !p.closest('textarea, [data-variables], small, .note5, label, p, .aide, option')) out.add('{}:' + n.nodeValue.trim().slice(0, 40));
      if (/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/.test(n.nodeValue)) out.add('valeur:' + n.nodeValue.trim().slice(0, 40));
    }
    for (const el of r.querySelectorAll('[placeholder], [aria-label], [title]')) { if (!vis(el)) continue; for (const a of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute(a) || ''; if (/^[a-z][a-z0-9]{0,6}_[a-z0-9_]{2,40}$/.test(v) || /\bundefined\b|\[object Object\]/.test(v)) out.add(a + ':' + v); } }
    return Array.from(out);
  };
  const debord = () => { const r = racine(); const c = r && r.querySelector('.carte'); return { page: document.documentElement.scrollWidth > innerWidth + 1, carte: !!(c && c.scrollWidth > c.clientWidth + 1) }; };
  window.__banc = { lister, etat, agir, brutes, debord, ouverte: () => { if (window.__bancFenetre) return true; const r = racine(); const c = r && r.querySelector('.carte'); return !!(c && c.classList.contains('on')); }, page: () => { const r = racine(); const v = r && r.querySelector('[data-vx]'); return v ? v.getAttribute('data-page') : null; } };
};

const PAGES = ['accueil', 'annonces', 'ventes', 'messages', 'favoris', 'notifications', 'automatisations', 'file', 'sante', 'parametres', 'etat-deconnecte', 'etat-choix', 'etat-sans-compte', 'etat-leboncoin', 'etat-vestiaire', 'fenetre-reliee', 'fenetre-pas-reliee', 'fenetre-onglet-etat', 'fenetre-reparer'];
const FORME_REFUSEE = new Set(['invalide', 'quoi', 'action', 'cle', 'geste', 'inconnu', 'forme']);

async function calme(pg, max = 4000) {
  let avant = null; const t0 = Date.now();
  for (;;) {
    const e = await pg.evaluate(() => window.__banc.etat()).catch(() => '');
    if (e === avant || Date.now() - t0 > max) return e;
    avant = e; await pg.waitForTimeout(220);
  }
}

// Les ÉTATS du panneau qui ne sont pas une page : pas connecté à VRM (formulaire de connexion), compte pas encore choisi
// (« c'est bien un de tes comptes ? »), aucun compte Vinted dans l'onglet, et le panneau sur Leboncoin / Vestiaire.
const ETATS = {
  'etat-deconnecte': { store: { __sansSession: true } },
  'etat-choix': { store: { vrmChoixComptes: {} } },
  'etat-sans-compte': { connecte: null },
  'etat-leboncoin': { url: 'https://www.leboncoin.fr/mes-annonces' },
  'etat-vestiaire': { url: 'https://fr.vestiairecollective.com/' },
  // La fenêtre de l'extension (popup.html) : reliée, pas reliée, vue « État de l'extension », réparation.
  'fenetre-reliee': { fenetre: '' },
  'fenetre-pas-reliee': { fenetre: '', store: { __sansSession: true } },
  'fenetre-onglet-etat': { fenetre: '?mode=onglet&depuis=7&vue=etat' },
  'fenetre-reparer': { fenetre: '?mode=reparer' },
};
async function session(nav, cfg, page) {
  const E = ETATS[page] || {};
  const m = await P.monde({ url: E.url, ...(E.connecte !== undefined ? { connecte: E.connecte } : {}), store: Object.assign({ vrmChoixComptes: { [P.UID]: { choix: 'oui', login: 'shop_sophie', at: Date.now() - P.J } } }, E.store || {}) });
  const t = E.fenetre !== undefined ? await P.ouvrirFenetre(nav, m, Object.assign({}, cfg, { query: E.fenetre })) : await P.ouvrir(nav, m, Object.assign({}, cfg, E.url ? { url: E.url } : {}));
  if (E.fenetre !== undefined) await t.pg.evaluate(() => { window.__bancFenetre = true; });
  if (ETATS[page]) page = null;
  await t.pg.evaluate(DANS_PAGE);
  await t.montrer();
  t.aller = async () => {
    if (!(await t.pg.evaluate(() => window.__banc.ouverte()))) await t.montrer();
    if (page && (await t.pg.evaluate(() => window.__banc.page())) !== page) {
      await t.pg.evaluate((p) => { const r = document.getElementById('vrm-badge').shadowRoot; let b = Array.from(r.querySelectorAll(`[data-onglet-b="${p}"]`)).find((x) => x.getClientRects().length); if (!b) { const plus = r.querySelector('[data-vx-plus]'); if (plus) plus.click(); b = r.querySelector(`[data-onglet-b="${p}"]`); } if (b) b.click(); }, page);
    }
    await calme(t.pg);
  };
  await t.aller();
  t.m = m;
  return t;
}

async function parcourir(nav, cfg, page, releve) {
  const T = `${cfg.nom} · ${page}`;
  let t = await session(nav, cfg, page);
  const neuve = async () => { await t.fermer(); t = await session(nav, cfg, page); };
  if (!process.env.BANC_SANS_CAPTURE) try { fs.mkdirSync(SORTIE, { recursive: true }); await t.pg.screenshot({ path: path.join(SORTIE, `${cfg.cle}-${page}.png`) }); } catch (_) {}
  releve.brutes.push(...(await t.pg.evaluate(() => window.__banc.brutes())).map((b) => `${T} : ${b}`));
  const deb = await t.pg.evaluate(() => window.__banc.debord());
  if (deb.page || deb.carte) releve.debords.push(`${T} : ${JSON.stringify(deb)}`);
  const racineCtl = await t.pg.evaluate(() => window.__banc.lister());
  const dejaVus = new Set(racineCtl.map((c) => c.s));
  const file = racineCtl.map((c) => ({ chemin: [], c }));
  let sale = false;
  while (file.length) {
    const { chemin, c } = file.shift();
    const nom = `${T} : ${chemin.concat(c.s).join(' ▸ ')}`;
    releve.total++;
    const ou = { cfg: cfg.cle, page, chemin, s: c.s, texte: c.texte };
    if (c.off) { releve.grises.push(nom); continue; }
    if (c.couvert && !connu.couvert(ou)) releve.couverts.push(`${nom} — couvert par ${c.couvert}`);
    if ((c.h < 44 || c.w < 44) && c.tag !== 'A' && !(c.tag === 'INPUT' && !['checkbox', 'radio'].includes(c.type)) && c.tag !== 'TEXTAREA' && c.tag !== 'SELECT' && !connu.petit(ou, c)) releve.petits.push(`${nom} — ${c.w}×${c.h}`);
    if (connu.sauter(ou)) { releve.sautes.push(nom); continue; }
    // Revenir à l'état de départ de ce contrôle : la page, puis son chemin.
    const rejouer = async () => {
      if (sale) { await neuve(); sale = false; } else await t.aller();
      for (const s of chemin) { const r = await t.pg.evaluate((s) => window.__banc.agir(s), s); if (r === 'absent') return false; await calme(t.pg); }
      return !!(await t.pg.evaluate((s) => !!window.__banc.lister().find((x) => x.s === s), c.s));
    };
    let la = await rejouer();
    if (!la) { sale = true; la = await rejouer(); }
    if (!la) { releve.perdus.push(nom); continue; }
    const avant = { e: await calme(t.pg), nMsg: t.messages.length, nErr: t.erreurs.length, st: JSON.stringify(t.m.f.store), url: t.pg.url(), ouverts: await t.pg.evaluate(() => window.__ouverts.length), ctl: new Set((await t.pg.evaluate(() => window.__banc.lister())).map((x) => x.s)) };
    const geste = await t.pg.evaluate((s) => window.__banc.agir(s), c.s).catch((e) => 'leve:' + e.message);
    await t.pg.waitForTimeout(260);
    const e2 = await calme(t.pg);
    const apres = { nMsg: t.messages.length, st: JSON.stringify(t.m.f.store), url: t.pg.url(), ouverts: await t.pg.evaluate(() => window.__ouverts.length).catch(() => 0) };
    const msgs = t.messages.slice(avant.nMsg);
    const effet = { ecran: e2 !== avant.e, message: msgs.length > 0, ecriture: apres.st !== avant.st, ouvert: apres.ouverts > avant.ouverts, adresse: apres.url !== avant.url };
    const aEffet = Object.values(effet).some(Boolean);
    if (process.env.BANC_SUIVI) console.log(`     … ${nom} (${geste}) ⇒ ${Object.keys(effet).filter((k) => effet[k]).join('+') || 'RIEN'}${msgs.length ? ' [' + msgs.map((x) => x.msg.action + (x.muet ? ' MUET' : '') + (process.env.BANC_SUIVI === 'piles' ? '{' + x.pile + '}' : '')).join(',') + ']' : ''}`);
    releve.gestes.push({ nom, geste, effet: Object.keys(effet).filter((k) => effet[k]), msgs: msgs.map((x) => ({ a: x.msg.action, q: x.msg.quoi, muet: x.muet, leve: x.leve, rep: x.rep && typeof x.rep === 'object' ? { ok: x.rep.ok, accepte: x.rep.accepte, code: x.rep.code, raison: x.rep.raison && String(x.rep.raison).slice(0, 80) } : x.rep })) });
    if (!aEffet && geste !== 'fichier' && geste !== 'select-1' && !c.courant && !connu.mort(ou)) releve.morts.push(`${nom} (${geste})`);
    if (!aEffet && c.courant) releve.courants.push(nom);
    for (const x of msgs) {
      if (x.muet) releve.muets.push(`${nom} ⇒ ${JSON.stringify(x.msg).slice(0, 200)}`);
      if (x.leve) releve.leves.push(`${nom} ⇒ ${x.msg.action} : ${x.leve}`);
      if (x.rep && typeof x.rep === 'object' && FORME_REFUSEE.has(String(x.rep.code || x.rep.raison || '')) && !connu.forme(ou, x)) releve.formes.push(`${nom} ⇒ ${JSON.stringify(x.msg).slice(0, 200)} ⇒ ${JSON.stringify(x.rep).slice(0, 120)}`);
    }
    for (const er of t.erreurs.slice(avant.nErr)) releve.erreurs.push(`${nom} ⇒ ${er}`);
    releve.brutes.push(...(await t.pg.evaluate(() => window.__banc.brutes()).catch(() => [])).map((b) => `${nom} : ${b}`));
    // Ce que ce toucher a fait apparaître : à toucher aussi (jusqu'à PROFONDEUR).
    // (Un toucher qui a changé de PAGE n'est pas déplié : la page d'arrivée a son propre parcours.)
    const pageApres = await t.pg.evaluate(() => window.__banc.page()).catch(() => null);
    if (chemin.length + 1 < PROFONDEUR && effet.ecran && (ETATS[page] || pageApres === page)) {
      const neufs = (await t.pg.evaluate(() => window.__banc.lister()).catch(() => [])).filter((x) => !avant.ctl.has(x.s) && !dejaVus.has(x.s));
      for (const x of neufs) { dejaVus.add(x.s); file.push({ chemin: chemin.concat(c.s), c: x }); }
      if (neufs.length) { try { await t.pg.screenshot({ path: path.join(SORTIE, `${cfg.cle}-${page}-${releve.total}.png`) }); } catch (_) {} }
    }
    // Un toucher qui a navigué ou fermé le panneau : la suite repart d'un monde neuf. (Un contrôle qu'un toucher
    // précédent a fait disparaître est retrouvé dans un monde neuf aussi : voir `rejouer`.)
    if (effet.adresse || !(await t.pg.evaluate(() => window.__banc.ouverte()).catch(() => false))) sale = true;
  }
  await t.fermer();
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const CFGS = [
    { cle: 'tel', nom: '390 Orion', largeur: 390, hauteur: 844, mobile: true, orion: true },
    { cle: 'ordi', nom: '1512', largeur: 1512, hauteur: 900 },
  ].filter((c) => !TAILLE || String(c.largeur) === TAILLE);
  const releve = { total: 0, gestes: [], morts: [], muets: [], leves: [], formes: [], petits: [], couverts: [], brutes: [], erreurs: [], perdus: [], grises: [], sautes: [], debords: [], courants: [] };
  try {
    for (const cfg of CFGS) for (const page of PAGES.filter((p) => !SEULE || p === SEULE)) {
      const n0 = releve.total;
      try { await parcourir(nav, cfg, page, releve); } catch (e) { releve.erreurs.push(`${cfg.nom} · ${page} : le parcours a levé — ${String(e && e.message).slice(0, 300)}`); }
      console.log(`  · ${cfg.nom} · ${page} : ${releve.total - n0} contrôle(s) touché(s)`);
    }
    if (LANGUES) for (const langue of ['en', 'es', 'it', 'de']) for (const page of PAGES.filter((p) => !SEULE || p === SEULE)) {
      const t = await session(nav, { cle: 'tel-' + langue, nom: '390 ' + langue, largeur: 390, hauteur: 844, mobile: true, langue }, page);
      releve.brutes.push(...(await t.pg.evaluate(() => window.__banc.brutes())).map((b) => `390 ${langue} · ${page} : ${b}`));
      for (const er of t.erreurs) releve.erreurs.push(`390 ${langue} · ${page} ⇒ ${er}`);
      try { await t.pg.screenshot({ path: path.join(SORTIE, `tel-${langue}-${page}.png`) }); } catch (_) {}
      await t.fermer();
    }
  } finally { await nav.close(); }
  for (const k of ['morts', 'muets', 'leves', 'formes', 'petits', 'couverts', 'brutes', 'erreurs', 'perdus', 'debords']) releve[k] = Array.from(new Set(releve[k]));
  try { fs.mkdirSync(SORTIE, { recursive: true }); fs.writeFileSync(path.join(SORTIE, 'releve.json'), JSON.stringify(releve, null, 1)); } catch (_) {}
  console.log(`\n${releve.total} contrôles recensés (${releve.grises.length} grisés, ${releve.sautes.length} écartés et dits, ${releve.gestes.length} touchés)`);
  const L = (l) => (l.length ? `${l.length} :\n      · ` + l.slice(0, 40).join('\n      · ') : '');
  dit(releve.total > 0 && releve.gestes.length > 0, 'le panneau s’ouvre et des contrôles sont touchés');
  dit(releve.morts.length === 0, 'aucun contrôle MORT (chaque toucher produit un effet)', L(releve.morts));
  dit(releve.muets.length === 0, 'aucun message MUET (le fond répond à tout ce que le panneau envoie)', L(releve.muets));
  dit(releve.leves.length === 0, 'aucun gestionnaire du fond ne LÈVE', L(releve.leves));
  dit(releve.formes.length === 0, 'aucune FORME de message refusée par le fond', L(releve.formes));
  dit(releve.erreurs.length === 0, 'aucune erreur de page', L(releve.erreurs));
  dit(releve.petits.length === 0, 'cibles ≥ 44 px', L(releve.petits));
  dit(releve.couverts.length === 0, 'aucun contrôle recouvert', L(releve.couverts));
  dit(releve.brutes.length === 0, 'aucune clé de traduction brute, ni « undefined », ni « NaN »', L(releve.brutes));
  dit(releve.debords.length === 0, 'rien ne déborde en largeur', L(releve.debords));
  dit(releve.perdus.length === 0, 'chaque contrôle recensé se retrouve pour être touché', L(releve.perdus));
  console.log(`\n${ko ? '❌' : '✅'} tout toucher : ${ok} bon(s), ${ko} défaut(s) — relevé : ${path.join(SORTIE, 'releve.json')}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
