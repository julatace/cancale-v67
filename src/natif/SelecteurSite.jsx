// ── src/natif/SelecteurSite.jsx — LE sélecteur de plateforme (20 nov.) ─────────────────────────────────────────────
// Décision du coordinateur (20 nov.) : un seul sélecteur de plateforme, le même sur tous les écrans (chantier
// `claude/minimaliste`) : « Tous · Vinted · Leboncoin · eBay · Vestiaire », seulement les sites RELIÉS. Créé ici par le lot
// argent-natif (sa branche ne l'avait pas encore poussé) avec le nom, la clé et la forme convenus : props
// `{ valeur, onChange, sites }`, choix gardé sous `vrm_site_courant` (cet appareil : une commodité, pas une donnée).
// Présentationnel : il ne lit aucune donnée et ne calcule rien ; « tous » = les chiffres de toujours.
//   const [site, setSite] = useSiteCourant();
//   <SelecteurSite valeur={site} onChange={setSite} sites={['vinted', 'leboncoin']}/>
import React from 'react';
import { tr } from '../i18n/index.js';
import { Segmente } from './Segmente.jsx';

export const CLE_SITE_COURANT = 'vrm_site_courant';
export const SITES_ORDRE = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
const NOMS = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire' };
const EVT = 'vrm:site-courant';

const lire = () => { try { const v = localStorage.getItem(CLE_SITE_COURANT); return v === 'tous' || SITES_ORDRE.includes(v) ? v : 'tous'; } catch (_) { return 'tous'; } };
// Le site choisi, partagé par les écrans de l'appareil (un changement ici se voit partout, sans recharger).
export function useSiteCourant() {
  const [v, setV] = React.useState(lire);
  React.useEffect(() => {
    const f = () => setV(lire());
    window.addEventListener(EVT, f); window.addEventListener('storage', f);
    return () => { window.removeEventListener(EVT, f); window.removeEventListener('storage', f); };
  }, []);
  const poser = React.useCallback((x) => {
    try { localStorage.setItem(CLE_SITE_COURANT, x); } catch (_) {}
    setV(x); try { window.dispatchEvent(new Event(EVT)); } catch (_) {}
  }, []);
  return [v, poser];
}

// `sites` : les sites reliés (dans n'importe quel ordre) ; un seul site relié ⇒ rien à choisir, le sélecteur se tait.
export function SelecteurSite({ valeur = 'tous', onChange, sites = [] }) {
  const liste = SITES_ORDRE.filter((s) => sites.includes(s));
  if (liste.length < 2) return null;
  const options = [{ cle: 'tous', libelle: tr('site.tous'), attrs: { 'data-site-choix': 'tous' } }, ...liste.map((s) => ({ cle: s, libelle: NOMS[s], attrs: { 'data-site-choix': s } }))];
  return (
    <div className="n-selecteur-site" data-site-courant={liste.includes(valeur) ? valeur : 'tous'}>
      <Segmente libelle={tr('site.choisir')} valeur={liste.includes(valeur) ? valeur : 'tous'} onChange={onChange} options={options}/>
    </div>
  );
}

export default SelecteurSite;
