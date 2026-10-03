// ebay.js — sur ebay.fr, dans TON navigateur. Plus aucun panneau (5.130).
//
// Julien, 2 octobre : « tout doit être centralisé dans VRM ». La liste des
// paires à mettre en vente vit dans l'APP ; quand il y clique « Préparer sur
// eBay », l'extension ouvre la mise en vente et ce fichier remplit les champs
// qu'il RECONNAÎT, attache les photos (rien ne touche son disque) et relève la
// structure de chaque étape (noms de champs, jamais un contenu saisi). Le
// bandeau en bas à gauche dit le CHIFFRE de ce qui est rempli.
//
// ⚠️ eBay ne publie RIEN tout seul : c'est lui qui relit et met en vente.
// ⚠️ AUCUNE CATÉGORIE N'EST DEVINÉE : eBay la propose à partir du titre, et une
//    catégorie fausse fait plus de mal que pas de catégorie du tout.
(function () {
  if (window.__vrmEbayLoaded) return; window.__vrmEbayLoaded = true;
  // §8 : chaque relevé porte la VERSION de l'extension qui l'a écrit, sinon une
  // étape manquante me fait deviner « défaut ou version trop ancienne ».
  const EXT_VER = (() => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } })();
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


  function toast(msg) {
    let el = document.getElementById('vrm-ebay-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-ebay-toast';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:2147483647;background:#10141B;color:#E8ECF2;border:1px solid #1E2530;font:600 13px/1.4 system-ui,sans-serif;padding:11px 16px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.35),0 12px 30px rgba(0,0,0,.3);max-width:min(420px,92vw)';
      document.documentElement.appendChild(el);
    }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el.__t); el.__t = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));




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
    } catch (_) {}
    _composEnCours = false; composFaits += k; return k;
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
    //    Les `<select>` natifs d'abord ; les comboboxes React suivent
    //    (`remplirComposants`, async, appelé par le minuteur).
    if (choisirListe([/[ée]tat|condition/], ['Très bon état', 'Bon état', 'Occasion', 'Used'])) n++;
    if (choisirListe([/marque|brand/], [ad.marque])) n++;
    if (choisirListe([/pointure|taille|\bsize\b/], [ad.taille])) n++;
    return n + composFaits;
  }
  function bandeau(n, ad) {
    let el = document.getElementById('vrm-ebay-b');
    if (!el) {
      el = document.createElement('div'); el.id = 'vrm-ebay-b';
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
      ? `<div style="color:#F5A524;margin-top:6px">Je ne remplis plus tout seul (c'est fini après 1 min 30). La mise en vente se fait en plusieurs étapes : à chaque nouvelle étape, clique <b>Re-remplir</b>.</div>`
      : '';
    el.innerHTML = (n > 0
      ? `<b>N°${esc(ad.numero)}</b> — ${n} champ${n > 1 ? 's' : ''} rempli${n > 1 ? 's' : ''}. ${photos} Relis tout, choisis la catégorie proposée par eBay, puis publie.`
      : `<b>N°${esc(ad.numero)}</b> — je n'ai reconnu aucun champ sur cette page. ${photos} Le texte complet est dans ton presse-papier, colle-le.`)
      + fini
      + `<div style="display:flex;gap:6px;margin-top:9px">
           <button id="vrm-eb-refill" style="flex:1;border:1px solid #1E2530;background:transparent;color:#E8ECF2;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Re-remplir</button>
           <button id="vrm-eb-cdesc" style="flex:1;border:1px solid #1E2530;background:transparent;color:#E8ECF2;border-radius:9px;padding:7px;font:600 11.5px system-ui,sans-serif;cursor:pointer">Copier la description</button>
           <button id="vrm-eb-close" title="Fermer" style="border:1px solid #1E2530;background:transparent;color:#8A93A3;border-radius:9px;padding:7px 9px;font:11.5px system-ui,sans-serif;cursor:pointer">✕</button>
         </div>
         <div style="color:#8A93A3;font-size:10px;margin-top:7px">VRM ne met jamais en vente à ta place : relis et clique toi-même.</div>`;
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
      if (essais > 90) { clearInterval(minuteur); arrete = true; bandeau(faits, ad); }
    }, 1000);
  }
  function relancer(ad) {
    arrete = false; essais = 0;
    _composFaits = new Set(); composFaits = 0;   // « Re-remplir » rouvre les menus
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
      send({ action: 'ebayForm', url: location.href, fields, selects, fichiers, fichiersMultiple, ver: EXT_VER, etape: signature.slice(0, 120) });
    } catch (_) {}
  }

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
