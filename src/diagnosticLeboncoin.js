// Résumé de structure uniquement : ni corps des annonces, ni URL de photo,
// ni identifiant de compte, ni requête vers Leboncoin.
export function resumeReceptionLbc({ annonces, comptes, traces }) {
  if (![annonces, comptes, traces].every(Array.isArray)) return 'Lecture du diagnostic impossible. Réessaie : aucun résultat vide ne peut être déduit de cet échec.';
  const items = Object.values(annonces[0]?.items || {}).filter(x => x && typeof x === 'object');
  const accounts = comptes[0]?.accounts || {};
  const confirmes = new Set(Object.entries(accounts).filter(([,a]) => a?.sessionAt).map(([id,a]) => String(a.id || id)));
  const attribuees = items.filter(a => a.account && confirmes.has(String(a.account)));
  const photos = a => Array.isArray(a.images) && a.images.some(p => typeof p === 'string' && /^https:\/\//.test(p));
  const schemas = traces[0]?.schemas || {};
  const listes = Object.entries(schemas).filter(([e]) => /\/adfinder\/v\d+\/myads(?:\/|$)|\/classifieds\/analysis\/list(?:\/|$)/i.test(e)).slice(-4);
  const mots = new Set('ads Ads data items results list classifieds announcements Info Id list_id ad_id id subject title price price_cents list_price owner user_id store_id account_id images urls urls_large thumb_urls urls_thumb image_urls ImageSmall url large thumbnail Status status string number boolean object array null'.split(' '));
  const forme = s => String(s).slice(0,200).replace(/[A-Za-z0-9_-]+/g,m => mots.has(m) ? m : '?').replace(/[^A-Za-z0-9_?.:\[\] -]/g,'?');
  return [
    'Diagnostic réception Leboncoin',
    `Comptes avec session enregistrée : ${confirmes.size}`,
    `Annonces enregistrées : ${items.length} ; attribuées à une session connue : ${attribuees.length} ; avec photo : ${attribuees.filter(photos).length}`,
    listes.length ? 'Liste privée observée : oui' : 'Liste privée observée : aucune trace disponible (ne prouve pas que le compte est vide)',
    ...listes.map(([ep,s]) => {
      const nom = /myads/i.test(ep) ? 'myads' : 'liste professionnelle';
      const at = Number.isFinite(Date.parse(s?.at)) ? new Date(s.at).toISOString() : 'date inconnue';
      const cles = Array.isArray(s?.cles) ? s.cles.filter(c => /\b(ads|Ads|images|ImageSmall|subject|title|price)\b/.test(String(c))).slice(0,35).map(forme) : [];
      return `${nom} · ${at}\nStructure : ${cles.join(', ') || 'champs attendus non relevés'}`;
    }),
  ].join('\n');
}
