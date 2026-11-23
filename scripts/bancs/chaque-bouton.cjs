// ═════════════════════════════════════════════════════════════════════════════
//  BANC ROBOT « CHAQUE BOUTON MARCHE » (22 nov., Julien : « audite tout le site, ne laisse aucun bug, que tous les
//  boutons marchent »). Le filet EXHAUSTIF : le robot parcourt chaque écran du build réel, recense TOUT ce qui se touche
//  (button, a, [role=button], rangées cliquables, segments, interrupteurs, champs, menus), touche chaque élément et
//  constate UN effet observable. Vendeur inventé (_base-volume.cjs), écritures interceptées (jamais la vraie base).
//
//  Pour chaque élément : visible ? recouvert ? ≥ 44 px au doigt ? grisé avec sa raison ? → on le touche (vrai doigt /
//  vraie souris à son centre) → effet (navigation, feuille, focus, état, requête, lien, téléchargement, toast…) ;
//  « aucun effet » = défaut ; erreur console / exception / promesse rejetée = défaut ; puis on revient (×, Échap,
//  retour) et on vérifie qu'on est au même endroit. Chaque feuille / sous-page ouverte devient un ÉTAT exploré à son tour.
//  Chaque champ de saisie reçoit : très long, emoji, espaces, et pour un montant « 12,50 », « 12.50 », des lettres.
//
//  VUES=tel,ordi (défaut)   ECRANS=settings,menu (racines ; défaut : toutes)   SEUL=<regex sur le libellé ou la clé>
//  PROFONDEUR=3   MAX_ETATS=400   SORTIE=<dossier : rapport JSON + tableau .md + captures>   NAVIGATEUR=webkit
//  AUTOTEST=1 : le robot se prouve lui-même — sept éléments FAUTIFS sont posés dans la page (bouton mort, trop petit, grisé
//  sans raison, recouvert, qui lève une erreur, lien cassé, montant qui avale la virgule) ; il doit les attraper TOUS, sinon rouge.
//  BANC_DIST=<dist d'avant> pour prouver qu'un contrôle était rouge.   Sortie ≠ 0 s'il reste un défaut non admis
//  (scripts/bancs/chaque-bouton-admis.json : chaque exception avec sa raison).   Un banc ne meurt pas : il rapporte.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'chaque-bouton');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',').map((x) => x.trim()).filter(Boolean);
const RACINES_TOUTES = ['journee', 'annonces', 'ventes', 'achats', 'compta', 'menu', 'garage', 'messages', 'emails', 'settings', 'extension', 'dashboard', 'vintedaccounts', 'automatisations', 'communaute', 'parrainage', 'organisation', 'litiges', 'semaine', 'trancher', 'masques', 'favoris', 'republier', 'catalog', 'stockvinted'];
const RACINES = process.env.AUTOTEST === '1' ? ['journee'] : process.env.ECRANS ? String(process.env.ECRANS).split(',').map((x) => x.trim()).filter(Boolean) : RACINES_TOUTES;
const SEUL = process.env.AUTOTEST === '1' ? /cb-test/ : process.env.SEUL ? new RegExp(process.env.SEUL, 'i') : null;
const PROFONDEUR = process.env.AUTOTEST === '1' ? 0 : Number(process.env.PROFONDEUR || 3);
const MAX_ETATS = Number(process.env.MAX_ETATS || 400);
const MAX_SEMBLABLES = Number(process.env.MAX_SEMBLABLES || 3);   // une famille de plus de 25 rangées identiques (une liste de données) : les 3 premières
const FIN = Date.now() + Number(process.env.DUREE_MAX || 6 * 3600) * 1000;   // au-delà, le robot s'arrête proprement et dit ce qui reste
const MOTEUR = String(process.env.NAVIGATEUR || 'chromium').toLowerCase();
const AUTOTEST = process.env.AUTOTEST === '1';
// Les fautifs de l'autotest : posés par-dessus l'app (coin haut gauche), chacun doit donner SON défaut.
const FAUTIFS = { 'cb-test mort': 'aucun-effet', 'cb-test petit': 'petit', 'cb-test grisé': 'grise-sans-raison', 'cb-test recouvert': 'recouvert', 'cb-test erreur': 'erreur', 'cb-test lien': 'lien-casse', 'cb-test montant': 'champ-montant', 'cb-test sain': '' };
const POSER_FAUTIFS = () => {
  if (document.getElementById('cb-fautifs')) return;
  const d = document.createElement('div'); d.id = 'cb-fautifs'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483000;background:#fff;padding:8px;display:grid;gap:8px;width:300px';
  const b = (nom, css) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = nom; x.style.cssText = 'min-height:44px;min-width:120px;' + (css || ''); d.appendChild(x); return x; };
  b('cb-test mort');
  b('cb-test petit', 'min-height:0;min-width:0;height:20px;width:60px;font-size:8px;justify-self:start;padding:0');
  b('cb-test grisé').disabled = true;
  const boite = document.createElement('div'); boite.style.cssText = 'position:relative;height:44px'; const dessous = document.createElement('button'); dessous.textContent = 'cb-test recouvert'; dessous.style.cssText = 'position:absolute;inset:0'; dessous.onclick = () => { dessous.dataset.t = '1'; }; const voile = document.createElement('div'); voile.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.05)'; boite.append(dessous, voile); d.appendChild(boite);
  b('cb-test erreur').onclick = () => { setTimeout(() => { throw new Error('cb-test : exception voulue'); }, 0); document.title = 'cb ' + Date.now(); };
  const a = document.createElement('a'); a.href = '/fichier-qui-n-existe-pas.pdf'; a.textContent = 'cb-test lien'; a.style.cssText = 'display:block;min-height:44px;line-height:44px'; d.appendChild(a);
  const i = document.createElement('input'); i.type = 'text'; i.inputMode = 'decimal'; i.setAttribute('aria-label', 'cb-test montant'); i.style.cssText = 'min-height:44px'; i.addEventListener('input', () => { i.value = i.value.replace(/[^0-9]/g, ''); }); d.appendChild(i);
  const sain = b('cb-test sain'); sain.setAttribute('aria-pressed', 'false'); sain.onclick = () => sain.setAttribute('aria-pressed', sain.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  document.body.appendChild(d);
};
const ADMIS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'chaque-bouton-admis.json'), 'utf8')); } catch (_) { return []; } })();
const admis = (d) => ADMIS.find((a) => (!a.vue || a.vue === d.vue) && a.defaut === d.type && new RegExp(a.cle, 'i').test(d.cle));

// ── Ce qui tourne DANS la page (posé avant l'app) ────────────────────────────────────────────────────────────────
const DANS_LA_PAGE = () => {
  if (window.__cb) return;
  const C = (window.__cb = { evts: [], bruit: new WeakSet(), lieux: new Set(), mo: null, n: 0, detail: [] });
  // Le LIEU d'un changement (balise.classe sur trois niveaux) : un bloc qui se remplit en fond est REMPLACÉ à chaque fois,
  // on le reconnaît à sa place, pas à son nœud.
  const lieu = (n) => { const l = []; for (let p = n, i = 0; p && p.nodeType === 1 && i < 3; p = p.parentElement, i++) l.push(p.tagName + '.' + String(p.className && p.className.baseVal != null ? p.className.baseVal : p.className || '').split(/\s+/).slice(0, 2).join('.')); return l.join('<'); };
  const duBruit = (cible, n) => C.bruit.has(cible) || C.bruit.has(n) || C.lieux.has(lieu(n));
  const auBruit = (cible, n) => { C.bruit.add(cible); C.lieux.add(lieu(n)); };
  const note = (type, d) => { try { C.evts.push({ type, d: String(d == null ? '' : d).slice(0, 200) }); } catch (_) {} };
  // Les sorties vers l'extérieur : constatées, jamais suivies.
  const fauxFenetre = () => ({ close() {}, focus() {}, print() { note('imprimer', 'fenêtre'); }, postMessage() {}, closed: false, location: { href: '', replace() {}, assign() {} }, document: { open() {}, write() { note('ecrire', 'document'); }, close() {}, title: '', body: { innerHTML: '', appendChild() {} }, head: { appendChild() {} }, createElement: (t) => document.createElement(t) }, addEventListener() {}, opener: null });
  try { window.open = (u) => { note('ouvrir', u); return fauxFenetre(); }; } catch (_) {}
  try { window.print = () => note('imprimer', 'page'); } catch (_) {}
  try { if (navigator.clipboard) { navigator.clipboard.writeText = (t) => { note('copier', t); return Promise.resolve(); }; navigator.clipboard.write = () => { note('copier', 'objet'); return Promise.resolve(); }; } } catch (_) {}
  try { Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { note('partager', d && (d.url || d.title || d.text)); return Promise.resolve(); } }); } catch (_) {}
  try { const c0 = document.execCommand.bind(document); document.execCommand = (k, ...r) => { if (k === 'copy') { note('copier', 'execCommand'); return true; } return c0(k, ...r); }; } catch (_) {}
  // (23 nov.) Un lien du site ouvert dans un autre onglet (centre d'aide, réécrit par vercel.json) est un effet ; son fichier doit exister.
  const lienDehors = (a) => { const h = a.getAttribute('href') || ''; if (a.hasAttribute('download') || /^blob:|^data:/.test(h)) return ['telechargement', a.getAttribute('download') || h.slice(0, 40)]; if (/^(mailto|tel|sms):/.test(h)) return ['lien', h]; try { const u = new URL(h, location.href); if (u.origin !== location.origin) return ['lien', u.href]; if (a.target === '_blank') return ['lien-local', /\.[a-z0-9]{2,5}$/i.test(u.pathname) ? u.pathname : (u.pathname.replace(/\/$/, '') || '/') === '/aide' ? '/aide/index.html' : /^\/aide\/[a-z-]+$/.test(u.pathname) ? u.pathname + '.html' : u.pathname]; if (/\.[a-z0-9]{2,5}$/i.test(u.pathname)) return ['lien-local', u.pathname]; } catch (_) { return ['lien', 'CASSÉ ' + h]; } return null; };
  document.addEventListener('click', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return; const l = lienDehors(a); if (l) { note(l[0], l[1]); e.preventDefault(); } }, true);
  try { const k0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { const l = this.getAttribute('href') ? lienDehors(this) : null; if (l) { note(l[0], l[1]); return; } return k0.call(this); }; } catch (_) {}

  const Q = 'button,a[href],a[role],[role=button],[role=tab],[role=switch],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=option],[role=link],[role=checkbox],[role=radio],input:not([type=hidden]),select,textarea,summary,[onclick]';
  const COUCHES = '.n-feuille,[role=dialog],[role=alertdialog],[aria-modal=true],[role=menu],[role=listbox]';
  // Visible POUR DE VRAI : ni transparent par un parent, ni rogné par un parent qui ne défile pas (bandeau replié).
  const visible = (e) => {
    if (!e || !e.isConnected) return false; const b = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (!(b.width > 0 && b.height > 0) || s.visibility === 'hidden' || s.display === 'none' || e.closest('[hidden],[inert],[aria-hidden=true]')) return false;
    // (23 nov.) Le contenu d'un <details> FERMÉ garde ses mesures (Chrome le cache par `content-visibility`) : il n'est pas visible —
    // sauf son <summary>. Sans cela, tout un rapport replié passait pour « recouvert par son summary ».
    for (let d = e.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) { const sm = d.querySelector(':scope > summary'); if (!(sm && sm.contains(e))) return false; }
    let defY = false, defX = false;   // sous un parent qui DÉFILE, ce qui dépasse s'atteint en défilant : pas rogné
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p); if (ps.opacity === '0') return false;
      const pb = p.getBoundingClientRect();
      if (ps.display === 'contents' || (!pb.width && !pb.height)) continue;
      if (/auto|scroll/.test(ps.overflowY) && p.scrollHeight > p.clientHeight + 1) defY = true;
      if (/auto|scroll/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1) defX = true;
      if (!defY && /hidden|clip/.test(ps.overflowY) && (b.bottom <= pb.top + 1 || b.top >= pb.bottom - 1)) return false;
      if (!defX && /hidden|clip/.test(ps.overflowX) && (b.right <= pb.left + 1 || b.left >= pb.right - 1)) return false;
    }
    return true;
  };
  const grand = (e) => { const b = e.getBoundingClientRect(); return b.width > 40 && b.height > 30; };
  const parId = (e, a) => { const v = e.getAttribute(a); return v ? v.split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ') : ''; };
  const texte = (e) => String(e.getAttribute('aria-label') || parId(e, 'aria-labelledby') || e.innerText || e.textContent || e.getAttribute('placeholder') || e.getAttribute('title') || (e.labels && e.labels[0] && e.labels[0].innerText) || (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && e.closest('label') && e.closest('label').innerText) || (e.querySelector && e.querySelector('img[alt]') && e.querySelector('img[alt]').alt) || (e.querySelector && e.querySelector('svg title') && e.querySelector('svg title').textContent) || '').replace(/\s+/g, ' ').trim();
  // Une couche = ce qui se pose PAR-DESSUS (feuille, dialogue, menu) ; un bloc du même rôle rangé DANS le fil d'une feuille n'en est pas une.
  const couches = () => { const l = [...document.querySelectorAll(COUCHES)].filter((e) => visible(e) && grand(e)); return l.filter((e) => { const dans = l.some((x) => x !== e && x.contains(e)); return !dans || /fixed|absolute/.test(getComputedStyle(e).position) || e.matches('.n-feuille,[aria-modal=true],[role=alertdialog]'); }); };
  const titreCouche = (c) => { const id = c.getAttribute('aria-labelledby'); const t = (id && document.getElementById(id.split(' ')[0])) || c.querySelector('.n-feuille-titre,h1,h2,h3,[role=heading]'); return (c.getAttribute('aria-label') || (t && t.textContent) || c.getAttribute('role') || 'feuille').replace(/\s+/g, ' ').trim().replace(/\d+/g, '#').slice(0, 50); };
  const dessus = () => { const l = couches(); if (!l.length) return null; let m = l[0], z = -1; for (const c of l) { let zz = 0, p = c; while (p && p !== document.body) { const v = parseInt(getComputedStyle(p).zIndex, 10); if (!isNaN(v)) zz = Math.max(zz, v); p = p.parentElement; } if (zz >= z) { z = zz; m = c; } } return m; };
  C.cle = () => {
    const main = document.querySelector('#vrm-contenu');
    const h = main && ([...main.querySelectorAll('h1,[data-titre-page]')].find(visible) || [...main.querySelectorAll('h1,[data-titre-page]')].find((e) => e.getClientRects().length && !e.closest('[hidden],[inert],[aria-hidden=true],details:not([open])')));   // (23 nov.) le grand titre replié au défilement reste le titre de l'écran
    const sous = main && [...main.querySelectorAll('[aria-current=page],[aria-current=true]')].filter(visible).map((e) => texte(e).replace(/\d+/g, '#').slice(0, 24)).join('+');
    const cs = couches().map(titreCouche); const u = []; for (const t of cs) if (u[u.length - 1] !== t) u.push(t);
    return { ecran: (main && main.dataset.ecran) || '', titre: h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '', sous: sous || '', couches: u, n: couches().length };
  };
  const ETAT = /\b(is-|est-|actif|active|selected|ouvert|open|on\b|off\b|allume|eteint|courant|pressed|hover|focus)[\w-]*/g;
  const famille = (e) => [e.tagName, e.getAttribute('role') || '', e.getAttribute('type') || '', String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className || '').replace(ETAT, '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')].join('|');
  const libelle = (e) => texte(e).replace(/\d+/g, '#').slice(0, 60);
  C.recenser = () => {
    const top = dessus();
    const racine = top || document.body;
    const pris = new Set([...racine.querySelectorAll(Q)].filter(visible));
    // Les rangées cliquables sans rôle : le curseur « main » dit qu'on peut toucher.
    const zone = top || document.querySelector('#vrm-contenu') || document.body;
    for (const e of zone.querySelectorAll('div,li,span,label,tr,td,article,section,img,svg,p')) {
      if (pris.has(e) || !visible(e)) continue;
      if (getComputedStyle(e).cursor !== 'pointer') continue;
      if (e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer') continue;
      if (e.closest(Q)) continue;
      if (e.tagName === 'LABEL' && (e.control || e.querySelector('input,select,textarea'))) continue;
      pris.add(e);
    }
    const l = [...pris].filter((e) => !e.matches('.vrm-aller-contenu') && !(e.tagName === 'LABEL'));
    const parFam = new Map(), parSig = new Map(); const out = [];
    for (const e of l) {
      const f = famille(e); parFam.set(f, (parFam.get(f) || 0) + 1);
      const base = f + '|' + libelle(e); const k = parSig.get(base) || 0; parSig.set(base, k + 1);
      const dansMain = !!e.closest('#vrm-contenu'); const c = e.closest(COUCHES);
      out.push({ sig: base + '|' + k, fam: f, lib: texte(e).slice(0, 70) || '(sans nom)', zone: c && visible(c) ? 'couche' : dansMain ? 'ecran' : 'coque', tag: e.tagName, type: (e.getAttribute('type') || '').toLowerCase(), role: e.getAttribute('role') || '' });
    }
    for (const o of out) o.nFam = parFam.get(o.fam);
    return out;
  };
  C.trouver = (sig) => {
    const top = dessus(); const racine = top || document.body;
    document.querySelectorAll('[data-cb-cible]').forEach((e) => e.removeAttribute('data-cb-cible'));
    const cand = new Set([...racine.querySelectorAll(Q)]);
    const zone = top || document.querySelector('#vrm-contenu') || document.body;
    for (const e of zone.querySelectorAll('div,li,span,tr,td,article,section,img,svg,p')) if (!cand.has(e) && visible(e) && getComputedStyle(e).cursor === 'pointer' && !(e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer') && !e.closest(Q)) cand.add(e);
    const parSig = new Map();
    const voulu = sig.slice(0, sig.lastIndexOf('|')); const fam = voulu.split('|').slice(0, 4).join('|'); const mots = voulu.split('|').slice(4).join('|').replace(/[#\d]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
    let meme = null, proche = null;
    for (const e of cand) { if (!visible(e) || e.matches('.vrm-aller-contenu') || e.tagName === 'LABEL') continue; const base = famille(e) + '|' + libelle(e); const k = parSig.get(base) || 0; parSig.set(base, k + 1); if (base + '|' + k === sig) { e.setAttribute('data-cb-cible', '1'); return true; } if (!meme && base === voulu) meme = e; if (!proche && mots.length >= 6 && famille(e) === fam && libelle(e).replace(/[#\d]+/g, '').replace(/\s+/g, ' ').trim().startsWith(mots)) proche = e; }
    // Le même élément, dont le rang ou les chiffres ont bougé (une liste qui se remplit, un compteur) : c'est lui.
    const autre = meme || proche; if (autre) { autre.setAttribute('data-cb-cible', '1'); return true; }
    return false;
  };
  const lie = (el, t) => !!t && (t === el || el.contains(t) || (t.closest && ((t.closest('label') && (t.closest('label').control === el || t.closest('label').contains(el))) || (el.labels && [...el.labels].some((l) => l.contains(t))))) || (t.contains(el) && getComputedStyle(t).cursor === 'pointer'));
  C.examiner = (tactile) => {
    const el = document.querySelector('[data-cb-cible]'); if (!el) return null;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
    let b = el.getBoundingClientRect();
    const cache = /^(checkbox|radio|file)$/.test((el.getAttribute('type') || '').toLowerCase()) || el.getAttribute('role') === 'switch';
    const habit = cache ? (el.closest('label') || (el.labels && el.labels[0]) || el.parentElement) : null;
    if (habit && (b.width < 24 || getComputedStyle(el).opacity === '0')) b = habit.getBoundingClientRect();
    const x = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), y = b.top + b.height / 2;
    const horsEcran = b.right <= 0 || b.left >= innerWidth || y < 0 || y > innerHeight;
    const t = horsEcran ? null : document.elementFromPoint(x, y);
    const recouvert = !horsEcran && !lie(el, t) && !(habit && habit.contains(t));
    const desc = (n) => n ? (n.tagName + '.' + String(n.className && n.className.baseVal != null ? n.className.baseVal : n.className || '').slice(0, 40) + ' «' + texte(n).slice(0, 30) + '»') : '';
    // La cible au doigt : 44 px AFFICHÉS, ou une zone de toucher élargie (pseudo-élément, rangée entière).
    let petit = '';
    if (tactile && !horsEcran) {
      const zoneT = (dx, dy) => { const p = document.elementFromPoint(x + dx, y + dy); return lie(el, p) || !!(habit && habit.contains(p)); };
      const enLigne = el.tagName === 'A' && getComputedStyle(el).display.startsWith('inline') && el.parentElement && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 12;
      const okL = b.width >= 43.5 || (zoneT(-21, 0) && zoneT(21, 0)), okH = b.height >= 43.5 || (zoneT(0, -21) && zoneT(0, 21));
      if (!enLigne && !(okL && okH)) petit = Math.round(b.width) + ' × ' + Math.round(b.height) + ' px';
    }
    const grise = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    let raison = '';
    if (grise) {
      const d = el.getAttribute('aria-describedby'); const dt = d && d.split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
      // Une phrase à côté (pas le texte des autres boutons) : dans le parent, puis dans le grand-parent.
      const phrase = (p) => { if (!p) return ''; const c = p.cloneNode(true); c.querySelectorAll('button,a,input,select,textarea,[role=button],label').forEach((x) => x.remove()); return (c.textContent || '').replace(/\s+/g, ' ').trim(); };
      const autour = phrase(el.parentElement), plusLoin = el.parentElement && el.parentElement.children.length <= 4 ? phrase(el.parentElement.parentElement) : '';
      const nom = el.getAttribute('aria-label') || '';
      raison = el.getAttribute('title') || dt || el.getAttribute('data-raison') || (nom.length > (el.innerText || '').trim().length + 10 ? nom : '') || (autour.length > 12 ? autour : '') || (plusLoin.length > 12 ? plusLoin : '');
    }
    const attrs = {}; for (const a of ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'aria-current', 'open', 'data-etat']) attrs[a] = el.getAttribute(a);
    attrs.checked = el.checked; attrs.value = 'value' in el ? String(el.value).slice(0, 80) : undefined;
    const numerique = el.tagName === 'INPUT' && (el.type === 'number' || /decimal|numeric/.test(el.getAttribute('inputmode') || '') || /prix|montant|€|price|co[uû]t|taux|%|frais|seuil|plafond/i.test(texte(el) + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + ((el.labels && el.labels[0] && el.labels[0].innerText) || '')));
    return { x, y, l: Math.round(b.width), h: Math.round(b.height), horsEcran, recouvert, par: recouvert ? desc(t) : '', petit, grise, raison: String(raison).slice(0, 120), attrs, numerique, editable: el.isContentEditable, lectureSeule: !!el.readOnly, options: el.tagName === 'SELECT' ? el.options.length : -1 };
  };
  C.attrs = () => { const el = document.querySelector('[data-cb-cible]'); if (!el) return null; const attrs = {}; for (const a of ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'aria-current', 'open', 'data-etat']) attrs[a] = el.getAttribute(a); attrs.checked = el.checked; attrs.value = 'value' in el ? String(el.value).slice(0, 80) : undefined; return attrs; };
  // Le bruit de fond (horloges, chargements) : ce qui bouge SANS qu'on touche ne compte pas comme un effet.
  C.ecouter = (ms) => new Promise((ok) => { const m = new MutationObserver((rs) => { for (const r of rs) C.bruit.add(r.target); }); m.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { m.disconnect(); ok(true); }, ms); });
  // Le SILENCE avant de toucher : plus rien ne bouge depuis `ms` (au plus `max`). Ce qui bouge encore au bout du délai
  // (une horloge, une animation sans fin) rejoint le bruit de fond. Ainsi, ce qui change APRÈS le toucher vient du toucher.
  C.silence = (ms, max) => new Promise((ok) => {
    let t = 0, recents = []; const t0 = Date.now();
    const finir = (calme) => { m.disconnect(); clearTimeout(t); clearTimeout(tm); if (!calme) for (const [n, quand, e] of recents) if (Date.now() - quand < 1500) auBruit(n, e); ok(calme); };
    const m = new MutationObserver((rs) => { let vu = false; for (const r of rs) { let n = r.target; if (n.nodeType !== 1) n = n.parentElement; if (!n || n.closest('head') || duBruit(r.target, n)) continue; if (r.type === 'attributes' && /^data-cb-/.test(r.attributeName)) continue; vu = true; recents.push([r.target, Date.now(), n]); if (recents.length > 400) recents = recents.slice(-200); } if (vu) { clearTimeout(t); t = setTimeout(() => finir(true), ms); } });
    m.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    t = setTimeout(() => finir(true), ms); const tm = setTimeout(() => finir(false), max); void t0;
  });
  // Le toucher À BLANC : un toucher posé sur le fond (aucun bouton dessous). Ce que l'app fait à N'IMPORTE QUEL toucher
  // (réveil, relève, message en attente) se produit ici, et rejoint le bruit — il ne sera pas pris pour l'effet du bouton.
  C.blanc = (ms, toucher) => new Promise((ok) => { let n = 0;
    if (toucher) { const c = dessus() || document.querySelector('#vrm-contenu') || document.body; const o = { bubbles: true, cancelable: true, composed: true, clientX: 2, clientY: 2 };
      for (const [K, t] of [[window.PointerEvent, 'pointerdown'], [MouseEvent, 'mousedown'], [window.PointerEvent, 'pointerup'], [MouseEvent, 'mouseup'], [MouseEvent, 'click']]) { try { c.dispatchEvent(new K(t, o)); } catch (_) {} }
      try { c.dispatchEvent(new Event('touchstart', { bubbles: true })); c.dispatchEvent(new Event('touchend', { bubbles: true })); } catch (_) {}
      try { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); } catch (_) {} } const m = new MutationObserver((rs) => { for (const r of rs) { let t = r.target; if (t.nodeType !== 1) t = t.parentElement; if (!t || t.closest('head') || duBruit(r.target, t)) continue; if (r.type === 'attributes' && /^data-cb-/.test(r.attributeName)) continue; n++; auBruit(r.target, t); } }); m.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { m.disconnect(); ok(n); }, ms); });
  C.armer = () => {
    C.evts = []; C.n = 0; C.detail = [];
    const el = document.querySelector('[data-cb-cible]');
    if (C.mo) C.mo.disconnect();
    C.mo = new MutationObserver((rs) => { for (const r of rs) {
      let t = r.target; if (t.nodeType !== 1) t = t.parentElement; if (!t) continue;
      if (duBruit(r.target, t)) continue;
      if (t.closest('head')) continue;   // une feuille de style ou un morceau de code qui arrive n'est pas un effet VU
      if (r.type === 'attributes' && /^data-cb-/.test(r.attributeName)) continue;
      if (r.type === 'attributes' && t === el && /^(class|style)$/.test(r.attributeName)) continue;
      if (r.type === 'attributes' && /^(data-vrm-d|data-focus|data-pointeur)/.test(r.attributeName) && (t === document.documentElement || t === document.body)) continue;
      C.n++; if (C.detail.length < 4) C.detail.push(r.type + ':' + t.tagName + '.' + String(t.className && t.className.baseVal != null ? t.className.baseVal : t.className || '').slice(0, 30) + (r.attributeName ? '@' + r.attributeName : ''));
    } });
    C.mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  C.instant = () => {
    const a = document.activeElement; const champ = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    const main = document.querySelector('#vrm-contenu');
    const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (_) {}
    return { cle: C.cle(), champ: champ ? (a.tagName + ':' + (a.getAttribute('aria-label') || a.placeholder || a.name || a.id || '')) : '', cible: !!(a && a.hasAttribute && a.hasAttribute('data-cb-cible')), defile: Math.round((main ? main.scrollTop : 0) + window.scrollY), toasts: [...document.querySelectorAll('.n-toast,[role=status],[role=alert]')].filter(visible).map((e) => e.textContent.trim().slice(0, 60)).join(' ¦ '), ls, mut: C.n, detail: C.detail.slice(), evts: C.evts.slice(), deborde: document.documentElement.scrollWidth > innerWidth + 2 };
  };
  C.fermeture = () => { const t = dessus(); if (!t) return null; const b = [...t.querySelectorAll('.n-feuille-croix,[aria-label^="Fermer"],[aria-label="Annuler"],[aria-label^="Retour"],[data-fermer],button')].filter(visible).find((e) => e.matches('.n-feuille-croix,[aria-label^="Fermer"],[aria-label="Annuler"],[aria-label^="Retour"],[data-fermer]') || /^(Fermer|Annuler|Terminé|OK|Plus tard|Non|Retour|×|✕)$/i.test((e.innerText || '').trim())); if (!b) return null; document.querySelectorAll('[data-cb-ferme]').forEach((e) => e.removeAttribute('data-cb-ferme')); b.setAttribute('data-cb-ferme', '1'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  C.champ = () => { const el = document.querySelector('[data-cb-cible]'); if (!el) return null; let msg = ''; const d = el.getAttribute('aria-describedby'); if (d) msg = d.split(' ').map((i) => { const n = document.getElementById(i); return n && visible(n) ? n.textContent : ''; }).join(' ').trim(); const al = [...document.querySelectorAll('[role=alert],.vrm-erreur,.n-erreur,[data-erreur]')].filter(visible).map((e) => e.textContent.trim()).join(' ').slice(0, 120); return { v: String(el.value == null ? el.textContent : el.value), mauvais: !!(el.validity && el.validity.badInput), invalide: el.getAttribute('aria-invalid') === 'true' || !!(el.validity && !el.validity.valid && el.value !== ''), msg: (msg || al).slice(0, 120), max: el.maxLength, deborde: document.documentElement.scrollWidth > innerWidth + 2, type: el.type || el.tagName }; };
};

// ── Le robot ─────────────────────────────────────────────────────────────────────────────────────────────────────
const cleTexte = (c) => [c.ecran, c.titre, c.sous, c.couches.join(' › ')].join(' | ');
const SAISIE = /^(text|search|tel|email|url|number|password|)$/;
// D'un onglet de la barre à un autre, et vers un écran du même groupe (Argent ↔ Statistiques, Ventes ↔ Litiges, Aujourd'hui ↔
// Ma semaine), l'entrée d'historique est REMPLACÉE (décision de Julien du 16 nov., src/navHistorique.js, tenue par
// audit-barre-achats.cjs) : là, « retour » ne ramène pas — ce n'est pas un défaut.
const BARRE = ['journee', 'annonces', 'ventes', 'achats', 'compta'], GROUPE_DE = { dashboard: 'compta', litiges: 'ventes', semaine: 'journee', cat_expedition: 'ventes' };
const memeBarre = (a, b) => BARRE.includes(GROUPE_DE[a] || a) && BARRE.includes(GROUPE_DE[b] || b);

async function parcourir(nav, relancer, ICI, vue, R) {
  const tactile = /^tel/.test(vue);
  const base = B.fabriquer({ volumeReel: true, annonces: 300 });
  let ctx, pg, J, mort = false;
  const ext = { requetes: 0, dialogues: [], fichiers: 0, telech: 0 };
  // La page (re)naît : au départ, et après un plantage du moteur (mémoire de la machine partagée) — le parcours continue.
  const naitre = async () => {
    if (ctx) await ctx.close().catch(() => {});
    try { ({ ctx, pg, J } = await B.ouvrir(nav(), vue, base)); } catch (_) { await relancer(); ({ ctx, pg, J } = await B.ouvrir(nav(), vue, base)); }
    mort = false;
    pg.on('crash', () => { mort = true; });
    pg.on('request', (r) => { if (!/\.(js|css|png|svg|woff2?|webp|ico|jpg|jpeg|map|json|webmanifest)(\?|$)/.test(r.url()) || /\/rest\/v1\/|\/api\//.test(r.url())) ext.requetes++; });
    pg.on('dialog', (d) => ext.dialogues.push(d.type() + ' « ' + d.message().slice(0, 80) + ' »'));
    pg.on('filechooser', () => ext.fichiers++);
    pg.on('download', (d) => { ext.telech++; d.cancel().catch(() => {}); });
    await pg.addInitScript(DANS_LA_PAGE);
  };
  await naitre();
  let ls0 = null, nCap = 0;
  const erreursVraies = () => J.erreurs.filter((e) => !/^warning /.test(e) && !/Service Worker|ResizeObserver loop|Permissions policy|getUserMedia|NotAllowedError|play\(\) request|AbortError/.test(e));
  const P = (f, ...a) => pg.evaluate(f, ...a).catch(() => null);
  const instant = () => P(() => window.__cb && window.__cb.instant());
  const cle = async () => { const c = await P(() => window.__cb && window.__cb.cle()); return c || { ecran: '?', titre: '', sous: '', couches: [], n: 0 }; };
  const toucher = async (x, y) => { if (tactile) await pg.touchscreen.tap(x, y).catch(() => {}); else await pg.mouse.click(x, y).catch(() => {}); };
  const calme = async (ms = 700) => { await pg.waitForTimeout(ms); await pg.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {}); };
  const capture = async (n) => { const f = `${vue}-${String(++nCap).padStart(3, '0')}-${n.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`; await pg.screenshot({ path: path.join(SORTIE, f) }).catch(() => {}); return f; };

  const recharger = async (racine) => {
    if (mort || pg.isClosed()) { R.renaissances = (R.renaissances || 0) + 1; await naitre(); }
    if (ls0) await P((l) => { try { localStorage.clear(); for (const k in l) localStorage.setItem(k, l[k]); } catch (_) {} }, ls0);
    await B.demarrer(pg, ICI, racine);
    // Le toast d'accueil passe ; ce qui reste ouvert au démarrage (accueil guidé) se ferme une fois.
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(300);
    // (23 nov.) Le toast « N nouveaux articles numérotés » part SEUL au bout de 10 s : s'il partait pendant qu'on touche un
    // bouton, sa disparition passait pour l'effet du bouton (l'autotest « mort » vu vert). On le laisse partir AVANT de
    // relever le stockage (il y note « vu » : il ne revient plus aux rechargements), puis on attend que l'écran se pose.
    if (!ls0) { for (let i = 0; i < 60; i++) { if (!(await P(() => !!document.querySelector('[data-toast-numeros] .n-toast')))) break; await pg.waitForTimeout(250); } }
    await P(() => window.__cb && window.__cb.silence(1500, 8000));
    if (!ls0) { const i = await instant(); ls0 = i ? i.ls : null; }
    if (AUTOTEST) { await pg.evaluate(POSER_FAUTIFS).catch(() => {}); await pg.waitForTimeout(200); }
  };
  const fermerTout = async () => {
    for (let i = 0; i < 5; i++) {
      const c = await cle(); if (!c.n) return true;
      const f = await P(() => window.__cb.fermeture());
      if (f) await toucher(f.x, f.y); else if (!tactile) await pg.keyboard.press('Escape').catch(() => {}); else await P(() => history.back());
      await pg.waitForTimeout(500);
      const c2 = await cle(); if (c2.n >= c.n) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(350); const c3 = await cle(); if (c3.n >= c.n) { await P(() => history.back()); await pg.waitForTimeout(450); } }
    }
    return !(await cle()).n;
  };
  const jouer = async (sig) => {
    if (!(await P((s) => window.__cb.trouver(s), sig))) return false;
    const e = await P((t) => window.__cb.examiner(t), tactile); if (!e || e.horsEcran) return false;
    await toucher(e.x, e.y); await calme(900); return true;
  };
  // Se placer dans un état : sa racine, puis son chemin de touchers.
  const etablir = async (S, dur) => {
    if (dur) await recharger(S.racine); else { await fermerTout(); await B.aller(pg, S.racine, 900); }
    for (const sig of S.chemin) if (!(await jouer(sig))) return null;
    return cleTexte(await cle());
  };

  const etats = RACINES.map((r) => ({ racine: r, chemin: [], prof: 0, nom: r }));
  const vusEtat = new Set(), vusElt = new Set();
  let nEtats = 0;
  while (etats.length && nEtats < MAX_ETATS && Date.now() < FIN) {
    const S = etats.shift();
    try { fs.writeFileSync(path.join(SORTIE, `chaque-bouton-en-cours-${vue}.json`), JSON.stringify(R)); } catch (_) {}
    let k = await etablir(S, true).catch(() => null);
    if (k == null && (mort || pg.isClosed())) k = await etablir(S, true).catch(() => null);
    if (k == null) { R.etats.push({ vue, nom: S.nom, cle: '', rejoue: false }); continue; }
    if (S.cleVoulue && k !== S.cleVoulue) { k = await etablir(S, true); if (k == null || k !== S.cleVoulue) { R.etats.push({ vue, nom: S.nom, cle: k || '', voulue: S.cleVoulue, rejoue: false }); continue; } }
    S.cle = k + (S.segment ? ' > ' + S.segment : '');
    if (vusEtat.has(S.cle)) continue; vusEtat.add(S.cle); nEtats++;
    // L'écran s'ouvre d'abord sur sa copie inerte, puis se remplit : on recense quand il est POSÉ (deux relevés identiques).
    let liste = [], empreinte = '';
    for (let i = 0; i < 10; i++) { liste = (await P(() => window.__cb.recenser())) || []; const em = liste.map((x) => x.sig).join('\n'); if (em === empreinte && liste.length) break; empreinte = em; await pg.waitForTimeout(800); }
    k = cleTexte(await cle());
    const c0 = await cle();
    const portee = (o) => (o.zone === 'coque' ? 'coque' : o.zone === 'couche' ? c0.ecran + ' › ' + c0.couches.join(' › ') : c0.ecran) + ' || ' + o.sig;
    const vuFam = new Map();
    const aFaire = [];
    for (const o of liste) {
      o.cle = portee(o);
      if (vusElt.has(o.cle)) continue;
      if (SEUL && !SEUL.test(o.lib) && !SEUL.test(o.cle)) continue;
      const nf = vuFam.get(o.fam) || 0; vuFam.set(o.fam, nf + 1);
      if (o.nFam > 25 && nf >= MAX_SEMBLABLES) { R.semblables++; vusElt.add(o.cle); continue; }
      vusElt.add(o.cle); aFaire.push(o);
    }
    R.etats.push({ vue, nom: S.nom, cle: S.cle, rejoue: true, elements: liste.length, neufs: aFaire.length });
    console.log(`\n── ${new Date().toISOString().slice(11, 19)} [${vue}] état ${nEtats} (reste ${etats.length}) : ${S.cle} — ${liste.length} éléments, ${aFaire.length} neufs`);

    const t0 = Date.now(); S.t0 = t0;
    for (const o of aFaire) {
      if (Date.now() > FIN) { R.horsDelai = (R.horsDelai || 0) + 1; continue; }
      const ligne = { vue, etat: S.cle, cle: o.cle, element: `${o.tag.toLowerCase()}${o.role ? '[' + o.role + ']' : ''} « ${o.lib} »`, zone: o.zone, effet: '', defauts: [], champs: [] };
      const defaut = async (type, detail) => { const d = { vue, type, detail: String(detail || '').slice(0, 300), cle: o.cle, element: ligne.element, etat: S.cle }; const a = admis(d); if (a) { d.admis = a.raison; } else d.capture = await capture(type); ligne.defauts.push(d); R.defauts.push(d); console.log(`  ${a ? '➖' : '❌'} ${ligne.element} — ${type}${detail ? ' : ' + String(detail).slice(0, 160) : ''}${a ? ' (admis : ' + a.raison + ')' : ''}`); };
      try {
        if (mort || pg.isClosed()) await etablir(S, true);
        // On est bien dans l'état ? sinon on s'y remet (à moindres frais, puis en rechargeant).
        let ici = cleTexte(await cle());
        if (ici !== k) { ici = await etablir(S, false); if (ici !== k) ici = await etablir(S, true); }
        // L'état a glissé (un segment touché, une case cochée) : on repart de l'état propre, une fois.
        if (ici === k && !(await P((s) => window.__cb.trouver(s), o.sig))) ici = await etablir(S, true);
        if (ici !== k || !(await P((s) => window.__cb.trouver(s), o.sig))) { ligne.effet = 'pas retrouvé'; ligne.robot = ici !== k ? `état « ${ici} » au lieu de « ${k} »` : 'élément absent'; if (process.env.BAVARD) console.log(`  ·· pas retrouvé ${ligne.element} : ${ligne.robot}`); R.pasRetrouves++; R.lignes.push(ligne); continue; }
        const e = await P((t) => window.__cb.examiner(t), tactile);
        if (!e) { ligne.effet = 'pas retrouvé'; R.pasRetrouves++; R.lignes.push(ligne); continue; }
        ligne.taille = e.l + '×' + e.h;
        if (e.horsEcran) { await defaut('hors-ecran', `centre en ${Math.round(e.x)},${Math.round(e.y)}`); ligne.effet = 'pas touché'; R.lignes.push(ligne); R.testes++; continue; }
        if (o.lib === '(sans nom)') await defaut('sans-nom', 'rien ne dit ce que c’est (ni texte, ni aria-label, ni étiquette)');
        if (e.petit) await defaut('petit', `cible de ${e.petit} au doigt (44 px attendus)`);
        if (e.grise) { ligne.effet = 'grisé' + (e.raison ? ' — raison dite' : ''); if (!e.raison) await defaut('grise-sans-raison', 'désactivé, aucune raison à côté (title, aria-describedby, phrase voisine)'); R.lignes.push(ligne); R.testes++; continue; }
        if (e.recouvert) {
          // Recouvert par le reste d'un geste d'avant (recherche ouverte, bulle) ? On referme, on se remet, on regarde encore.
          await pg.keyboard.press('Escape').catch(() => {}); await P(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await pg.waitForTimeout(350);
          let e2 = (cleTexte(await cle()) === k && await P((s) => window.__cb.trouver(s), o.sig)) ? await P((t) => window.__cb.examiner(t), tactile) : null;
          if (!e2 || e2.recouvert) { const kk = await etablir(S, true); e2 = (kk === k && await P((s) => window.__cb.trouver(s), o.sig)) ? await P((t) => window.__cb.examiner(t), tactile) : null; }
          if (!e2) { ligne.effet = 'pas retrouvé'; R.pasRetrouves++; R.lignes.push(ligne); continue; }
          Object.assign(e, e2);
          if (e.recouvert) await defaut('recouvert', `recouvert par ${e.par}`);
        }
        // L'écran ET le réseau se taisent avant qu'on touche : ce qui change APRÈS vient du toucher, pas d'un chargement de fond.
        // Puis un essai À BLANC (0,8 s sans toucher) : s'il bouge encore quelque chose, ce quelque chose rejoint le bruit et on recommence.
        for (let i = 0; i < 4; i++) {
          const n0 = ext.requetes; await P(() => window.__cb.silence(450, 6000));
          const blanc = await P((t) => window.__cb.blanc(800, t), !S.sansBlanc);
          if (cleTexte(await cle()) !== k) { S.sansBlanc = true; await etablir(S, true); await P((s) => window.__cb.trouver(s), o.sig); continue; }   // le toucher à blanc a fermé la feuille : dans cet état, on s'en passe
          if (n0 === ext.requetes && blanc === 0) break;
        }
        { const e1 = await P((t) => window.__cb.examiner(t), tactile); if (e1 && !e1.horsEcran) { e.x = e1.x; e.y = e1.y; e.attrs = e1.attrs; } }   // l'écran a pu se poser entre-temps : on vise où l'élément EST
        const nErr = erreursVraies().length; ext.requetes = 0; ext.dialogues = []; ext.fichiers = 0; ext.telech = 0;
        // (23 nov., 2ᵉ passe) Le doigt resté dans un champ d'un toucher d'avant cachait l'effet « focus dans un champ » du suivant.
        await P(() => { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.hasAttribute('data-cb-cible') && a.blur) a.blur(); });
        const avant = await instant();
        await P(() => window.__cb.armer());
        let choix = false;
        if (o.tag === 'SELECT') { if (e.options > 1) { choix = await pg.evaluate(() => { const s = document.querySelector('[data-cb-cible]'); const v0 = s.value; const i = [...s.options].findIndex((x) => !x.disabled && x.value !== v0); if (i < 0) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, s.options[i].value); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return true; }).catch(() => false); } }
        else await toucher(e.x, e.y);
        // On attend l'effet (jusqu'à 1,6 s), puis que l'écran se pose.
        let apres = null;
        for (let i = 0; i < 13; i++) { await pg.waitForTimeout(120); apres = await instant(); if (!apres || apres.mut || apres.evts.length || cleTexte(apres.cle) !== cleTexte(avant.cle) || ext.dialogues.length || ext.fichiers || (apres.champ && apres.champ !== avant.champ)) break; }
        if (!apres) { await calme(1500); apres = await instant(); } else { await calme(450); apres = (await instant()) || apres; }
        const at = await P(() => window.__cb.attrs());
        // ── L'effet constaté ──
        const kA = avant ? cleTexte(avant.cle) : ''; let kB = apres ? cleTexte(apres.cle) : '(page rechargée)';
        const lsChange = apres && avant ? Object.keys({ ...avant.ls, ...apres.ls }).filter((x) => avant.ls[x] !== apres.ls[x]) : [];
        const attrChange = at ? Object.keys(at).filter((a) => String(at[a]) !== String(e.attrs[a])) : [];
        let effet = '', genre = '';
        if (ext.dialogues.length) { effet = 'confirmation native : ' + ext.dialogues[0]; genre = 'dialogue'; }
        else if (!apres) { effet = 'la page a été rechargée'; genre = 'navigation'; }
        else if (apres.cle.ecran !== avant.cle.ecran) { effet = 'navigation → ' + apres.cle.ecran; genre = 'navigation'; }
        else if (apres.cle.n > avant.cle.n || (apres.cle.couches.join('›') !== avant.cle.couches.join('›') && apres.cle.n >= avant.cle.n && apres.cle.n > 0)) { effet = 'feuille ouverte : « ' + apres.cle.couches[apres.cle.couches.length - 1] + ' »'; genre = 'feuille'; }
        else if (apres.cle.n < avant.cle.n) { effet = 'feuille fermée'; genre = 'fermeture'; }
        // (23 nov.) Seul l'onglet courant (aria-current) a changé, même écran, même titre : un segment de l'écran, pas une page
        // (Organisation : Missions · Lots… ; Argent : Résumé · Statistiques) — le retour n'a pas à le défaire.
        else if (kA !== kB && apres.cle.ecran === avant.cle.ecran && apres.cle.titre === avant.cle.titre && apres.cle.couches.join('›') === avant.cle.couches.join('›')) { effet = 'onglet → ' + apres.cle.sous; genre = 'etat'; }
        else if (kA !== kB) { effet = 'navigation → ' + (apres.cle.titre || apres.cle.sous); genre = 'navigation'; }
        else if (apres.evts.length) { const v = apres.evts[0]; effet = ({ lien: 'lien externe', 'lien-local': 'fichier du site', ouvrir: 'nouvelle fenêtre', imprimer: 'impression', copier: 'copié', partager: 'partage', telechargement: 'téléchargement' }[v.type] || v.type) + ' : ' + v.d; genre = v.type; }
        else if (ext.fichiers) { effet = 'choix d’un fichier'; genre = 'fichier'; }
        else if (ext.telech) { effet = 'téléchargement'; genre = 'telechargement'; }
        else if (choix) { effet = 'choix changé'; genre = 'etat'; }
        else if (attrChange.length && !(attrChange.length === 1 && attrChange[0] === 'value' && !/^(checkbox|radio|range)$/.test(o.type))) { effet = 'état changé (' + attrChange.join(', ') + ')'; genre = 'etat'; }
        else if (apres.champ && (apres.champ !== avant.champ || apres.cible) && !/^(checkbox|radio)$/.test(o.type) && o.role !== 'switch') { effet = 'focus dans un champ'; genre = 'focus'; }
        else if (apres.toasts !== avant.toasts && apres.toasts) { effet = 'message : ' + apres.toasts.slice(0, 60); genre = 'toast'; }
        else if (apres.mut) { effet = 'écran mis à jour (' + apres.detail.join(' ; ') + ')'; genre = 'etat'; }
        else if (['aria-checked', 'aria-selected', 'aria-pressed', 'aria-current'].some((a) => /^(true|page)$/.test(String(e.attrs[a])))) { effet = 'déjà choisi (rien à changer)'; genre = 'choisi'; }
        else if (ext.requetes) {
          // Une requête seule peut être une relève de fond : on attend le silence, on retouche, il en faut une AUSSITÔT.
          for (let i = 0, n0 = -1; i < 12 && n0 !== ext.requetes; i++) { n0 = ext.requetes; await pg.waitForTimeout(500); }
          ext.requetes = 0;
          if (await P((s) => window.__cb.trouver(s), o.sig)) { const e3 = await P((t) => window.__cb.examiner(t), tactile); if (e3 && !e3.horsEcran) { await toucher(e3.x, e3.y); await pg.waitForTimeout(450); } }
          const i2 = await instant();
          if (ext.requetes) { effet = 'requête partie (deux fois sur deux)'; genre = 'requete'; }
        }
        else if (apres.defile !== avant.defile) { effet = 'défilement'; genre = 'defilement'; }
        else if (o.tag === 'SELECT' && e.options <= 1) { effet = 'liste à un seul choix'; genre = 'etat'; }
        else if (['aria-checked', 'aria-selected', 'aria-pressed', 'aria-current'].some((a) => /^(true|page)$/.test(String(e.attrs[a]))) && /radio|tab|option/.test(o.role + ' ' + o.type)) { effet = 'déjà choisi (rien à changer)'; genre = 'choisi'; }
        // Un effet MINCE (une à trois retouches de l'écran, rien d'autre) peut être un changement de fond tombé au même moment :
        // on fait taire l'écran, on retouche — il doit se passer de nouveau quelque chose, sinon ce n'était pas le bouton.
        if (genre === 'etat' && apres && effet.startsWith('écran mis à jour') && apres.mut <= 3 && !attrChange.length) {
          await P(() => window.__cb.silence(450, 6000)); await P((t) => window.__cb.blanc(800, t), !S.sansBlanc);
          if (cleTexte(await cle()) === kA && await P((s) => window.__cb.trouver(s), o.sig)) {
            const e3 = await P((t) => window.__cb.examiner(t), tactile);
            if (e3 && !e3.horsEcran && !e3.grise) {
              ext.requetes = 0; await P(() => window.__cb.armer()); const d0 = await instant(); await toucher(e3.x, e3.y);
              let i2 = null; for (let i = 0; i < 10; i++) { await pg.waitForTimeout(130); i2 = await instant(); if (!i2 || i2.mut || i2.evts.length || cleTexte(i2.cle) !== kA) break; }
              // (23 nov.) Un « aller à la section » touché une 2e fois défile encore (la section ouverte reste ouverte) : c'est un effet.
              if (i2 && d0 && i2.defile !== d0.defile) { /* défilement : l'effet est confirmé */ }
              else if (i2 && !i2.mut && !i2.evts.length && cleTexte(i2.cle) === kA && !ext.requetes && !ext.dialogues.length) { effet = ''; genre = ''; ligne.mince = `premier toucher : ${apres.detail.join(' ; ')} ; second toucher : rien`; }
            }
          }
        }
        ligne.effet = effet || 'AUCUN EFFET'; ligne.genre = genre;
        if (process.env.BAVARD) console.log(`  ·· ${ligne.element} → ${ligne.effet} [${kA} ⇒ ${kB}] mut=${apres ? apres.mut : '-'} n=${avant.cle.n}→${apres ? apres.cle.n : '-'}`);
        if (!effet) await defaut('aucun-effet', ligne.mince ? 'touché deux fois : ' + ligne.mince : 'touché : rien ne change (ni écran, ni feuille, ni focus, ni requête, ni message)');
        // Un lien : sa cible existe-t-elle ?
        for (const v of (apres ? apres.evts : [])) {
          if (v.type === 'lien' && /^CASSÉ|^https?:\/\/[^/]*$|undefined|null|\/\/$/.test(v.d) && !/^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\/?$/i.test(v.d)) await defaut('lien-casse', v.d);
          if (v.type === 'lien-local' && !fs.existsSync(path.join(B.DIST, decodeURIComponent(v.d)))) await defaut('lien-casse', 'fichier absent du site : ' + v.d);
          if ((v.type === 'ouvrir') && (!v.d || /undefined|null/.test(v.d)) && !(apres.evts || []).some((x) => x.type === 'ecrire')) await defaut('lien-casse', 'fenêtre ouverte sans adresse valable : « ' + v.d + ' »');
        }
        const errs = erreursVraies().slice(nErr);
        if (errs.length) await defaut('erreur', errs.slice(0, 2).join(' ¦ '));
        if (apres && apres.deborde && !avant.deborde) await defaut('deborde', 'après le toucher, la page déborde en largeur');

        // ── Un champ : ce qu'il accepte, ce qu'il refuse, ce qu'il garde ──
        const champ = (o.tag === 'TEXTAREA' || (o.tag === 'INPUT' && SAISIE.test(o.type)) || e.editable) && !e.lectureSeule;
        if (champ && genre === 'focus') {
          const essais = [['long', 'Nike Air Max 1 Patta '.repeat(15).trim()], ['emoji', '👟🔥 été 42'], ['espaces', '   ']];
          if (e.numerique) essais.unshift(['virgule', '12,50'], ['point', '12.50'], ['lettres', 'abc']);
          for (const [nom, val] of essais) {
            const n0 = erreursVraies().length;
            if (!(await P((s) => window.__cb.trouver(s), o.sig))) { ligne.champs.push({ nom, v: '(champ parti)' }); break; }
            await pg.evaluate(() => { const el = document.querySelector('[data-cb-cible]'); el.focus(); if (el.select) el.select(); else { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }).catch(() => {});
            await pg.keyboard.press('Backspace').catch(() => {});
            if (/[^\x00-\xff]/.test(val)) await pg.keyboard.insertText(val).catch(() => {}); else await pg.keyboard.type(val, { delay: nom === 'long' ? 0 : 15 }).catch(() => {});
            await pg.waitForTimeout(350);
            const c1 = await P(() => window.__cb.champ());
            await pg.waitForTimeout(nom === 'emoji' ? 700 : 100);
            const still = await P((s) => window.__cb.trouver(s), o.sig);
            const c2 = still ? await P(() => window.__cb.champ()) : null;
            ligne.champs.push({ nom, v: c1 ? c1.v.slice(0, 40) : '(parti)', invalide: !!(c1 && (c1.invalide || c1.mauvais)), msg: c1 ? c1.msg : '' });
            const e2 = erreursVraies().slice(n0);
            if (e2.length) await defaut('erreur', `saisie « ${nom} » : ` + e2[0]);
            if (!c1) continue;
            if (c1.deborde && !avant.deborde) await defaut('deborde', `saisie « ${nom} » : la page déborde en largeur`);
            if (nom === 'virgule' || nom === 'point') {
              const chiffres = c1.v.replace(/[^\d.,]/g, '');
              if (!chiffres && !c1.msg) await defaut('champ-montant', `« ${val} » est refusé sans un mot (le champ reste vide)`);
              else if (chiffres && !/12[.,]50?/.test(chiffres) && !c1.msg) await defaut('champ-montant', `« ${val} » devient « ${c1.v} » : la décimale est perdue`);
            }
            if (nom === 'emoji' && c1.type !== 'number' && c1.type !== 'email' && c1.type !== 'tel' && c1.type !== 'password' && !e.numerique && c2 && c1.v && c2.v !== c1.v) await defaut('saisie-perdue', `tapé « ${c1.v} », 0,7 s plus tard « ${c2.v} »`);
          }
          if (await P((s) => window.__cb.trouver(s), o.sig)) { await pg.evaluate(() => { const el = document.querySelector('[data-cb-cible]'); el.focus(); if (el.select) el.select(); }).catch(() => {}); await pg.keyboard.press('Backspace').catch(() => {}); await pg.waitForTimeout(150); }
          await P(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
          R.champs++;
        }

        // ── Un nouvel endroit ? Il sera exploré à son tour. ──
        const segment = (genre === 'etat' && effet.startsWith('onglet →')) || genre === 'etat' && /tab|radio|menuitemradio/.test(o.role) || (genre === 'etat' && attrChange.some((a) => /selected|pressed|current/.test(a)) && /segment|onglet|filtre/i.test(o.fam));
        // (23 nov., 2ᵉ passe) BORNE=1 : on n'explore pas un écran hors du morceau (un lien de la coque mène à Aujourd'hui,
        // Annonces… — touché et jugé, mais pas parcouru : il a son propre morceau).
        const horsMorceau = process.env.BORNE === '1' && genre === 'navigation' && apres && !RACINES.includes(apres.cle.ecran);
        if (apres && !horsMorceau && (genre === 'feuille' || genre === 'navigation' || segment) && S.prof < PROFONDEUR && kB !== '(page rechargée)') {
          const kN = kB + (segment ? ' > ' + o.lib.slice(0, 30) : '');
          if (!vusEtat.has(kN) && !etats.some((x) => x.cleProm === kN)) etats.push({ racine: S.racine, chemin: S.chemin.concat(o.sig), prof: S.prof + 1, nom: S.nom + ' → ' + o.lib.slice(0, 30), cleVoulue: segment ? null : kB, cleProm: kN, segment: segment ? o.lib.slice(0, 30) : (S.segment || '') });
        }

        // ── Revenir, et vérifier qu'on est revenu au même endroit ──
        if (genre === 'feuille') {
          let ferme = false;
          if (!tactile) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500); ferme = (await cle()).n <= avant.cle.n; if (!ferme) await defaut('echap', `Échap ne ferme pas « ${apres.cle.couches[apres.cle.couches.length - 1]} »`); }
          if (!ferme) { const f = await P(() => window.__cb.fermeture()); if (f) { await toucher(f.x, f.y); await pg.waitForTimeout(600); ferme = (await cle()).n <= avant.cle.n; } }
          if (!ferme) { await P(() => history.back()); await pg.waitForTimeout(600); ferme = (await cle()).n <= avant.cle.n; if (ferme && tactile) ligne.retour = 'geste retour (pas de ×)'; }
          if (!ferme) { await defaut('ne-se-ferme-pas', `« ${apres.cle.couches[apres.cle.couches.length - 1]} » : ni ×, ni Échap, ni retour`); await etablir(S, true); }
          else if (cleTexte(await cle()) !== kA) await defaut('retour-ailleurs', `feuille fermée, mais on n'est plus au même endroit : « ${cleTexte(await cle())} » au lieu de « ${kA} »`);
        } else if (genre === 'navigation' && o.zone !== 'coque' && apres && !/^(Retour|Fermer|Annuler|Terminé)/i.test(o.lib) && !memeBarre(avant.cle.ecran, apres.cle.ecran)) {
          // Le geste « retour » du téléphone / du navigateur ramène d'où l'on vient (une feuille quittée en naviguant reste fermée).
          await P(() => history.back());
          const voulu = avant.cle.n ? [avant.cle.ecran, avant.cle.titre].join(' | ') : kA;
          let kR = '';
          for (let i = 0; i < 12; i++) { await pg.waitForTimeout(150); kR = cleTexte(await cle()); if (kR.startsWith(voulu)) break; }
          if (!kR.startsWith(voulu)) { await calme(2500); kR = cleTexte(await cle()); if (!kR.startsWith(voulu)) await defaut('retour-ailleurs', `« retour » après la navigation mène à « ${kR} » au lieu de « ${voulu} »`); else await defaut('retour-recharge', '« retour » après la navigation recharge toute l’app (on en sort) avant de revenir'); }
        }
        // Les réglages touchés reviennent à leur valeur (le robot ne laisse pas l'app en anglais ou en sombre).
        const fin = await instant();
        const sale = !fin || Object.keys({ ...ls0, ...fin.ls }).some((x) => ls0[x] !== fin.ls[x] && /langue|dark|sombre|session|auth|token|acces|cacher|masqu|design|style/i.test(x));
        if (sale) await etablir(S, true);
        R.testes++; R.lignes.push(ligne);
        if (effet && !ligne.defauts.length && process.env.BAVARD) console.log(`  ✅ ${ligne.element} — ${effet}`);
      } catch (err) {
        const plante = mort || pg.isClosed() || /crash|closed/i.test(String(err && err.message));
        if (plante && !o.rejoue) { o.rejoue = true; aFaire.push(o); console.log(`  ↻ ${ligne.element} — le moteur est tombé, l'élément sera rejoué`); mort = true; await etablir(S, true).catch(() => {}); continue; }
        ligne.effet = ligne.effet || 'le robot a calé'; ligne.robot = String(err && err.message).slice(0, 200); R.lignes.push(ligne); R.cales++;
        console.log(`  ⚠️ ${ligne.element} — le robot a calé : ${ligne.robot}`);
        await etablir(S, true).catch(() => {});
      }
    }
  }
  R.resteEtats += etats.length; R.enFile = (R.enFile || []).concat(etats.map((x) => vue + ' : ' + x.nom));
  await ctx.close().catch(() => {});
}

async function main() {
  const { srv, ICI } = await B.serveur();
  let navig = await B.navigateur();
  const nav = () => navig;
  const relancer = async () => { await navig.close().catch(() => {}); navig = await B.navigateur(); };
  const R = { moteur: MOTEUR, vues: VUES, racines: RACINES, etats: [], lignes: [], defauts: [], testes: 0, champs: 0, semblables: 0, pasRetrouves: 0, cales: 0, resteEtats: 0 };
  try { for (const vue of VUES) { try { await parcourir(nav, relancer, ICI, vue, R); } catch (e) { console.log(`⚠️ [${vue}] parcours interrompu : ${e && e.message}`); R.cales++; } } }
  finally { await navig.close().catch(() => {}); srv.close(); }
  // ── Le rapport ──
  const suff = `${MOTEUR}-${VUES.join('+')}${process.env.ECRANS ? '-' + RACINES.join('+').slice(0, 40) : ''}`;
  fs.writeFileSync(path.join(SORTIE, `chaque-bouton-${suff}.json`), JSON.stringify(R, null, 1));
  const vrais = R.defauts.filter((d) => !d.admis), adm = R.defauts.filter((d) => d.admis);
  const md = [`# Chaque bouton marche — ${MOTEUR}, ${VUES.join(' + ')}`, '', `${R.testes} éléments touchés · ${R.champs} champs éprouvés · ${R.etats.filter((e) => e.rejoue).length} états (écrans, sous-pages, feuilles) · ${R.semblables} rangées semblables non rejouées · ${R.pasRetrouves} pas retrouvés · ${vrais.length} défauts · ${adm.length} admis`, '', '## Défauts', '', '| vue | état | élément | défaut | détail | capture |', '|---|---|---|---|---|---|',
    ...vrais.map((d) => `| ${d.vue} | ${d.etat} | ${d.element.replace(/\|/g, '/')} | ${d.type} | ${d.detail.replace(/\|/g, '/')} | ${d.capture || ''} |`), '', '## Admis (avec leur raison)', '', ...adm.map((d) => `- [${d.vue}] ${d.element} — ${d.type} : ${d.admis}`), '', '## Tout ce qui a été touché', '', '| vue | état | élément | effet |', '|---|---|---|---|',
    ...R.lignes.map((l) => `| ${l.vue} | ${l.etat} | ${l.element.replace(/\|/g, '/')} | ${l.effet.replace(/\|/g, '/')}${l.defauts.length ? ' ❌' : ''} |`)].join('\n');
  fs.writeFileSync(path.join(SORTIE, `chaque-bouton-${suff}.md`), md);
  const parType = {}; for (const d of vrais) parType[d.type] = (parType[d.type] || 0) + 1;
  console.log(`\nchaque-bouton (${MOTEUR}) : ${R.testes} éléments touchés, ${R.champs} champs éprouvés, ${R.etats.filter((e) => e.rejoue).length} états, ${R.semblables} semblables non rejoués, ${R.pasRetrouves} pas retrouvés, ${R.cales} cales, ${R.resteEtats} états restés en file${R.horsDelai ? `, ${R.horsDelai} éléments hors délai` : ''}`);
  console.log(`${vrais.length} défauts ${JSON.stringify(parType)} · ${adm.length} admis — rapport : ${path.join(SORTIE, `chaque-bouton-${suff}.md`)}`);
  process.exitCode = vrais.length ? 1 : 0;
  if (AUTOTEST) {
    // Le robot doit attraper CHAQUE fautif avec SON défaut, et laisser passer le bouton sain.
    let rate = 0;
    for (const vue of VUES) for (const nom of Object.keys(FAUTIFS)) {
      const l = R.lignes.find((x) => x.vue === vue && x.element.includes(nom)); const types = l ? l.defauts.map((d) => d.type) : [];
      const attendu = FAUTIFS[nom]; const tact = /^tel/.test(vue);
      const ok = !!l && (attendu === '' ? types.length === 0 : (attendu === 'petit' && !tact) ? true : types.includes(attendu));
      if (!ok) rate++;
      console.log(`${ok ? '✅' : '❌'} autotest [${vue}] ${nom} : attendu « ${attendu || 'aucun défaut'} », constaté « ${l ? (types.join(', ') || 'aucun défaut') + ' · ' + l.effet : 'pas touché'} »`);
    }
    console.log(rate ? `AUTOTEST ROUGE : ${rate} fautif(s) non attrapé(s)` : 'AUTOTEST VERT : le robot attrape chaque fautif et laisse passer le bouton sain');
    process.exitCode = rate ? 1 : 0;
  }
}
main().catch((e) => { console.error('chaque-bouton : ' + (e && e.stack || e)); process.exitCode = 2; });
