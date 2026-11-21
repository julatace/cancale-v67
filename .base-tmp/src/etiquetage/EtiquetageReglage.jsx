// ── PARAMÈTRES → STOCK → MÉTHODE D'ÉTIQUETAGE (19 nov. 2026, lot stock-etiquetage) ─────────
// Julien : « À la création du compte, et même après, qu'on puisse choisir la méthode d'étiquetage que l'on veut. »
// Le même choix que Ma configuration (src/configurationDepart.js, étape « numero ») : qui numérote, la forme des
// PROCHAINS numéros, l'étiquette (écrite à la main ou imprimée) et son format. Design natif (listes groupées, coches).
// Les écritures sont celles de src/etiquetage/methode.js (`ecrituresMethode`, trois clés, seulement ce qui change) ;
// l'écran ne touche à AUCUN numéro (§5) : `ecrire` est fourni par Réglages et n'écrit que ces clés.
// Props : lire() → { numeroEcrit, prefixe, etiquetage } (bruts) · archive (la lettre des anciens N°) ·
//         ecrire(ecritures) → Promise<bool> · onNumeros() (où VRM lit le N° que tu écris) · onImprimer() | null · Icon
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee } from '../natif/index.js';
import { methodeDe, ecrituresMethode, FORMATS, lettreDe } from './methode.js';
import './etiquetage.css';

export default function EtiquetageReglage({ lire, archive = '', ecrire, onNumeros = null, onImprimer = null }) {
  const [brut, setBrut] = React.useState(() => lire());
  const m = methodeDe(brut);
  const [serieVue, setSerieVue] = React.useState(m.serie);      // « Avec une lettre » s'ouvre avant que la lettre soit tapée
  const [lettre, setLettre] = React.useState(m.lettre);
  const [refus, setRefus] = React.useState(null);
  const [rate, setRate] = React.useState(false);
  // Une lettre enregistrée (ici ou sur un autre appareil) ouvre la série « lettre ».
  React.useEffect(() => { if (methodeDe(brut).serie === 'lettre') setSerieVue('lettre'); }, [brut]);
  const appliquer = async (choix) => {
    const { ecritures, refus: r } = ecrituresMethode(brut, choix, { archive });
    setRefus(r);
    if (!ecritures.length) return;
    const ok = await ecrire(ecritures);
    setRate(!ok);
    if (ok) setBrut(lire());
  };
  const coche = (vrai) => (vrai ? 'coche' : null);
  const fmt = (f) => tr('etq.format.' + f.v);
  return (
    <div className="etq" data-etiquetage-reglage={m.qui || 'aucun'} data-etiquetage-serie={m.serie} data-etiquetage-support={m.support || 'aucun'}>
      <Groupe titre={tr('etq.qui.titre')}>
        <Rangee titre={tr('etq.qui.vrm')} sousTitre={tr('etq.qui.vrm.sous')} sousLignes={2} fin={coche(m.qui === 'vrm')} onClick={() => appliquer({ qui: 'vrm' })} attrs={{ 'data-etiquetage-choix': 'qui:vrm', 'aria-pressed': m.qui === 'vrm' }}/>
        <Rangee titre={tr('etq.qui.moi')} sousTitre={tr('etq.qui.moi.sous')} sousLignes={2} fin={coche(m.qui === 'moi')} onClick={() => appliquer({ qui: 'moi' })} attrs={{ 'data-etiquetage-choix': 'qui:moi', 'aria-pressed': m.qui === 'moi' }}/>
        {m.qui === 'moi' && onNumeros ? <Rangee titre={tr('etq.qui.ou')} fin="chevron" onClick={onNumeros} attrs={{ 'data-etiquetage-ou': '' }}/> : null}
      </Groupe>
      {m.qui !== 'moi' ? (
        <Groupe titre={tr('etq.serie.titre')} pied={tr('etq.pied')}>
          <Rangee titre={tr('etq.serie.chiffres')} fin={coche(serieVue === 'chiffres')} onClick={() => { setSerieVue('chiffres'); appliquer({ serie: 'chiffres' }); }} attrs={{ 'data-etiquetage-choix': 'serie:chiffres' }}/>
          <Rangee titre={tr('etq.serie.lettre', { l: lettre || (archive === 'C' ? 'D' : 'C') })} fin={coche(serieVue === 'lettre')} onClick={() => setSerieVue('lettre')} attrs={{ 'data-etiquetage-choix': 'serie:lettre' }}/>
          {serieVue === 'lettre' ? (
            <label className="etq-champ" data-etiquetage-lettre="">
              <span className="etq-champ-nom">{tr('etq.serie.laLettre')}</span>
              <input className="etq-entree" value={lettre} maxLength={3} autoCapitalize="characters" autoComplete="off" aria-label={tr('etq.serie.laLettre')}
                onChange={(e) => setLettre(lettreDe(e.target.value))} onBlur={() => { if (lettre) appliquer({ serie: 'lettre', lettre }); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && lettre) { e.preventDefault(); appliquer({ serie: 'lettre', lettre }); } }} data-etiquetage-lettre-champ=""/>
            </label>) : null}
        </Groupe>) : null}
      {refus ? <p className="etq-refus" role="alert" data-etiquetage-refus={refus}>{tr('etq.refus.' + refus, { l: archive })}</p> : null}
      <Groupe titre={tr('etq.support.titre')}>
        <Rangee titre={tr('etq.support.main')} sousTitre={tr('etq.support.main.sous')} sousLignes={2} fin={coche(m.support === 'main')} onClick={() => appliquer({ support: 'main' })} attrs={{ 'data-etiquetage-choix': 'support:main' }}/>
        <Rangee titre={tr('etq.support.imprimee')} sousTitre={tr('etq.support.imprimee.sous')} sousLignes={2} fin={coche(m.support === 'imprimee')} onClick={() => appliquer({ support: 'imprimee' })} attrs={{ 'data-etiquetage-choix': 'support:imprimee' }}/>
      </Groupe>
      {m.support === 'imprimee' ? (
        <Groupe titre={tr('etq.format.titre')}>
          {FORMATS.map((f) => <Rangee key={f.v} titre={fmt(f)} fin={coche(m.format === f.v)} onClick={() => appliquer({ format: f.v })} attrs={{ 'data-etiquetage-choix': 'format:' + f.v }}/>)}
          <Rangee titre={tr('etq.format.titreArticle')} interrupteur={{ actif: m.titre, onChange: (v) => appliquer({ titre: !!v }) }} attrs={{ 'data-etiquetage-titre': m.titre ? '1' : '0' }}/>
          {onImprimer ? <Rangee titre={tr('etq.imprimer')} fin="chevron" onClick={onImprimer} attrs={{ 'data-etiquetage-imprimer': '' }}/> : null}
        </Groupe>) : null}
      {rate ? <p className="etq-refus" role="alert" data-etiquetage-rate="">{tr('etq.rate')}</p> : null}
    </div>
  );
}
