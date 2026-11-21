// ════════════════════════════════════════════════════════════════════════════
//  LA FAUSSE PAGE vinted.fr DES AUDITS (21 nov., ext. 5.414 — `toutinterface`)
//
//  Depuis la 5.414, le service worker n'envoie plus AUCUNE écriture à Vinted : il injecte
//  `vrm-formulaire.js` dans l'onglet de travail et lui demande UNE étape (clic, saisie). C'est la
//  PAGE de Vinted qui envoie alors SA requête. Dans un `vm`, il n'y a pas de page : cette fausse page
//  répond aux étapes comme la vraie le ferait (elle vérifie l'adresse montrée — la bonne conversation,
//  la bonne annonce —, puis envoie la requête que la page enverrait, ORIGINE « page »), pour que les
//  audits d'avant gardent leurs juges (ordre, corps, refus, plafonds) sur ce que la page envoie.
//  ⚠️ Elle ne prouve RIEN des sélecteurs de la vraie page : c'est le rôle du banc Playwright
//  `scripts/bancs/interface-vinted.cjs` (le VRAI vrm-formulaire.js sur une page de banc).
//  `ctx.__vrmPage` (réglable par l'audit) : { vu:false } (message/offre pas apparu), { manque:'nom',
//  manqueEtape } (élément introuvable), { captcha:true }, { favoriConv: id } (conversation déjà là).
//  `fetchPage(chemin, opts)` : la requête de la page (par défaut `ctx.fetch` avec un chemin relatif).
// ════════════════════════════════════════════════════════════════════════════
function fabriquerFaussePage({ ctx, j, tab, fetchPage }) {
  const envoyerPage = fetchPage || ((p, o) => ctx.fetch(p, o));
  const st = ctx.__vrmPageEtat = ctx.__vrmPageEtat || { champs: {} };
  const emule = async (etape, d0) => {
    const d = d0 || {}, opt = ctx.__vrmPage || {};
    const chemin = (() => { try { return new URL(tab.url).pathname; } catch (_) { return '/'; } })();
    (j.etapesPage = j.etapesPage || []).push({ etape, quoi: d.quoi, chemin });
    if (opt.captcha) return { ok: false, code: 'captcha', chemin };
    if (opt.manque && (opt.manqueEtape ? opt.manqueEtape === etape : true)) return { ok: false, code: 'selecteur', manque: opt.manque, chemin };
    const envoi = async (m, p, corps) => {
      const r = await envoyerPage(p, { method: m, credentials: 'include', headers: { 'content-type': 'application/json' }, body: corps == null ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
      let json = null; try { json = await r.json(); } catch (_) { json = null; }
      return { status: r.status, ok: r.status >= 200 && r.status < 300, json, corps: corps == null ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), chemin: p };
    };
    const id = (v) => /^[1-9]\d{0,19}$/.test(String(v || ''));
    switch (etape) {
      case 'etat': return { ok: true, chemin };
      case 'ouvrirVente': case 'formulairePret': st.champs = {}; st.photos = []; return { ok: true, chemin };
      case 'ouvrir': return new RegExp(String(d.chemin || '^/')).test(chemin) ? { ok: true, chemin } : { ok: false, code: 'identite', chemin };
      case 'photos': { const n = (d.photos || []).length; if (!n) return { ok: false, code: 'photos-absentes' }; st.photos = []; st.temp = st.temp || 'temp-page-banc'; for (let i = 0; i < n; i++) { const r = await envoi('POST', '/api/v2/photos', { nom: d.photos[i].nom }); if (!r.ok) return { ok: false, code: 'refus', status: r.status, json: r.json }; const pid = r.json && (r.json.id != null ? r.json.id : r.json.photo && r.json.photo.id); if (pid != null) st.photos.push(pid); } return { ok: true, n }; }
      case 'champ': st.champs[d.quoi] = d; return { ok: true };
      case 'brouillon': { const s = st.champs; const attrs = []; if (s.etat) attrs.push({ code: 'condition', ids: [s.etat.id] }); if (s.taille) attrs.push({ code: 'size', ids: [s.taille.id] }); const draft = { id: null, title: s.titre && s.titre.valeur, description: s.description && s.description.valeur, price: s.prix && String(s.prix.valeur), catalog_id: s.categorie ? s.categorie.id : null, brand_id: s.marque ? s.marque.id : null, brand: s.marque ? (s.marque.nom || null) : null, color_ids: s.couleurs ? s.couleurs.ids : [], package_size_id: s.colis ? s.colis.id : null, item_attributes: attrs, temp_uuid: st.temp || 'temp-page-banc', assigned_photos: (st.photos || []).map((id) => ({ id, orientation: 0 })) }; return { ok: true, rep: await envoi('POST', '/api/v2/item_upload/drafts', { draft, feedback_id: null, parcel: null, upload_session_id: st.temp || 'temp-page-banc' }) }; }
      case 'supprimer': if (!new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('POST', `/api/v2/items/${d.id}/delete`, null) };
      case 'publier': return { ok: true, rep: await envoi('POST', `/api/v2/item_upload/drafts/${d.draftId}/completion`, { draft: { id: Number(d.draftId) } }) };
      case 'favoriOuvrir': {
        if (!id(d.itemId) || !id(d.receiverId)) return { ok: false, code: 'etape' };
        if (opt.favoriConv) { tab.url = `https://www.vinted.fr/inbox/${opt.favoriConv}`; return { ok: true, rep: null, conv: String(opt.favoriConv), envoye: false }; }
        const rep = await envoi('POST', '/api/v2/conversations', { initiator: 'seller_enters_notification', item_id: String(d.itemId), opposite_user_id: String(d.receiverId) });
        const conv = rep && rep.json && rep.json.conversation && id(rep.json.conversation.id) ? String(rep.json.conversation.id) : '';
        if (conv) tab.url = `https://www.vinted.fr/inbox/${conv}`;
        return { ok: true, rep, conv, envoye: true };
      }
      case 'message': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const rep = await envoi('POST', `/api/v2/conversations/${d.conv}/replies`, { reply: { body: String(d.texte), photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } }); return { ok: true, rep, vu: rep.ok && opt.vu !== false }; }
      case 'offre': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const p = Number(d.prix); const rep = await envoi('POST', `/api/v2/transactions/${d.tx}/offers`, { offer: { currency: 'EUR', price: Math.round(p * 100) % 100 ? p.toFixed(2) : String(Math.round(p)) } }); return { ok: true, rep, vu: rep.ok && opt.vu !== false && opt.offreVue !== false }; }
      case 'repondreOffre': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const rep = await envoi('PUT', `/api/v2/transactions/${d.tx}/offer_requests/${d.oid}/${d.accepter ? 'accept' : 'reject'}`, null); return { ok: true, rep, vu: true, autre: false }; }
      case 'masquer': if (!new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('PUT', `/api/v2/items/${d.id}/is_hidden`, { is_hidden: !!d.voulu }), vu: true };
      case 'prix': if (!new RegExp(`^/items/${d.id}/edit/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('PUT', `/api/v2/item_upload/items/${d.id}`, d.corpsPage && (typeof d.corpsPage === 'object' || typeof d.corpsPage === 'string') ? d.corpsPage : { item: { id: Number(d.id), price: String(d.prix), ...(d.titre ? { title: String(d.titre) } : {}) } }) };   // `corpsPage` : ce que la VRAIE page « Modifier » enverrait (l'annonce entière, le prix changé)
      // 5.414 : la grille des tailles, LUE par la page « Vendre » (la catégorie choisie : la page demande ses attributs).
      case 'grille': return { ok: true, rep: await envoi('POST', '/api/v2/item_upload/attributes', { attributes: [{ code: 'category', value: [Number(d.id)] }] }) };
      // 5.414 : le bordereau et l'évaluation — la fausse page envoie le corps que la vraie enverrait (adresse du compte, dépôt choisi).
      case 'bordereau': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('PUT', `/api/v2/transactions/${d.tx}/shipment/order`, { seller_address_id: d.adresse == null ? null : d.adresse, drop_off_type: d.depot || null, label_type: null }) };
      case 'evaluation': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi(String(d.methode || 'POST'), String(d.chemin), d.corps) };
      case 'reponse': return { ok: false, code: 'sans-reponse' };
      default: return { ok: false, code: 'etape' };
    }
  };
  return emule;
}
// Pour un audit à banc PROPRE (son propre `vm`) : l'onglet de travail et la page, branchés sur SON ctx.
//  · `chrome.tabs` : query / get / create / update à état (un onglet vinted.fr par défaut) ;
//  · `chrome.scripting.executeScript` : un fichier `vrm-formulaire.js` ⇒ la fausse page ; une fonction ⇒ jouée
//    (comme avant, par l'exécuteur d'origine s'il y en a un) ;
//  · `fetchPage(chemin, opts)` : où vont les requêtes de la page (le faux Vinted de l'audit).
function brancherPageVinted(ctx, { onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete', active: true, windowId: 1 }], fetchPage, j = {} } = {}) {
  const copie = (x) => JSON.parse(JSON.stringify(x));
  const ch = ctx.chrome = ctx.chrome || {};
  const tabs = ch.tabs = ch.tabs || {};
  const avant = { query: tabs.query, exec: ch.scripting && ch.scripting.executeScript };
  tabs.query = async () => onglets.map(copie);
  tabs.get = async (id) => { const t = onglets.find((o) => o && o.id === id); if (!t) throw new Error('No tab with id: ' + id); return copie(t); };
  tabs.create = async (o = {}) => { const t = { id: 100 + onglets.length, url: String(o.url || 'https://www.vinted.fr/'), status: 'complete', active: o.active !== false, windowId: 1 }; onglets.push(t); return copie(t); };
  tabs.update = async (id, o = {}) => { const t = onglets.find((x) => x && x.id === id); if (!t) throw new Error('No tab with id: ' + id); if (o.url) t.url = String(o.url); return copie(t); };
  if (!tabs.onUpdated) tabs.onUpdated = { addListener() {} };
  if (!tabs.onRemoved) tabs.onRemoved = { addListener() {} };
  ch.scripting = ch.scripting || {};
  ch.scripting.executeScript = async (x = {}) => {
    const { target, func, args, files } = x;
    const t = onglets.find((o) => o && target && o.id === target.tabId) || onglets[0];
    if (Array.isArray(files)) {
      if (files.includes('vrm-formulaire.js') && (!ctx.__vrmFormulaire || ctx.__vrmFormulaire.__emule)) { const e = fabriquerFaussePage({ ctx, j, tab: t, fetchPage }); e.__emule = true; ctx.__vrmFormulaire = e; }
      return [{ result: undefined }];
    }
    if (typeof func === 'function' && /__vrmFormulaire/.test(String(func))) return [{ result: await func(...(args || [])) }];
    if (typeof avant.exec === 'function') return avant.exec(x);
    try { ctx.location = new URL((t && t.url) || 'https://www.vinted.fr/'); } catch (_) {}
    return [{ result: typeof func === 'function' ? await func(...(args || [])) : undefined }];
  };
  return { onglets, j };
}
module.exports = { fabriquerFaussePage, brancherPageVinted };
