// Résumé de structure uniquement : ni corps des annonces, ni URL de photo,
// ni identifiant de compte, ni requête vers Leboncoin.
export function resumeReceptionLbc({ annonces, comptes, traces, transactions=[] }) {
  if (![annonces, comptes, traces, transactions].every(Array.isArray)) return 'Lecture du diagnostic impossible. Réessaie : aucun résultat vide ne peut être déduit de cet échec.';
  const items = Object.values(annonces[0]?.items || {}).filter(x => x && typeof x === 'object');
  const accounts = comptes[0]?.accounts || {};
  const confirmes = new Set(Object.entries(accounts).filter(([,a]) => a?.sessionAt).map(([id,a]) => String(a.id || id)));
  const attribuees = items.filter(a => a.account && confirmes.has(String(a.account)));
  const photos = a => Array.isArray(a.images) && a.images.some(p => typeof p === 'string' && /^https:\/\//.test(p));
  const ventes=Object.values(transactions[0]?.ventes||{}).filter(v=>v&&typeof v==='object');
  const date=Math.max(0,...ventes.map(v=>Date.parse(v.at||'')||0));
  const horodatage = v => Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : 'aucune date disponible';
  const identite = Math.max(0,...Object.values(accounts).map(a=>Date.parse(a?.sessionAt||'')||0));
  const tokens = new Set('api adfinder myads ads classifieds analysis list account stats proxy consumergoods pages transactions transaction orders own_orders pro-order-proxy purchases purchase delivery-configurator-api configs _next data compte part pro mes-transactions mes-annonces json fr'.split(' '));
  const route = brut => {
    const m=String(brut).match(/(?:https?:\/\/)?([a-z0-9.-]*leboncoin\.fr)(\/[^\s?]*)/i);
    if(!m)return null;
    const path=m[2].split('/').map(x=>{if(!x)return '';const ext=x.endsWith('.json')?'.json':'';const k=ext?x.slice(0,-5):x;return (tokens.has(k)||/^v\d+$/.test(k)?k:/^\d+$/.test(k)?'{id}':'?')+ext;}).join('/');
    const statut=/→\s*(\d{3})/.exec(String(brut))?.[1];
    return path+(statut?' → HTTP '+statut:'');
  };
  const chemins=(Array.isArray(traces[0]?.paths)?traces[0].paths:[]).filter(p=>/adfinder|classifieds|transaction|own_orders|purchases|mes-annonces/i.test(String(p))).slice(-12).map(route).filter(Boolean);
  const schemas = traces[0]?.schemas || {};
  const listes = Object.entries(schemas).filter(([e]) => /adfinder|classifieds|transaction|own_orders|purchases|mes-annonces/i.test(e)).slice(-4);
  const mots = new Set('ads Ads data items results list classifieds announcements Info Id list_id ad_id id subject title price price_cents list_price owner user_id store_id account_id images urls urls_large thumb_urls urls_thumb image_urls ImageSmall url large thumbnail pageProps props transactions purchase_id is_seller item prices final step parcel last_event_status Status status string number boolean object array null'.split(' '));
  const forme = s => String(s).slice(0,200).replace(/[A-Za-z0-9_-]+/g,m => mots.has(m) ? m : '?').replace(/[^A-Za-z0-9_?.:\[\] -]/g,'?');
  return [
    'Diagnostic réception Leboncoin',
    `Comptes avec session enregistrée : ${confirmes.size}`,
    `Dernière identité enregistrée : ${identite?new Date(identite).toISOString():'aucune date disponible'}`,
    `Dernière mise à jour des traces techniques : ${horodatage(traces[0]?.updatedAt)}`,
    `Transactions enregistrées : ${ventes.length} ; ventes confirmées : ${ventes.filter(v=>v.isSeller===true).length} ; achats confirmés : ${ventes.filter(v=>v.isSeller===false).length}`,
    `Dernier enregistrement de transaction : ${date?new Date(date).toISOString():'aucune date disponible'}`,
    `Annonces enregistrées : ${items.length} ; attribuées à une session connue : ${attribuees.length} ; avec photo : ${attribuees.filter(photos).length}`,
    listes.some(([e])=>/myads|classifieds\/analysis\/list/i.test(e)) ? 'Liste privée observée : oui' : 'Liste privée observée : aucune trace disponible (ne prouve pas que le compte est vide)',
    'Historique des réponses observées (pas une preuve de capture récente) :',
    ...(chemins.length?chemins:['aucun chemin de liste ou de transaction enregistré']),
    ...listes.map(([ep,s]) => {
      const nom = route(ep) || 'structure technique';
      const at = Number.isFinite(Date.parse(s?.at)) ? new Date(s.at).toISOString() : 'date inconnue';
      const cles = Array.isArray(s?.cles) ? s.cles.filter(c => /\b(ads|Ads|images|ImageSmall|subject|title|price|transactions|is_seller|prices|step)\b/.test(String(c))).slice(0,35).map(forme) : [];
      return `${nom} · ${at}\nStructure : ${cles.join(', ') || 'champs attendus non relevés'}`;
    }),
  ].join('\n');
}
