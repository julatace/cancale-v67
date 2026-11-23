// ── src/calendrierSemaine/CalendrierSemaine.jsx — « Les 7 prochains jours » (23 nov., lot calendrier-semaine) ──
// Une feuille, ouverte depuis la carte « Colis » d'Aujourd'hui : jour par jour, les colis à envoyer et les retraits, avec
// leur date limite. Une date ESTIMÉE porte la pastille « estimée » (jamais « en retard ») ; ce qui est en retard (une
// limite LUE et dépassée), une estimation passée, ce qui n'a aucune date et ce qui vient après la semaine sont dits à part,
// jamais cachés (§5 : un colis caché est un colis perdu). Toucher un envoi ouvre la fiche de SON N° ; sans N°, Colis ;
// toucher un retrait ouvre « À retirer ». Une VUE : tout arrive rangé par src/calendrierSemaine.js (aucun calcul ici).
// Chaque rangée porte `data-cal-*` (sorte, jour, estimée) : le banc lit les repères, jamais un libellé.
import React from 'react';
import { tr, nombre, localeCourante } from '../i18n/index.js';
import { Feuille, Groupe, Rangee, Pastille, Bouton, Glyphe } from '../natif/index.js';
import { calendrierSemaine } from '../calendrierSemaine.js';

const lirePub = (load, cle) => { try { const v = load(cle, null); return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
const titreJour = (ymd, i) => {
  if (i === 0) return tr('cal.aujourdhui');
  if (i === 1) return tr('cal.demain');
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const heureCourte = (iso) => { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString(localeCourante(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };

export default function CalendrierSemaine({ ouverte = true, onFermer, load, onNav = null, Icon = null }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vrm_colis_aposter' || k === 'vrm_colis_retirer') setTick((x) => x + 1); };
    window.addEventListener('vrm:save', f); window.addEventListener('vrm:colis', f);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('vrm:colis', f); };
  }, []);
  const C = React.useMemo(() => {
    try { return calendrierSemaine({ aposter: lirePub(load, 'vrm_colis_aposter'), retirer: lirePub(load, 'vrm_colis_retirer') }); } catch (_) { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, tick]);
  const ic = (n) => (Icon ? <Icon name={n} size={22}/> : null);
  const fermerPuis = (f) => () => { if (onFermer) onFermer(); setTimeout(f, 0); };
  const ouvrirFiche = (num) => fermerPuis(() => { try { window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: String(num) })); } catch (_) {} });
  const versColis = fermerPuis(() => { if (onNav) onNav('cat_bord'); });
  const versRetraits = fermerPuis(() => { if (onNav) onNav('retraits'); });

  const rangee = (x, cle) => {
    const estimee = x.estimee ? <Pastille ton="neutre">{tr('cal.estimee')}</Pastille> : null;
    const quand = x.sorte === 'envoi' ? (x.heure ? tr('cal.avant', { h: x.heure }) : '') : (x.heure ? tr('cal.avant', { h: heureCourte(x.heure) }) : '');
    const attrs = { 'data-cal-sorte': x.sorte, 'data-cal-jour': x.jour || '', 'data-cal-estimee': x.estimee ? '1' : '0', 'data-cal-num': x.num || '' };
    if (x.sorte === 'envoi') {
      return <Rangee key={cle} icone={ic('truck')} titre={x.nom || tr('cal.colisSansNom')} sousTitre={[x.num ? tr('cal.numero', { n: x.num }) : tr('cal.sansNumero'), quand].filter(Boolean).join(' · ')}
        pastille={estimee} fin="chevron" onClick={x.num ? ouvrirFiche(x.num) : versColis} attrs={attrs}/>;
    }
    return <Rangee key={cle} icone={ic('pin')} titre={x.nom || tr('cal.retraitSansNom', { t: x.transporteur || '—' })} sousTitre={[x.transporteur, quand].filter(Boolean).join(' · ')}
      pastille={estimee} fin="chevron" onClick={versRetraits} attrs={attrs}/>;
  };
  const liste = (envois, retraits, p) => [...envois.map((x, i) => rangee(x, p + 'e' + i)), ...retraits.map((x, i) => rangee(x, p + 'r' + i))];

  let corps;
  if (!C) corps = <Groupe><Rangee titre={tr('v2.jour.pasSu')}/></Groupe>;
  else {
    const raisons = [C.pasSu.envois ? tr('cal.pasSu.envois') : '', C.pasSu.retraits ? tr('cal.pasSu.retraits') : ''].filter(Boolean);
    const retardLus = C.avant.envois.filter((x) => !x.estimee), estPassees = C.avant.envois.filter((x) => x.estimee);
    const autres = C.autres ? ['ebay', 'leboncoin', 'vestiaire'].map((s) => [s, C.autres[s]]).filter(([, v]) => v > 0) : [];
    corps = (
      <>
        {raisons.length ? <Groupe attrs={{ 'data-cal-passu': [C.pasSu.envois ? 'envois' : '', C.pasSu.retraits ? 'retraits' : ''].filter(Boolean).join(',') }}>
          <Rangee titre={raisons.join(' · ')} lignes={2}/>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 16px 12px' }}>
            {C.pasSu.envois ? <Bouton variante="teinte" icone={<Glyphe nom="truck"/>} onClick={versColis} attrs={{ 'data-cal-ouvrir-colis': '' }}>{tr('cal.ouvrirColis')}</Bouton> : null}
            {C.pasSu.retraits ? <Bouton variante="teinte" icone={<Glyphe nom="pin"/>} onClick={versRetraits} attrs={{ 'data-cal-ouvrir-retraits': '' }}>{tr('cal.ouvrirRetraits')}</Bouton> : null}
          </div>
        </Groupe> : null}
        {retardLus.length || C.avant.retraits.length ? (
          <Groupe titre={tr('cal.enRetard')} attrs={{ 'data-cal-groupe': 'retard' }}>{liste(retardLus, C.avant.retraits.filter((x) => !x.estimee), 'a')}</Groupe>) : null}
        {estPassees.length || C.avant.retraits.some((x) => x.estimee) ? (
          <Groupe titre={tr('cal.estPassee')} attrs={{ 'data-cal-groupe': 'estimation-passee' }}>{liste(estPassees, C.avant.retraits.filter((x) => x.estimee), 'p')}</Groupe>) : null}
        {C.jours.map((j, i) => (
          <Groupe key={j.jour} titre={titreJour(j.jour, i)} attrs={{ 'data-cal-groupe': 'jour', 'data-cal-date': j.jour, 'data-cal-n': String(j.envois.length + j.retraits.length) }}>
            {j.envois.length || j.retraits.length ? liste(j.envois, j.retraits, 'j' + i) : <Rangee titre={tr('cal.rien')} ton="neutre" attrs={{ 'data-cal-vide': '' }}/>}
          </Groupe>
        ))}
        {C.plusTard.envois.length || C.plusTard.retraits.length ? (
          <Groupe titre={tr('cal.plusTard')} attrs={{ 'data-cal-groupe': 'plus-tard' }}>{liste(C.plusTard.envois, C.plusTard.retraits, 't')}</Groupe>) : null}
        {C.sansDate.envois.length || C.sansDate.retraits.length || autres.length ? (
          <Groupe titre={tr('cal.sansDate')} attrs={{ 'data-cal-groupe': 'sans-date' }}>
            {liste(C.sansDate.envois, C.sansDate.retraits, 's')}
            {autres.map(([s, v]) => <Rangee key={s} icone={ic('truck')} titre={tr('cal.autreSite.' + s, { n: nombre(v) })} sousTitre={tr('cal.autreSite.sous')} fin="chevron" onClick={versColis}
              attrs={{ 'data-cal-autre': s, 'data-cal-n': String(v) }}/>)}
          </Groupe>) : null}
        <details className="vrm-repli" data-cal-pourquoi="" style={{ margin: '8px 16px 16px' }}><summary>{tr('cal.pourquoi')}</summary><p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{tr('cal.pourquoi.texte')}</p></details>
      </>
    );
  }
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('cal.titre')} detente="pleine" attrs={{ 'data-cal-feuille': '' }}>
      {corps}
    </Feuille>
  );
}
