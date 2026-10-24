import {formesLiensNotifications} from './favorisVinted.js';
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

export function tracesNotifications(data) {
  const familles = new Map();
  const famille = chemin => {
    if (typeof chemin !== 'string' || chemin.length > 400) return null;
    const p = chemin.split(/[?#]/)[0];
    if (/^\/api\/v\d+\/(?:user_)?notifications\/?$/i.test(p)) return 'liste_api';
    if (/^\/inbox-notifications\/v\d+\/notifications\/?$/i.test(p)) return 'liste_inbox';
    if (/^\/(?:api\/v\d+\/(?:user_)?notifications|inbox-notifications\/v\d+\/notifications)\/unread_count\/?$/i.test(p)) return 'compteur_seulement';
    return null;
  };
  for (const path of (Array.isArray(data?.paths) ? data.paths : []).slice(0,600)) {
    const f = famille(path); if (f) familles.set(f,{flux:f,statut:null});
  }
  for (const [cle, valeur] of Object.entries(data?.reponses || {}).slice(0,400)) {
    const m = /^GET (\/.+)$/.exec(cle), f = m && famille(m[1]);
    if (!f || !Number.isInteger(valeur?.st) || valeur.st < 100 || valeur.st > 599) continue;
    const precedent = familles.get(f);
    if (precedent?.statut != null && precedent.statut !== valeur.st) familles.set(`${f}_${valeur.st}`,{flux:f,statut:valeur.st});
    else familles.set(f,{flux:f,statut:valeur.st});
  }
  return {etat:'lues',versionExtension:/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(data?.ver || '')?data.ver:'non_identifiee',observations:[...familles.values()].slice(0,20)};
}

export async function lireDiagnosticFavoris({uid, owner, ownerActuel, base, headers, fetcher = fetch}) {
  if (!/^\d{1,20}$/.test(String(uid || '')) || !owner || ownerActuel() !== owner) throw Error('Sélectionne un compte Vinted dans ta session VRM.');
  const r = await fetcher(`${base}/rest/v1/app_data?id=eq.harvest_${uid}_notifications&owner=eq.${encodeURIComponent(owner)}&select=owner,data`, {headers, cache: 'no-store'});
  if (!r.ok) throw Error('Les notifications captées n’ont pas pu être lues. Réessaie.');
  const rows = await r.json();
  if (ownerActuel() !== owner) throw Error('La session a changé. Relance la vérification.');
  if (!Array.isArray(rows) || rows.length > 1 || rows.some(x => x?.owner !== owner)) throw Error('La lecture du compte n’a pas été confirmée.');
  const entete = {diagnostic: 'VRM-favoris-structure-v3', envoisAutomatiques: 'non_actives', listeComplete: 'non_verifiee'};
  if (!rows.length) {
    let traces = {etat:'lecture_indisponible'};
    let reponse;
    try { reponse=await fetcher(`${base}/rest/v1/app_data?id=eq.harvest_${uid}_seen_urls&owner=eq.${encodeURIComponent(owner)}&select=owner,data`,{headers,cache:'no-store'}); }
    catch (_) { /* pas de trace plutôt qu'une fausse absence de requêtes */ }
    if (ownerActuel() !== owner) throw Error('La session a changé. Relance la vérification.');
    if (reponse?.ok) {
      let lignes;
      try { lignes=await reponse.json(); } catch (_) { lignes=null; }
      if (ownerActuel() !== owner) throw Error('La session a changé. Relance la vérification.');
      if (Array.isArray(lignes)) {
        if (lignes.length>1 || lignes.some(x=>x?.owner!==owner || String(x?.data?.uid)!==String(uid))) throw Error('Les traces ne confirment pas le compte attendu.');
        traces=lignes.length?tracesNotifications(lignes[0].data):{etat:'aucune_trace'};
      }
    }
    return {...entete, reception: 'aucune_capture', traces};
  }
  const d = rows[0].data;
  if (!d || d.type !== 'notifications' || String(d.uid) !== String(uid) || !d.payload || typeof d.payload !== 'object') throw Error('La capture ne confirme pas le compte et le type attendus.');
  return {...entete, reception: 'capture_disponible', ...structureNotifications(d.payload), liens:formesLiensNotifications(d.payload)};
}
