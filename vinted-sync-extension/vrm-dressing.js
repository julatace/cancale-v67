// ════════════════════════════════════════════════════════════════════════════
//  LE DRESSING AMÉLIORÉ SUR VINTED (5.410.4, « comme Bleam »)
//
//  Sur la page profil / dressing du COMPTE CONNECTÉ DANS L'ONGLET (vérifié par le fond : un autre profil ⇒ rien),
//  quand SON réglage « Dressing amélioré » est allumé (éteint par défaut) :
//   · la plaque N° VRM sur chaque vignette (par identité d'annonce, jamais par titre) et une case pour la choisir ;
//   · le tri (récentes, anciennes, plus / moins vues, plus de favoris, prix ↑/↓, plus republiées) et le filtre
//     « sauvegardées ou non » (le coffre), appliqués à l'affichage seulement ;
//   · une barre en bas : Sauvegardes · Planifications · Stock auto ; pour la sélection : Planifier · Modifier ·
//     Republier · Supprimer. CHAQUE action passe par un chemin gardé du fond (atelier Republier, suppression sur SA
//     confirmation, une à la fois, compte de l'onglet, plafonds) ; Modifier ouvre la page de modification de Vinted.
//  ⚠️ Ce script ne fabrique AUCUN clic ni aucune frappe sur Vinted (aucun événement synthétique) : il dessine.
//  Shadow root FERMÉE pour la barre ; les plaques et cases sont nos éléments (`data-vrm-dp`), retirés à l'arrêt.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (window.top !== window) return;
  if (window.__vrmDressing) return; window.__vrmDressing = true;
  const vivant = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  if (!vivant()) return;
  const U = globalThis.VRM_UI; if (!U) return;
  const T = U.T, esc = U.esc;
  const membre = () => { const m = /^\/member\/(\d{1,20})(?:[-/]|$)/.exec(location.pathname); return m ? m[1] : ''; };
  let etat = null, choisis = new Set(), hote = null, ombre = null, conf = null, note = '', enVol = false, quantite = 2;
  const demander = (msg) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'vrm-dressing', membre: membre() }, msg), (r) => { void chrome.runtime.lastError; res(r || null); }); } catch (_) { res(null); } });
  // Les vignettes : chaque lien `/items/{id}` ; la cellule = l'ancêtre le plus haut qui ne contient que CETTE annonce.
  function cellules() {
    const vus = new Map();
    for (const a of document.querySelectorAll('a[href*="/items/"]')) {
      if (a.closest('[data-vrm-dp-barre]')) continue;
      const m = /\/items\/(\d{4,15})(?:[-/?#]|$)/.exec(a.getAttribute('href') || ''); if (!m || vus.has(m[1])) continue;
      let el = a;
      while (el.parentElement && el.parentElement !== document.body) {
        const ids = new Set([...el.parentElement.querySelectorAll('a[href*="/items/"]')].map((x) => (/\/items\/(\d{4,15})/.exec(x.getAttribute('href') || '') || [])[1]).filter(Boolean));
        if (ids.size > 1) break;
        el = el.parentElement;
      }
      vus.set(m[1], el);
    }
    return vus;
  }
  const CLES_TRI = { recentes: (s) => -(s.cree || 0), anciennes: (s) => s.cree || 0, vues_plus: (s) => -(s.vues || 0), vues_moins: (s) => s.vues || 0, favoris: (s) => -(s.favoris || 0), prix_bas: (s) => s.prix || 0, prix_haut: (s) => -(s.prix || 0), republiees: (s) => -(s.repub || 0) };
  function decorer() {
    if (!etat || !etat.actif) return;
    const cs = cellules(); if (!cs.size) return;
    const sauve = Array.isArray(etat.sauve) ? new Set(etat.sauve) : null;
    for (const [id, el] of cs) {
      if (!el.querySelector('[data-vrm-dp]')) {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const d = document.createElement('div'); d.setAttribute('data-vrm-dp', id);
        d.style.cssText = 'position:absolute;top:6px;left:6px;z-index:5;display:flex;gap:6px;align-items:center;pointer-events:auto';
        const num = etat.nums && etat.nums[id];
        d.innerHTML = `<button type="button" role="checkbox" data-vrm-dp-case="${esc(id)}" aria-checked="false" aria-label="${esc(T('dp_choisir'))}" style="appearance:none;border:0;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:rgb(255 255 255/.92);box-shadow:0 1px 3px rgb(0 0 0/.25);cursor:pointer;font:700 18px/1 system-ui;color:#111114"></button>${num ? `<span data-vrm-dp-num="${esc(num)}" style="font:700 13px/1 -apple-system,Inter,system-ui,sans-serif;padding:6px 8px;border-radius:8px;background:#111114;color:#fff;letter-spacing:.02em"><small style="font-weight:500;opacity:.8;margin-right:2px">N°</small>${esc(num)}</span>` : ''}`;
        el.appendChild(d);
        // Une case À NOUS (un bouton) : le toucher ne suit pas le lien de l'annonce (on l'arrête ici, rien n'est envoyé).
        const c = d.querySelector('button');
        const peindre = () => { const on = choisis.has(id); c.setAttribute('aria-checked', String(on)); c.textContent = on ? '✓' : ''; c.style.background = on ? '#0F6B4C' : 'rgb(255 255 255/.92)'; c.style.color = on ? '#fff' : '#111114'; };
        peindre();
        c.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (choisis.has(id)) choisis.delete(id); else choisis.add(id); peindre(); rendreBarre(); }, true);
        d.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
      }
      const cache = sauve && ((etat.filtre === 'sauvegardees' && !sauve.has(id)) || (etat.filtre === 'non' && sauve.has(id)));
      el.toggleAttribute('data-vrm-dp-cache', !!cache); el.style.display = cache ? 'none' : '';
    }
    // Le tri, à l'affichage : les cellules de LA MÊME grille, réordonnées (rien n'est envoyé à Vinted).
    const k = CLES_TRI[etat.tri] || CLES_TRI.recentes;
    const parGrille = new Map();
    for (const [id, el] of cs) { const p = el.parentElement; if (!p) continue; if (!parGrille.has(p)) parGrille.set(p, []); parGrille.get(p).push([id, el]); }
    for (const [p, l] of parGrille) {
      const tri = l.slice().sort((a, b) => k((etat.stats || {})[a[0]] || {}) - k((etat.stats || {})[b[0]] || {}));
      if (tri.every((x, i) => x[1] === l[i][1])) continue;
      for (const [, el] of tri) p.appendChild(el);
    }
  }
  function retirer() { document.querySelectorAll('[data-vrm-dp]').forEach((x) => x.remove()); document.querySelectorAll('[data-vrm-dp-cache]').forEach((x) => { x.style.display = ''; x.removeAttribute('data-vrm-dp-cache'); }); if (hote) { hote.remove(); hote = null; ombre = null; } }
  function rendreBarre() {
    if (!etat || !etat.actif) return;
    if (!hote) { hote = document.createElement('div'); hote.id = 'vrm-dressing'; hote.setAttribute('data-vrm-dp-barre', ''); hote.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000'; ombre = hote.attachShadow({ mode: 'closed' }); U.monter(ombre); (document.body || document.documentElement).appendChild(hote); }
    const n = choisis.size;
    const btn = (k, l, attrs) => `<button type="button" class="vu-btn" data-dp="${k}"${attrs || ''}>${esc(T(l))}</button>`;
    // 5.429 (« la republication à la main ») : « Republier » montre d'abord l'Avant | Après de CES annonces (ce que le dressing
    //    amélioré a LU : N°, prix, mise en ligne) — puis « Republier maintenant » (SON 2e toucher) part par l'atelier (même chemin).
    const aaRep = conf === 'republier' && U.MODIF && U.MODIF.avantApresHtml ? U.MODIF.avantApresHtml([...choisis].map((id) => { const st = (etat.stats || {})[id] || {}; const pr = Number(st.prix) > 0 ? Number(st.prix) : null;
      return { id, sorte: 'republier', titre: '', photo: '', num: (etat.nums && etat.nums[id]) || '', avant: { prix: pr, statut: 'en_vente', depuis: Number(st.cree) > 0 ? Number(st.cree) * 1000 : null }, apres: { prix: pr, statut: 'en_vente', depuis: 'maintenant' } }; })) : '';
    const confHtml = conf ? `<div class="vu-plaque" role="alertdialog" data-dp-confirme="${conf}" style="margin:0 0 8px;padding:12px 16px;max-height:60vh;overflow:auto"><p style="margin:0 0 8px">${esc(T(conf === 'supprimer' ? 'dp_confirme_sup' : conf === 'republier' ? 'dp_confirme_rep' : 'dp_quantite', { n }))}</p>${aaRep}${conf === 'stock' ? `<input type="number" min="1" max="99" value="${quantite}" data-dp-quantite style="width:80px;min-height:44px;font-size:16px">` : ''}<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="vu-btn vu-plein" data-dp-oui>${esc(conf === 'republier' ? T('rd_maintenant') : T('dp_confirmer'))}</button><button type="button" class="vu-btn" data-dp-non>${esc(T('dp_annuler'))}</button></div></div>` : '';
    ombre.innerHTML = `<style>${U.CSS}</style><div class="vu-racine" style="padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--vu-sur);border-top:.5px solid var(--vu-filet);box-shadow:0 -8px 24px -16px rgb(0 0 0/.35);font:400 15px/20px -apple-system,Inter,system-ui,sans-serif;color:var(--vu-encre)">
      ${confHtml}${note ? `<p role="status" data-dp-note style="margin:0 0 8px">${esc(note)}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-dp-barre="${n}">
        ${btn('sauvegardes', 'dp_sauvegardes')}${btn('planifications', 'dp_planifications')}${btn('stock', 'dp_stock', n ? '' : ' disabled')}
        <span style="flex:1 1 auto;min-width:8px"></span>
        <span data-dp-n="${n}" style="color:var(--vu-muet)">${esc(T('dp_choisies', { n }))}</span>
        ${btn('planifier', 'dp_planifier', n ? '' : ' disabled')}${btn('modifier', 'dp_modifier', n === 1 ? '' : ' disabled')}${btn('republier', 'dp_republier', n ? '' : ' disabled')}${btn('supprimer', 'dp_supprimer', n && n <= 10 ? '' : ' disabled')}
      </div></div>`;
    const ids = [...choisis];
    const ouvrir = (u) => { try { window.open(u, '_blank', 'noopener'); } catch (_) {} };
    ombre.querySelectorAll('[data-dp]').forEach((b) => b.addEventListener('click', () => {
      const k = b.getAttribute('data-dp'); note = '';
      if (k === 'sauvegardes') return ouvrir('https://vrm.center/?tab=annonces&site=vinted&vue=coffre');
      if (k === 'planifications') return ouvrir('https://vrm.center/?tab=annonces&site=vinted&vue=programme');
      if (k === 'planifier') return ouvrir('https://vrm.center/?tab=annonces&site=vinted&vue=programme&ids=' + encodeURIComponent(ids.join(',')));
      if (k === 'modifier') { if (ids.length === 1) location.assign('/items/' + ids[0] + '/edit'); return; }
      conf = k; rendreBarre();
    }));
    const oui = ombre.querySelector('[data-dp-oui]'); if (oui) oui.addEventListener('click', async () => {
      if (enVol) return; enVol = true; const q = ombre.querySelector('[data-dp-quantite]'); if (q) quantite = Number(q.value) || 1;
      const quoi = conf; conf = null; rendreBarre();
      const r = await demander({ action: 'dressingAction', quoi, ids, confirme: true, ...(quoi === 'stock' ? { n: quantite } : {}) });
      enVol = false; note = r && r.ok ? T('dp_ok') : T('dp_ko', { r: (r && r.raison) || '—' });
      if (r && r.ok && quoi === 'supprimer') choisis = new Set();
      rendreBarre(); charger();
    });
    const non = ombre.querySelector('[data-dp-non]'); if (non) non.addEventListener('click', () => { conf = null; rendreBarre(); });
  }
  async function charger() {
    if (!membre()) { etat = null; retirer(); return; }
    const r = await demander({ action: 'dressingPlus' });
    etat = r && r.ok ? r : null;
    if (!etat || !etat.actif) { retirer(); return; }
    decorer(); rendreBarre();
  }
  let minuteur = null, dernierChemin = location.pathname;
  const obs = new MutationObserver(() => { if (minuteur) return; minuteur = setTimeout(() => { minuteur = null; if (location.pathname !== dernierChemin) { dernierChemin = location.pathname; choisis = new Set(); charger(); } else decorer(); }, 400); });
  try { obs.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  charger();
})();
