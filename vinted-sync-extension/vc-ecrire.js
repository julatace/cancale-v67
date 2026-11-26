// vc-ecrire.js — monde isolé de vestiairecollective.com : ÉCRIRE UN MESSAGE PAR L'INTERFACE DE LA PAGE (5.412.0).
//
// Décision de Julien (21 nov.) : « on ne fait plus les requêtes » pour les ÉCRITURES. Un message Vestiaire
// (réponse, « Leur écrire ») part par la page elle-même, dans l'onglet : clic dans le champ, saisie LETTRE À
// LETTRE, clic sur « Envoyer », puis VÉRIFICATION que la page a bien envoyé CE texte dans CETTE conversation
// (la messagerie de la page — Stream — rend le message envoyé : vc-inject.js le voit et le dit, `vcenvoivu`).
// Pas vu ⇒ arrêt, et c'est dit (« je ne sais pas si c'est parti, regarde avant de renvoyer »), jamais « fait ».
//
// Le BON DESTINATAIRE est vérifié par IDENTIFIANT avant tout geste : la conversation ouverte dans la page
// (`convouverte` : la dernière que la page a chargée chez Stream ou ouverte chez Vestiaire, lue par vc-inject.js)
// doit être exactement celle demandée, et l'adresse de la page doit la porter. Sinon rien n'est tapé.
//
// Le champ et le bouton ne sont JAMAIS devinés : la première fois, VRM les APPREND de SON envoi fait à la main
// (le champ où il a tapé, le bouton touché ou la touche Entrée dans les 4 s avant que la page n'envoie) — une
// « signature » (balise, éditable ou non, et quelques attributs stables : data-testid, name, role, type,
// aria-label) gardée dans CE navigateur (`chrome.storage.local`, `vrmVcUi`), jamais son texte, jamais en base
// (la base ne reçoit que « appris : oui / non », `vc_envoi`). À l'envoi, la signature doit désigner UN seul
// élément visible ; zéro ou plusieurs ⇒ rien n'est tapé, dit.
//
// Clics et frappes de l'extension : `isTrusted:false` ASSUMÉS (décision du 20 nov.), aucun maquillage.
// Une vérification visible de Vestiaire (DataDome / captcha, ≥ 120 × 60 à l'écran) ⇒ arrêt, rien n'est tapé.
// L'ordre ne vient QUE du fond de l'extension, pour le cadre principal.
(function () {
  'use strict';
  if (window.__vrmVcEcrire) return; window.__vrmVcEcrire = true;
  if (window.top !== window) return;
  const CLE_UI = 'vrmVcUi';
  const ATTRS = ['data-testid', 'data-test', 'data-cy', 'name', 'role', 'type', 'aria-label'];
  const vivant = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const hasard = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const propre = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();

  // ── Ce que la page (vc-inject.js, monde MAIN) dit : envois vus, conversation ouverte ──
  const attentesVu = [];          // { conv, texte, depuis, ok }
  const attentesConv = new Map(); // jeton → résoudre
  let ordreEnCours = false;
  // 5.446 (lot ext-anciens-lots, revue moyennes 60-62) : « envoi vu » et « conversation ouverte » ne
  // viennent plus que du CANAL PRIVÉ de vc-inject.js, par le pont de vc.js (`__vrmVcPont`, monde isolé de
  // l'extension) — avant, `window`, qu'un script de la page pouvait forger (« envoyé » sans que rien ne parte).
  const pont = (() => { try { const p = window.__vrmVcPont; return p && typeof p.ecouter === 'function' ? p : null; } catch (_) { return null; } })();
  try {
    if (pont) pont.ecouter((d) => {
      if (!d || d.__tag !== 'CANCALE_VC') return;
      if (d.kind === 'vcenvoivu') {
        const conv = String(d.conv || ''), t = propre(d.t);
        for (const a of attentesVu.slice()) if (a.conv === conv && propre(a.texte) === t) { attentesVu.splice(attentesVu.indexOf(a), 1); a.ok(); }
        if (!ordreEnCours) apprendre(conv).catch(() => {});
        return;
      }
      if (d.kind === 'vcconvouverte' && typeof d.jeton === 'string') {
        const f = attentesConv.get(d.jeton);
        if (f) { attentesConv.delete(d.jeton); f({ conv: String(d.conv || ''), at: Number(d.at) || 0, moi: String(d.moi || '') }); }
      }
    });
  } catch (_) {}
  const convOuverte = () => new Promise((res) => {
    const jeton = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 10);
    const t = setTimeout(() => { if (attentesConv.delete(jeton)) res(null); }, 3000);
    attentesConv.set(jeton, (r) => { clearTimeout(t); res(r); });
    if (!pont || !pont.envoyer({ __tag: 'CANCALE_VC_ORDRE', kind: 'convouverte', jeton })) { if (attentesConv.delete(jeton)) { clearTimeout(t); res(null); } }
  });

  // ── La signature d'un élément (jamais son texte, jamais une valeur saisie) ──
  const editable = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/i.test(el.type || '')) || el.isContentEditable === true);
  function signature(el, avecTexte) {
    if (!el || !el.tagName) return null;
    const attrs = {};
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && v.length <= 60 && !/\d{5,}/.test(v)) attrs[a] = v; }
    const s = { tag: el.tagName.toLowerCase(), ce: el.isContentEditable === true, attrs };
    // Le mot du bouton (« Envoyer », « Send ») : un libellé court, sans chiffre, jamais un texte saisi.
    if (avecTexte) { const t = propre(el.textContent).slice(0, 30); if (t && !/\d/.test(t)) s.mot = t; }
    return s;
  }
  const visible = (el) => { try { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none'; } catch (_) { return false; } };
  function trouver(sig) {
    if (!sig || !/^[a-z][a-z0-9-]{0,20}$/.test(String(sig.tag || ''))) return { el: null, n: 0 };
    let sel = sig.tag;
    for (const [k, v] of Object.entries(sig.attrs || {})) if (ATTRS.includes(k)) sel += `[${k}="${String(v).replace(/["\\]/g, '\\$&')}"]`;
    let liste = [];
    try { liste = [...document.querySelectorAll(sel)]; } catch (_) { return { el: null, n: 0 }; }
    liste = liste.filter((el) => visible(el) && (sig.ce ? el.isContentEditable === true : true) && (!sig.mot || propre(el.textContent).slice(0, 30) === sig.mot));
    return { el: liste.length === 1 ? liste[0] : null, n: liste.length };
  }

  // ── Apprendre de SON envoi fait à la main ──
  let dernierChamp = null, dernierChampAt = 0, dernierClic = null, dernierClicAt = 0, dernierEntreeAt = 0;
  try {
    document.addEventListener('input', (e) => { if (e.isTrusted && editable(e.target)) { dernierChamp = e.target; dernierChampAt = Date.now(); } }, true);
    document.addEventListener('keydown', (e) => { if (e.isTrusted && e.key === 'Enter' && !e.shiftKey && editable(e.target)) { dernierChamp = e.target; dernierEntreeAt = Date.now(); } }, true);
    document.addEventListener('click', (e) => { if (!e.isTrusted) return; const b = e.target && e.target.closest && e.target.closest('button,[role="button"]'); if (b) { dernierClic = b; dernierClicAt = Date.now(); } }, true);
  } catch (_) {}
  function adresseDe(conv) {
    if (!/^[\w-]{3,40}$/.test(String(conv || ''))) return null;
    try {
      const u = new URL(location.href);
      if (u.pathname.includes(conv)) { const m = u.pathname.split(conv).join('{conv}'); return /^\/[\w/{}.-]{1,100}$/.test(m) && m.split('{conv}').length === 2 ? { modele: m } : null; }
      for (const [k, v] of u.searchParams) if (v === conv && /^[\w-]{1,20}$/.test(k)) { const m = `${/^\/[\w/.-]{0,80}$/.test(u.pathname) ? u.pathname : '/'}?${k}={conv}`; return { modele: m }; }
      return { sansConv: true };
    } catch (_) { return null; }
  }
  async function apprendre(conv) {
    const t = Date.now();
    if (!dernierChamp || t - Math.max(dernierChampAt, dernierEntreeAt) > 15000) return;
    const champ = signature(dernierChamp, false);
    let envoi = null;
    if (dernierClic && t - dernierClicAt <= 4000) envoi = Object.assign({ mode: 'bouton' }, signature(dernierClic, true));
    else if (t - dernierEntreeAt <= 4000) envoi = { mode: 'entree' };
    if (!champ || !envoi) return;
    // L'ADRESSE d'une conversation, apprise du même geste (jamais devinée) : où la page met l'identifiant de la
    // conversation (`/chemin/{conv}` ou `?clé={conv}`). Sans lui dans l'adresse : `sansConv` (VRM ne peut alors pas
    // vérifier le destinataire par l'adresse, et le dit).
    const ui = { champ, envoi, at: new Date().toISOString(), page: location.pathname.replace(/\d{3,}/g, '{id}').slice(0, 80), adresse: adresseDe(conv) };
    if (!vivant()) return;
    try { await chrome.storage.local.set({ [CLE_UI]: ui }); } catch (_) { return; }
    try { chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcUiAppris', mode: envoi.mode, adresse: ui.adresse ? (ui.adresse.sansConv ? 'sans' : 'oui') : '', conv: /^[\w-]{3,40}$/.test(conv) ? conv : '' }, () => { void chrome.runtime.lastError; }); } catch (_) {}
  }

  // ── Une vérification VISIBLE de Vestiaire (DataDome / captcha) ──
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

  // ── Taper lettre à lettre (le texte inséré comme le ferait le clavier, un caractère à la fois) ──
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
  const contenu = (el) => propre(el.isContentEditable ? el.innerText : el.value);

  async function ecrire(msg) {
    const conv = String(msg.conv || ''), texte = typeof msg.texte === 'string' ? msg.texte.replace(/\r\n?/g, '\n').trim() : '';
    if (!/^[\w-]{3,40}$/.test(conv) || !texte || texte.length > 1000) return { ok: true, statut: 0, erreur: 'invalide' };
    if (!/(^|\.)vestiairecollective\.com$/i.test(location.hostname)) return { ok: true, statut: 0, erreur: 'pas-vestiaire' };
    if (ordreEnCours) return { ok: true, statut: 0, erreur: 'en-cours' };
    ordreEnCours = true;
    try {
      if (verificationVisible()) return { ok: true, statut: 0, erreur: 'verification', defi: true };
      // 1. Le BON destinataire, par identifiant : l'adresse porte la conversation ET la page l'a ouverte.
      if (!String(location.href).includes(conv)) return { ok: true, statut: 0, erreur: 'pas-ouverte' };
      let co = null;
      for (let i = 0; i < 20; i++) { co = await convOuverte(); if (co && co.conv === conv) break; await attendre(500); }
      if (!co) return { ok: true, statut: 0, erreur: 'page-muette' };
      if (co.conv !== conv) return { ok: true, statut: 0, erreur: 'autre-conversation' };
      if (msg.compte && co.moi && String(msg.compte) !== co.moi) return { ok: true, statut: 0, erreur: 'autre-compte' };
      if (msg.compte && !co.moi) return { ok: true, statut: 0, erreur: 'compte-pas-su' };
      // 2. Le champ et le bouton APPRIS (sinon rien).
      let ui = null;
      try { ui = (await chrome.storage.local.get(CLE_UI))[CLE_UI] || null; } catch (_) { return { ok: true, statut: 0, erreur: 'stockage' }; }
      if (!ui || !ui.champ || !ui.envoi) return { ok: true, statut: 0, erreur: 'pas-appris' };
      const c = trouver(ui.champ);
      if (!c.el) return { ok: true, statut: 0, erreur: c.n ? 'champ-ambigu' : 'champ-introuvable' };
      const champ = c.el;
      if (contenu(champ)) return { ok: true, statut: 0, erreur: 'champ-pas-vide' };   // jamais mêler son brouillon au nôtre
      // 3. Clic dans le champ, saisie lettre à lettre (40–160 ms au hasard entre deux).
      champ.scrollIntoView({ block: 'center' });
      champ.click(); champ.focus();
      await attendre(hasard(300, 800));
      for (const ch of [...texte]) {
        if (verificationVisible()) return { ok: true, statut: 0, erreur: 'verification', defi: true, tape: true };
        if (document.activeElement !== champ) champ.focus();
        insererUn(champ, ch === '\n' ? '\n' : ch);
        await attendre(hasard(40, 160));
      }
      await attendre(hasard(400, 1200));
      // Ce qui est dans le champ est EXACTEMENT le texte (sinon rien n'est envoyé ; le champ est laissé tel quel, dit).
      if (contenu(champ) !== propre(texte)) return { ok: true, statut: 0, erreur: 'saisie-differente', tape: true };
      // 4. Le geste d'envoi appris.
      const vu = new Promise((ok) => attentesVu.push({ conv, texte, depuis: Date.now(), ok }));
      if (ui.envoi.mode === 'bouton') {
        const b = trouver(ui.envoi);
        if (!b.el) return { ok: true, statut: 0, erreur: b.n ? 'bouton-ambigu' : 'bouton-introuvable', tape: true };
        b.el.click();
      } else {
        const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        champ.dispatchEvent(new KeyboardEvent('keydown', o)); champ.dispatchEvent(new KeyboardEvent('keypress', o)); champ.dispatchEvent(new KeyboardEvent('keyup', o));
      }
      // 5. La vérification : la page a envoyé CE texte dans CETTE conversation (15 s au plus).
      const r = await Promise.race([vu.then(() => true), attendre(15000).then(() => false)]);
      for (const a of attentesVu.slice()) if (a.conv === conv) attentesVu.splice(attentesVu.indexOf(a), 1);
      if (r) return { ok: true, statut: 200, confirme: true };
      return { ok: true, statut: 0, erreur: verificationVisible() ? 'verification' : 'pas-vu', defi: verificationVisible(), envoye: true };
    } finally { ordreEnCours = false; }
  }
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'vcEcrireUI') return;
      if (!sender || sender.id !== chrome.runtime.id) return;
      ecrire(msg).then(sendResponse, () => sendResponse({ ok: true, statut: 0, erreur: 'interrompu' }));
      return true;
    });
    // « Es-tu là ? » — le fond attend que la page de la conversation soit prête.
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'vcEcrirePret') return;
      if (!sender || sender.id !== chrome.runtime.id) return;
      sendResponse({ ok: true, href: String(location.href).slice(0, 300) });
    });
  } catch (_) {}
  try { window.__vrmVcEcrireTest = { signature, trouver, ecrire, verificationVisible }; } catch (_) {}
})();
