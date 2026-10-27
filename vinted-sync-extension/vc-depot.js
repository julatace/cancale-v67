// vc-depot.js — sur vestiairecollective.com, dans TON navigateur (27 octobre, 5.235).
//
// Julien : « je veux pouvoir le faire sur VRM directement, pouvoir publier ».
// Quand il clique « Préparer sur Vestiaire » dans l'app, l'extension ouvre
// Vestiaire ; dans CET onglet seulement, ce fichier attend le formulaire de
// dépôt, remplit les champs qu'il RECONNAÎT, attache les photos (détourées par
// Photoroom avec SA clé quand elle est posée) et relève la structure de chaque
// étape (`panel_vc_form` : noms de champs, jamais un contenu saisi). Le bandeau
// dit le CHIFFRE de ce qui est rempli.
//
// ⚠️ JE N'AI JAMAIS VU CE FORMULAIRE : rien n'est promis, rien n'est deviné.
// ⚠️ 5.236 : VRM PUBLIE tout seul, SANS BOOSTER (`publierSansBooster`), quand
//    tout est rempli ; une catégorie ou un modèle obligatoires restent à lui.
// ⚠️ AUCUNE CATÉGORIE, AUCUN MODÈLE n'est choisi : une catégorie fausse fait
//    plus de mal que pas de catégorie du tout (leçon eBay).
// Ce fichier est une copie d'ebay.js : ses commentaires « eBay » disent pourquoi
// chaque garde existe ; ils valent ici aussi.
(function () {
  if (window.__vrmVcDepotLoaded) return; window.__vrmVcDepotLoaded = true;
  // §8 : chaque relevé porte la VERSION de l'extension qui l'a écrit, sinon une
  // étape manquante me fait deviner « défaut ou version trop ancienne ».
  const EXT_VER = (() => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } })();
  const send = (m) => new Promise((res) => { try { chrome.runtime.sendMessage(Object.assign({ from: 'cancale-vcdepot' }, m), (r) => res(r || { ok: false })); } catch (_) { res({ ok: false }); } });
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


  function toast(msg) {
    let el = document.getElementById('vrm-vc-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-vc-toast';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:2147483647;background:#10141B;color:#E8ECF2;border:1px solid #1E2530;font:600 13px/1.4 system-ui,sans-serif;padding:11px 16px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.35),0 12px 30px rgba(0,0,0,.3);max-width:min(420px,92vw)';
      document.documentElement.appendChild(el);
    }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el.__t); el.__t = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 5.188 : le HTML de nos propres gabarits (valeurs passées par `esc`) est posé
  // par DOMParser plutôt que `innerHTML =` — même résultat, et c'est la forme que
  // les boutiques (Firefox, Edge) relisent sans avertissement.
  const poserHtml = (el, html) => { const d = new DOMParser().parseFromString('<body>' + String(html) + '</body>', 'text/html'); el.replaceChildren(...Array.from(d.body.childNodes)); };





  // ── REMPLISSAGE DU FORMULAIRE DE MISE EN VENTE ────────────────────────────
  // L'adresse du formulaire n'est pas mesurée : c'est la PRÉSENCE d'un champ de
  // dépôt (photo, description ou prix) qui décide, et seulement dans l'onglet
  // ouvert pour la paire (le fond ne rend la paire qu'à lui).
  const estFormulaire = () => true;
  const formulaireVisible = () => champsFichier().length > 0 || !!champ([/description/]) || !!champ([/prix|price/]);
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
  const DANS_ENTETE = (el) => !!el.closest('header, footer, [role="search"], [role="banner"], [role="navigation"], nav');
  // ⚠️ ET UN CHAMP DE FILTRE N'EST PAS UN CHAMP DE MISE EN VENTE. Une page de
  //    résultats d'eBay porte « Prix min » et « Prix max », qui correspondent
  //    parfaitement à `/prix|price|montant/`. On les écarte par ce qu'ils SONT,
  //    pas par l'adresse — même garde que sur Leboncoin, où le prix d'une paire
  //    atterrissait pour de vrai dans `price_min` (prouvé au banc).
  const PAS_UN_CHAMP_DE_DEPOT = /recherch|search|\bmin\b|\bmax\b|filtr|\btri\b|code.?postal|mot.?cl|newsletter|e-?mail|password|mot.?de.?passe/i;
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
            return t === cible;   // Vestiaire : le libellé EXACT seulement (« Bon état » ⊂ « Très bon état »)
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
  // ⚠️⚠️ eBAY UTILISE DES LISTES REACT, PAS DES `<select>` NATIFS — exactement
  //    comme Leboncoin (mesuré le 19 sept.). `choisirListe` (ci-dessus) ne voit
  //    que les `<select>` : sur le vrai formulaire eBay il ne remplit RIEN, le
  //    défaut « ça ne met pas la catégorie ni le reste ». Même correctif que
  //    Leboncoin : on OUVRE le combobox et on CLIQUE l'option au texte EXACT —
  //    le geste d'un humain, jamais une valeur posée en douce, jamais « le
  //    premier qui ressemble » (§5 : un attribut faux sur une annonce publiée
  //    est le coût le plus élevé du projet).
  function labelCombobox(el) {
    let lbl = el.getAttribute('aria-label') || '';
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { try { for (const id of lb.split(/\s+/)) { const e = document.getElementById(id); if (e) lbl += ' ' + (e.innerText || ''); } } catch (_) {} }
    const id = el.getAttribute('id');
    if (id) { try { const l = document.querySelector('label[for="' + ((window.CSS && CSS.escape) ? CSS.escape(id) : id) + '"]'); if (l) lbl += ' ' + (l.innerText || ''); } catch (_) {} }
    const f = el.closest('div,fieldset,section'); if (f) { const l = f.querySelector('label'); if (l) lbl += ' ' + (l.innerText || ''); }
    return lbl.toLowerCase();
  }
  async function choisirComposant(motif, valeurExacte) {
    const cible = String(valeurExacte || '').trim();
    if (!cible) return false;
    const boxes = Array.from(document.querySelectorAll('[role="combobox"]')).filter((el) => !DANS_ENTETE(el));
    for (const box of boxes) {
      if (!motif.test(labelCombobox(box))) continue;
      const val = String(box.value || box.getAttribute('data-choisi') || '').trim();
      if (val) return false;                            // déjà choisi : on ne touche pas
      try { box.focus(); box.click(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 160));      // le menu React s'ouvre
      const opt = Array.from(document.querySelectorAll('[role="option"]'))
        .find((o) => String(o.textContent || '').trim().toLowerCase() === cible.toLowerCase());
      if (opt) { try { opt.click(); } catch (_) {} return true; }
      try { box.blur(); } catch (_) {}                   // referme le menu, rien choisi
      return false;
    }
    return false;
  }
  // Une seule fois par paire (le minuteur rappelle `remplir` chaque seconde —
  // sans ça on rouvrirait le menu en boucle). Remis à zéro par « Re-remplir ».
  let _composFaits = new Set(); let _composEnCours = false; let composFaits = 0;
  async function remplirComposants(ad) {
    if (_composEnCours) return 0; _composEnCours = true;
    let k = 0;
    try {
      const cle = (q) => String(ad.id || ad.sku || '') + ':' + q;
      const etat = String(ad.etat || '').trim();
      if (etat && !_composFaits.has(cle('e')) && await choisirComposant(/[ée]tat|condition/, etat)) { _composFaits.add(cle('e')); k++; }
      const marque = String(ad.marque || '').trim();
      if (marque && !_composFaits.has(cle('m')) && await choisirComposant(/marque|brand/, marque)) { _composFaits.add(cle('m')); k++; }
      const taille = String(ad.taille || '').trim();
      if (taille && !_composFaits.has(cle('p')) && await choisirComposant(/pointure|taille|\bsize\b/, taille)) { _composFaits.add(cle('p')); k++; }
      const couleur = String(ad.couleur || '').trim();
      if (couleur && !_composFaits.has(cle('c')) && await choisirComposant(/couleur|colou?r/, couleur)) { _composFaits.add(cle('c')); k++; }
    } catch (_) {}
    _composEnCours = false; composFaits += k; return k;
  }
  function remplir(ad) {
    let n = 0;
    if (!formulaireVisible()) return composFaits;
    if (setField(champ([/titre|title/]), ad.title)) n++;
    if (setField(champ([/description|texte|détail|detail/]), ad.description)) n++;
    if (setField(champ([/prix|price|montant/]), String(ad.price || ''))) n++;
    // ⚠️ « ça ne met pas la catégorie ni le reste » (Julien, 13 septembre, sur
    //    Leboncoin) : les listes déroulantes ne sont pas des `input`, `champ()`
    //    ne les voyait même pas. L'état, la marque et la pointure en sont, et
    //    eBay les demande. La CATÉGORIE, non — voir `choisirListe`.
    //    Les `<select>` natifs d'abord ; les comboboxes React suivent
    //    (`remplirComposants`, async, appelé par le minuteur).
    // L'état : seulement le libellé EXACT de Vinted (jamais « le plus proche »).
    if (choisirListe([/[ée]tat|condition/], [ad.etat])) n++;
    if (choisirListe([/marque|brand/], [ad.marque])) n++;
    if (choisirListe([/pointure|taille|\bsize\b/], [ad.taille])) n++;
    return n + composFaits;
  }
  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIER SANS BOOSTER (27 octobre, 5.236)
  // ══════════════════════════════════════════════════════════════════════════
  // Julien : « je veux que ça publie tout seul sans booster ». Même garde que
  // Leboncoin (`lbc.js`, `publierSansBooster`), parce que le risque est le même :
  // DÉPENSER SON ARGENT. Le formulaire de Vestiaire n'a JAMAIS été vu d'ici :
  //   · toute option payante (boost, mise en avant, vitrine, sponsorisé…, ou un
  //     libellé qui porte un PRIX) est décochée, puis relue deux fois ; encore
  //     active ⇒ rien n'est cliqué ;
  //   · on ne clique qu'un bouton qui dit publier / mettre en vente / soumettre,
  //     jamais un bouton à prix, jamais un bouton qui nomme une option, jamais
  //     « annuler / brouillon / aperçu » ;
  //   · un champ OBLIGATOIRE resté vide (catégorie, modèle… que VRM ne devine
  //     pas) ⇒ on attend et on le DIT ; le prix affiché doit être celui de VRM ;
  //   · un clic par onglet (`sessionStorage`), noté AVANT de cliquer : une page
  //     rechargée ne republie jamais. Si Vestiaire REFUSE le formulaire (champ en
  //     erreur, bouton toujours là), le clic est rendu et on réessaie quand le
  //     champ est rempli — 3 fois au plus.
  //   · « publiée » n'est noté que sur une CONFIRMATION vue (la page quitte le
  //     formulaire, ou dit « soumis / en cours de vérification ») — jamais deviné.
  const PRIX_ARGENT_VC = /€|\beuros?\b|\beur\b|\d[.,]\d{2}\b|booster|boost|payer|paiement|premium|\bpack\b|mise en avant|mettre en avant|sponsoris|vitrine|spotlight|featur|promot/i;
  const NOM_BOOST_VC = /(boost|promot|featur|spotlight|sponsor|vitrine|mise en avant|mettre en avant|premium|\bpack\b|visibilit|highlight|top.?liste|remont|bump)/i;
  const NOTRE_UI_VC = (el) => !!(el.closest && el.closest('#vrm-vc-b,#vrm-vc-toast,#vrm-badge,[data-vrm]'));
  const attendreVc = (ms) => new Promise((r) => setTimeout(r, ms));
  function libelleDe(el) {
    try {
      let t = (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute('aria-label') || '';
      if (!t) { const l = el.closest('label'); if (l) t = l.innerText || ''; }
      if (!t) { const lb = el.getAttribute('aria-labelledby'); if (lb) t = lb.split(/\s+/).map((id) => { const e = document.getElementById(id); return e ? e.innerText : ''; }).join(' '); }
      if (!t && el.parentElement) t = el.parentElement.innerText || '';
      return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    } catch (_) { return ''; }
  }
  function optionsPayantes() {
    const tous = Array.from(document.querySelectorAll('input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="switch"],[role="radio"],[aria-pressed]')).filter((cb) => {
      if (DANS_ENTETE(cb) || NOTRE_UI_VC(cb)) return false;
      const nom = ((cb.name || cb.getAttribute('name') || '') + ' ' + (cb.id || '') + ' ' + (cb.getAttribute('aria-label') || '')).toLowerCase();
      const lib = libelleDe(cb);
      if (NOM_BOOST_VC.test(nom) || NOM_BOOST_VC.test(lib)) return true;
      // Un choix qui porte un PRIX est payant — sauf « 0 € / gratuit », et sauf
      // un mode de LIVRAISON (on n'y touche jamais : il peut porter un prix).
      if (/livr|exp[ée]di|shipping|delivery|colis/i.test(nom + ' ' + lib)) return false;
      return /€|\beuros?\b/i.test(lib) && !/\b0(?:[.,]00)?\s*€|gratuit|free/i.test(lib);
    });
    return tous.filter((cb) => !(cb.tagName === 'INPUT' && tous.some((o) => o !== cb && o.tagName !== 'INPUT' && o.contains(cb))));
  }
  const estCoche = (cb) => {
    if (cb.tagName === 'INPUT') return !!cb.checked || cb.getAttribute('aria-checked') === 'true';
    if (cb.getAttribute('aria-checked') === 'true' || cb.getAttribute('aria-pressed') === 'true') return true;
    const inp = cb.querySelector && cb.querySelector('input[type="checkbox"],input[type="radio"]');
    return !!(inp && inp.checked);
  };
  // Les champs obligatoires restés vides : VRM ne les devine pas, il les NOMME.
  function obligatoiresVides() {
    const out = [];
    document.querySelectorAll('input,select,textarea,[role="combobox"]').forEach((el) => {
      try {
        if (DANS_ENTETE(el) || NOTRE_UI_VC(el) || el.type === 'hidden' || el.disabled) return;
        const req = el.required || el.getAttribute('aria-required') === 'true';
        if (!req) return;
        if (el.type === 'file') return;   // les photos ont leur propre suivi
        if (el.type === 'checkbox' || el.type === 'radio') return;
        const v = String(el.value || el.getAttribute('data-choisi') || (el.getAttribute('role') === 'combobox' ? (el.getAttribute('aria-valuetext') || '') : '') || '').trim();
        if (!v) out.push((libelleDe(el) || el.name || el.id || 'un champ').slice(0, 40));
      } catch (_) {}
    });
    return out;
  }
  const enErreur = () => Array.from(document.querySelectorAll('[aria-invalid="true"]')).filter((el) => !DANS_ENTETE(el) && !NOTRE_UI_VC(el)).map((el) => (libelleDe(el) || el.name || '').slice(0, 40));
  // Le prix AFFICHÉ doit être celui de VRM (un champ prérempli ailleurs part tel quel sinon).
  function prixRefusVc(ad) {
    const el = champ([/prix|price|montant/]);
    if (!el) return 'je ne vois pas le champ du prix — rien n\'est publié';
    const lu = Number(String(el.value || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
    const voulu = Number(String(ad.price || '').replace(',', '.'));
    if (!isFinite(voulu) || voulu <= 0) return 'le prix de VRM est illisible — rien n\'est publié';
    if (!isFinite(lu) || Math.abs(lu - voulu) > 0.005) return `le prix sur la page (${esc(el.value)}) n'est pas celui de VRM (${voulu} €) — rien n'est publié`;
    return '';
  }
  const PAGE_CONFIRMEE = /merci|f[ée]licitations|a bien [ée]t[ée]|soumis|en cours de (v[ée]rification|validation|mod[ée]ration)|submitted|under review|bient[ôo]t en ligne/i;
  let publication = { etat: '', raison: '', essais: 0, bouton: '', urlClic: '' };
  async function publierSansBooster(ad) {
    if (!ad || ad.publier !== true) return { ok: false, raison: '' };
    const cle = 'vrmVcPublieClique:' + String(ad.id);
    let deja = true;
    try { deja = !!sessionStorage.getItem(cle); } catch (_) { deja = true; }
    if (deja) return { ok: false, raison: 'j\'ai déjà cliqué « Publier » pour cette paire dans cet onglet — je ne reclique jamais (une seconde publication est pire)' };
    const vides = obligatoiresVides();
    if (vides.length) return { ok: false, attente: true, raison: 'il reste à choisir : ' + vides.slice(0, 3).join(', ') + ' — VRM ne le devine pas, choisis-le et je publie' };
    const pk = prixRefusVc(ad); if (pk) return { ok: false, raison: pk };
    for (const cb of optionsPayantes()) {
      if (!estCoche(cb)) continue;
      if (cb.getAttribute('role') === 'radio' || cb.type === 'radio') continue;   // un radio ne se décoche pas
      try { cb.click(); } catch (_) {}
      await attendreVc(120);
    }
    await attendreVc(450);
    if (optionsPayantes().some(estCoche)) return { ok: false, raison: 'une option payante est encore active — rien n\'est publié : publie toi-même, sans booster' };
    await attendreVc(300);
    const opts = optionsPayantes();
    if (opts.some(estCoche)) return { ok: false, raison: 'une option payante est encore active — rien n\'est publié : publie toi-même, sans booster' };
    const PUBLIER = /publier|mettre en vente|mettre en ligne|soumettre|envoyer (?:mon|l['’])\s*article|publish|submit|list (?:my )?item/i;
    const NEG = /annuler|retour|pr[ée]c[ée]dent|revenir|\bback\b|supprim|brouillon|draft|plus tard|aper[çc]u|pr[ée]visualis|ajouter|s[ée]lectionner|choisir|enregistrer/i;
    const lib = (b) => (((b.innerText || b.value || '') + ' ' + (b.getAttribute('aria-label') || '')) || '').replace(/\s+/g, ' ').trim();
    const actif = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !!lib(b);
    // Le bouton est-il celui d'une OPTION (dans sa carte) ? Le plus petit bloc qui
    // le contient et contient une option payante — mais pas le FORMULAIRE entier
    // (un bloc qui porte la description, le prix ou les photos n'est pas une carte).
    const dansCarte = (b) => { let el = b.parentElement; for (let i = 0; el && i < 6; i++, el = el.parentElement) { const n = opts.filter((o) => el.contains(o)).length; if (n > 1) return false; if (n === 1) return !el.querySelector('textarea,input[type="file"]') && !el.matches('form'); } return false; };
    const sur = (b) => actif(b) && !PRIX_ARGENT_VC.test(lib(b)) && !NOM_BOOST_VC.test(lib(b)) && !NEG.test(lib(b)) && !dansCarte(b);
    const btns = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"]')).filter((el) => !DANS_ENTETE(el) && !NOTRE_UI_VC(el));
    const b = btns.find((x) => sur(x) && PUBLIER.test(lib(x)));
    if (!b) return { ok: false, attente: true, raison: 'je ne vois pas encore de bouton de publication gratuite — rien n\'est cliqué' };
    if (optionsPayantes().some(estCoche)) return { ok: false, raison: 'une option payante s\'est activée — rien n\'est publié' };
    publication.urlClic = location.href; publication.bouton = lib(b).slice(0, 40);
    try { sessionStorage.setItem(cle, JSON.stringify({ at: Date.now(), url: publication.urlClic, bouton: publication.bouton })); } catch (_) { return { ok: false, raison: 'je ne peux pas retenir le clic dans cet onglet — rien n\'est publié' }; }
    try { b.click(); } catch (_) {}
    return { ok: true, bouton: publication.bouton, cle };
  }
  // Après le clic : confirmation vue ⇒ notée « publiée » ; formulaire refusé
  // (un champ en erreur, le même bouton toujours là) ⇒ le clic est rendu.
  async function suivreApresClic(ad, cle) {
    for (let i = 0; i < 60; i++) {
      await attendreVc(500);
      const texte = String((document.body && document.body.innerText) || '').slice(0, 20000);
      const quitte = location.href !== publication.urlClic && !formulaireVisible();
      if (quitte || (PAGE_CONFIRMEE.test(texte) && !formulaireVisible())) {
        publication.etat = 'publiee'; publication.raison = '';
        const r = await send({ action: 'publiee', url: location.href });
        if (!(r && r.ok)) publication.raison = 'publiée, mais VRM n\'a pas pu la noter — clique « Déjà publiée » dans VRM';
        return;
      }
      const err = enErreur();
      if (i >= 3 && err.length && formulaireVisible()) {
        try { sessionStorage.removeItem(cle); } catch (_) {}
        publication.etat = 'refusee'; publication.raison = 'Vestiaire demande encore : ' + err.slice(0, 3).join(', ') + ' — complète et je republie';
        return;
      }
    }
    publication.etat = 'pas-su'; publication.raison = 'j\'ai cliqué « ' + publication.bouton + ' » mais je n\'ai vu aucune confirmation — vérifie dans tes articles, je ne reclique pas';
  }
  let _pubEnCours = false;
  async function tenterPublication(ad) {
    if (_pubEnCours || !ad || ad.publier !== true) return;
    if (publication.etat === 'publiee' || publication.etat === 'clic' || publication.etat === 'pas-su' || publication.etat === 'stop') return;
    // Les photos d'abord : sans elles Vestiaire refuse (ou publie sans).
    if (!(photosEtat && photosEtat.n > 0)) { publication.raison = 'j\'attends que les photos soient attachées avant de publier'; return; }
    if (publication.essais >= 3) { publication.etat = 'stop'; publication.raison = 'Vestiaire a refusé 3 fois — publie toi-même, sans booster'; return; }
    _pubEnCours = true;
    try {
      const r = await publierSansBooster(ad);
      if (r.ok) { publication.essais++; publication.etat = 'clic'; publication.raison = ''; bandeau(faits, ad); await suivreApresClic(ad, r.cle); }
      else { publication.raison = r.raison || ''; if (!r.attente && r.raison) publication.etat = 'stop'; }
    } finally { _pubEnCours = false; bandeau(faits, ad); }
  }
  function bandeau(n, ad) {
    let el = document.getElementById('vrm-vc-b');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-vc-b';
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483646;max-width:min(420px,92vw);background:#10141B;color:#E8ECF2;border:1px solid #1E2530;border-radius:12px;padding:11px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.35),0 16px 40px rgba(0,0,0,.36)';
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
      ? `<div style="color:#F5A524;margin-top:6px">Je ne remplis plus tout seul (c'est fini après 10 min). Le dépôt se fait peut-être en plusieurs étapes : à chaque nouvelle étape, clique <b>Re-remplir</b>.</div>`
      : '';
    const pub = ad.publier !== true ? ''
      : publication.etat === 'publiee' ? `<div data-vc-pub="publiee" style="margin-top:6px"><b>✓ Publiée sans booster.</b> ${publication.raison ? esc(publication.raison) : 'VRM l\'a notée publiée.'}</div>`
      : publication.etat === 'clic' ? `<div data-vc-pub="clic" style="margin-top:6px">J'ai cliqué « ${esc(publication.bouton)} » (sans booster) — j'attends la confirmation de Vestiaire…</div>`
      : publication.raison ? `<div data-vc-pub="${esc(publication.etat || 'attente')}" style="color:#F5A524;margin-top:6px">${esc(publication.raison)}</div>`
      : `<div data-vc-pub="attente" style="margin-top:6px">Je publie tout seul, sans booster, dès que tout est rempli.</div>`;
    poserHtml(el, (n > 0
      ? `<b>N°${esc(ad.numero)}</b> — ${n} champ${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''}. ${photos}${ad.publier === true ? '' : ' Relis tout, choisis la catégorie et le modèle, puis publie.'}`
      : (formulaireVisible()
        ? `<b>N°${esc(ad.numero)}</b> — je n'ai reconnu aucun champ sur cette page. ${photos} Copie la description ci-dessous et colle-la.`
        : `<b>N°${esc(ad.numero)}</b> — clique <b>« Vendre un article »</b> sur Vestiaire : je remplis dès que le formulaire s'affiche.`))
      + pub + fini
      + `<div style="display:flex;gap:6px;margin-top:9px">
           <button id="vrm-vc-refill" style="flex:1;border:1px solid #1E2530;background:transparent;color:#E8ECF2;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Re-remplir</button>
           <button id="vrm-vc-cdesc" style="flex:1;border:1px solid #1E2530;background:transparent;color:#E8ECF2;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Copier la description</button>
           <button id="vrm-vc-close" title="Fermer" style="border:1px solid #1E2530;background:transparent;color:#8A93A3;border-radius:9px;padding:7px 9px;font:11.5px system-ui,sans-serif;cursor:pointer">✕</button>
         </div>
         <div style="color:#8A93A3;font-size:10px;margin-top:7px">${ad.publier === true ? 'VRM ne coche jamais d\'option payante (boost, mise en avant) et ne clique jamais un bouton qui porte un prix. La catégorie et le modèle, VRM ne les devine pas.' : 'VRM ne publie pas à ta place ici : relis et clique toi-même. Une fois publiée, note-la « Déjà publiée » dans VRM.'}</div>`);
    el.querySelector('#vrm-vc-refill').onclick = () => { relancer(ad); };
    el.querySelector('#vrm-vc-cdesc').onclick = () => { copyDire(ad.description || '', 'Description'); };
    el.querySelector('#vrm-vc-close').onclick = () => { clearInterval(minuteur); el.remove(); send({ action: 'fini' }); };
  }
  // eBay reconstruit son formulaire au fil des étapes : on réessaie, sans jamais
  // écraser ce qui est déjà saisi. On s'arrête au bout de 90 s — et on le DIT.
  let essais = 0, faits = 0, minuteur = null, arrete = false;
  let photosFaites = false, photosEtat = null;
  function surveiller(ad) {
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      essais++;
      // Les comboboxes React (état/marque/pointure) se remplissent en async ;
      // leur compte s'ajoute à `composFaits`, que `remplir` additionne.
      remplirComposants(ad).then((k) => { if (k) { const nn = remplir(ad); if (nn > faits) { faits = nn; bandeau(faits, ad); } } });
      const n = remplir(ad);
      if (n > faits) { faits = n; bandeau(faits, ad); }
      // Les photos : dès qu'une étape porte un champ fichier, on attache. UNE
      // seule fois — ré-attacher écraserait ce qu'il vient d'ajouter lui-même.
      if (!photosFaites && champsFichier().length) {
        photosFaites = true;
        attacherPhotos(ad).then((r2) => { photosEtat = r2; bandeau(faits, ad); });
      }
      if (formulaireVisible()) { rapporterEtape(); if (essais % 2 === 0) tenterPublication(ad); }
      if (essais > 600) { clearInterval(minuteur); arrete = true; bandeau(faits, ad); }
    }, 1000);
  }
  function relancer(ad) {
    arrete = false; essais = 0;
    _composFaits = new Set(); composFaits = 0;   // « Re-remplir » rouvre les menus
    if (publication.etat === 'stop' || publication.etat === 'refusee') publication = { etat: '', raison: '', essais: 0, bouton: '', urlClic: '' };
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
    // 5.243 : la STRUCTURE du formulaire (noms de champs, libellés et codes des
    // options — jamais une saisie) se relève aussi quand le dépôt est ouvert à
    // la main, sans paire lancée depuis VRM : c'est elle qui permettra de
    // choisir la catégorie tout seul. Rien n'est rempli ni cliqué ici.
    if (!ad) { releverSansDepot(); return; }
    bandeau(0, ad);
    surveiller(ad);
    // Un clic « Publier » déjà fait dans cet onglet (la page a rechargé après) :
    // on ne reclique pas, on regarde si la confirmation est là.
    if (ad.publier === true && publication.etat === '') {
      let note = null; const cle = 'vrmVcPublieClique:' + String(ad.id);
      try { note = JSON.parse(sessionStorage.getItem(cle) || 'null'); } catch (_) { note = null; }
      if (note && note.url) { publication.etat = 'clic'; publication.urlClic = note.url; publication.bouton = String(note.bouton || '').slice(0, 40); bandeau(0, ad); suivreApresClic(ad, cle).then(() => bandeau(faits, ad)); }
    }
  }
  // La STRUCTURE du formulaire me revient — noms de champs, libellés d'options,
  // présence d'un champ fichier ; AUCUN contenu saisi. C'est ce qui permettra de
  // viser juste au lieu de deviner (je n'ai jamais vu ce formulaire : il est
  // derrière la connexion).
  // ⚠️ CHAQUE ÉTAPE DISTINCTE, pas une seule : la mise en vente eBay se fait en
  //    plusieurs écrans, et n'en garder qu'un revient à ne rien savoir des
  //    autres — c'est exactement le défaut corrigé pour `lbc_recon.etapes`.
  let derniereEtape = '';
  // ⚠️⚠️ CE RELEVÉ N'AVAIT APPRIS AUCUNE DES LEÇONS DE LEBONCOIN (1er oct.) :
  //   1. il captait la BARRE DE RECHERCHE (`_nkw`) et les champs cachés comme s'ils
  //      étaient des champs du formulaire — alors que `champ()` les écarte déjà par
  //      `DANS_ENTETE`/`PAS_UN_CHAMP_DE_DEPOT`/hidden. Un relevé pollué me fait
  //      viser un faux champ au prochain passage. On applique les MÊMES gardes.
  //   2. il ne lisait que les `<select>` natifs — or le formulaire de mise en vente
  //      d'eBay (comme Leboncoin) utilise des listes REACT (`role="combobox"` +
  //      `role="option"`), que `document.querySelectorAll('select')` ne voit pas.
  //      C'est « ça ne met pas la catégorie » : la liste existe, on ne la mesurait
  //      pas. On relève son libellé, ses options ET le CODE réel de chaque option
  //      (`value`/`data-value`/`data-qa-id`/id) — jamais une valeur saisie.
  //   3. il ne portait PAS la version de l'extension qui l'a écrit. §8 : sans elle,
  //      une étape manquante me fait DEVINER « défaut ou version trop ancienne ».
  function champDepot(el) {
    try {
      if (el.type === 'hidden' || el.disabled) return false;
      if (DANS_ENTETE(el)) return false;
      const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || '';
      const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '') + ' ' + lab).toLowerCase();
      return !PAS_UN_CHAMP_DE_DEPOT.test(hay);
    } catch (_) { return false; }
  }
  let _releveMinuteur = null;
  function releverSansDepot() {
    if (_releveMinuteur || !/sell|deposit|vendre/i.test(location.pathname)) return;
    let tours = 0;
    _releveMinuteur = setInterval(() => {
      tours += 1;
      try { if (formulaireVisible()) rapporterEtape(); } catch (_) {}
      if (tours > 90) { clearInterval(_releveMinuteur); _releveMinuteur = null; }
    }, 2000);
  }
  function rapporterEtape() {
    try {
      const fields = [];
      document.querySelectorAll('input, select, textarea').forEach((el) => {
        if (!champDepot(el)) return;
        // ⚠️ AUCUNE valeur saisie : on note SI le champ est rempli et sa LONGUEUR
        //    (un booléen, un nombre), jamais le texte — et `multiple`/`accept` d'un
        //    champ photo, qui décide si on pose les photos d'un coup ou une par une.
        const val = (() => { try { return String(el.value || ''); } catch (_) { return ''; } })();
        fields.push({ tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '', id: el.id || '',
          ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '',
          label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 60),
          qa: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '',
          rempli: !!val.trim(), len: val.length,
          multiple: el.type === 'file' ? !!el.multiple : undefined,
          accept: el.type === 'file' ? (el.accept || '') : undefined });
      });
      const selects = [];
      document.querySelectorAll('select').forEach((el) => {
        if (!champDepot(el)) return;
        selects.push({ name: el.name || '', id: el.id || '', forme: 'select',
          label: ((el.labels && el.labels[0] && el.labels[0].innerText) || '').slice(0, 50),
          options: Array.from(el.options || []).slice(0, 25).map((o) => String(o.textContent || '').trim().slice(0, 40)),
          optcodes: Array.from(el.options || []).slice(0, 25).filter((o) => o.value).map((o) => ({ t: String(o.textContent || '').trim().slice(0, 40), v: String(o.value).slice(0, 40) })) });
      });
      // Les listes REACT (combobox/listbox) — invisibles à `querySelectorAll('select')`.
      // ⚠️ Une `listbox` rattachée à un `combobox` par `aria-controls` est le
      //    conteneur d'options de ce combobox, pas une seconde liste : on l'écarte
      //    pour ne pas compter la même liste deux fois.
      const boxesControlees = new Set();
      document.querySelectorAll('[role="combobox"][aria-controls]').forEach((c) => { const id = c.getAttribute('aria-controls'); if (id) boxesControlees.add(id); });
      document.querySelectorAll('[role="combobox"],[role="listbox"]').forEach((el) => {
        if (!champDepot(el)) return;
        if ((el.getAttribute('role') || '') === 'listbox' && el.id && boxesControlees.has(el.id)) return;
        const g = (a) => { try { return el.getAttribute(a) || ''; } catch (_) { return ''; } };
        const lib = (((el.labels && el.labels[0] && el.labels[0].innerText) || '') || g('aria-label') || String(el.textContent || '')).slice(0, 50);
        // Les options d'un combobox ouvert OU rattaché par aria-controls.
        let opts = [];
        try {
          const ctrl = g('aria-controls'); const box = ctrl && document.getElementById(ctrl);
          const scope = box || el.parentElement || document;
          opts = Array.from(scope.querySelectorAll('[role="option"]')).slice(0, 30);
        } catch (_) {}
        selects.push({ name: el.name || '', id: el.id || '', forme: 'composant', role: g('role'), controls: g('aria-controls'),
          label: lib,
          options: opts.map((o) => String(o.textContent || '').trim().slice(0, 40)),
          optcodes: opts.map((o) => ({ t: String(o.textContent || '').trim().slice(0, 40), v: String(o.getAttribute('data-value') || o.getAttribute('value') || o.getAttribute('data-qa-id') || o.id || '').slice(0, 40) })).filter((o) => o.v) });
      });
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled && !DANS_ENTETE(el));
      const fichiers = fileInputs.length;
      const fichiersMultiple = fileInputs.some((el) => el.multiple);
      const signature = fields.map((f) => f.name || f.id).join('|') + '#' + selects.length + '#' + fichiers;
      if (!fields.length && !selects.length && !fichiers) return;
      if (signature === derniereEtape) return;
      derniereEtape = signature;
      send({ action: 'vcForm', url: location.href, fields, selects, fichiers, fichiersMultiple, ver: EXT_VER, etape: signature.slice(0, 120) });
    } catch (_) {}
  }

  auto();
  // eBay est une application à page unique : l'URL change sans rechargement.
  let derniere = location.href;
  setInterval(() => {
    if (location.href === derniere) return;
    derniere = location.href; essais = 0; faits = 0; arrete = false;
    if (!minuteur || arrete) auto();
  }, 1500);
})();
