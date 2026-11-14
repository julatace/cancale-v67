// ═══════════════════════════════════════════════════════════════════════════
//  161 · CE QUE L'APP PUBLIE POUR SIRI (14 nov.) — la ligne `siri_retrait`
// ═══════════════════════════════════════════════════════════════════════════
// Seulement quand un jeton Siri EXISTE (`vrm_siri.h`, lu en scalaire) : les colis
// COMPTÉS « à retirer » (la publication `vrm_colis_retirer` de l'écran des retraits,
// §5 « un seul propriétaire ») avec le code de LEUR commande (la copie
// `vrm_codes_hors_ligne`, CE compte VRM seulement). La règle : `publicationSiriRetrait`
// (api/_lib/siri-reponses.js). Publication absente ⇒ rien n'est écrit (la dernière reste,
// le serveur la dit « d'après VRM à hh h mm », périmée au bout de 12 h).
// « Vendu aujourd'hui » et « à envoyer » ne passent pas ici : `widget_stats` (App.jsx).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { AUTH, load, isCloudReady, onCloudReady, withOwner, SUPABASE_URL, SB_CONFLICT, sbAuth } from '../App.jsx';
import { publicationSiriRetrait, LIGNE_SIRI, LIGNE_SIRI_RETRAIT } from '../../api/_lib/siri-reponses.js';

export const EVT_SIRI = 'vrm:siri-maj';
// { actif, at, debut } · null (pas su : rien n'est publié)
export async function siriActif() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_SIRI}&select=h:data->>h,at:data->>at,debut:data->>debut`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    return j[0] && j[0].h ? { actif: true, at: j[0].at || '', debut: j[0].debut || '' } : { actif: false };
  } catch (_) { return null; }
}

export function useSiriPublication() {
  React.useEffect(() => {
    let mort = false, actif = null, dernier = '';
    const publier = async () => {
      if (mort || actif !== true || !isCloudReady() || !(AUTH.user && AUTH.user.id)) return;
      const uid = AUTH.user.id;
      const c = load('vrm_codes_hors_ligne', null);
      const codes = c && Array.isArray(c.codes) && (!c.uid || c.uid === uid) ? c.codes : [];
      const data = publicationSiriRetrait({ pubRetirer: load('vrm_colis_retirer', null), codes, uid });
      if (!data) return;
      const cle = JSON.stringify(data);
      if (cle === dernier) return;
      dernier = cle;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${SB_CONFLICT}`, {
          method: 'POST', headers: sbAuth({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify([withOwner({ id: LIGNE_SIRI_RETRAIT, data })]),
        });
        if (!r || !r.ok) dernier = '';
      } catch (_) { dernier = ''; }
    };
    const relire = async () => { const e = await siriActif(); if (mort) return; actif = e ? e.actif : null; if (actif) { dernier = ''; publier(); } };
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vrm_colis_retirer' || k === 'vrm_codes_hors_ligne') publier(); };
    if (AUTH.user) relire();
    window.addEventListener('vrm:save', f);
    window.addEventListener(EVT_SIRI, relire);
    const off = onCloudReady(() => { if (actif === null) relire(); else publier(); });
    return () => { mort = true; window.removeEventListener('vrm:save', f); window.removeEventListener(EVT_SIRI, relire); if (typeof off === 'function') off(); };
  }, []);
}
