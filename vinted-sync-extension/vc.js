// vc.js — monde isolé de vestiairecollective.com : le RELAIS.
// Il ne lit rien lui-même : il transmet au fond ce que vc-inject.js a relevé
// (des chemins, des noms de champs et des types — jamais une valeur).
// ⚠️ Un message ne vient que de CETTE page (`event.source === window`) et porte
//    notre étiquette. L'adresse de la page et l'origine sont posées par NOUS,
//    jamais dictées par la page.
(function () {
  'use strict';
  if (window.__vrmVcRelais) return; window.__vrmVcRelais = true;
  // 5.295 : les envois en attente de leur réponse (jeton → réponse au fond).
  const envoisEnAttente = new Map();
  const vivant = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || d.__tag !== 'CANCALE_VC') return;
      if (!vivant()) return;                    // extension rechargée : on se tait
      // 5.236 : tes annonces et leur boost, et l'identifiant d'une annonce créée.
      if (d.kind === 'vcannonces') {
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 200).map((x) => ({
          id: String((x && x.id) || '').slice(0, 40), boost: x && (x.boost === true || x.boost === false) ? x.boost : null,
          cles: (Array.isArray(x && x.cles) ? x.cles : []).slice(0, 6).map((c) => String(c).slice(0, 40)),
          ref: String((x && x.ref) || '').slice(0, 12),
          // 5.295 : combien de personnes l'ont mise en favori (un nombre, jamais qui).
          favoris: x && typeof x.favoris === 'number' && isFinite(x.favoris) && x.favoris >= 0 ? Math.floor(x.favoris) : null,
          cleFavoris: String((x && x.cleFavoris) || '').slice(0, 40) }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcAnnonces', items, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0 }, () => { void chrome.runtime.lastError; });
        return;
      }
      if (d.kind === 'vcventes') {
        const ventes = (Array.isArray(d.ventes) ? d.ventes : []).slice(0, 200).map((x) => ({
          id: String((x && x.id) || '').slice(0, 40), productId: String((x && x.productId) || '').slice(0, 40), ref: String((x && x.ref) || '').slice(0, 12),
          etat: String((x && x.etat) || '').slice(0, 40), date: String((x && x.date) || '').slice(0, 30),
          montant: x && x.montant && isFinite(Number(x.montant.valeur)) ? { valeur: Number(x.montant.valeur), devise: String(x.montant.devise || '').slice(0, 3), cle: String(x.montant.cle || '').slice(0, 60) } : null,
          limite: String((x && x.limite) || '').slice(0, 30), etiquette: x && (x.etiquette === true || x.etiquette === false) ? x.etiquette : null,
          suivi: String((x && x.suivi) || '').slice(0, 40), transporteur: String((x && x.transporteur) || '').slice(0, 30) }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcVentes', source: d.source === 'a-expedier' ? 'a-expedier' : 'ventes', ventes, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 120).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.238 : tes messages Vestiaire — le NOMBRE de non-lus, et des conversations
      // sans aucun texte ni nom (identifiants, référence, non lu, date).
      if (d.kind === 'vccompteur') {
        const n = Number(d.messages);
        if (!isFinite(n) || n < 0) return;
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcCompteur', messages: Math.floor(n) }, () => { void chrome.runtime.lastError; });
        return;
      }
      if (d.kind === 'vcmessages') {
        const conversations = (Array.isArray(d.conversations) ? d.conversations : []).slice(0, 200).map((x) => ({
          id: String((x && x.id) || '').slice(0, 40), productId: String((x && x.productId) || '').slice(0, 40), ref: String((x && x.ref) || '').slice(0, 12),
          nonLu: x && (x.nonLu === true || x.nonLu === false) ? x.nonLu : null, date: String((x && x.date) || '').slice(0, 30),
          // 5.295 : l'aperçu du dernier message (texte borné, jamais un nom).
          apercu: String((x && x.apercu) || '').slice(0, 160), apercuDeMoi: x && (x.apercuDeMoi === true || x.apercuDeMoi === false) ? x.apercuDeMoi : null }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcMessages', moi: /^[\w-]{1,40}$/.test(String(d.moi || '')) ? String(d.moi) : '', conversations, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 120).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.295 : le compte Vestiaire ouvert dans CET onglet (son identifiant seul).
      if (d.kind === 'vcmoi') {
        const id = String(d.id || '');
        if (!/^[\w-]{1,40}$/.test(id)) return;
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcMoi', id, forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 80).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.295 : UN fil de conversation — le texte des messages, leur date, « de toi » ; jamais un nom.
      if (d.kind === 'vcfil') {
        const conv = String(d.conv || '');
        if (!/^[\w-]{3,40}$/.test(conv)) return;
        const messages = (Array.isArray(d.messages) ? d.messages : []).slice(0, 200).map((x) => ({
          id: /^[\w-]{1,40}$/.test(String((x && x.id) || '')) ? String(x.id) : '', t: String((x && x.t) || '').slice(0, 2000),
          deMoi: x && (x.deMoi === true || x.deMoi === false) ? x.deMoi : null, at: String((x && x.at) || '').slice(0, 30) })).filter((x) => x.t);
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcFil', conv, productId: String(d.productId || '').slice(0, 40), ref: String(d.ref || '').slice(0, 12), messages, lus: Number(d.lus) || 0,
          moi: /^[\w-]{1,40}$/.test(String(d.moi || '')) ? String(d.moi) : '', page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 80).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.295 : la RECETTE d'un envoi que TU as fait sur la page (jamais ton texte, jamais une valeur d'en-tête).
      if (d.kind === 'vcenvoiappris') {
        const r = d.recette;
        if (!r || typeof r !== 'object') return;
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcEnvoiAppris', recette: r }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.295 : la réponse de Vestiaire à un envoi demandé par le fond.
      if (d.kind === 'vcenvoiresultat' && typeof d.jeton === 'string') {
        const f = envoisEnAttente.get(d.jeton);
        if (f) { envoisEnAttente.delete(d.jeton); f({ ok: true, statut: Number(d.statut) || 0, cles: (Array.isArray(d.cles) ? d.cles : []).slice(0, 60).map((c) => String(c).slice(0, 120)), idMsg: /^[\w-]{1,40}$/.test(String(d.idMsg || '')) ? String(d.idMsg) : '', erreur: String(d.erreur || '').slice(0, 80) }); }
        return;
      }
      // 5.239 : tes ACHATS Vestiaire — scalaires seulement, jamais le vendeur ni ton adresse.
      if (d.kind === 'vcachats') {
        const achats = (Array.isArray(d.achats) ? d.achats : []).slice(0, 200).map((x) => ({
          id: String((x && x.id) || '').slice(0, 40), productId: String((x && x.productId) || '').slice(0, 40), nom: String((x && x.nom) || '').slice(0, 80),
          etat: String((x && x.etat) || '').slice(0, 40), date: String((x && x.date) || '').slice(0, 30),
          montant: x && x.montant && isFinite(Number(x.montant.valeur)) ? { valeur: Number(x.montant.valeur), devise: String(x.montant.devise || '').slice(0, 3), cle: String(x.montant.cle || '').slice(0, 60) } : null,
          suivi: String((x && x.suivi) || '').slice(0, 40), transporteur: String((x && x.transporteur) || '').slice(0, 30) }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcAchats', achats, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 120).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
        return;
      }
      // 5.243 : le catalogue du dépôt (libellés publics du site, jamais une personne).
      if (d.kind === 'vccatalogue') {
        const chemin = String(d.chemin || '');
        if (!/^\/[a-z0-9/_-]*deposit\/(catalog|brands)/i.test(chemin)) return;
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcCatalogue', chemin: chemin.slice(0, 160), body: String(d.body || '').slice(0, 3000000), coupe: !!d.coupe }, () => { void chrome.runtime.lastError; });
        return;
      }
      if (d.kind === 'vcpublie') {
        chrome.runtime.sendMessage({ from: 'cancale-vcdepot', action: 'vcPublie', productId: String(d.productId || '').slice(0, 40) }, () => { void chrome.runtime.lastError; });
        return;
      }
      if (d.kind !== 'vcrecon') return;
      const borne = (a, n) => (Array.isArray(a) ? a.slice(0, n).map((x) => String(x).slice(0, 200)) : []);
      chrome.runtime.sendMessage({
        from: 'cancale-vc', action: 'vcRecon',
        patch: {
          chemins: borne(d.chemins, 300), pages: borne(d.pages, 60),
          hotes: (d.hotes && typeof d.hotes === 'object') ? Object.fromEntries(Object.entries(d.hotes).slice(0, 40).map(([h, n]) => [String(h).slice(0, 80), Number(n) || 0])) : {},
          schemas: (d.schemas && typeof d.schemas === 'object') ? Object.fromEntries(Object.entries(d.schemas).slice(0, 60).map(([e, c]) => [String(e).slice(0, 200), borne(c, 200)])) : {},
          nextData: !!d.nextData, nextFlux: !!d.nextFlux,
        },
      }, () => { void chrome.runtime.lastError; });
    } catch (_) {}
  });
  // ── RÉPONDRE, SUR SON CLIC (31 octobre, 5.295) ─────────────────────────────
  // L'ordre ne vient QUE du fond de l'extension (jamais de la page), et ne vaut
  // que pour le cadre principal. Il passe au capteur (monde MAIN, vc-inject.js),
  // qui seul tient les en-têtes que la page vient d'envoyer. Pas de réponse en
  // 20 s ⇒ « muet » : le fond dit qu'il ne SAIT PAS (jamais « fait »).
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.from !== 'vrm-fond' || msg.action !== 'vcRepondre') return;
      if (!sender || sender.id !== chrome.runtime.id || window.top !== window) return;
      const conv = String(msg.conv || ''), texte = typeof msg.texte === 'string' ? msg.texte : '';
      if (!/^[\w-]{3,40}$/.test(conv) || !texte.trim() || texte.length > 2000) { sendResponse({ ok: false, code: 'invalide' }); return; }
      const jeton = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
      const t = setTimeout(() => { if (envoisEnAttente.delete(jeton)) sendResponse({ ok: false, code: 'muet' }); }, 20000);
      envoisEnAttente.set(jeton, (r) => { clearTimeout(t); sendResponse(r); });
      window.postMessage({ __tag: 'CANCALE_VC_ORDRE', kind: 'repondre', jeton, conv, texte, recette: msg.recette }, '*');
      return true;
    });
  } catch (_) {}
})();
