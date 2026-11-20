// ════════════════════════════════════════════════════════════════════════════
//  « ARRIVÉS · À RANGER » (20 nov. 2026, lot arrivee-scan) — dans le Stock.
//  Julien : « l'app reçoit les mails avec les codes de retrait et les n° de suivi, c'est là que l'app sait quel article
//  est arrivé ». Les achats ARRIVÉS (« J'ai retiré », le retrait noté, le scan) attendent ici leur N° et leur case — un
//  toucher ouvre l'écran d'arrivée de CET achat. Un achat déjà rangé (une fiche porte SON n° de transaction) n'y est plus :
//  jamais deux fois (`arrivesARanger`, src/arriveeAchat.js). Rien n'est écrit ici ; les notes vivent sur l'appareil
//  (`vrm_arrivees_a_numeroter`), les fiches sont celles de la coque (`vrm_fiches_neuves`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, nombre } from './i18n/index.js';
import { Groupe, Rangee, Vignette } from './natif/index.js';
import { arrivesARanger } from './arriveeAchat.js';
import { ouvrirRetrouver } from './retrouverColis.js';

const lire = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (_) { return null; } };
export const lireArrives = () => { const notes = lire('vrm_arrivees_a_numeroter') || {}; const fiches = lire('vrm_fiches_neuves'); return fiches ? arrivesARanger({ notes, fiches }) : arrivesARanger({ notes, fiches: {} }); };
export const ouvrirArrivee = (entrees) => { try { window.dispatchEvent(new CustomEvent('vrm:atelier-numeroter', { detail: { entrees, prendre: () => {} } })); } catch (_) {} };

export function useArrives() {
  const [l, setL] = React.useState(lireArrives);
  React.useEffect(() => {
    const f = () => setL(lireArrives());
    const g = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vrm_fiches_neuves') f(); };
    window.addEventListener('vrm:arrivees', f); window.addEventListener('vrm:save', g); window.addEventListener('storage', f);
    return () => { window.removeEventListener('vrm:arrivees', f); window.removeEventListener('vrm:save', g); window.removeEventListener('storage', f); };
  }, []);
  return l;
}

export default function ArrivesARanger({ Icon = null, Photo = null }) {
  const l = useArrives();
  if (!l.length) return null;
  return (
    <Groupe titre={tr('arv.stock.titre', { n: nombre(l.length) })} attrs={{ 'data-arv-arrives': l.length }}>
      {l.slice(0, 5).map((p) => (
        <Rangee key={p.tx} vignette={<Vignette src={Photo ? "" : (p.photo || "")} alt="" image={p.photo && Photo ? <Photo src={p.photo} alt=""/> : null}/>} titre={p.titre || tr('arv.sansTitre')} lignes={2}
          sousTitre={tr('arv.stock.sous')} fin="chevron" onClick={() => ouvrirArrivee([p])} attrs={{ 'data-arv-arrive': String(p.tx) }}/>
      ))}
      <Rangee icone={Icon ? <Icon name="scan" size={22}/> : null} titre={tr('arv.stock.scanner')} onClick={() => ouvrirRetrouver('stock', '', 'arrivee')} attrs={{ 'data-arv-bouton': 'stock' }}/>
    </Groupe>
  );
}
