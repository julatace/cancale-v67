// ebay.js — Assistant eBay (tourne sur ebay.fr, dans TON navigateur).
//
// MÊME MODÈLE QUE LEBONCOIN, ET MÊME LIMITE ASSUMÉE : il ne publie RIEN tout
// seul. Pour chaque paire que tu as cochée « eBay » dans VRM, il ATTACHE les
// photos au formulaire, copie le texte complet, ouvre la page de mise en vente et
// remplit les champs qu'il RECONNAÎT. Tu relis, tu choisis la catégorie que
// eBay propose, et c'est TOI qui cliques sur « Mettre en vente ».
//
// ⚠️⚠️ CE FICHIER AFFIRMAIT UNE IMPOSSIBILITÉ QUI N'EXISTE PAS : « les photos ne
//    peuvent pas être injectées — un navigateur interdit de remplir un champ
//    fichier par programme ». Mesuré dans Chromium le 13 septembre : ce qui est
//    interdit c'est `input.value = '/chemin/photo.jpg'` ; `input.files =
//    dataTransfer.files` MARCHE. Corrigé pour Leboncoin le jour même, laissé
//    entier ici. Les photos s'attachent donc, et **rien ne touche son disque**.
//    *Une impossibilité qu'on n'a pas mesurée est une opinion.*
//
// ⚠️ CE QU'IL NE SAIT TOUJOURS PAS, ET QUI EST DIT À L'ÉCRAN :
//   • le formulaire eBay n'a jamais été observé depuis ce projet (il est derrière
//     la connexion) : le bandeau annonce COMBIEN de champs ont été remplis et
//     COMBIEN de photos ont été attachées. S'il dit 0, rien n'a été reconnu et il
//     le voit tout de suite. L'extension me remonte la structure de CHAQUE étape
//     du formulaire pour que le prochain passage vise juste.
//   • AUCUNE CATÉGORIE N'EST DEVINÉE : eBay la propose à partir du titre, et une
//     catégorie fausse fait plus de mal que pas de catégorie du tout.
//     Mesurer d'abord, deviner jamais.
(function () {
  if (window.__vrmEbayLoaded) return; window.__vrmEbayLoaded = true;
  const send = (m) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-ebay' }, m), (r) => res(r || { ok: false })); } catch (_) { res({ ok: false }); } });
  // ⚠️⚠️ « TITRE COPIÉ » SANS RIEN COPIER. `navigator.clipboard.writeText` échoue
  //    en rendant une promesse REJETÉE (document pas au premier plan, permission
  //    refusée, contexte non sécurisé) : un `try/catch` ne l'attrape pas. Ce
  //    fichier n'avait même pas de repli — le panneau annonçait « copié » et le
  //    presse-papier restait vide. Et c'est le texte qui porte la référence
  //    VRM-{n°}, le seul filet quand le formulaire n'a pas de champ pour elle.
  //    Même défaut mesuré et corrigé sur `lbc.js` le 13 septembre.
  function copyLegacy(t) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    (document.body || document.documentElement).appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
  async function copy(t) {
    try {
      const p = navigator.clipboard && navigator.clipboard.writeText(t);
      if (p && typeof p.then === 'function') { await p; return true; }
    } catch (_) {}
    return copyLegacy(t);
  }
  // On DIT ce qui s'est passé, on ne le suppose pas.
  const copyDire = async (t, quoi) => {
    toast(await copy(t) ? quoi + ' copié' + (/description/i.test(quoi) ? 'e' : '')
      : 'Je n\'ai pas pu accéder à ton presse-papier (' + quoi.toLowerCase() + '). Clique dans la page puis réessaie.');
  };

  let queue = [], retirees = 0, postedCount = 0, vendues = 0, preuveKO = false, echec = false, ouvert = false, charge = false;

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
    // ⚠️ UNE FILE QUI RÉTRÉCIT SANS EXPLICATION SE LIT COMME UNE PERTE : les
    //    paires prouvées vendues sur Vinted sont écartées, et on dit combien.
    // ⚠️ Une preuve qu'on n'a pas pu lire ne vaut pas « rien n'est vendu » : sur
    //    eBay, publier une paire déjà vendue engage une expédition.
    const doute = preuveKO
      ? `<div style="padding:9px 13px;color:#B45309;font-size:11.5px;border-top:1px solid #E3E6EA">Je n'ai pas pu vérifier lesquelles sont <b>déjà vendues sur Vinted</b> : la lecture a échoué. Cette liste peut donc en contenir — clique <b>↻</b> dans un moment.</div>`
      : '';
    const ecartees = vendues
      ? `<br>${vendues} paire${vendues > 1 ? 's' : ''} déjà vendue${vendues > 1 ? 's' : ''} sur Vinted n'${vendues > 1 ? 'y sont' : 'y est'} pas : je ne te propose pas de remettre en vente ce que tu n'as plus. ${vendues > 1 ? 'Elles gardent leurs numéros' : 'Elle garde son numéro'}.`
      : '';
    return tete
      + `<div style="padding:10px 13px;color:#5B6470;font-size:11.5px">${queue.length} paire${queue.length > 1 ? 's' : ''} cochée${queue.length > 1 ? 's' : ''} pour eBay${postedCount ? ` · ${postedCount} déjà marquée${postedCount > 1 ? 's' : ''} en ligne` : ''}.<br>Je prépare, <b>tu publies</b> : les photos s'attachent au formulaire, rien n'est téléchargé sur ton ordinateur.${ecartees}</div>`
      + doute + cartes + reste;
  }

  async function charger() {
    const r = await send({ action: 'getQueue' });
    charge = true;
    if (!r || !r.ok) { echec = true; queue = []; }
    else { echec = !!r.echec; queue = r.queue || []; retirees = r.retirees || 0; postedCount = r.postedCount || 0; vendues = r.vendues || 0; preuveKO = !!r.preuveKO; }
    panneau();
  }

  async function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.getAttribute('data-a');
    if (a === 'toggle') { ouvert = !ouvert; panneau(); if (ouvert && !charge) charger(); return; }
    if (a === 'reload') { charge = false; panneau(); charger(); return; }
    const carte = e.target.closest('.vrm-c'); const id = carte && carte.getAttribute('data-id');
    const ad = queue.find((x) => x.id === id); if (!ad) return;
    if (a === 'ctitle') { await copyDire(ad.title, 'Titre'); }
    else if (a === 'cdesc') { await copyDire(ad.description, 'Description'); }
    else if (a === 'csku') { toast(await copy(ad.sku) ? 'Référence copiée : ' + ad.sku : 'Je n\'ai pas pu copier la référence ' + ad.sku + ' — elle est aussi dans la description.'); }
    else if (a === 'posted') {
      if (!confirm('⚠️ Ceci NE publie PAS l\'annonce.\n\nÀ cliquer seulement si tu as DÉJÀ mis en ligne la N°' + ad.numero + ' sur eBay.\nÇa la retire de la liste « à préparer ». Continuer ?')) return;
      await send({ action: 'markPosted', id: ad.id });
      queue = queue.filter((x) => x.id !== ad.id); panneau(); toast('N°' + ad.numero + ' retirée de la liste');
    }
    else if (a === 'prepare') {
      // ⚠️ PLUS AUCUN TÉLÉCHARGEMENT : « ça me fait télécharger des photos dans
      //    mon ordi » (Julien, 13 septembre). Les photos sont attachées au
      //    formulaire dans le nouvel onglet, par `attacherPhotos`.
      const nbPh = (ad.photos || []).length;
      await copy('TITRE :\n' + ad.title + '\n\nDESCRIPTION :\n' + ad.description + '\n\nPRIX : ' + ad.price + ' €\nRÉFÉRENCE (SKU) : ' + ad.sku);
      await send({ action: 'setPending', ad });
      window.open('https://www.ebay.fr/sl/sell', '_blank');
      toast('🚀 N°' + ad.numero + ' — ' + nbPh + ' photo' + (nbPh > 1 ? 's' : '') + ' prête' + (nbPh > 1 ? 's' : '')
        + ' : le formulaire se remplit dans le nouvel onglet, photos comprises. Rien n\'est téléchargé sur ton ordinateur. Relis avant de publier.');
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
  // ⚠️ MESURÉ SUR LA VRAIE PAGE (12 septembre, `curl https://www.ebay.fr/sl/sell`) :
  //    la barre de recherche du haut est un `<input name="_nkw" id="gh-ac">`
  //    présent sur TOUTES les pages d'eBay, dans l'en-tête `#gh`. Un champ vide
  //    et bien visible : exactement ce que mon remplissage aurait pu viser. On
  //    écarte donc tout ce qui vit dans l'en-tête, la recherche ou un pied de
  //    page — le formulaire de mise en vente, lui, n'y est jamais.
  const DANS_ENTETE = (el) => !!el.closest('#gh, header, footer, [role="search"], [role="banner"], [role="navigation"], nav');
  // ⚠️ ET UN CHAMP DE FILTRE N'EST PAS UN CHAMP DE MISE EN VENTE. Une page de
  //    résultats d'eBay porte « Prix min » et « Prix max », qui correspondent
  //    parfaitement à `/prix|price|montant/`. On les écarte par ce qu'ils SONT,
  //    pas par l'adresse — même garde que sur Leboncoin, où le prix d'une paire
  //    atterrissait pour de vrai dans `price_min` (prouvé au banc).
  const PAS_UN_CHAMP_DE_DEPOT = /recherch|\bmin\b|\bmax\b|filtr|\btri\b|code.?postal|mot.?cl|_nkw/i;
  function champ(patterns) {
    const els = Array.from(document.querySelectorAll('input, textarea'));
    for (const p of patterns) for (const el of els) {
      if (el.type === 'hidden' || el.disabled) continue;
      if (DANS_ENTETE(el)) continue;
      const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
      const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '') + ' ' + lab).toLowerCase();
      if (PAS_UN_CHAMP_DE_DEPOT.test(hay)) continue;
      if (p.test(hay)) return el;
    }
    return null;
  }
  // ══════════════════════════════════════════════════════════════════════════
  // LES PHOTOS S'ATTACHENT (mesuré dans Chromium, voir l'en-tête du fichier)
  // ══════════════════════════════════════════════════════════════════════════
  // Le fond lit les octets (le CDN de Vinted ne renvoie aucun en-tête CORS : la
  // page seule ne peut pas), on fabrique les `File` ici, et on les attache.
  // ⚠️ Ce n'est pas un faux clic de souris : `input.files` + un `change` sont
  //    l'API du navigateur. Ce qui est refusé (§3) c'est piloter la souris à
  //    l'aveugle, et ça n'a rien à voir.
  function champsFichier() {
    return Array.from(document.querySelectorAll('input[type="file"]'))
      .filter((el) => !el.disabled && !DANS_ENTETE(el));
  }
  function fichiersDepuis(photos, numero) {
    const out = [];
    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i];
      if (!ph || !ph.b64) continue;
      try {
        const bin = atob(ph.b64);
        const buf = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);
        const type = ph.type || 'image/jpeg';
        const ext = /png/.test(type) ? 'png' : (/webp/.test(type) ? 'webp' : 'jpg');
        out.push(new File([buf], `VRM-${numero}-${i + 1}.${ext}`, { type }));
      } catch (_) {}
    }
    return out;
  }
  async function attacherPhotos(ad) {
    const urls = (ad.photos || []).slice(0, 12);
    if (!urls.length) return { n: 0, raison: 'aucune photo à attacher' };
    const cible = champsFichier()[0];
    const zone = document.querySelector('[class*="drop"],[class*="Drop"],[data-testid*="photo"],[class*="photo"],[class*="Photo"]');
    if (!cible && !zone) return { n: 0, raison: 'aucun champ photo sur cette étape' };
    const r = await send({ action: 'photoBytes', urls, max: 12 });
    const photos = (r && r.ok && Array.isArray(r.photos)) ? r.photos : [];
    const fichiers = fichiersDepuis(photos, ad.numero);
    // ⚠️ Une photo que le CDN refuse n'est PAS une photo attachée : on le dit.
    const rates = photos.filter((ph) => ph && ph.erreur).length;
    if (!fichiers.length) return { n: 0, rates, raison: rates ? 'les photos n\'ont pas pu être lues' : 'aucune photo lisible' };
    try {
      const dt = new DataTransfer();
      fichiers.forEach((f) => dt.items.add(f));
      if (cible) {
        cible.files = dt.files;
        cible.dispatchEvent(new Event('input', { bubbles: true }));
        cible.dispatchEvent(new Event('change', { bubbles: true }));
        if (cible.files && cible.files.length) return { n: cible.files.length, rates };
      }
      if (zone) {
        const dt2 = new DataTransfer();
        fichiers.forEach((f) => dt2.items.add(f));
        zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt2 }));
        zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt2 }));
        return { n: fichiers.length, rates, voie: 'glisser-déposer' };
      }
      return { n: 0, rates, raison: 'le champ n\'a pas accepté les fichiers' };
    } catch (e) { return { n: 0, rates, raison: String((e && e.message) || e).slice(0, 60) }; }
  }
  // Une liste déroulante : on ne retient une option que si son libellé correspond
  // VRAIMENT. Jamais « le premier de la liste » — laisser vide vaut toujours
  // mieux que choisir faux (§5).
  // ⚠️⚠️ ET AUCUNE CATÉGORIE N'EST CHOISIE ICI, exprès : eBay la propose à partir
  //    du titre et se trompe moins que moi, qui n'ai jamais vu son arbre de
  //    catégories. C'est la règle du dossier, pas un oubli de symétrie avec
  //    Leboncoin (où la liste est courte et connue).
  function choisirListe(motifs, valeurs) {
    const sels = Array.from(document.querySelectorAll('select')).filter((el) => !el.disabled && !DANS_ENTETE(el));
    for (const m of motifs) {
      for (const el of sels) {
        const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
        const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + lab).toLowerCase();
        if (!m.test(hay)) continue;
        if (String(el.value || '').trim()) return false;          // déjà choisi : on ne touche pas
        for (const v of (valeurs || [])) {
          const cible = String(v || '').trim().toLowerCase();
          if (!cible) continue;
          const opt = Array.from(el.options || []).find((o) => {
            const t = String(o.textContent || '').trim().toLowerCase();
            return t === cible || (t.length > 2 && cible.includes(t)) || (cible.length > 2 && t.includes(cible));
          });
          if (opt) {
            el.value = opt.value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;                                             // champ trouvé, aucune option qui colle
      }
    }
    return false;
  }
  function remplir(ad) {
    let n = 0;
    if (setField(champ([/titre|title|subject/]), ad.title)) n++;
    if (setField(champ([/description|texte|body|détail|detail/]), ad.description)) n++;
    if (setField(champ([/prix|price|montant|buy.?it.?now|start.?price/]), String(ad.price || ''))) n++;
    if (setField(champ([/\bsku\b|référ|referen|custom.?label|numéro.?de.?référence/]), ad.sku)) n++;
    // ⚠️ « ça ne met pas la catégorie ni le reste » (Julien, 13 septembre, sur
    //    Leboncoin) : les listes déroulantes ne sont pas des `input`, `champ()`
    //    ne les voyait même pas. L'état, la marque et la pointure en sont, et
    //    eBay les demande. La CATÉGORIE, non — voir `choisirListe`.
    if (choisirListe([/[ée]tat|condition/], ['Très bon état', 'Bon état', 'Occasion', 'Used'])) n++;
    if (choisirListe([/marque|brand/], [ad.marque])) n++;
    if (choisirListe([/pointure|taille|\bsize\b/], [ad.taille])) n++;
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
    const photos = photosEtat
      ? (photosEtat.n > 0
          ? `📷 <b>${photosEtat.n} photo${photosEtat.n > 1 ? 's' : ''} attachée${photosEtat.n > 1 ? 's' : ''}</b>${photosEtat.rates ? ` (${photosEtat.rates} illisible${photosEtat.rates > 1 ? 's' : ''})` : ''}.`
          : `📷 aucune photo attachée — ${esc(photosEtat.raison || 'raison inconnue')}.`)
      : `📷 j'attache les photos dès que l'étape photo s'affiche.`;
    // ⚠️ L'ARRÊT AU BOUT DE 90 s SE DISAIT EN SILENCE. La mise en vente eBay se
    //    fait en étapes : passé ce délai, le remplissage attendait des champs
    //    qu'il ne surveillait plus, et rien ne le disait. Même défaut mesuré et
    //    corrigé sur Leboncoin — « Re-remplir » RELANCE la surveillance, sans
    //    quoi il ne servirait qu'une fois.
    const fini = arrete
      ? `<div style="color:#E8B35D;margin-top:6px">Je ne remplis plus tout seul (c'est fini après 1 min 30). La mise en vente se fait en plusieurs étapes : à chaque nouvelle étape, clique <b>Re-remplir</b>.</div>`
      : '';
    el.innerHTML = (n > 0
      ? `<b>N°${esc(ad.numero)}</b> — ${n} champ${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''}. ${photos} Relis tout, choisis la catégorie proposée par eBay, puis publie.`
      : `<b>N°${esc(ad.numero)}</b> — je n'ai reconnu aucun champ sur cette page. ${photos} Le texte complet est dans ton presse-papier, colle-le.`)
      + fini
      + `<div style="display:flex;gap:6px;margin-top:9px">
           <button id="vrm-eb-refill" style="flex:1;border:1px solid #3A4A43;background:transparent;color:#fff;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Re-remplir</button>
           <button id="vrm-eb-cdesc" style="flex:1;border:1px solid #3A4A43;background:transparent;color:#fff;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Copier la description</button>
           <button id="vrm-eb-close" title="Fermer" style="border:1px solid #3A4A43;background:transparent;color:#9AA4AE;border-radius:9px;padding:7px 9px;font:11.5px system-ui,sans-serif;cursor:pointer">✕</button>
         </div>
         <div style="color:#8B949E;font-size:10px;margin-top:7px">VRM ne met jamais en vente à ta place : relis et clique toi-même.</div>`;
    el.querySelector('#vrm-eb-refill').onclick = () => { relancer(ad); };
    el.querySelector('#vrm-eb-cdesc').onclick = () => { copyDire(ad.description || '', 'Description'); };
    el.querySelector('#vrm-eb-close').onclick = () => { clearInterval(minuteur); el.remove(); send({ action: 'setPending', ad: null }); };
  }
  // eBay reconstruit son formulaire au fil des étapes : on réessaie, sans jamais
  // écraser ce qui est déjà saisi. On s'arrête au bout de 90 s — et on le DIT.
  let essais = 0, faits = 0, minuteur = null, arrete = false;
  let photosFaites = false, photosEtat = null;
  function surveiller(ad) {
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      essais++;
      const n = remplir(ad);
      if (n > faits) { faits = n; bandeau(faits, ad); }
      // Les photos : dès qu'une étape porte un champ fichier, on attache. UNE
      // seule fois — ré-attacher écraserait ce qu'il vient d'ajouter lui-même.
      if (!photosFaites && champsFichier().length) {
        photosFaites = true;
        attacherPhotos(ad).then((r2) => { photosEtat = r2; bandeau(faits, ad); });
      }
      if (essais > 90) { clearInterval(minuteur); arrete = true; bandeau(faits, ad); }
    }, 1000);
  }
  function relancer(ad) {
    arrete = false; essais = 0;
    faits = remplir(ad);
    if (!photosFaites && champsFichier().length) {
      photosFaites = true;
      attacherPhotos(ad).then((r2) => { photosEtat = r2; bandeau(faits, ad); });
    }
    surveiller(ad);
    bandeau(faits, ad);
  }
  async function auto() {
    if (!estFormulaire()) return;
    const r = await send({ action: 'getPending' });
    const ad = (r && r.ok && r.ad) ? r.ad : null;
    if (!ad) return;
    bandeau(0, ad);
    surveiller(ad);
    setTimeout(() => rapporterEtape(), 6000);
  }
  // La STRUCTURE du formulaire me revient — noms de champs, libellés d'options,
  // présence d'un champ fichier ; AUCUN contenu saisi. C'est ce qui permettra de
  // viser juste au lieu de deviner (je n'ai jamais vu ce formulaire : il est
  // derrière la connexion).
  // ⚠️ CHAQUE ÉTAPE DISTINCTE, pas une seule : la mise en vente eBay se fait en
  //    plusieurs écrans, et n'en garder qu'un revient à ne rien savoir des
  //    autres — c'est exactement le défaut corrigé pour `lbc_recon.etapes`.
  let derniereEtape = '';
  function rapporterEtape() {
    try {
      const fields = [];
      document.querySelectorAll('input, select, textarea').forEach((el) => {
        fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '',
          ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '',
          label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 60),
          qa: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '' });
      });
      const selects = [];
      document.querySelectorAll('select').forEach((el) => {
        selects.push({ name: el.name || '', id: el.id || '',
          label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 50),
          options: Array.from(el.options || []).slice(0, 25).map((o) => String(o.textContent || '').trim().slice(0, 40)) });
      });
      const fichiers = document.querySelectorAll('input[type="file"]').length;
      const signature = fields.map((f) => f.name || f.id).join('|') + '#' + selects.length + '#' + fichiers;
      if (!fields.length && !selects.length && !fichiers) return;
      if (signature === derniereEtape) return;
      derniereEtape = signature;
      send({ action: 'ebayForm', url: location.href, fields, selects, fichiers, etape: signature.slice(0, 120) });
    } catch (_) {}
  }

  panneau();
  auto();
  // eBay est une application à page unique : l'URL change sans rechargement.
  let derniere = location.href;
  setInterval(() => {
    if (location.href === derniere) return;
    derniere = location.href; essais = 0; faits = 0; arrete = false;
    auto();
    setTimeout(() => rapporterEtape(), 4000);
  }, 1500);
})();
