// ebay.js — Assistant eBay (tourne sur ebay.fr, dans TON navigateur).
//
// MÊME MODÈLE QUE LEBONCOIN, ET MÊME LIMITE ASSUMÉE : il ne publie RIEN tout
// seul. Pour chaque paire que tu as cochée « eBay » dans VRM, il télécharge les
// photos, copie le texte complet, ouvre le formulaire de mise en vente et
// remplit les champs qu'il RECONNAÎT. Tu relis, tu choisis la catégorie que
// eBay propose, et c'est TOI qui cliques sur « Mettre en vente ».
//
// ⚠️ CE QU'IL NE SAIT PAS FAIRE, ET QUI EST DIT À L'ÉCRAN :
//   • les PHOTOS ne peuvent pas être injectées — un navigateur interdit de
//     remplir un champ fichier par programme. Elles sont dans ton dossier
//     VRM-{n°}, il ne reste qu'à les glisser.
//   • le formulaire eBay n'a jamais été observé depuis ce projet : le bandeau
//     annonce COMBIEN de champs ont été remplis. S'il dit 0, rien n'a été
//     reconnu — et l'extension me remonte la structure du formulaire pour que
//     le prochain passage vise juste. Mesurer d'abord, deviner jamais.
(function () {
  if (window.__vrmEbayLoaded) return; window.__vrmEbayLoaded = true;
  const send = (m) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-ebay' }, m), (r) => res(r || { ok: false })); } catch (_) { res({ ok: false }); } });
  const copy = (t) => { try { navigator.clipboard.writeText(t); } catch (_) {} };

  let queue = [], retirees = 0, postedCount = 0, echec = false, ouvert = false, charge = false;

  function toast(msg) {
    let el = document.getElementById('vrm-ebay-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-ebay-toast';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:2147483647;background:#10151B;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:11px 16px;border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.3);max-width:min(420px,92vw)';
      document.documentElement.appendChild(el);
    }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el.__t); el.__t = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  // ── LE PANNEAU ────────────────────────────────────────────────────────────
  function panneau() {
    let el = document.getElementById('vrm-ebay');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-ebay';
      el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;width:min(360px,94vw);max-height:78vh;overflow:auto;background:#fff;color:#10151B;border:1px solid #E3E6EA;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.18);font:13px/1.45 system-ui,sans-serif';
      document.documentElement.appendChild(el);
      el.addEventListener('click', onClick);
    }
    el.innerHTML = rendu();
    return el;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BTN = 'border:1px solid #E3E6EA;background:#fff;color:#10151B;border-radius:8px;padding:6px 10px;font:600 12px system-ui,sans-serif;cursor:pointer';

  function rendu() {
    const tete = `<div style="display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid #E3E6EA;position:sticky;top:0;background:#fff">
      <b style="flex:1;font-size:13px">VRM → eBay</b>
      <button data-a="reload" style="${BTN}">↻</button>
      <button data-a="toggle" style="${BTN}">${ouvert ? '–' : '+'}</button></div>`;
    if (!ouvert) return tete;
    if (!charge) return tete + `<div style="padding:14px;color:#5B6470">Je lis tes annonces…</div>`;
    // ⚠️ « 0 à préparer » ne veut pas dire la même chose selon la cause.
    if (echec) return tete + `<div style="padding:14px;color:#B45309">Je n'ai pas pu lire tes annonces — cette liste est vide parce que la lecture a échoué, pas parce qu'il n'y a rien à préparer.</div>`;
    if (!queue.length) {
      const pourquoi = retirees > 0
        ? `Aucune annonce n'est cochée « eBay » dans VRM (${retirees} en ligne ne le sont pas). Ça se coche sur l'écran <b>Annonces</b>, sous chaque paire.`
        : `Rien à préparer : tout ce qui est coché « eBay » est déjà marqué en ligne.`;
      return tete + `<div style="padding:14px;color:#5B6470">${pourquoi}</div>`;
    }
    const cartes = queue.slice(0, 40).map((a) => `
      <div class="vrm-c" data-id="${esc(a.id)}" style="border-top:1px solid #E3E6EA;padding:11px 13px">
        <div style="font-weight:700;font-size:12.5px">N°${esc(a.numero)} · ${esc(a.title).slice(0, 60)}</div>
        <div style="color:#5B6470;font-size:11.5px;margin:2px 0 8px">${esc(a.price)} € · réf ${esc(a.sku)} · ${esc(a.account || '')} · ${(a.photos || []).length} photo(s)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button data-a="prepare" style="${BTN};flex:1 1 100%;background:#1E5FCC;color:#fff;border-color:#1E5FCC">🚀 Tout préparer</button>
          <button data-a="ctitle" style="${BTN}">Titre</button>
          <button data-a="cdesc" style="${BTN}">Description</button>
          <button data-a="csku" style="${BTN}">Réf</button>
          <button data-a="posted" style="${BTN}">✓ déjà en ligne</button>
        </div>
      </div>`).join('');
    const reste = queue.length > 40 ? `<div style="padding:9px 13px;color:#5B6470;font-size:11.5px">… et ${queue.length - 40} autres.</div>` : '';
    return tete
      + `<div style="padding:10px 13px;color:#5B6470;font-size:11.5px">${queue.length} paire${queue.length > 1 ? 's' : ''} cochée${queue.length > 1 ? 's' : ''} pour eBay${postedCount ? ` · ${postedCount} déjà marquée${postedCount > 1 ? 's' : ''} en ligne` : ''}.<br>Je prépare, <b>tu publies</b> : les photos ne peuvent pas être injectées dans le formulaire, elles arrivent dans ton dossier <b>VRM-{n°}</b>.</div>`
      + cartes + reste;
  }

  async function charger() {
    const r = await send({ action: 'getQueue' });
    charge = true;
    if (!r || !r.ok) { echec = true; queue = []; }
    else { echec = !!r.echec; queue = r.queue || []; retirees = r.retirees || 0; postedCount = r.postedCount || 0; }
    panneau();
  }

  async function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.getAttribute('data-a');
    if (a === 'toggle') { ouvert = !ouvert; panneau(); if (ouvert && !charge) charger(); return; }
    if (a === 'reload') { charge = false; panneau(); charger(); return; }
    const carte = e.target.closest('.vrm-c'); const id = carte && carte.getAttribute('data-id');
    const ad = queue.find((x) => x.id === id); if (!ad) return;
    if (a === 'ctitle') { copy(ad.title); toast('Titre copié'); }
    else if (a === 'cdesc') { copy(ad.description); toast('Description copiée'); }
    else if (a === 'csku') { copy(ad.sku); toast('Référence copiée : ' + ad.sku); }
    else if (a === 'posted') {
      if (!confirm('⚠️ Ceci NE publie PAS l\'annonce.\n\nÀ cliquer seulement si tu as DÉJÀ mis en ligne la N°' + ad.numero + ' sur eBay.\nÇa la retire de la liste « à préparer ». Continuer ?')) return;
      await send({ action: 'markPosted', id: ad.id });
      queue = queue.filter((x) => x.id !== ad.id); panneau(); toast('N°' + ad.numero + ' retirée de la liste');
    }
    else if (a === 'prepare') {
      const dl = await send({ action: 'downloadPhotos', urls: ad.photos || [], numero: ad.numero });
      copy('TITRE :\n' + ad.title + '\n\nDESCRIPTION :\n' + ad.description + '\n\nPRIX : ' + ad.price + ' €\nRÉFÉRENCE (SKU) : ' + ad.sku);
      await send({ action: 'setPending', ad });
      window.open('https://www.ebay.fr/sl/sell', '_blank');
      toast('🚀 ' + ((dl && dl.count) || 0) + ' photo(s) dans le dossier VRM-' + ad.numero + ' — le formulaire se remplit dans le nouvel onglet, relis avant de publier.');
    }
  }

  // ── REMPLISSAGE DU FORMULAIRE DE MISE EN VENTE ────────────────────────────
  const estFormulaire = () => /\/sl\/|\/lstng|prelist|sell\/create|\/sell\b/i.test(location.href);
  function setField(el, val) {
    if (!el || !val) return false;
    if (String(el.value || '').trim()) return false;          // on n'écrase jamais une correction
    try {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }
  function champ(patterns) {
    const els = Array.from(document.querySelectorAll('input, textarea'));
    for (const p of patterns) for (const el of els) {
      if (el.type === 'hidden' || el.disabled) continue;
      const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
      const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '') + ' ' + lab).toLowerCase();
      if (p.test(hay)) return el;
    }
    return null;
  }
  function remplir(ad) {
    let n = 0;
    if (setField(champ([/titre|title|subject/]), ad.title)) n++;
    if (setField(champ([/description|texte|body|détail|detail/]), ad.description)) n++;
    if (setField(champ([/prix|price|montant|buy.?it.?now|start.?price/]), String(ad.price || ''))) n++;
    if (setField(champ([/\bsku\b|référ|referen|custom.?label|numéro.?de.?référence/]), ad.sku)) n++;
    return n;
  }
  function bandeau(n, ad) {
    let el = document.getElementById('vrm-ebay-b');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-ebay-b';
      el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483646;max-width:min(420px,92vw);background:#10151B;color:#fff;border-radius:10px;padding:11px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.3)';
      document.documentElement.appendChild(el);
    }
    // ⚠️ ON DIT LE CHIFFRE, PAS « C'EST PRÊT ». Zéro champ reconnu est une
    //    information utile — et la seule honnête quand c'est le cas.
    el.innerHTML = n > 0
      ? `<b>N°${esc(ad.numero)}</b> — ${n} champ${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''}. Relis tout, choisis la catégorie proposée par eBay, ajoute les photos du dossier <b>VRM-${esc(ad.numero)}</b>, puis publie.`
      : `<b>N°${esc(ad.numero)}</b> — je n'ai reconnu aucun champ sur cette page. Le texte complet est dans ton presse-papier (colle-le), et les photos sont dans <b>VRM-${esc(ad.numero)}</b>.`;
  }
  // eBay reconstruit son formulaire au fil des étapes : on réessaie, sans jamais
  // écraser ce qui est déjà saisi. On s'arrête au bout de 90 s.
  let essais = 0, faits = 0, minuteur = null;
  async function auto() {
    if (!estFormulaire()) return;
    const r = await send({ action: 'getPending' });
    const ad = (r && r.ok && r.ad) ? r.ad : null;
    if (!ad) return;
    bandeau(0, ad);
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      essais++;
      const n = remplir(ad);
      if (n > faits) { faits = n; bandeau(faits, ad); }
      if (essais > 90) clearInterval(minuteur);
    }, 1000);
    // La STRUCTURE du formulaire (noms de champs, aucun contenu) me revient une
    // fois : c'est ce qui permettra de viser juste au lieu de deviner.
    setTimeout(() => {
      try {
        const fields = [];
        document.querySelectorAll('input, select, textarea').forEach((el) => {
          fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '',
            ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '',
            label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 60),
            qa: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '' });
        });
        if (fields.length) send({ action: 'ebayForm', url: location.href, fields });
      } catch (_) {}
    }, 6000);
  }

  panneau();
  auto();
  // eBay est une application à page unique : l'URL change sans rechargement.
  let derniere = location.href;
  setInterval(() => { if (location.href !== derniere) { derniere = location.href; essais = 0; faits = 0; auto(); } }, 1500);
})();
