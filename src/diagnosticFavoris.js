// Préparer le raccordement des favoris à leurs conversations sans supposer
// la forme du flux Vinted et sans exporter son contenu privé.
const CHAMPS = new Set(('payload data notifications notification items item user actor sender recipient from_user entity target link url action type event id user_id item_id conversation_id transaction_id entry_id body title message text created_at updated_at created_at_ts pagination page total_pages current_page next_page count code status attributes parameters content path href button buttons actions target_url read is_read details icon image entity_type subject params web_url entities context meta event_type notification_type').split(' '));

export function structureNotifications(payload) {
  const champs = new Map();
  const vus = new WeakSet();
  let visites = 0, limite = false;
  const parcourir = (v, chemin, profondeur) => {
    if (++visites > 500 || profondeur > 7) { limite = true; return; }
    const type = v === null ? 'null' : Array.isArray(v) ? 'liste' : typeof v;
    if (!champs.has(chemin)) champs.set(chemin, new Set());
    champs.get(chemin).add(type);
    if (!v || typeof v !== 'object' || vus.has(v)) return;
    vus.add(v);
    if (Array.isArray(v)) {
      if (v.length > 3) limite = true;
      for (const x of v.slice(0, 3)) parcourir(x, `${chemin}[]`, profondeur + 1);
    } else {
      const cles = Object.keys(v);
      if (cles.length > 60) limite = true;
      for (const k of cles.slice(0, 60)) {
        const nom = CHAMPS.has(k) ? k : 'champ_non_standard';
        parcourir(v[k], `${chemin}.${nom}`, profondeur + 1);
      }
    }
  };
  parcourir(payload, 'reponse', 0);
  return { champs: [...champs].map(([chemin, types]) => ({ chemin, types: [...types].sort() })), echantillonLimite: limite };
}

export async function lireDiagnosticFavoris({uid, owner, ownerActuel, base, headers, fetcher = fetch}) {
  if (!/^\d{1,20}$/.test(String(uid || '')) || !owner || ownerActuel() !== owner) throw Error('Sélectionne un compte Vinted dans ta session VRM.');
  const r = await fetcher(`${base}/rest/v1/app_data?id=eq.harvest_${uid}_notifications&owner=eq.${encodeURIComponent(owner)}&select=owner,data`, {headers, cache: 'no-store'});
  if (!r.ok) throw Error('Les notifications captées n’ont pas pu être lues. Réessaie.');
  const rows = await r.json();
  if (ownerActuel() !== owner) throw Error('La session a changé. Relance la vérification.');
  if (!Array.isArray(rows) || rows.length > 1 || rows.some(x => x?.owner !== owner)) throw Error('La lecture du compte n’a pas été confirmée.');
  const entete = {diagnostic: 'VRM-favoris-structure-v1', envoisAutomatiques: 'non_actives', listeComplete: 'non_verifiee'};
  if (!rows.length) return {...entete, reception: 'aucune_capture'};
  const d = rows[0].data;
  if (!d || d.type !== 'notifications' || String(d.uid) !== String(uid) || !d.payload || typeof d.payload !== 'object') throw Error('La capture ne confirme pas le compte et le type attendus.');
  return {...entete, reception: 'capture_disponible', ...structureNotifications(d.payload)};
}
