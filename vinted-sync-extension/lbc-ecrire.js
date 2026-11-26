// lbc-ecrire.js — monde isolé de leboncoin.fr : ÉCRIRE PAR L'INTERFACE DE LA PAGE (5.416.0, 21 nov.).
//
// Décision de Julien (21 nov.) : « on ne fait plus les requêtes », « pour tous les sites ». Sur Leboncoin, les
// quatre écritures que VRM faisait par requête — mettre une annonce en PAUSE, la SUPPRIMER (son clic confirmé),
// CHANGER SON PRIX (son clic, ou la baisse par règle) et RÉPONDRE dans une conversation (son clic, ou « Leur
// écrire » aux intéressés) — se font maintenant par la page elle-même, dans l'onglet : VRM clique et tape
// (lettre à lettre), et c'est la PAGE qui envoie. Clics et frappes `isTrusted:false` ASSUMÉS (décision du
// 20 nov.), AUCUN maquillage (ni isTrusted, ni debugger/CDP, ni souris inventée).
//
// Rien n'est deviné. Les boutons et les champs de Leboncoin n'ont jamais été vus d'ici (403) : VRM les APPREND
// de SON geste fait à la main, une fois, dans ce Chrome (comme `lbc_formulaires` pour le dépôt) — les clics
// VRAIS (isTrusted) qu'il a faits juste avant que la page envoie l'écriture que lbc-inject.js a vue. Ce qui est
// gardé : une « signature » par étape (balise, quelques attributs stables, le mot court du bouton — jamais un
// texte saisi, jamais un prix, jamais un nom), dans CE navigateur (`chrome.storage.local`, `vrmLbcUi`).
//
// À chaque geste :
//  · le compte privé de la PAGE (lu par lbc-inject.js) doit être celui que le fond attend, sinon rien ;
//  · l'annonce se désigne par son IDENTIFIANT (le lien de sa rangée, l'adresse de la page), jamais par son titre :
//    « même avec 50 annonces identiques, tu ne dois pas pouvoir te tromper » ; la conversation, par son identifiant
//    dans l'adresse ET la dernière conversation que la page a chargée ;
//  · chaque étape doit désigner UN seul élément visible, et apparaître après l'étape d'avant (la preuve à l'écran
//    que le clic a pris) ; sinon ARRÊT, l'élément nommé — avant le clic final, celui qui envoie (irréversible pour
//    une suppression) ;
//  · « fait » SEULEMENT quand la page a envoyé CETTE écriture (CETTE annonce, CE prix, CE texte dans CETTE
//    conversation) — vu par lbc-inject.js sur le canal privé ; pas vu ⇒ « je ne sais pas », jamais « fait » ;
//  · une vérification VISIBLE (captcha, DataDome ; ≥ 120 × 60 à l'écran) ⇒ arrêt ;
//  · une action à la fois ; délais au hasard (500–1 500 ms entre deux clics, 40–160 ms entre deux lettres).
// L'ordre ne vient QUE du fond de l'extension, pour le cadre principal.
(function () {
  'use strict';
  if (window.__vrmLbcEcrire) return; window.__vrmLbcEcrire = true;
  if (window.top !== window) return;
  if (!/(^|\.)leboncoin\.fr$/i.test(location.hostname)) return;
  const CLE_UI = 'vrmLbcUi';
  const ATTRS = ['data-testid', 'data-test', 'data-qa-id', 'data-cy', 'name', 'role', 'type', 'aria-label'];
  const ETAPES_MAX = 5;
  const vivant = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const hasard = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const propre = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const pont = () => { try { return window.__vrmLbcPont || null; } catch (_) { return null; } };

  // ── Ce que la page a ENVOYÉ (vu par lbc-inject.js, canal privé, via lbc-relay.js) ──
  const vus = [];             // les 40 derniers gestes vus { quoi, ids, conv, texte, ad, euros, statut, moi, defi, at }
  const attentes = [];        // { test, ok }
  let ordreEnCours = false;
  let convVue = { conv: '', moi: '', at: 0 };
  let ecouteBranchee = false;
  function brancher() {
    if (ecouteBranchee) return true;
    const p = pont(); if (!p) return false;
    ecouteBranchee = true;
    p.ecouter((d) => {
      if (!d || typeof d !== 'object') return;
      if (d.kind === 'lbcconvvue') { convVue = { conv: String(d.conv || ''), moi: String(d.moi || ''), at: Number(d.at) || Date.now() }; return; }
      if (d.kind !== 'lbcgestevu') return;
      const g = { quoi: String(d.quoi || ''), ids: Array.isArray(d.ids) ? d.ids.map(String) : [], conv: String(d.conv || ''), texte: typeof d.texte === 'string' ? d.texte : '',
        ad: String(d.ad || ''), euros: Number(d.euros), statut: Number(d.statut) || 0, moi: String(d.moi || ''), defi: d.defi === true, at: Date.now() };
      vus.push(g); while (vus.length > 40) vus.shift();
      for (const a of attentes.slice()) if (a.test(g)) { attentes.splice(attentes.indexOf(a), 1); a.ok(g); }
      if (!ordreEnCours && g.statut >= 200 && g.statut < 300) apprendre(g).catch(() => {});
    });
    return true;
  }
  brancher();
  const attendreVu = (test, ms) => new Promise((ok) => {
    const a = { test, ok: (g) => { clearTimeout(t); ok(g); } };
    const t = setTimeout(() => { const i = attentes.indexOf(a); if (i >= 0) attentes.splice(i, 1); ok(null); }, ms);
    attentes.push(a);
  });

  // ── Signatures (jamais un texte saisi, jamais un nombre) ──
  const editable = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|tel|number|)$/i.test(el.type || '')) || el.isContentEditable === true);
  const CLIQUABLE = 'button,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="option"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"],a[href],label,input[type="checkbox"],input[type="radio"],input[type="submit"],summary';
  function signature(el, avecMot) {
    if (!el || !el.tagName) return null;
    const attrs = {};
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && v.length <= 60 && !/\d{3,}/.test(v)) attrs[a] = v; }
    const s = { tag: el.tagName.toLowerCase(), ce: el.isContentEditable === true, attrs };
    if (avecMot) { const t = propre(el.textContent).slice(0, 40); if (t && !/\d/.test(t)) s.mot = t; }
    return s;
  }
  const nomDe = (sig) => (sig && (sig.mot || (sig.attrs && (sig.attrs['aria-label'] || sig.attrs['data-testid'] || sig.attrs['data-qa-id'] || sig.attrs.name)) || sig.tag)) || 'l’élément';
  const visible = (el) => { try { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05; } catch (_) { return false; } };
  function trouver(sig, dans) {
    if (!sig || !/^[a-z][a-z0-9-]{0,20}$/.test(String(sig.tag || ''))) return { el: null, n: 0 };
    let sel = sig.tag;
    for (const [k, v] of Object.entries(sig.attrs || {})) if (ATTRS.includes(k)) sel += `[${k}="${String(v).replace(/["\\]/g, '\\$&')}"]`;
    let liste = [];
    try { liste = [...(dans || document).querySelectorAll(sel)]; } catch (_) { return { el: null, n: 0 }; }
    liste = liste.filter((el) => visible(el) && (sig.ce ? el.isContentEditable === true : true) && (!sig.mot || propre(el.textContent).slice(0, 40) === sig.mot) && !(el.closest && el.closest('#vrm-badge,[data-vrm]')));
    return { el: liste.length === 1 ? liste[0] : null, n: liste.length };
  }
  async function trouverAttendu(sig, dans, ms) {
    const fin = Date.now() + ms;
    let r = trouver(sig, dans);
    while (!r.el && Date.now() < fin) { await attendre(250); r = trouver(sig, dans); }
    return r;
  }

  // ── L'IDENTITÉ D'UNE ANNONCE DANS LA PAGE : les liens et attributs qui portent SON identifiant ──
  // Un identifiant Leboncoin (6 à 12 chiffres) lu dans un lien (`/ad/…/{id}`, `/{id}.htm`, `?id={id}`) ou un
  // attribut `data-*` qui ne contient QUE lui. Jamais le titre, jamais le prix, jamais la photo.
  const ID_AD = /^\d{6,12}$/;
  function idsDe(el) {
    const out = new Set();
    try {
      const h = el.getAttribute && el.getAttribute('href');
      if (h) {
        let u = null; try { u = new URL(h, location.origin); } catch (_) {}
        if (u && /(^|\.)leboncoin\.fr$/i.test(u.hostname)) {
          for (const sg of u.pathname.split('/')) { const x = sg.replace(/\.htm$/i, ''); if (ID_AD.test(x)) out.add(x); }
          for (const [k, v] of u.searchParams) if (/^(id|list_?id|ad_?id)$/i.test(k) && ID_AD.test(v)) out.add(v);
        }
      }
      for (const a of (el.attributes ? [...el.attributes] : [])) if (/^data-/i.test(a.name) && ID_AD.test(String(a.value || '').trim())) out.add(String(a.value).trim());
    } catch (_) {}
    return out;
  }
  function idsDans(racine) {
    const out = new Set();
    try {
      for (const x of idsDe(racine)) out.add(x);
      for (const el of racine.querySelectorAll('a[href],[data-list-id],[data-ad-id],[data-id],[data-qa-id]')) for (const x of idsDe(el)) out.add(x);
    } catch (_) {}
    return out;
  }
  // La « rangée » d'une annonce : le plus GRAND conteneur, au-dessus d'un de ses liens, qui ne porte AUCUN autre
  // identifiant d'annonce. Une rangée par annonce ; deux conteneurs distincts ⇒ ambigu (rien n'est cliqué).
  function rangeeDe(el, id) {
    let cur = el, garde = null;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const ids = idsDans(cur);
      if (ids.size && [...ids].some((x) => x !== id)) break;
      if (ids.has(id)) garde = cur;
      cur = cur.parentElement;
    }
    return garde;
  }
  function rangeesDe(id) {
    const ens = new Set();
    try {
      for (const el of document.querySelectorAll('a[href],[data-list-id],[data-ad-id],[data-id],[data-qa-id]')) {
        if (el.closest && el.closest('#vrm-badge,[data-vrm]')) continue;
        if (!idsDe(el).has(id)) continue;
        const r = rangeeDe(el, id); if (r) ens.add(r);
      }
    } catch (_) {}
    // Un conteneur qui en contient un autre de la liste : c'est la même rangée (on garde le plus grand).
    const l = [...ens];
    return l.filter((a) => !l.some((b) => b !== a && b.contains(a)));
  }
  function rangeeVoisine(el) { let cur = el; while (cur && cur !== document.body) { const ids = idsDans(cur); if (ids.size) return ids; cur = cur.parentElement; } return null; }

  // ── Apprendre de SON geste fait à la main (évènements VRAIS seulement) ──
  const actes = [];   // { type: 'clic' | 'saisie' | 'entree', el, at }
  const pousser = (a) => { actes.push(a); while (actes.length > 16) actes.shift(); };
  try {
    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const t = e.target && e.target.closest ? e.target : null; if (!t) return;
      const el = t.closest(CLIQUABLE) || t;
      if (el.closest && el.closest('#vrm-badge,[data-vrm]')) return;
      // Pris AU MOMENT du clic (la page peut retirer la rangée dès que l'écriture a réussi) : la signature, et les
      // identifiants d'annonce du plus proche conteneur qui en porte (la rangée, ou rien).
      const v = rangeeVoisine(el);
      pousser({ type: 'clic', el, sig: signature(el, true), voisins: v ? [...v] : [], at: Date.now() });
    }, true);
    document.addEventListener('input', (e) => {
      if (!e.isTrusted || !editable(e.target)) return;
      const der = actes[actes.length - 1];
      const sep = /,/.test(String(e.target.value || '')) ? ',' : '.';
      if (der && der.type === 'saisie' && der.el === e.target) { der.at = Date.now(); der.sep = sep; return; }
      pousser({ type: 'saisie', el: e.target, sig: signature(e.target, false), sep, at: Date.now() });
    }, true);
    document.addEventListener('keydown', (e) => { if (e.isTrusted && e.key === 'Enter' && !e.shiftKey && editable(e.target)) pousser({ type: 'entree', el: e.target, voisins: [], at: Date.now() }); }, true);
  } catch (_) {}
  // L'adresse de la page, l'identifiant (annonce `{ad}` ou conversation `{conv}`) remis en trou — jamais deviné.
  function adresseDe(cle, trou) {
    try {
      const u = new URL(location.href);
      const tr = (s) => s.split('/').map((x) => (x === cle || x === cle + '.htm' ? x.replace(cle, trou) : x)).join('/');
      const modele = cle ? tr(u.pathname) : u.pathname;
      let recherche = '';
      for (const [k, v] of u.searchParams) if (cle && v === cle && /^[\w-]{1,20}$/.test(k)) recherche = `?${k}=${trou}`;
      if (!/^\/[\w/{}.-]{0,160}$/.test(modele) || /\d{6,}/.test(modele)) return null;
      return { modele, recherche, porte: !!cle && (modele.includes(trou) || recherche.includes(trou)) };
    } catch (_) { return null; }
  }
  async function garder(quoi, ui, info) {
    if (!vivant()) return;
    let tout = {};
    try { tout = (await chrome.storage.local.get(CLE_UI))[CLE_UI] || {}; } catch (_) { return; }
    if (ui) tout[quoi] = ui;
    try { if (ui) await chrome.storage.local.set({ [CLE_UI]: tout }); } catch (_) { return; }
    try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-lbc', action: 'lbcUiAppris', quoi, appris: !!ui }, info || {}), () => { void chrome.runtime.lastError; }); } catch (_) {}
  }
  async function apprendre(g) {
    const t = Date.now();
    const recents = actes.filter((a) => t - a.at <= 30000);
    if (g.quoi === 'pause' || g.quoi === 'supprime' || g.quoi === 'reprise') {
      if (g.ids.length !== 1) return garder(g.quoi, null, { raison: 'plusieurs-annonces' });
      const id = g.ids[0];
      const clics = recents.filter((a) => a.type === 'clic');
      // La 1re étape : un clic DANS la rangée de CETTE annonce ; les suivantes : rien dans la rangée d'une AUTRE.
      const dansSienne = (a) => a.voisins.length > 0 && a.voisins.every((x) => x === id);
      const dansAutre = (a) => a.voisins.length > 0 && !a.voisins.includes(id);
      let debut = -1;
      for (let i = clics.length - 1; i >= 0; i--) {
        if (dansAutre(clics[i])) break;
        if (dansSienne(clics[i])) debut = i;
      }
      if (debut < 0) return garder(g.quoi, null, { raison: 'rangee-introuvable' });
      const suite = clics.slice(debut);
      if (suite.length > ETAPES_MAX) return garder(g.quoi, null, { raison: 'trop-d-etapes' });
      const etapes = suite.map((a) => ({ sig: a.sig, portee: dansSienne(a) ? 'ligne' : 'page' }));
      if (etapes.some((e) => !e.sig) || etapes[0].portee !== 'ligne') return garder(g.quoi, null, { raison: 'etape-illisible' });
      const page = adresseDe(id, '{ad}');
      if (!page) return garder(g.quoi, null, { raison: 'adresse' });
      return garder(g.quoi, { etapes, page, at: new Date().toISOString() }, { etapes: etapes.length });
    }
    if (g.quoi === 'prix') {
      const iS = recents.map((a) => a.type).lastIndexOf('saisie');
      if (iS < 0) return garder('prix', null, { raison: 'champ-introuvable' });
      const champ = recents[iS];
      const apres = recents.slice(iS + 1).filter((a) => a.type === 'clic' || a.type === 'entree');
      if (apres.length > ETAPES_MAX) return garder('prix', null, { raison: 'trop-d-etapes' });
      const page = adresseDe(g.ad, '{ad}');
      if (!page || !page.porte) return garder('prix', null, { raison: 'adresse-sans-annonce' });
      const etapes = apres.map((a) => (a.type === 'entree' ? { entree: true } : { sig: a.sig, portee: 'page' }));
      if (!champ.sig || etapes.some((e) => !e.entree && !e.sig)) return garder('prix', null, { raison: 'etape-illisible' });
      return garder('prix', { champ: champ.sig, sep: champ.sep === ',' ? ',' : '.', etapes, page, at: new Date().toISOString() }, { etapes: etapes.length });
    }
    if (g.quoi === 'message') {
      const iS = recents.map((a) => a.type).lastIndexOf('saisie');
      if (iS < 0 || t - recents[iS].at > 20000) return garder('message', null, { raison: 'champ-introuvable' });
      const champ = recents[iS];
      const apres = recents.slice(iS + 1).filter((a) => a.type === 'clic' || a.type === 'entree');
      const der = apres[apres.length - 1];
      if (!der || t - der.at > 5000) return garder('message', null, { raison: 'envoi-introuvable' });
      const envoi = der.type === 'entree' ? { entree: true } : { sig: der.sig };
      if (!envoi.entree && !envoi.sig) return garder('message', null, { raison: 'etape-illisible' });
      const page = adresseDe(g.conv, '{conv}');
      if (!page || !page.porte) return garder('message', null, { raison: 'adresse-sans-conv' });
      if (!champ.sig) return garder('message', null, { raison: 'etape-illisible' });
      return garder('message', { champ: champ.sig, envoi, page, at: new Date().toISOString() }, { etapes: 1 });
    }
  }

  // ── Une vérification VISIBLE (captcha, DataDome, Cloudflare) ──
  function verificationVisible() {
    try {
      for (const f of document.querySelectorAll('iframe')) {
        const src = String(f.src || '');
        if (!/captcha-delivery\.com|datadome|hcaptcha|recaptcha|turnstile|challenges\.cloudflare/i.test(src)) continue;
        const r = f.getBoundingClientRect();
        if (r.width >= 120 && r.height >= 60 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Taper lettre à lettre ──
  function insererUn(el, ch) {
    let ok = false;
    try { ok = document.execCommand('insertText', false, ch); } catch (_) { ok = false; }
    if (ok) return;
    if (el.isContentEditable) { el.textContent = (el.textContent || '') + ch; }
    else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
      set.call(el, String(el.value || '') + ch);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
  }
  function vider(el) {
    try { el.focus(); if (el.select) el.select(); else document.execCommand('selectAll', false, null); } catch (_) {}
    let ok = false; try { ok = document.execCommand('delete', false, null); } catch (_) { ok = false; }
    if (!ok || contenu(el)) {
      if (el.isContentEditable) el.textContent = '';
      else { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ''); }
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
  }
  const contenu = (el) => propre(el.isContentEditable ? el.innerText : el.value);
  const nombreDe = (t) => { const s = String(t || '').replace(/[\s\u00a0€]/g, '').replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : null; };
  async function taper(champ, texte) {
    champ.scrollIntoView({ block: 'center' });
    champ.click(); champ.focus();
    await attendre(hasard(300, 800));
    for (const ch of [...texte]) {
      if (verificationVisible()) return 'verification';
      if (document.activeElement !== champ) champ.focus();
      insererUn(champ, ch);
      await attendre(hasard(40, 160));
    }
    return '';
  }
  const cliquer = async (el) => { el.scrollIntoView({ block: 'center' }); await attendre(hasard(500, 1500)); el.click(); };
  const appuyerEntree = (el) => { const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }; el.dispatchEvent(new KeyboardEvent('keydown', o)); el.dispatchEvent(new KeyboardEvent('keypress', o)); el.dispatchEvent(new KeyboardEvent('keyup', o)); };
  const fini = (g, extra) => (g ? Object.assign({ ok: true, statut: g.statut, defi: g.defi, geste: true, confirme: g.statut >= 200 && g.statut < 300 }, extra || {})
    : Object.assign({ ok: true, statut: 0, erreur: verificationVisible() ? 'verification' : 'pas-vu', defi: verificationVisible(), geste: true, envoye: true }, extra || {}));
  const arret = (erreur, extra) => Object.assign({ ok: true, statut: 0, erreur }, extra || {});

  // ── Les étapes apprises, une à une ; la dernière envoie ──
  async function derouler(etapes, rangee, vu, avantDernier) {
    for (let k = 0; k < etapes.length; k++) {
      const e = etapes[k];
      if (verificationVisible()) return { r: arret('verification', { defi: true, geste: k > 0 }) };
      if (k === etapes.length - 1 && avantDernier) { const non = avantDernier(); if (non) return { r: arret(non, { geste: k > 0 }) }; }
      if (e.entree) { if (k === etapes.length - 1) { const p = vu(); appuyerEntree(document.activeElement || document.body); return { p }; } appuyerEntree(document.activeElement || document.body); continue; }
      const dans = e.portee === 'ligne' ? rangee : document;
      if (e.portee === 'ligne' && (!rangee || !document.contains(rangee))) return { r: arret('rangee-perdue', { geste: k > 0, etape: k + 1 }) };
      // La PREUVE à l'écran que l'étape d'avant a pris : l'élément de celle-ci apparaît (6 s au plus).
      const t = await trouverAttendu(e.sig, dans, k === 0 ? 1500 : 6000);
      if (!t.el) return { r: arret(t.n ? 'etape-ambigue' : 'etape-introuvable', { geste: k > 0, etape: k + 1, element: nomDe(e.sig), derniere: k === etapes.length - 1 }) };
      if (k === etapes.length - 1) { const p = vu(); await cliquer(t.el); return { p }; }
      await cliquer(t.el);
    }
    return { r: arret('sans-etape') };
  }

  async function executer(msg) {
    const quoi = String(msg.quoi || '');
    if (!['pause', 'supprime', 'prix', 'message', 'reprise'].includes(quoi)) return arret('invalide');   // 5.426 : + reprise (réactiver)
    if (ordreEnCours) return arret('en-cours');
    ordreEnCours = true;
    try {
      if (!brancher()) return arret('canal');
      if (verificationVisible()) return arret('verification', { defi: true });
      // 1. Le compte privé de la PAGE, celui que le fond attend.
      const et = await pont().etat();
      if (!et) return arret('page-muette');
      if (!et.moi) return arret('compte-pas-su');
      if (String(msg.compte || '') !== et.moi) return arret('autre-compte');
      let tout = null;
      try { tout = (await chrome.storage.local.get(CLE_UI))[CLE_UI] || {}; } catch (_) { return arret('stockage'); }
      const ui = tout[quoi];
      if (!ui) return arret('pas-appris');
      const moiOk = (g) => g.moi === et.moi;

      if (quoi === 'pause' || quoi === 'supprime' || quoi === 'reprise') {
        const id = String(msg.id || '');
        if (!ID_AD.test(id)) return arret('invalide');
        // Aucune double action : la même écriture vue il y a moins de 2 min ⇒ rien.
        if (vus.some((g) => g.quoi === quoi && g.ids.includes(id) && g.statut >= 200 && g.statut < 300 && Date.now() - g.at < 120000)) return arret('deja');
        if (!Array.isArray(ui.etapes) || !ui.etapes.length) return arret('pas-appris');
        const rangees = rangeesDe(id);
        if (!rangees.length) return arret('annonce-absente');
        if (rangees.length > 1) return arret('annonce-ambigue');
        const rangee = rangees[0];
        let attente = null;
        const vu = () => (attente = attendreVu((g) => g.quoi === quoi && g.ids.includes(id), 15000));
        const avant = () => (!document.contains(rangee) || !idsDans(rangee).has(id) ? 'rangee-perdue' : '');
        const d = await derouler(ui.etapes, rangee, vu, avant);
        if (d.r) return d.r;
        const g = await d.p;
        if (g && (!moiOk(g) || g.ids.length !== 1)) return arret('autre-ecriture', { geste: true, envoye: true });
        return fini(g);
      }

      if (quoi === 'prix') {
        const id = String(msg.id || ''), avantE = Number(msg.prixAvant), nouveau = Number(msg.prix);
        if (!ID_AD.test(id) || !(nouveau >= 1) || !Number.isFinite(avantE)) return arret('invalide');
        // L'annonce : son identifiant dans l'ADRESSE de la page.
        if (!new RegExp(`(^|[^0-9])${id}([^0-9]|$)`).test(location.pathname + location.search)) return arret('pas-ouverte');
        const c = await trouverAttendu(ui.champ, document, 8000);
        if (!c.el) return arret(c.n ? 'champ-ambigu' : 'champ-introuvable', { element: 'le champ du prix' });
        const champ = c.el;
        // La preuve que c'est la BONNE fiche : la page montre le prix que VRM a lu (sinon rien n'est touché).
        const vuPage = nombreDe(contenu(champ));
        if (vuPage == null || Math.round(vuPage * 100) !== Math.round(avantE * 100)) return arret('prix-page-different', { prixPage: vuPage });
        const texte = Number.isInteger(nouveau) ? String(nouveau) : nouveau.toFixed(2).replace('.', ui.sep === ',' ? ',' : '.');
        vider(champ);
        if (contenu(champ)) return arret('champ-pas-vide', { geste: true });
        const v = await taper(champ, texte);
        if (v) return arret(v, { defi: true, geste: true });
        await attendre(hasard(400, 1200));
        const relu = nombreDe(contenu(champ));
        if (relu == null || Math.round(relu * 100) !== Math.round(nouveau * 100)) return arret('saisie-differente', { geste: true });
        let attente = null;
        const vu = () => (attente = attendreVu((g) => g.quoi === 'prix' && g.ad === id, 15000));
        const etapes = Array.isArray(ui.etapes) && ui.etapes.length ? ui.etapes : [{ entree: true }];
        const d = await derouler(etapes, null, vu, null);
        if (d.r) return Object.assign(d.r, { geste: true });
        const g = await d.p;
        if (g && !moiOk(g)) return arret('autre-ecriture', { geste: true, envoye: true });
        return fini(g, g ? { prixVu: Number.isFinite(g.euros) ? g.euros : null } : {});
      }

      // message
      const conv = String(msg.conv || ''), texte = typeof msg.texte === 'string' ? msg.texte.replace(/\r\n?/g, '\n').trim() : '';
      if (!/^[\w-]{3,64}$/.test(conv) || !texte || texte.length > 2000) return arret('invalide');
      if (!ui.champ || !ui.envoi) return arret('pas-appris');
      // Le BON destinataire, par identifiant : l'adresse porte la conversation ET la page l'a chargée.
      if (!String(location.pathname + location.search).split(/[/?=&]/).includes(conv)) return arret('pas-ouverte');
      let co = null;
      for (let i = 0; i < 20; i++) { co = await pont().etat(); if (co && co.conv === conv) break; await attendre(500); }
      if (!co || co.conv !== conv) return arret(co && co.conv ? 'autre-conversation' : 'conversation-pas-chargee');
      const c = trouver(ui.champ, document);
      if (!c.el) return arret(c.n ? 'champ-ambigu' : 'champ-introuvable', { element: 'le champ du message' });
      const champ = c.el;
      if (contenu(champ)) return arret('champ-pas-vide');   // jamais mêler son brouillon au nôtre
      const v = await taper(champ, texte);
      if (v) return arret(v, { defi: true, geste: true });
      await attendre(hasard(400, 1200));
      if (contenu(champ) !== propre(texte)) return arret('saisie-differente', { geste: true });
      let attente = null;
      const vu = () => (attente = attendreVu((g) => g.quoi === 'message' && g.conv === conv && propre(g.texte) === propre(texte), 15000));
      const d = await derouler([ui.envoi.entree ? { entree: true } : { sig: ui.envoi.sig, portee: 'page' }], null, vu, null);
      if (d.r) return Object.assign(d.r, { geste: true });
      const g = await d.p;
      if (g && !moiOk(g)) return arret('autre-ecriture', { geste: true, envoye: true });
      return fini(g);
    } finally { ordreEnCours = false; }
  }
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'lbcGesteUI') return;
      if (!sender || sender.id !== chrome.runtime.id) return;
      executer(msg).then(sendResponse, () => sendResponse({ ok: true, statut: 0, erreur: 'interrompu', geste: true }));
      return true;
    });
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'lbcEcrirePret') return;
      if (!sender || sender.id !== chrome.runtime.id) return;
      sendResponse({ ok: true, canal: brancher() && !!(pont() && pont().pret()), href: String(location.href).slice(0, 300) });
    });
  } catch (_) {}
  try { window.__vrmLbcEcrireTest = { signature, trouver, rangeesDe, executer, verificationVisible, actes }; } catch (_) {}
})();
