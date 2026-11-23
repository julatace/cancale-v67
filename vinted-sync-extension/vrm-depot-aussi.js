// vrm-depot-aussi.js — leboncoin.fr et vestiairecollective.com, cadre principal : « PUBLIER AUSSI SUR… » (5.424, 21 nov.).
//
// Julien (choix n° 45) : publier une annonce Vinted aussi sur Leboncoin et Vestiaire, en un geste, « parfait et
// irréprochable ». Ce fichier ne décide RIEN : il n'agit que dans l'ONGLET DE TRAVAIL que le fond a ouvert pour CETTE
// publication (le fond seul envoie les ordres, `aussiUI`), et seulement par l'INTERFACE de la page — comme une
// personne : les photos déposées dans le champ du site, chaque texte tapé LETTRE À LETTRE, chaque choix cliqué au
// libellé EXACT du site, « Continuer », puis « Publier » quand le fond, après avoir RELU le formulaire, le demande.
// Clics et frappes `isTrusted:false` ASSUMÉS (décision du 20 nov.), AUCUN maquillage (ni isTrusted, ni debugger/CDP,
// ni souris inventée). Aucune requête n'est envoyée d'ici : c'est la page du site qui envoie.
//
// Les règles :
//  · chaque champ doit être UN élément visible de la page ; deux qui se ressemblent ⇒ ARRÊT (VRM ne choisit pas) ;
//    absent ⇒ ARRÊT, nommé ; une valeur absente de la liste du site ⇒ ARRÊT (jamais « la plus proche ») ;
//  · chaque champ est RELU après la saisie (ce que la page MONTRE), et le fond le juge (src/publier/aussi.js,
//    `relireFormulaire`) ; un écart ⇒ ARRÊT avant « Publier » ;
//  · une vérification VISIBLE (captcha, DataDome ; ≥ 120 × 60 à l'écran) ⇒ ARRÊT ;
//  · une option PAYANTE cochée (boost, « à la une », un prix sur une option) ⇒ ARRÊT (VRM ne paie jamais) ;
//  · un champ obligatoire de la page que VRM ne connaît pas, resté vide ⇒ ARRÊT, son libellé nommé ;
//  · « Publier » n'est cliqué qu'UNE fois par onglet et par publication (`sessionStorage`) — jamais deux ;
//  · la frise de la publication est dite en haut de l'onglet (preuve à l'écran), avec « Tout arrêter ».
// ⚠️ Les formulaires de dépôt de ces deux sites n'ont jamais été vus d'ici (403) : la liste des repères NON
//    vérifiés en vrai est dans docs/passation/2026-11-21-ext-5424.md. Un repère qui ne trouve rien ARRÊTE, il ne devine pas.
(function () {
  'use strict';
  if (window.__vrmDepotAussi) return; window.__vrmDepotAussi = true;
  if (window.top !== window) return;
  const SITE = /(^|\.)leboncoin\.fr$/i.test(location.hostname) ? 'leboncoin' : /(^|\.)vestiairecollective\.com$/i.test(location.hostname) ? 'vestiaire' : '';
  if (!SITE) return;
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const hasard = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const propre = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
  const norm = (t) => propre(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ');
  let stop = false;

  // ── Ce qui n'est pas un champ du dépôt ──
  const NOTRE_UI = (el) => !!(el && el.closest && el.closest('[data-vrm], #vrm-aussi-frise, #vrm-badge, #vrm-lbc-banner, #vrm-vc-b'));
  const DANS_ENTETE = (el) => !!(el && el.closest && el.closest('header, footer, nav, [role="search"], [role="banner"], [role="navigation"], form[action*="recherche"]'));
  const PAS_DU_DEPOT = /recherch|search|\bmin\b|\bmax\b|filtr|\btri\b|newsletter|e-?mail|password|mot.?de.?passe/i;
  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  }
  const utile = (el) => visible(el) && !NOTRE_UI(el) && !DANS_ENTETE(el);
  function verificationVisible() {
    try {
      for (const f of document.querySelectorAll('iframe, #datadome-captcha')) {
        const src = String(f.src || f.id || '');
        if (!/captcha-delivery\.com|datadome|hcaptcha|recaptcha|turnstile|challenges\.cloudflare/i.test(src)) continue;
        const r = f.getBoundingClientRect();
        if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true;
      }
    } catch (_) {}
    return false;
  }
  // Le libellé d'un champ : son <label>, aria-label, aria-labelledby, la légende de son groupe, placeholder, name, id.
  function texteDe(el) { return propre(el ? (el.innerText != null ? el.innerText : el.textContent) : ''); }
  function libelleDe(el) {
    if (!el) return '';
    const parts = [];
    try { if (el.labels && el.labels.length) parts.push(texteDe(el.labels[0])); } catch (_) {}
    const al = el.getAttribute && el.getAttribute('aria-label'); if (al) parts.push(al);
    const lb = el.getAttribute && el.getAttribute('aria-labelledby');
    if (lb) for (const id of lb.split(/\s+/)) { const x = document.getElementById(id); if (x) parts.push(texteDe(x)); }
    const fs = el.closest && el.closest('fieldset'); if (fs) { const lg = fs.querySelector('legend'); if (lg) parts.push(texteDe(lg)); }
    for (const a of ['placeholder', 'name', 'id', 'data-testid', 'data-qa-id']) { const v = el.getAttribute && el.getAttribute(a); if (v) parts.push(v); }
    return parts.join(' · ');
  }
  // ── LES REPÈRES DE CHAQUE CHAMP (non vérifiés en vrai : voir le récit) ──
  const CHAMPS = {
    titre: { sorte: 'texte', motif: /\btitre\b|\btitle\b|\bsubject\b|que proposez|nom de l'article|nom de l’article/i },
    description: { sorte: 'texte', motif: /description|\bbody\b|d[ée]cri/i, long: true },
    prix: { sorte: 'texte', motif: /\bprix\b|\bprice\b/i, nombre: true },
    categorie: { sorte: 'choix', motif: /cat[ée]gorie|category|rubrique/i },
    univers: { sorte: 'choix', motif: /^univers\b|\bunivers\b|\bgenre\b|gender/i },
    type: { sorte: 'choix', motif: /^type\b|\btype de\b/i },
    marque: { sorte: 'choix', motif: /\bmarque\b|\bbrand\b|cr[ée]ateur|designer/i },
    taille: { sorte: 'choix', motif: /\btaille\b|\bpointure\b|\bsize\b/i },
    etat: { sorte: 'choix', motif: /[ée]tat\b|\bcondition\b/i },
    couleur: { sorte: 'choix', motif: /\bcouleur\b|\bcolou?r\b/i },
  };
  const ORDRE = ['photos', 'titre', 'categorie', 'univers', 'type', 'marque', 'taille', 'etat', 'couleur', 'description', 'prix'];
  const NOM = { photos: 'Photos', titre: 'Titre', description: 'Description', prix: 'Prix', categorie: 'Catégorie', univers: 'Univers', type: 'Type', marque: 'Marque', taille: 'Taille', etat: 'État', couleur: 'Couleur' };
  function champsTexte(def) {
    const els = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]')).filter((el) => {
      if (!utile(el) || el.disabled || el.readOnly) return false;
      if (el.tagName === 'INPUT' && /^(hidden|file|checkbox|radio|submit|button|search)$/i.test(el.type || '')) return false;
      if (el.getAttribute('role') === 'combobox') return false;
      const l = libelleDe(el);
      if (PAS_DU_DEPOT.test(l)) return false;
      if (!def.motif.test(l)) return false;
      if (def.long && el.tagName === 'INPUT') return false;
      return true;
    });
    return els;
  }
  // Un contrôle de choix : <select>, combobox (bouton ou champ), ou groupe de boutons radio.
  function controlesChoix(def) {
    const out = [];
    for (const el of document.querySelectorAll('select, [role="combobox"], button[aria-haspopup="listbox"], [role="radiogroup"], fieldset')) {
      if (!utile(el) || el.disabled) continue;
      if (el.tagName === 'FIELDSET' && !el.querySelector('input[type="radio"], [role="radio"]')) continue;
      if (el.tagName === 'FIELDSET' && el.querySelector('[role="radiogroup"]')) continue;
      const l = el.tagName === 'FIELDSET' ? texteDe(el.querySelector('legend')) : libelleDe(el);
      if (!def.motif.test(l)) continue;
      out.push(el);
    }
    return out;
  }
  // ── Taper lettre à lettre (la page voit chaque lettre) ──
  function insererUn(el, ch) {
    let ok = false;
    try { ok = document.execCommand('insertText', false, ch); } catch (_) { ok = false; }
    if (ok) return;
    if (el.isContentEditable) el.textContent = (el.textContent || '') + ch;
    else { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(el.value || '') + ch); }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\n' ? 'insertLineBreak' : 'insertText' }));
  }
  const contenu = (el) => (el.isContentEditable ? el.innerText : String(el.value == null ? '' : el.value));
  function vider(el) {
    try { el.focus(); if (el.select) el.select(); else document.execCommand('selectAll', false, null); } catch (_) {}
    let ok = false; try { ok = document.execCommand('delete', false, null); } catch (_) { ok = false; }
    if (!ok || contenu(el)) {
      if (el.isContentEditable) el.textContent = '';
      else { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ''); }
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
  }
  async function taper(el, texte) {
    surligner(el);
    el.scrollIntoView({ block: 'center' });
    el.click(); el.focus();
    await attendre(hasard(250, 600));
    // Le site a pu pré-remplir (Vestiaire propose un titre) : la page de travail est la sienne, pas un brouillon de lui.
    if (contenu(el)) vider(el);
    for (const ch of [...String(texte)]) {
      if (stop) return 'stop';
      if (verificationVisible()) return 'verification';
      if (document.activeElement !== el) el.focus();
      insererUn(el, ch);
      await attendre(hasard(25, 90));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { el.blur(); } catch (_) {}
    await attendre(hasard(250, 600));
    return '';
  }
  const cliquer = async (el) => { surligner(el); el.scrollIntoView({ block: 'center' }); await attendre(hasard(400, 1000)); el.click(); };
  // ── Choisir une valeur : le libellé EXACT du site, un seul élément ──
  const optionsVisibles = (racine) => Array.from((racine || document).querySelectorAll('[role="option"], [role="menuitemradio"], [role="menuitem"], li[data-value], [data-option]')).filter((o) => utile(o) || (o.closest && o.closest('[role="listbox"]') && visible(o)));
  async function attendreQue(test, ms) { for (const fin = Date.now() + ms; Date.now() < fin;) { const r = test(); if (r) return r; if (stop) return null; await attendre(150); } return null; }
  function relireChoix(ctrl) {
    if (!ctrl) return '';
    if (ctrl.tagName === 'SELECT') { const o = ctrl.options[ctrl.selectedIndex]; return o && ctrl.value !== '' ? propre(o.textContent) : ''; }
    if (ctrl.getAttribute('role') === 'radiogroup' || ctrl.tagName === 'FIELDSET') {
      const coche = Array.from(ctrl.querySelectorAll('input[type="radio"], [role="radio"]')).find((r) => r.checked || r.getAttribute('aria-checked') === 'true');
      if (!coche) return '';
      const lab = coche.labels && coche.labels[0] ? coche.labels[0] : coche.closest('label');
      return propre(lab ? texteDe(lab) : (coche.getAttribute('aria-label') || texteDe(coche)));
    }
    if ('value' in ctrl && ctrl.tagName === 'INPUT') return propre(ctrl.value);
    // Un bouton de liste : il montre la valeur choisie (une de ses lignes), pas son libellé de champ.
    const l = libelleDe(ctrl);
    const lignes = texteDe(ctrl).split('\n').map(propre).filter((x) => x && norm(x) !== norm(l));
    return lignes.length ? lignes[lignes.length - 1] : '';
  }
  async function choisirDans(ctrl, valeur) {
    const v = norm(valeur);
    if (ctrl.tagName === 'SELECT') {
      const opts = Array.from(ctrl.options).filter((o) => norm(o.textContent) === v);
      if (opts.length !== 1) return { erreur: opts.length ? 'champ-ambigu' : 'option-absente' };
      surligner(ctrl); await attendre(hasard(400, 900));
      ctrl.value = opts[0].value;
      ctrl.dispatchEvent(new Event('input', { bubbles: true })); ctrl.dispatchEvent(new Event('change', { bubbles: true }));
      return {};
    }
    if (ctrl.getAttribute('role') === 'radiogroup' || ctrl.tagName === 'FIELDSET') {
      const rs = Array.from(ctrl.querySelectorAll('input[type="radio"], [role="radio"]')).filter((r) => { const lab = r.labels && r.labels[0] ? r.labels[0] : r.closest('label'); return norm(lab ? texteDe(lab) : (r.getAttribute('aria-label') || texteDe(r))) === v; });
      if (rs.length !== 1) return { erreur: rs.length ? 'champ-ambigu' : 'option-absente' };
      const lab = rs[0].labels && rs[0].labels[0] ? rs[0].labels[0] : rs[0].closest('label');
      await cliquer(lab || rs[0]);
      return {};
    }
    // Liste déroulante du site : l'ouvrir, chercher (si elle a un champ de recherche), cliquer l'option exacte.
    await cliquer(ctrl);
    let liste = await attendreQue(() => { const l = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"]')).filter(visible); return l.length ? l : null; }, 6000);
    if (!liste) return { erreur: 'option-absente' };
    let exactes = () => optionsVisibles(document).filter((o) => norm(o.getAttribute('aria-label') || texteDe(o)) === v);
    if (!exactes().length) {
      const recherche = Array.from(document.querySelectorAll('[role="listbox"] input, [role="dialog"] input[type="search"], [role="dialog"] input[type="text"], input[aria-autocomplete="list"]')).filter(visible)[0] || (ctrl.tagName === 'INPUT' ? ctrl : null);
      if (recherche) { const t = await taper(recherche, valeur); if (t) return { erreur: t }; await attendreQue(() => exactes().length, 4000); }
    }
    const l = exactes();
    if (l.length !== 1) { try { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (_) {} return { erreur: l.length ? 'champ-ambigu' : 'option-absente' }; }
    await cliquer(l[0]);
    await attendreQue(() => !l[0].isConnected || !visible(l[0]), 3000);
    return {};
  }
  // La catégorie sans contrôle nommé : des cartes / boutons au libellé de chaque niveau (« Mode » › « Chaussures »).
  function elementAuTexte(libelle) {
    const v = norm(libelle);
    const l = Array.from(document.querySelectorAll('button, [role="button"], [role="radio"], [role="option"], [role="tab"], label, a[role="button"], li[role="option"]'))
      .filter((el) => utile(el) && norm(el.getAttribute('aria-label') || texteDe(el)) === v);
    return l;
  }
  function selectionneAuTexte(libelle) {
    const v = norm(libelle);
    return Array.from(document.querySelectorAll('[aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], [aria-current="true"], input[type="radio"]:checked'))
      .some((el) => { const lab = el.tagName === 'INPUT' ? (el.labels && el.labels[0]) || el.closest('label') : el; return lab && norm(lab.getAttribute && lab.getAttribute('aria-label') || texteDe(lab)) === v; });
  }
  // ── Les photos : une à une (l'uploader du site peut vider son champ après chaque fichier), preuve = vignettes / fichiers gardés ──
  function champPhoto() { return Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled && !NOTRE_UI(el) && !DANS_ENTETE(el)); }
  function vignettes() { return Array.from(document.querySelectorAll('img')).filter((im) => !NOTRE_UI(im) && /^(blob:|data:image)/.test(String(im.currentSrc || im.src || '')) && visible(im)).length; }
  const FORMAT = (b) => (b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) ? 'jpg' : (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) ? 'png' : (b.length > 11 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) ? 'webp' : '';
  async function enJpeg(buf) {
    try { const bmp = await createImageBitmap(new Blob([buf])); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92)); return b ? new Uint8Array(await b.arrayBuffer()) : null; } catch (_) { return null; }
  }
  async function deposerPhotos(n) {
    const champs = champPhoto();
    if (!champs.length) return { erreur: 'champ-absent', element: NOM.photos };
    if (champs.length > 1) return { erreur: 'champ-ambigu', element: NOM.photos };
    let r = null; try { r = await new Promise((ok) => chrome.runtime.sendMessage({ from: 'vrm-aussi', action: 'aussiPhotos' }, (x) => { void chrome.runtime.lastError; ok(x || null); })); } catch (_) { r = null; }
    const photos = r && r.ok && Array.isArray(r.photos) ? r.photos : [];
    if (photos.length !== n || photos.some((p) => !p || !p.b64)) return { erreur: 'photos', element: `${photos.filter((p) => p && p.b64).length}/${n} lues` };
    if (r.vestiaire && photos.some((p) => p.detoure !== true)) return { erreur: 'photos-detourage' };
    const fichiers = [];
    for (let i = 0; i < photos.length; i++) {
      const bin = atob(photos[i].b64); let buf = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);
      let ext = FORMAT(buf);
      if (ext === 'webp') { const jp = await enJpeg(buf); if (jp && FORMAT(jp) === 'jpg') { buf = jp; ext = 'jpg'; } else ext = ''; }
      if (!ext) return { erreur: 'photos', element: `photo ${i + 1} : format` };
      fichiers.push(new File([buf], `VRM-${r.numero || ''}-${i + 1}.${ext}`, { type: ext === 'png' ? 'image/png' : 'image/jpeg' }));
    }
    const base = vignettes();
    let gardes = 0;
    for (let i = 0; i < fichiers.length; i++) {
      if (stop) return { erreur: 'stop' };
      if (verificationVisible()) return { erreur: 'verification' };
      const f = champPhoto()[0]; if (!f) return { erreur: 'champ-absent', element: NOM.photos };
      surligner(f.closest('label, div') || f);
      const dt = new DataTransfer();
      for (const x of f.files || []) dt.items.add(x);
      dt.items.add(fichiers[i]);
      f.files = dt.files;
      f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
      // La preuve : une vignette de plus, ou le champ qui garde ses fichiers.
      const ok = await attendreQue(() => vignettes() - base >= i + 1 || ((champPhoto()[0] || {}).files || []).length >= i + 1, 8000);
      if (!ok) return { erreur: 'photos', element: `photo ${i + 1} pas prise par la page` };
      gardes = i + 1;
      await attendre(hasard(500, 1200));
    }
    return { relu: String(Math.max(gardes && vignettes() - base, ((champPhoto()[0] || {}).files || []).length)) };
  }
  // ── Les options payantes : jamais ──
  const NOM_BOOST = /(gallery|galerie|bump|remont|toplist|top.?liste|urgent|boost|mise en avant|mettre en avant|premium|\bpack\b|photos?\s*suppl|[àa] la une|logo|sponsor)/i;
  function optionPayanteCochee() {
    return Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"], [aria-pressed]')).some((cb) => {
      if (NOTRE_UI(cb) || DANS_ENTETE(cb)) return false;
      const lab = cb.labels && cb.labels[0] ? texteDe(cb.labels[0]) : (cb.closest('label') ? texteDe(cb.closest('label')) : (cb.getAttribute('aria-label') || texteDe(cb)));
      const nom = (cb.name || '') + ' ' + (cb.id || '') + ' ' + lab;
      const coche = cb.checked || cb.getAttribute('aria-checked') === 'true' || cb.getAttribute('aria-pressed') === 'true';
      if (!coche) return false;
      if (NOM_BOOST.test(nom)) return true;
      return /€|\beuros?\b/i.test(lab) && !/\b0(?:[.,]00)?\s*€|gratuit|sans option|aucune option/i.test(lab) && cb.type !== 'radio';
    });
  }
  // ── Les boutons d'étape : un seul, au libellé exact ──
  const libBtn = (b) => propre((b.innerText || b.value || '') + ' ' + (b.getAttribute('aria-label') || ''));
  function boutons(re) {
    return Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).filter((b) => utile(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true'
      && re.test(norm(b.innerText || b.value || b.getAttribute('aria-label') || '')) && !/€|\beuros?\b|booster|boost|payer|premium|\bpack\b|a la une|mise en avant|mettre en avant/i.test(libBtn(b)));
  }
  const RE_CONTINUER = /^(continuer|suivant|etape suivante|valider)$/;
  const RE_PUBLIER = /^(publier|publier mon annonce|publier l'annonce|publier l'article|deposer mon annonce|deposer l'annonce|mettre en vente|mettre en ligne|mettre en vente mon article)$/;
  // Un champ obligatoire de la page, visible et vide, que VRM ne remplit pas : nommé (jamais deviné).
  function obligatoireInconnu(connus) {
    for (const el of document.querySelectorAll('input, textarea, select')) {
      if (!utile(el) || el.disabled || /^(hidden|file|checkbox|radio|submit|button)$/i.test(el.type || '')) continue;
      if (!(el.required || el.getAttribute('aria-required') === 'true')) continue;
      if (String(el.value || '').trim()) continue;
      if (connus.has(el)) continue;
      return libelleDe(el).split(' · ')[0] || el.name || 'champ';
    }
    return '';
  }
  // ── La FRISE (preuve à l'écran) ──
  let frise = null, friseEtat = {};
  function dessinerFrise(titre) {
    if (!frise) {
      frise = document.createElement('div'); frise.id = 'vrm-aussi-frise'; frise.setAttribute('data-vrm', 'aussi');
      frise.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483646;background:#FFFFFF;color:#111114;border-bottom:.5px solid #D1D1D6;font:500 13px/18px -apple-system,system-ui,sans-serif;padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;box-shadow:0 1px 8px rgba(0,0,0,.08)';
      document.documentElement.appendChild(frise);
    }
    frise.replaceChildren();
    const t = document.createElement('b'); t.textContent = 'VRM publie ' + (titre || ''); frise.appendChild(t);
    for (const k of ORDRE.concat(['publier'])) {
      if (!(k in friseEtat)) continue;
      const s = document.createElement('span'); s.setAttribute('data-aussi-etape', k); s.setAttribute('data-etat', friseEtat[k]);
      s.textContent = (friseEtat[k] === 'ok' ? '✓ ' : friseEtat[k] === 'ko' ? '✕ ' : '… ') + (NOM[k] || 'Publier');
      s.style.cssText = 'padding:2px 8px;border-radius:999px;background:' + (friseEtat[k] === 'ok' ? '#E6F4EA' : friseEtat[k] === 'ko' ? '#FFF4DD' : '#F2F2F7') + ';color:' + (friseEtat[k] === 'ko' ? '#8A4B00' : '#111114');
      frise.appendChild(s);
    }
    if (issue) {
      const p = document.createElement('p'); p.setAttribute('data-aussi-issue', issue.etat);
      p.textContent = issue.etat === 'publiee' ? 'Publiée — l’annonce est reliée à son N° dans VRM.' : (issue.etat === 'pas-su' ? 'À vérifier : ' : 'Arrêté avant « Publier » : ') + issue.raison;
      p.style.cssText = 'flex-basis:100%;margin:2px 0 0;padding:6px 10px;border-radius:10px;background:' + (issue.etat === 'publiee' ? '#E6F4EA' : '#FFF4DD') + ';color:' + (issue.etat === 'publiee' ? '#1F7A3A' : '#8A4B00');
      frise.appendChild(p);
      return;
    }
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Tout arrêter'; b.setAttribute('data-aussi-stop', '');
    b.style.cssText = 'margin-left:auto;min-height:44px;padding:0 14px;border-radius:10px;border:.5px solid #C7C7CC;background:#F2F2F7;color:#111114;font:600 13px -apple-system,system-ui,sans-serif';
    b.addEventListener('click', () => { stop = true; try { chrome.runtime.sendMessage({ from: 'vrm-aussi', action: 'publierAussiStop' }, () => { void chrome.runtime.lastError; }); } catch (_) {} });
    frise.appendChild(b);
  }
  // L'issue, dite sur l'onglet (publiée ; ou arrêtée, avec la raison) — la frise reste, le bouton d'arrêt part.
  let issue = null;
  function finFrise(m) {
    issue = { etat: String(m && m.etat || ''), raison: String(m && m.raison || '').slice(0, 300) };
    if (issue.etat === 'publiee') friseEtat.publier = 'ok';
    dessinerFrise('');
  }
  let surligne = null;
  function surligner(el) { try { if (surligne && surligne !== el) surligne.style.outline = surligne.__vrmOutline || ''; if (el) { el.__vrmOutline = el.style.outline; el.style.outline = '2px solid #0F6B4C'; surligne = el; } } catch (_) {} }

  // ── UNE PAGE DU FORMULAIRE : remplir ce qui est là, relire ──
  async function page(o) {
    const attendu = o && o.attendu && typeof o.attendu === 'object' ? o.attendu : null;
    if (!attendu) return { ok: false, erreur: 'ordre' };
    const faits = new Set(Array.isArray(o.faits) ? o.faits : []);
    dessinerFrise(o.titre);
    await attendre(hasard(600, 1200));                // la page se pose (un formulaire de site se dessine en plusieurs temps)
    if (verificationVisible()) return { ok: false, erreur: 'verification' };
    if (optionPayanteCochee()) return { ok: false, erreur: 'option-payante' };
    const remplis = {}; const connus = new Set();
    for (const k of ORDRE) {
      if (stop) return { ok: false, erreur: 'stop' };
      if (faits.has(k) || !(k in attendu)) continue;
      if (k === 'photos') {
        if (!champPhoto().length) continue;
        friseEtat.photos = 'cours'; dessinerFrise(o.titre);
        const r = await deposerPhotos(Number(attendu.photos) || 0);
        if (r.erreur) { friseEtat.photos = 'ko'; dessinerFrise(o.titre); return { ok: false, erreur: r.erreur, element: r.element || NOM.photos, remplis }; }
        remplis.photos = r.relu; friseEtat.photos = 'ok'; dessinerFrise(o.titre); continue;
      }
      const def = CHAMPS[k];
      const valeur = k === 'prix' ? String(attendu.prix) : String(attendu[k]);
      if (def.sorte === 'texte') {
        const l = champsTexte(def);
        if (!l.length) continue;                        // pas sur cette page (le dépôt est en étapes)
        if (l.length > 1) return { ok: false, erreur: 'champ-ambigu', element: NOM[k], remplis };
        friseEtat[k] = 'cours'; dessinerFrise(o.titre);
        const t = await taper(l[0], valeur);
        if (t) return { ok: false, erreur: t, remplis };
        connus.add(l[0]);
        remplis[k] = propre(contenu(l[0]));
        friseEtat[k] = norm(remplis[k]) === norm(valeur) || (k === 'prix' && Number(remplis[k].replace(',', '.')) === Number(valeur)) ? 'ok' : 'ko'; dessinerFrise(o.titre);
        continue;
      }
      // Un choix.
      const ctrls = controlesChoix(def);
      if (ctrls.length > 1) return { ok: false, erreur: 'champ-ambigu', element: NOM[k], remplis };
      if (ctrls.length === 1) {
        friseEtat[k] = 'cours'; dessinerFrise(o.titre);
        const r = await choisirDans(ctrls[0], valeur);
        if (r.erreur) { friseEtat[k] = 'ko'; dessinerFrise(o.titre); return { ok: false, erreur: r.erreur, element: NOM[k] + ' « ' + valeur + ' »', remplis }; }
        await attendre(hasard(300, 700));
        connus.add(ctrls[0]);
        remplis[k] = relireChoix(ctrls[0]);
        friseEtat[k] = norm(remplis[k]) === norm(valeur) ? 'ok' : 'ko'; dessinerFrise(o.titre);
        continue;
      }
      // La catégorie en cartes (sans contrôle nommé) : chaque niveau au libellé exact, unique (« Mode » › « Chaussures »),
      // puis la sélection RELUE (l'élément que la page marque choisi). Rien de visible ⇒ pas sur cette page.
      if (k === 'categorie' || k === 'univers') {
        const niveaux = k === 'categorie' && Array.isArray(o.chemin) && o.chemin.length ? o.chemin.map(String) : [valeur];
        let clique = false;
        for (let i = 0; i < niveaux.length; i++) {
          const nv = niveaux[i];
          if (selectionneAuTexte(nv)) continue;
          const l = elementAuTexte(nv);
          if (!l.length) { if (!clique) break; friseEtat[k] = 'ko'; dessinerFrise(o.titre); return { ok: false, erreur: 'option-absente', element: NOM[k] + ' « ' + nv + ' »', remplis }; }
          if (l.length > 1) return { ok: false, erreur: 'champ-ambigu', element: NOM[k] + ' « ' + nv + ' »', remplis };
          friseEtat[k] = 'cours'; dessinerFrise(o.titre);
          await cliquer(l[0]); clique = true;
          if (i < niveaux.length - 1) await attendreQue(() => elementAuTexte(niveaux[i + 1]).length || selectionneAuTexte(niveaux[i + 1]), 4000);
        }
        if (!clique && !selectionneAuTexte(valeur)) continue;
        const vu = await attendreQue(() => selectionneAuTexte(valeur), 4000);
        remplis[k] = vu ? propre(valeur) : '';
        friseEtat[k] = vu ? 'ok' : 'ko'; dessinerFrise(o.titre);
        if (!vu) return { ok: false, erreur: 'pas-avance', element: NOM[k] + ' « ' + valeur + ' »', remplis };
      }
    }
    const publication = boutons(RE_PUBLIER).length > 0;
    const cont = boutons(RE_CONTINUER);
    const manque = obligatoireInconnu(connus);
    return { ok: true, remplis, publication, continuer: !manque && cont.length === 1, ...(manque ? { manque } : {}), ...(cont.length > 1 ? { manque: 'deux boutons « Continuer »' } : {}) };
  }
  function signaturePage() { return location.href + '|' + Array.from(document.querySelectorAll('input, textarea, select, [role="combobox"], [role="radiogroup"]')).filter(visible).map((e) => libelleDe(e)).join('|'); }
  async function continuer() {
    if (verificationVisible()) return { ok: false, erreur: 'verification' };
    if (optionPayanteCochee()) return { ok: false, erreur: 'option-payante' };
    const l = boutons(RE_CONTINUER);
    if (l.length !== 1) return { ok: false, erreur: l.length ? 'champ-ambigu' : 'bouton-absent', element: 'Continuer' };
    const avant = signaturePage();
    await cliquer(l[0]);
    const change = await attendreQue(() => signaturePage() !== avant, 8000);
    if (!change) {
      const err = Array.from(document.querySelectorAll('[role="alert"], [aria-invalid="true"]')).filter(utile).map((e) => libelleDe(e) || texteDe(e)).filter(Boolean)[0] || '';
      return { ok: false, erreur: 'pas-avance', element: err ? err.slice(0, 80) : 'Continuer' };
    }
    return { ok: true };
  }
  // La relecture finale : ce que la page MONTRE encore (les champs de la dernière étape, un récapitulatif).
  function relire(champs) {
    const lus = {};
    for (const k of Array.isArray(champs) ? champs : []) {
      const def = CHAMPS[k]; if (!def) continue;
      if (def.sorte === 'texte') { const l = champsTexte(def); if (l.length === 1) lus[k] = propre(contenu(l[0])); continue; }
      const c = controlesChoix(def); if (c.length === 1) { const v = relireChoix(c[0]); if (v) lus[k] = v; }
    }
    return lus;
  }
  async function publier(o) {
    const cle = 'vrmAussiClique:' + String(o && o.cle || '');
    let deja = true; try { deja = !!sessionStorage.getItem(cle); } catch (_) { deja = true; }
    if (deja) return { ok: false, clique: false, erreur: 'deja-clique' };
    if (verificationVisible()) return { ok: false, clique: false, erreur: 'verification' };
    if (optionPayanteCochee()) return { ok: false, clique: false, erreur: 'option-payante' };
    if (stop) return { ok: false, clique: false, erreur: 'stop' };
    const l = boutons(RE_PUBLIER);
    if (l.length !== 1) return { ok: false, clique: false, erreur: l.length ? 'champ-ambigu' : 'bouton-absent', element: 'Publier' };
    try { sessionStorage.setItem(cle, String(Date.now())); } catch (_) { return { ok: false, clique: false, erreur: 'stockage' }; }
    friseEtat.publier = 'cours'; dessinerFrise('');
    await cliquer(l[0]);
    friseEtat.publier = 'ok'; dessinerFrise('');
    return { ok: true, clique: true, bouton: libBtn(l[0]).slice(0, 40) };
  }
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'aussiUI') return;
      if (!sender || sender.id !== chrome.runtime.id) return;
      const q = String(msg.quoi || '');
      if (q === 'pret') { sendResponse({ ok: true, site: SITE, href: String(location.href).slice(0, 300) }); return; }
      if (q === 'stop') { stop = true; sendResponse({ ok: true }); return; }
      if (q === 'fin') { finFrise(msg); sendResponse({ ok: true }); return; }
      const f = q === 'page' ? page(msg) : q === 'continuer' ? continuer() : q === 'relire' ? Promise.resolve({ ok: true, lus: relire(msg.champs) }) : q === 'publier' ? publier(msg) : null;
      if (!f) { sendResponse({ ok: false, erreur: 'ordre' }); return; }
      f.then(sendResponse, () => sendResponse({ ok: false, erreur: 'interrompu' }));
      return true;
    });
  } catch (_) {}
  try { window.__vrmDepotAussiTest = { champsTexte, controlesChoix, relire, verificationVisible, optionPayanteCochee, CHAMPS }; } catch (_) {}
})();
