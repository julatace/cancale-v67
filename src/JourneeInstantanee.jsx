// ════════════════════════════════════════════════════════════════════════════
//  MA JOURNÉE TOUT DE SUITE — LE RENDU DE L'INSTANTANÉ (9 nov.)
//  Les derniers chiffres rendus sur CET appareil pour CE compte (src/journeeInstantanee.js),
//  posés dans la forme de la tête de Ma journée (mêmes classes : la place ne bouge pas
//  quand l'écran vrai les remplace), avec « Mis à jour il y a N min » à la place de
//  « Modifier ». INERTE (`inert`) : aucun geste n'en part — la prochaine chose dit
//  « Vérification… » tant que la relecture n'a pas confirmé. Les attributs `data-*` de
//  l'écran vrai (`data-jv2-*`, `data-fu-case`, `data-prochain`…) ne sont PAS repris :
//  rien ne peut lire un chiffre de l'instantané comme un chiffre frais (`data-ji-*`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { instantaneMontrable } from './journeeInstantanee.js';
import { PileVignettes } from './design/PileVignettes.jsx';
import { GrandChiffre } from './design/CarteMois.jsx';
import { BarreObjectif } from './design/CarteStats.jsx';
import { SqLignes } from './Squelette.jsx';
// (9 nov., soir) Le rendu commun des instantanés (Ma journée, Colis, Ventes).
import { useInerte, useMaintenant, MentionInstantane, CasesInstantanees, progObjectif } from './InstantaneCommun.jsx';
import { tr } from './i18n/index.js';

const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
let _fmtJour = null;
const nomJour = (d) => {
  try { if (!_fmtJour) _fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (_) { _fmtJour = null; }
  const t = _fmtJour ? _fmtJour.format(d) : d.toDateString();
  return majuscule(d.getDate() === 1 ? t.replace(/\b1\b/, '1er') : t);
};

// (14 nov., ouverture instantanée) `etat` : 'hors-ligne' (réseau coupé) ou 'panne' (la base n'a pas répondu) —
// l'instantané RESTE, daté, et dit pourquoi rien n'est relu (`data-instantane-panne`) ; ni « Vérification… »
// ni lignes qui chargent : rien ne se relit tant que le réseau ou la base ne revient pas. Sans `etat` : avant.
export function JourneeInstantanee({ snap, maintenant = null, ScreenHead = null, Icon = null, fmt = null, etat = '' }) {
  const ref = React.useRef(null);
  // L'âge avance pendant qu'on attend ; `inert` : ni focus, ni clic (src/InstantaneCommun.jsx).
  const now = useMaintenant(maintenant);
  useInerte(ref);
  const M = instantaneMontrable(snap, now);
  if (!M) return null;
  const h = new Date(now).getHours();
  const hello = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const largeurOk = typeof window !== 'undefined' && M.largeur && Math.abs((window.innerWidth || 0) - M.largeur) < 2;
  const F = M.frise;
  const max = F ? Math.max(0, ...F.jours.map((j) => j.v || 0)) : 0;
  // Le panneau : celui que l'écran avait choisi aujourd'hui ; un autre jour, le dernier jour vendu connu
  // (jamais aujourd'hui, pas encore relu) ; sinon aujourd'hui en lecture.
  let P = F && F.panneau ? { ...F.panneau, choisi: F.panneau.periode } : null;
  if (F && !P) {
    const vendu = [...F.jours].reverse().find((j) => j.k > 0 && j.v > 0);
    P = vendu ? { choisi: vendu.iso, nom: vendu.k === 1 ? 'Hier' : nomJour(vendu.d), vendu: String(vendu.v), grand: fmt ? fmt(vendu.v / 100) : `${(vendu.v / 100).toLocaleString('fr-FR')} €`, faits: vendu.n != null ? [`${vendu.n.toLocaleString('fr-FR')} vente${vendu.n > 1 ? 's' : ''}`] : [], semaine: '' }
      : { choisi: F.jours[6].iso, nom: 'Aujourd’hui', vendu: '', grand: '—', faits: ['lecture…'], semaine: '' };
  }
  const prog = fmt ? progObjectif(M.objectif) : null;
  const pr = M.prochain;
  // « Mis à jour il y a N min » : à la place (et à la taille) de « Modifier ».
  const mention = (cls) => <MentionInstantane age={M.age} className={cls}/>;
  const arret = etat === 'hors-ligne' || etat === 'panne';
  const motGeste = etat === 'hors-ligne' ? tr('instantane.geste.horsLigne') : etat === 'panne' ? tr('instantane.geste.panne') : 'Vérification…';
  return (
    // Le cadre de l'écran vrai (la racine de `Comptabilite` : 16 px en haut), puis sa mise en page.
    <div ref={ref} style={{ padding: '16px 14px 40px' }} data-journee-instantane="" data-ji-t={String(M.t)} data-ji-age={String(Math.floor(M.age / 60000))} data-ji-etat={etat || undefined} aria-busy={arret ? undefined : 'true'}>
    <div className="vrm-day-layout vrm-fu-ecran vrm-fu-journee vrm-ji">
      {ScreenHead ? <ScreenHead icon="soleilLevant" title="Ma journée"/> : null}
      <section className="vrm-day-greeting vrm-w-tete vrm-fu-tete" aria-label="Ta journée — derniers chiffres connus" style={largeurOk && M.hauteur ? { minHeight: M.hauteur } : undefined}>
        <div className="vrm-day-hello vrm-fu-bonjour">{hello}{M.prenom ? ' ' + M.prenom : ''}</div>
        <h1 className="vrm-fu-titre-tete">Ma journée</h1>
        {M.cases ? null : mention('vrm-ji-age vrm-ji-age-seule')}
        <p className="vrm-phrase-ecran vrm-fu-phrase-tete" data-ji-phrase="">{M.phrase && M.phrase.texte ? M.phrase.texte : 'Tes derniers chiffres, le temps de tout relire'}</p>
        {arret ? <p className="vrm-ji-arret" role="status" data-instantane-panne={etat}>{etat === 'hors-ligne' ? tr('instantane.arret.horsLigne') : tr('instantane.arret.panne')}</p> : null}
        {pr ? (
          <div className="vrm-jv2-prochain">
            <div className={'vrm-day-task vrm-fu-tache is-prochain' + (pr.urgent ? ' is-urgent' : '')} data-ji-prochain={pr.tuile || pr.job || ''} aria-disabled="true">
              <PileVignettes srcs={[]} n={0} icone={Icon ? <Icon name={pr.tuile === 'retirer' ? 'pin' : pr.tuile === 'envoyer' ? 'box' : 'info'} size={20}/> : null}/>
              <span className="vrm-day-task-textes">
                <span className="vrm-day-task-title">{pr.titre}</span>
                {pr.note ? <span className="vrm-day-task-note">{pr.note}</span> : null}
              </span>
              <span className={'vrm-day-task-action vrm-ji-geste' + (pr.principal ? ' is-principal' : '')} data-ji-geste={arret ? etat : 'verification'} title={arret ? undefined : 'Les chiffres se vérifient : ce geste s’ouvre dès que tout est relu.'}>
                <span className="vrm-day-task-action-mot">{motGeste}</span>
              </span>
            </div>
          </div>
        ) : pr === undefined && M.gestes ? <div className="vrm-jv2-prochain-attente" aria-hidden="true"/> : null}
        {F ? (
          <div className="vrm-jv2-argent vrm-ji-chiffres" data-ji-frise="">
            <ol className="vrm-fu-semaine vrm-jv2-frise" aria-label="Les sept derniers jours">
              {F.jours.map((j) => (
                <li key={j.iso} className="vrm-fu-jour" data-auj={j.k === 0 ? '' : undefined} data-choisi={P && P.choisi === j.iso ? '' : undefined} data-ji-jour={j.iso} data-ji-n={j.n == null ? '' : String(j.n)} data-ji-v={j.v == null ? '' : String(j.v)}>
                  <button type="button" className="vrm-jv2-jour" tabIndex={-1} aria-hidden="true">
                    <span aria-hidden="true">{LETTRES[j.d.getDay()]}</span><b>{j.d.getDate()}</b>
                    <i className="vrm-jv2-barre" aria-hidden="true" style={{ '--h': j.v > 0 && max > 0 ? (0.18 + 0.82 * j.v / max).toFixed(3) : 0 }}/>
                  </button>
                </li>
              ))}
            </ol>
            {P ? (
              <div className="vrm-jv2-periode" data-ji-panneau={P.choisi || ''}>
                <div className="vrm-jv2-quand">
                  <span className="vrm-fu-surtitre vrm-jv2-nom">{P.nom}</span>
                  {P.semaine ? <button type="button" className="vrm-jv2-sem" tabIndex={-1} aria-hidden="true">{P.semaine}</button> : null}
                </div>
                <div className="vrm-jv2-corps">
                  <div className="vrm-jv2-chiffre">
                    {P.vendu === ''
                      ? <div className="vrm-fu-grand vrm-jv2-grand is-vide" data-ji-vendu="">—</div>
                      : P.vendu === '0'
                        ? <div className="vrm-jv2-grand is-zero" data-ji-vendu="0">Rien vendu</div>
                        : <GrandChiffre className="vrm-fu-grand vrm-jv2-grand" data-ji-vendu={P.vendu}>{P.grand}</GrandChiffre>}
                    <p className="vrm-jv2-faits">{(P.faits || []).map((f, i) => <React.Fragment key={i}>{i ? ' ' : ''}<span>{f}</span></React.Fragment>)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {M.cases ? (
          <section className="vrm-fu-carte-nu a-action vrm-carte-stats vrm-ji-chiffres" data-ji-cases="">
            {mention('vrm-fu-modifier vrm-ji-age')}
            <CasesInstantanees cases={M.cases}/>
            {prog ? <BarreObjectif prog={prog} fmt={fmt} maintenant={now} prefixe="data-ji-objectif"/> : null}
          </section>
        ) : null}
      </section>
      {M.gestes && !arret ? (
        <section className="vrm-fu-afaire" aria-label="À faire" aria-busy="true" data-ji-gestes={String(M.gestes)}>
          {/* Le titre de l'écran vrai : « Ensuite » s'il reste des gestes après la prochaine chose. */}
          <div className="vrm-fu-titre-section"><h2 className="vrm-day-titre-section">{M.gestes - (pr ? 1 : 0) > 0 && pr ? 'Ensuite' : 'À faire'}</h2><span>{M.gestes} geste{M.gestes > 1 ? 's' : ''}</span></div>
          {pr && M.gestes <= 1 ? <p className="vrm-fu-vide vrm-jv2-rien-dautre">Rien d’autre pour l’instant.</p> : <SqLignes n={Math.min(3, Math.max(1, M.gestes - (pr ? 1 : 0)))} montant={false}/>}
        </section>
      ) : null}
    </div>
    </div>
  );
}
export default JourneeInstantanee;
