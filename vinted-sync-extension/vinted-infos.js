// vinted-infos.js — CE QUE VRM SAIT, AU BON ENDROIT SUR VINTED (11 nov., lot AA, 5.339).
//
// Propositions 40 et 41, validées par Julien (« fais tout », 9 nov.) :
//  1. Sur SES annonces (son dressing, la page d'une de ses annonces) : une ligne
//     discrète « N°124 · acheté 60 € · en ligne depuis 23 j ».
//  2. Sur la page d'une annonce d'un AUTRE vendeur : un encart replié « VRM » —
//     la calculette d'achat (la règle de l'app, `calculer` → `cascadeVente`) et
//     « peut-être N paires proches en ligne chez toi » (`pairesDuModele`, lot F).
//
// LECTURE SEULE : rien n'est envoyé à Vinted, rien n'est cliqué, rien n'est
// écrit. Aucune requête Vinted : la page est lue telle qu'elle est affichée, le
// reste vient de la base VRM par le fond (`infosVintedPage`, `stockPourModele`).
// L'IDENTITÉ d'une annonce est son identifiant Vinted (le lien /items/{id}) —
// jamais un titre. Le fond ne rend que les annonces du compte CONNECTÉ dans
// l'onglet. Pas su ⇒ le champ n'est pas écrit (jamais 0, jamais deviné).
// Les règles viennent de vrm-regles-achat.js (copie refabriquée par
// scripts/regles-achat-extension.cjs) : aucune formule ici.
// Tout est dans une ombre FERMÉE (la page ne lit ni ne restyle rien), classes à
// part : la page de Vinted n'est pas touchée.

(() => {
  if (window.__vrmInfosLoaded) return;
  window.__vrmInfosLoaded = true;
  const R = globalThis.__vrmReglesAchat || null;
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  const demander = (msg) => new Promise((res) => {
    if (!vivant()) return res(null);
    try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-vinfos' }, msg), (r) => { void chrome.runtime.lastError; res(r || null); }); } catch (_) { res(null); }
  });

  // ── LE THÈME DE LA PAGE (clair ou sombre, selon ce que Vinted peint) ──────
  const sombre = () => {
    const lum = (el) => { if (!el) return null; const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor || ''); if (!m || (m[4] != null && Number(m[4]) < 0.5)) return null; return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; };
    const l = lum(document.body); const l2 = l == null ? lum(document.documentElement) : l;
    if (l2 != null) return l2 < 0.4;
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) { return false; }
  };
  const STYLE = (nuit) => `
    :host{all:initial;display:block}
    *{box-sizing:border-box;margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif}
    .ligne{display:block;font-size:12px;line-height:1.35;font-weight:600;color:${nuit ? '#98989D' : '#6E6E73'};padding:4px 2px 2px;font-variant-numeric:tabular-nums;white-space:normal;overflow-wrap:anywhere}
    .ligne b{color:${nuit ? '#F5F5F7' : '#1D1D1F'};font-weight:700}
    .ligne .q{color:${nuit ? '#8E8E93' : '#AEAEB2'};font-weight:500}
    .encart{margin:10px 0;border-radius:18px;background:${nuit ? '#1C1C1E' : '#F2F2F7'};color:${nuit ? '#F5F5F7' : '#1D1D1F'};max-width:420px}
    .tete{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 14px;cursor:pointer;font:600 14px/1.2 -apple-system,system-ui,sans-serif;color:inherit}
    .tete:focus-visible{outline:2px solid ${nuit ? '#0A84FF' : '#0071E3'};outline-offset:2px;border-radius:18px}
    .logo{font-weight:800;letter-spacing:.02em}
    .tete .sous{color:${nuit ? '#98989D' : '#6E6E73'};font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chev{width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);opacity:.5;transition:transform .2s}
    .tete[aria-expanded="true"] .chev{transform:rotate(45deg)}
    .corps{padding:0 14px 14px}
    .corps[hidden]{display:none}
    .grille{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    label{display:block;font:600 12px/1.3 -apple-system,system-ui,sans-serif;color:${nuit ? '#98989D' : '#6E6E73'}}
    input{all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;margin-top:4px;padding:0 12px;border-radius:12px;background:${nuit ? '#2C2C2E' : '#FFFFFF'};color:inherit;font:600 16px/44px -apple-system,system-ui,sans-serif;font-variant-numeric:tabular-nums}
    input:focus-visible{outline:2px solid ${nuit ? '#0A84FF' : '#0071E3'}}
    .sites{display:flex;gap:4px;margin:10px 0;padding:2px;border-radius:12px;background:${nuit ? 'rgba(118,118,128,.24)' : 'rgba(118,118,128,.12)'}}
    .site{all:unset;box-sizing:border-box;flex:1;min-height:44px;text-align:center;border-radius:10px;cursor:pointer;font:600 13px/44px -apple-system,system-ui,sans-serif;color:inherit}
    .site[aria-checked="true"]{background:${nuit ? '#636366' : '#FFFFFF'};box-shadow:0 1px 3px rgba(0,0,0,.12)}
    .res{margin-top:10px;padding:12px;border-radius:14px;background:${nuit ? '#2C2C2E' : '#FFFFFF'}}
    .res .t{font:600 12px/1.3 -apple-system,system-ui,sans-serif;color:${nuit ? '#98989D' : '#6E6E73'}}
    .res .m{font:800 28px/1.15 -apple-system,system-ui,sans-serif;font-variant-numeric:tabular-nums;margin-top:2px}
    .res .m .b{font-size:15px;font-weight:600;color:${nuit ? '#98989D' : '#6E6E73'}}
    .petit{font:500 12px/1.4 -apple-system,system-ui,sans-serif;color:${nuit ? '#98989D' : '#6E6E73'};margin-top:6px}
    .stock{margin-top:12px;font:600 13px/1.4 -apple-system,system-ui,sans-serif}
    .stock ul{list-style:none;padding:0;margin:4px 0 0}
    .stock li{font:500 12px/1.4 -apple-system,system-ui,sans-serif;color:${nuit ? '#98989D' : '#6E6E73'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;
  const ombre = (hote) => { const sr = hote.attachShadow({ mode: 'closed' }); const st = document.createElement('style'); st.textContent = STYLE(sombre()); sr.appendChild(st); return sr; };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ── LES FORMES ──────────────────────────────────────────────────────────
  const euros = (n) => { const c = Math.round(n * 100) / 100; return (Number.isInteger(c) ? String(c) : c.toFixed(2).replace('.', ',')) + ' €'; };
  const idDe = (a) => { const m = /\/items\/(\d{4,15})(?:[-/?#]|$)/.exec(a.getAttribute('href') || ''); return m ? m[1] : ''; };
  const articleIci = () => { const m = /^\/items\/(\d{4,15})(?:[-/]|$)/.exec(location.pathname); return m && !/^\/items\/\d+\/edit/.test(location.pathname) ? m[1] : ''; };
  const surDressing = () => /^\/member\/\d+/.test(location.pathname);
  // Les morceaux de la ligne, chacun SEULEMENT s'il est su.
  function morceauxLigne(info, maintenant = Date.now()) {
    const p = [];
    if (info && info.numero) p.push({ cle: 'num', texte: 'N°' + info.numero, fort: true });
    let achat = null;
    if (R && info && (info.buyPrice != null || info.buyNum != null)) {
      const num = info.numero && !info.ecrit ? String(info.numero) : '';
      achat = R.prixAchatDe({ numero: num, buyPrice: info.buyPrice }, num && info.buyNum != null ? { [num]: info.buyNum } : {});
    }
    if (achat != null) p.push({ cle: 'achat', texte: 'acheté ' + euros(achat), valeur: achat });
    else if (info && info.numero) p.push({ cle: 'achat', texte: 'prix d’achat ?', discret: true });
    const d = info && Number(info.depuis);
    if (d && isFinite(d) && d <= maintenant) { const j = Math.floor((maintenant - d) / 86400000); p.push({ cle: 'jours', texte: j < 1 ? 'en ligne depuis aujourd’hui' : `en ligne depuis ${j} j`, valeur: j }); }
    return p;
  }
  function hoteLigne(id, info) {
    const p = morceauxLigne(info);
    if (!p.some((x) => x.cle === 'num' || x.cle === 'jours')) return null;
    const h = document.createElement('div');
    h.setAttribute('data-vrm-infos-pour', id);
    h.setAttribute('data-vrm-infos-num', info.numero || '');
    const a = p.find((x) => x.cle === 'achat' && x.valeur != null); h.setAttribute('data-vrm-infos-achat', a ? String(a.valeur) : '');
    const j = p.find((x) => x.cle === 'jours'); h.setAttribute('data-vrm-infos-jours', j ? String(j.valeur) : '');
    h.setAttribute('data-vrm-infos-texte', p.map((x) => x.texte).join(' · '));
    h.style.setProperty('display', 'block', 'important'); h.style.setProperty('position', 'static', 'important');
    const sr = ombre(h), l = el('span', 'ligne');
    l.setAttribute('title', 'VRM — visible par toi seul');
    p.forEach((x, i) => { if (i) l.appendChild(document.createTextNode(' · ')); l.appendChild(el(x.fort ? 'b' : x.discret ? 'span' : 'span', x.discret ? 'q' : '', x.texte)); });
    sr.appendChild(l);
    return h;
  }
  // La cellule de la grille : le plus haut parent qui ne contient AUCUN lien vers
  // une autre annonce (jamais la grille entière, jamais la page).
  function celluleDe(a) {
    const moi = idDe(a); let c = a;
    for (let i = 0; i < 8; i++) {
      const p = c.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      if ([...p.querySelectorAll('a[href*="/items/"]')].some((x) => { const k = idDe(x); return k && k !== moi; })) break;
      c = p;
    }
    return c;
  }
  // Le N° écrit une seule fois : la pastille posée par vinted-capture.js sur la
  // même carte se tait quand la ligne le dit (§7).
  const taireLaPastille = (zone) => { for (const e of zone.querySelectorAll('[data-vrm-num-pour],[data-vrm-num-page]')) e.style.setProperty('display', 'none', 'important'); };

  // ── 1. LA LIGNE SOUS SES ANNONCES ───────────────────────────────────────
  let chemin = location.pathname, connus = {}, demandes = new Set(), enVol = false, generation = 0, achatIci = false, membresVus = '';
  const remettre = () => {
    chemin = location.pathname; generation++; connus = {}; demandes = new Set(); enVol = false; achatIci = false; membresVus = ''; stockLu = null;
    document.querySelectorAll('[data-vrm-infos-pour],[data-vrm-achat]').forEach((e) => e.remove());
  };
  async function demanderInfos() {
    if (chemin !== location.pathname) remettre();
    if (enVol || !vivant()) return;
    const ici = articleIci();
    if (!surDressing() && !ici) return;
    const items = [];
    for (const a of document.querySelectorAll('a[href*="/items/"]')) { const id = idDe(a); if (id && !demandes.has(id)) { demandes.add(id); items.push(id); } }
    if (ici && !demandes.has(ici)) { demandes.add(ici); items.push(ici); }
    const membres = ici ? [...new Set([...document.querySelectorAll('a[href*="/member/"]')].map((a) => (/\/member\/(\d{1,15})(?:[-/?#]|$)/.exec(a.getAttribute('href') || '') || [])[1]).filter(Boolean))].sort() : [];
    const mv = membres.join(',');
    const reDemander = ici && !connus[ici] && !achatIci && mv !== membresVus;
    if (!items.length && !reDemander) return;
    if (reDemander && !items.includes(ici)) items.push(ici);
    enVol = true; membresVus = mv;
    const g = generation;
    const r = await demander({ action: 'infos', items, membres });
    if (g !== generation) return;
    enVol = false;
    if (!r || !r.ok) { items.forEach((x) => demandes.delete(x)); membresVus = ''; return; }
    if (r.portee !== 'compte') return;
    Object.assign(connus, r.infos || {});
    if (ici && r.achat === true && !connus[ici]) achatIci = true;
  }
  function poserLignesInfos() {
    if (chemin !== location.pathname) return;
    const ici = articleIci();
    if (surDressing()) {
      for (const a of document.querySelectorAll('a[href*="/items/"]')) {
        const id = idDe(a), info = id && connus[id];
        if (!info) continue;
        const c = celluleDe(a);
        if (c.querySelector('[data-vrm-infos-pour="' + id + '"]') || (c.nextElementSibling && c.nextElementSibling.getAttribute('data-vrm-infos-pour') === id)) { if (info.numero) taireLaPastille(c); continue; }
        const h = hoteLigne(id, info); if (!h) continue;
        if (c.tagName === 'A') c.insertAdjacentElement('afterend', h); else c.appendChild(h);
        if (info.numero) taireLaPastille(c);
      }
    } else if (ici && connus[ici]) {
      const h1 = document.querySelector('h1');
      if (!h1 || document.querySelector('[data-vrm-infos-pour="' + ici + '"]')) { if (h1 && connus[ici].numero) taireLaPastille(h1); return; }
      const h = hoteLigne(ici, connus[ici]); if (!h) return;
      h1.insertAdjacentElement('afterend', h);
      if (connus[ici].numero) taireLaPastille(h1);
    }
  }

  // ── 2. L'ENCART D'ACHAT, SUR L'ANNONCE D'UN AUTRE VENDEUR ───────────────
  const texteDe = (s) => { const e = document.querySelector(s); if (!e) return ''; return String((e.tagName === 'META' ? e.getAttribute('content') : e.textContent) || '').replace(/\s+/g, ' ').trim(); };
  function lireAnnonce() {
    const h1 = document.querySelector('h1');
    const titre = (h1 ? String(h1.textContent || '').replace(/\s+/g, ' ').trim() : '') || texteDe('meta[property="og:title"]');
    const marque = texteDe('[itemprop="brand"] [itemprop="name"]') || texteDe('[itemprop="brand"]') || texteDe('[data-testid="item-attributes-brand"] [itemprop="name"]') || texteDe('[data-testid*="brand"] a') || '';
    const taille = texteDe('[itemprop="size"]') || texteDe('[data-testid="item-attributes-size"] [itemprop="size"]') || '';
    const brutPrix = texteDe('[data-testid="item-price"]') || texteDe('meta[property="product:price:amount"]') || texteDe('[itemprop="price"]');
    const m = /(\d{1,6})(?:[.,](\d{1,2}))?/.exec(String(brutPrix || '').replace(/\s/g, ''));
    const prix = m ? m[1] + (m[2] ? ',' + m[2].padEnd(2, '0') : '') : '';
    return { titre: titre.slice(0, 200), marque: marque.slice(0, 60), taille: taille.slice(0, 20), prix };
  }
  let stockLu = null;   // undefined en cours · null pas encore · { ok, stock } lu
  function poserEncartAchat() {
    const ici = articleIci();
    if (!ici || !achatIci || !R || document.querySelector('[data-vrm-achat]')) return;
    const h1 = document.querySelector('h1');
    const hote = document.createElement('div');
    hote.setAttribute('data-vrm-achat', ici);
    hote.style.setProperty('display', 'block', 'important');
    if (h1) h1.insertAdjacentElement('afterend', hote);
    else { hote.style.cssText = 'position:fixed!important;left:16px;top:76px;z-index:2147483000;width:min(420px,calc(100vw - 32px))'; document.body.appendChild(hote); }
    const sr = ombre(hote);
    const boite = el('div', 'encart');
    const tete = el('button', 'tete'); tete.type = 'button'; tete.setAttribute('aria-expanded', 'false');
    tete.append(el('span', 'logo', 'VRM'), el('span', 'sous', 'Calculette et ton stock'), el('span', 'chev'));
    const corps = el('div', 'corps'); corps.hidden = true;
    boite.append(tete, corps); sr.appendChild(boite);
    const a = lireAnnonce();
    hote.setAttribute('data-vrm-achat-prix-lu', a.prix || '');
    // La calculette : la règle de l'app (`calculer`), les deux prix tapés par lui.
    const champ = (id, lib, val, ph) => { const l = el('label', '', lib); const i = el('input'); i.id = id; i.inputMode = 'decimal'; i.autocomplete = 'off'; i.value = val; i.placeholder = ph; l.appendChild(i); return [l, i]; };
    const [lA, iA] = champ('vrm-achat', 'Je l’achète', a.prix || '', '60');
    const [lR, iR] = champ('vrm-revente', 'Je la revends', '', '120');
    const grille = el('div', 'grille'); grille.append(lA, lR);
    let site = 'vinted';
    const sites = el('div', 'sites'); sites.setAttribute('role', 'radiogroup'); sites.setAttribute('aria-label', 'Sur quelle plateforme ?');
    for (const s of R.SITES_CALCULETTE) {
      const b = el('button', 'site', s.nom); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-site', s.cle); b.setAttribute('aria-checked', String(s.cle === site));
      b.addEventListener('click', () => { site = s.cle; for (const x of sites.children) x.setAttribute('aria-checked', String(x.getAttribute('data-site') === site)); calcul(); });
      sites.appendChild(b);
    }
    const [lE, iE] = champ('vrm-emballage', 'Emballage', '', '0,80');
    const res = el('div', 'res'); res.setAttribute('aria-live', 'polite');
    const note = el('p', 'petit', a.prix ? 'Prix de l’annonce, sans port ni protection. Rien n’est enregistré.' : 'Rien n’est enregistré.');
    const stock = el('div', 'stock');
    corps.append(grille, sites, lE, res, note, stock);
    function calcul() {
      const r = R.calculer({ achat: iA.value, revente: iR.value, site, emballage: iE.value }, {});
      hote.setAttribute('data-vrm-calc-etat', r.etat);
      hote.setAttribute('data-vrm-calc-benefice', r.etat === 'ok' ? String(r.benefice) : '');
      hote.setAttribute('data-vrm-calc-borne', r.etat === 'ok' ? r.borne : '');
      res.textContent = '';
      if (r.etat === 'vide') { res.appendChild(el('p', 't', 'Tape le prix de revente.')); return; }
      if (r.etat === 'illisible') { res.appendChild(el('p', 't', 'Un montant ne se lit pas : par exemple 12,50.')); return; }
      const perte = r.benefice < 0;
      res.appendChild(el('p', 't', perte ? 'Tu perds' : 'Tu gagnes'));
      const m = el('p', 'm');
      if (r.borne === 'au-plus') m.appendChild(el('span', 'b', 'au plus '));
      else if (r.borne === 'environ') m.appendChild(el('span', 'b', 'environ '));
      m.appendChild(document.createTextNode(R.eurosCalc(Math.abs(r.benefice))));
      res.appendChild(m);
      if (r.manque && r.manque.length) res.appendChild(el('p', 'petit', r.manque.join(' · ')));
    }
    for (const i of [iA, iR, iE]) i.addEventListener('input', calcul);
    // Les touches tapées restent dans l'encart : la page ne les entend pas.
    for (const ev of ['keydown', 'keyup', 'keypress']) hote.addEventListener(ev, (e) => e.stopPropagation());
    calcul();
    // « Peut-être N paires proches » — une PROPOSITION (§5), la règle du lot F.
    async function montrerStock() {
      if (stockLu !== null) return;
      stockLu = undefined;
      stock.textContent = ''; stock.appendChild(el('p', 'petit', 'Je regarde ton stock…'));
      const r = await demander({ action: 'stockModele' });
      stockLu = r || { ok: false };
      stock.textContent = '';
      if (!r || !r.ok || !Array.isArray(r.stock)) { hote.setAttribute('data-vrm-stock', 'pas-su'); stock.appendChild(el('p', 'petit', 'Ton stock n’a pas pu être lu.')); return; }
      const cible = { titre: a.titre, marque: a.marque, taille: a.taille };
      if (!(R.extractBrand(a.marque) || a.marque) && !R.extractBrand(a.titre)) { hote.setAttribute('data-vrm-stock', 'marque'); stock.appendChild(el('p', 'petit', 'Marque pas lue : je ne compare pas.')); return; }
      const p = R.pairesDuModele({ cible, stock: r.stock, marqueDe: R.extractBrand, modeleDe: R.extractModel, couleursDe: R.extractColors });
      hote.setAttribute('data-vrm-stock', String(p.n));
      if (!p.n) { stock.appendChild(el('p', 'petit', r.aConfirmer ? `${(globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : {}).Aucune || 'Aucune paire'} proche en ligne. Des comptes sont à relire.` : `${(globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : {}).Aucune || 'Aucune paire'} proche en ligne chez toi.`)); return; }
      stock.appendChild(el('p', '', `Peut-être ${p.n} ${p.n > 1 ? ((globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : {}).noms || 'paires') : ((globalThis.VRM_MOTS ? globalThis.VRM_MOTS.mots() : {}).nom || 'paire')} proche${p.n > 1 ? 's' : ''} en ligne chez toi`));
      const ul = el('ul');
      for (const x of p.paires.slice(0, 3)) ul.appendChild(el('li', '', x.titre + (x.taille ? ' · ' + x.taille : '')));
      stock.appendChild(ul);
    }
    tete.addEventListener('click', () => { const o = tete.getAttribute('aria-expanded') !== 'true'; tete.setAttribute('aria-expanded', String(o)); corps.hidden = !o; if (o) montrerStock(); });
  }

  setInterval(async () => {
    if (!vivant()) return;
    try { await demanderInfos(); poserLignesInfos(); poserEncartAchat(); } catch (_) {}
  }, 1200);
})();
