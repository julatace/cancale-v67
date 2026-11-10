// ════════════════════════════════════════════════════════════════════════════
//  LE RENDU COMMUN DES INSTANTANÉS (Ma journée, Colis, Ventes — 9 nov.)
//  La règle des données est src/instantaneEcran.js. Ici, ce que les trois écrans
//  montrent de la même façon :
//    · `useInerte` : `inert` posé sur le DOM (React 18 ne connaît pas l'attribut) —
//      ni focus, ni clic : AUCUN geste ne part d'un instantané ;
//    · `useMaintenant` : l'âge avance pendant qu'on attend (toutes les 30 s) ;
//    · `MentionInstantane` : « ● Mis à jour il y a 7 min », à la place de « Modifier » ;
//    · `CasesInstantanees` + `CarteInstantanee` : la carte des chiffres, mêmes classes
//      que l'écran vrai (la place ne bouge pas au remplacement), attributs à SON
//      préfixe (`data-ji-*`, `data-inst-*`) : rien ne peut lire un chiffre ancien
//      comme frais ;
//    · `GesteVerification` : le mot de tout geste tant que rien n'est relu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { ageTexte } from './instantaneEcran.js';
import { BarreObjectif } from './design/CarteStats.jsx';
import './styles-journee-instantanee.css';

export function useInerte(ref) {
  React.useLayoutEffect(() => { const r = ref.current; if (r) { try { r.inert = true; } catch (_) {} r.setAttribute('inert', ''); } });
}
export function useMaintenant(maintenant) {
  const [now, setNow] = React.useState(() => maintenant || Date.now());
  React.useEffect(() => { if (maintenant) return undefined; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [maintenant]);
  return maintenant || now;
}
const TITRE_MENTION = 'Les chiffres de ta dernière visite sur cet appareil. Ils se vérifient : ils seront remplacés dans un instant.';
export function MentionInstantane({ age, className, prefixe = 'data-ji' }) {
  return (
    <span className={className} {...{ [prefixe + '-mention']: '' }} role="status" title={TITRE_MENTION}>
      <span className="vrm-ji-point" aria-hidden="true"/>Mis à jour {ageTexte(age)}
    </span>
  );
}
// Le mot de tout geste tant que la relecture n'a pas confirmé (aucun n'en part : l'instantané est inerte).
export function GesteVerification({ className = '', prefixe = 'data-inst' }) {
  return (
    <span className={(className ? className + ' ' : '') + 'vrm-inst-geste'} {...{ [prefixe + '-geste']: 'verification' }} aria-disabled="true" title="Les chiffres se vérifient : ce geste s’ouvre dès que tout est relu.">
      Vérification…
    </span>
  );
}
export function CasesInstantanees({ cases, prefixe = 'data-ji' }) {
  return (
    <div className="vrm-fu-cases" style={{ '--n': cases.length }}>
      {cases.map((c) => (
        <div key={c.cle} className="vrm-fu-case" {...{ [prefixe + '-case']: c.cle, [prefixe + '-valeur']: c.valeur }}>
          <b className={c.vide ? 'is-vide' : undefined} style={{ '--nc': Math.max(1, String(c.b == null ? '' : c.b).length) }}>{c.b}</b>
          <span>{c.l}</span>
          <small className="vrm-fu-case-raison" aria-hidden={c.raison ? undefined : 'true'}>{c.raison || ' '}</small>
        </div>
      ))}
    </div>
  );
}
// La barre de l'objectif telle que rangée (les nombres de SA barre, src/objectifMois.js).
export function progObjectif(O) {
  if (!O) return null;
  const eur = O.type === 'ca';
  const cible = Number(O.cible); const val = O.valeur === '' ? null : Number(O.valeur);
  if (!Number.isFinite(cible) || cible <= 0) return null;
  return { type: O.type, objectif: eur ? cible / 100 : cible, valeur: val == null || !Number.isFinite(val) ? null : (eur ? val / 100 : val), pct: O.pct === '' ? null : Number(O.pct), partiel: !!O.partiel, atteint: !!O.atteint, manque: [] };
}
// La carte sombre des chiffres de Colis et Ventes (src/design/CarteStats.jsx), telle que rendue.
export function CarteInstantanee({ carte, age, fmt, maintenant, prefixe = 'data-inst' }) {
  if (!carte) return null;
  const prog = fmt ? progObjectif(carte.objectif) : null;
  return (
    <section className={(carte.classes || 'vrm-fu-carte vrm-carte-stats') + ' vrm-ji-chiffres'} {...{ [prefixe + '-carte']: '' }}>
      <div className="vrm-fu-carte-haut">
        <span className="vrm-fu-surtitre">{carte.surtitre}</span>
        <MentionInstantane age={age} className="vrm-fu-modifier vrm-ji-age" prefixe={prefixe}/>
      </div>
      {carte.grand ? (
        <div className="vrm-fu-carte-tete">
          <div className="vrm-fu-carte-txt">
            <div className={'vrm-fu-grand' + (carte.grand.vide ? ' is-vide' : '')} {...{ [prefixe + '-grand']: carte.grand.valeur }}>{carte.grand.texte}</div>
            {carte.grand.sous ? <div className="vrm-fu-sous"><span className="vrm-fu-sous-nom">{carte.grand.sous}</span></div> : null}
          </div>
          {/* La courbe n'est pas rangée : sa place seulement (rien ne bouge au remplacement). */}
          {carte.spark ? <span className="vrm-inst-courbe" aria-hidden="true" style={{ width: carte.spark.l, height: carte.spark.h }}/> : null}
        </div>
      ) : null}
      {carte.cases ? <CasesInstantanees cases={carte.cases} prefixe={prefixe}/> : null}
      {prog ? <BarreObjectif prog={prog} fmt={fmt} maintenant={maintenant} prefixe={prefixe + '-objectif'}/> : null}
    </section>
  );
}
