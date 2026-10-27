// vc.js — monde isolé de vestiairecollective.com : le RELAIS.
// Il ne lit rien lui-même : il transmet au fond ce que vc-inject.js a relevé
// (des chemins, des noms de champs et des types — jamais une valeur).
// ⚠️ Un message ne vient que de CETTE page (`event.source === window`) et porte
//    notre étiquette. L'adresse de la page et l'origine sont posées par NOUS,
//    jamais dictées par la page.
(function () {
  'use strict';
  if (window.__vrmVcRelais) return; window.__vrmVcRelais = true;
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
          ref: String((x && x.ref) || '').slice(0, 12) }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcAnnonces', items, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0 }, () => { void chrome.runtime.lastError; });
        return;
      }
      if (d.kind === 'vcventes') {
        const ventes = (Array.isArray(d.ventes) ? d.ventes : []).slice(0, 200).map((x) => ({
          id: String((x && x.id) || '').slice(0, 40), productId: String((x && x.productId) || '').slice(0, 40), ref: String((x && x.ref) || '').slice(0, 12),
          etat: String((x && x.etat) || '').slice(0, 40), date: String((x && x.date) || '').slice(0, 30),
          montant: x && x.montant && isFinite(Number(x.montant.valeur)) ? { valeur: Number(x.montant.valeur), devise: String(x.montant.devise || '').slice(0, 3), cle: String(x.montant.cle || '').slice(0, 60) } : null }));
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
          nonLu: x && (x.nonLu === true || x.nonLu === false) ? x.nonLu : null, date: String((x && x.date) || '').slice(0, 30) }));
        chrome.runtime.sendMessage({ from: 'cancale-vc', action: 'vcMessages', conversations, offset: Number(d.offset) || 0, total: typeof d.total === 'number' ? d.total : null, lus: Number(d.lus) || 0, page: String(d.page || '').slice(0, 160), forme: (Array.isArray(d.forme) ? d.forme : []).slice(0, 120).map((c) => String(c).slice(0, 120)) }, () => { void chrome.runtime.lastError; });
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
})();
