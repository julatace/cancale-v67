// ═══════════════════════════════════════════════════════════════════════════
// LE CENTRE DE NOTIFICATIONS — la cloche et sa feuille (5 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (5 nov.) : « une meilleure interface, plus pro, personnalisable comme
// on veut ; cliquer une notification amène directement sur ce qui est arrivé,
// mis en évidence ». La liste est CE QUE LE SERVEUR A ENVOYÉ (ou gardé pendant
// les heures calmes), rangée par lui (`push_journal`) ; une entrée touchée est
// marquée lue et ouvre l'objet par la même adresse que la notification
// (`?tab=…&cible=…`, src/cibleNotif.js) — l'élément est mis en évidence là-bas.
// Règle pure : src/journalNotifs.js. Lectures et écritures : passées par l'app.
import React from 'react';
import { TYPES_CENTRE, ETAT_CENTRE, entreesDuJournal, estLue, marquerLues, toutLu, parJour, heureCourte, rechercheDe, regrouperLignes, quandRelatif } from './journalNotifs.js';
import { ICONE_FAMILLE, GESTE_FAMILLE } from '../api/_lib/notif-belle.js';
import { SheetShell } from './composants/SheetShell.jsx';
import { EtatPanne } from './composants/EtatPanne.jsx';
import { BoutonBase as Bouton } from './composants/Bouton.jsx';
import { NOTIONS } from './libelles.js';

const nomType = (f) => (TYPES_CENTRE.find((t) => t.id === f) || {}).titre || (f === 'test' ? 'Essai' : 'Autre');
// (8 nov.) Une ligne de la cloche : l'icône de la famille, le fait, le texte, le
// geste (ce que fait le toucher) et l'heure dite comme un téléphone.
function LigneNotif({ e, nl, onOuvrir, Icon, retrait = false }) {
  const va = !!rechercheDe(e.url);
  return (
    <button type="button" className={'vrm-cn-ligne' + (nl ? ' is-non-lue' : '') + (retrait ? ' is-retrait' : '')} data-centre-entree={e.seq} data-centre-type={e.famille} data-non-lue={nl ? '1' : '0'} data-centre-url={e.url} onClick={() => onOuvrir(e)}
      aria-label={`${nl ? 'Non lue · ' : ''}${e.titre || 'Notification'}${e.texte ? ' · ' + e.texte : ''}`}>
      <span className="vrm-cn-ic" data-centre-icone={ICONE_FAMILLE[e.famille] || 'bell2'} aria-hidden="true"><Icon name={ICONE_FAMILLE[e.famille] || 'bell2'} size={17}/>{nl ? <span className="vrm-cn-point"/> : null}</span>
      <span className="vrm-cn-corps">
        <span className="vrm-cn-meta"><span>{nomType(e.famille)}</span>{ETAT_CENTRE[e.etat] ? <span className="vrm-cn-etat" data-centre-etat-entree={e.etat}>{ETAT_CENTRE[e.etat]}</span> : null}<time dateTime={new Date(e.t).toISOString()} title={heureCourte(e.t)}>{quandRelatif(e.t)}</time></span>
        <span className="vrm-cn-ti">{e.titre || 'Notification'}</span>
        {e.texte ? <span className="vrm-cn-tx">{e.texte}</span> : null}
        {va && GESTE_FAMILLE[e.famille] ? <span className="vrm-cn-geste" data-centre-geste="">{GESTE_FAMILLE[e.famille]}</span> : null}
      </span>
      {va ? <span className="vrm-cn-chevron" aria-hidden="true"><Icon name="chevron" size={14}/></span> : null}
    </button>
  );
}
// Plusieurs notifications du même genre le même jour : une ligne qui dit combien,
// dépliable (le téléphone n'en a montré qu'une).
function GroupeNotifs({ g, lu, onOuvrir, Icon }) {
  const [ouvert, setOuvert] = React.useState(false);
  const nl = g.items.filter((e) => !estLue(e, lu)).length;
  return (
    <>
      <button type="button" className={'vrm-cn-ligne vrm-cn-groupe' + (nl ? ' is-non-lue' : '')} aria-expanded={ouvert} data-centre-groupe={g.genre} data-centre-groupe-n={g.items.length} onClick={() => setOuvert((v) => !v)}>
        <span className="vrm-cn-ic" aria-hidden="true"><Icon name={ICONE_FAMILLE[g.famille] || 'bell2'} size={17}/>{nl ? <span className="vrm-cn-point"/> : null}</span>
        <span className="vrm-cn-corps">
          <span className="vrm-cn-meta"><span>{nomType(g.famille)}</span><time dateTime={new Date(g.t).toISOString()}>{quandRelatif(g.t)}</time></span>
          <span className="vrm-cn-ti">{g.titre}</span>
          <span className="vrm-cn-tx">Dernier : {g.items[0].titre}{g.items[0].texte ? ' · ' + g.items[0].texte : ''}</span>
          <span className="vrm-cn-geste">{ouvert ? 'Replier' : `Voir les ${g.items.length}`}</span>
        </span>
        <span className={'vrm-cn-chevron' + (ouvert ? ' is-ouvert' : '')} aria-hidden="true"><Icon name="chevron" size={14}/></span>
      </button>
      {ouvert ? g.items.map((e) => <LigneNotif key={e.seq} e={e} nl={!estLue(e, lu)} onOuvrir={onOuvrir} Icon={Icon} retrait/>) : null}
    </>
  );
}

// La cloche de l'en-tête : la pastille dit le nombre de non-lues (rien si 0 ou
// pas su — « pas su » n'affiche jamais « 0 »).
// `enPlus` : les notifications LOCALES (« Où ranger », src/ouRanger.js) — comptées
// dans la pastille, jamais envoyées au téléphone.
export function BoutonCentreNotifs({ nonLues, onOuvrir, Icon, enPlus = 0 }) {
  const n = (Number.isSafeInteger(nonLues) && nonLues > 0 ? nonLues : 0) + (Number.isSafeInteger(enPlus) && enPlus > 0 ? enPlus : 0);
  const lib = n ? `Notifications : ${n} non lue${n > 1 ? 's' : ''}` : 'Notifications';
  return (
    <button className="vrm-hbtn vrm-cn-cloche" type="button" data-centre-notifs-cloche="" data-non-lues={Number.isSafeInteger(nonLues) ? String(nonLues) : ''}
      aria-label={lib} title={lib} onClick={onOuvrir}>
      <Icon name="bell2" size={21}/>
      {/* (14 nov., refonte de la coque) « 9+ » au plus : au-delà, le nombre exact est dans la feuille (et lu dans `aria-label`). */}
      {n ? <span className="vrm-cn-pastille" data-cn-pastille={String(n)} aria-hidden="true">{n > 9 ? '9+' : n}</span> : null}
    </button>
  );
}

// La feuille. `charger()` rend `{ journal: data|null, lu: data|null }` ;
// `ecrireLu(next)` rend true si la base l'a pris.
// (5 nov., chantier H) La feuille est LA feuille de l'app (`SheetShell` : poignée,
// titre, la même croix, portail, retour du navigateur). `aRanger` : les achats qui
// viennent d'arriver et LA case proposée (src/ouRanger.js) — locales, jamais
// envoyées au téléphone ; `undefined` = en cours, `null` = pas su (rien n'est dit).
export function FeuilleCentreNotifs({ onFermer, charger, ecrireLu, onAller, onReglages, Fermer, Icon, z = 9500, aRanger = null, onRanger = null, onRangeFait = null }) {
  const [etat, setEtat] = React.useState({ entrees: undefined, lu: null });
  const [filtre, setFiltre] = React.useState('');
  const vivant = React.useRef(true);
  const lire = React.useCallback(async () => {
    setEtat((e) => ({ ...e, entrees: undefined }));
    const r = await charger().catch(() => ({ journal: null, lu: null }));
    if (vivant.current) setEtat({ entrees: entreesDuJournal(r.journal), lu: r.lu });
  }, [charger]);
  React.useEffect(() => { vivant.current = true; lire(); return () => { vivant.current = false; }; }, [lire]);
  const { entrees, lu } = etat;
  const types = entrees ? TYPES_CENTRE.filter((t) => entrees.some((e) => e.famille === t.id)) : [];
  const visibles = entrees ? entrees.filter((e) => !filtre || e.famille === filtre) : entrees;
  const nonLues = entrees ? entrees.filter((e) => !estLue(e, lu)).length : 0;
  // Marquer lu sans attendre la base : l'écran suit tout de suite ; si
  // l'écriture échoue, la prochaine ouverture relit l'état réel.
  const poserLu = (next) => { setEtat((e) => ({ ...e, lu: next })); ecrireLu(next); };
  const ouvrir = (e) => {
    if (lu !== null) poserLu(marquerLues(lu, [e.seq]));
    const q = rechercheDe(e.url);
    onFermer();
    if (q) onAller(q);
  };
  const toutMarquer = () => { if (entrees && entrees.length && lu !== null) poserLu(toutLu(entrees[0].seq, lu)); };
  const groupes = visibles ? parJour(visibles) : [];
  const rangees = Array.isArray(aRanger) ? aRanger : [];
  const etatListe = entrees === undefined ? 'lecture' : entrees === null ? 'passu' : (entrees.length || rangees.length) ? 'lu' : 'vide';
  return (
    <SheetShell onClose={onFermer} titre="Notifications" maxWidth={560} z={z} FermeAuRetour={Fermer}
      className="vrm-cn-feuille" aria-label="Notifications" data-centre-notifs="" data-centre-etat={etatListe} data-noswipe="1">
      {(nonLues > 0 && lu !== null) || types.length > 1 ? (
        <div className="vrm-cn-barre">
          {types.length > 1 ? (
            <div className="vrm-cn-filtres" role="tablist" aria-label="Type de notification">
              <button type="button" role="tab" aria-selected={!filtre} className={'vrm-cn-filtre' + (!filtre ? ' is-actif' : '')} onClick={() => setFiltre('')}>Toutes</button>
              {types.map((t) => <button key={t.id} type="button" role="tab" aria-selected={filtre === t.id} data-centre-filtre={t.id} className={'vrm-cn-filtre' + (filtre === t.id ? ' is-actif' : '')} onClick={() => setFiltre(filtre === t.id ? '' : t.id)}>{t.titre}</button>)}
            </div>
          ) : <span className="vrm-cn-compte" data-centre-compte={nonLues}>{nonLues} non lue{nonLues > 1 ? 's' : ''}</span>}
          {nonLues > 0 && lu !== null ? <button type="button" className="vrm-cn-lien" data-centre-tout-lu="" onClick={toutMarquer}>Tout marquer lu</button> : null}
        </div>
      ) : null}
      <div className="vrm-cn-liste">
        {rangees.length && !filtre ? (
          <div className="vrm-cn-jour" data-centre-ranger={rangees.length}>
            <h3 className="vrm-cn-jour-titre">À ranger</h3>
            <ul>
              {rangees.map((r) => (
                <li key={'r' + r.tx}>
                  <div className="vrm-cn-ligne is-non-lue vrm-cn-ranger" data-centre-ranger-tx={r.tx} data-centre-ranger-case={r.case ? r.case.meubleId + ':' + r.case.i : ''}>
                    <span className="vrm-cn-point" aria-hidden="true"/>
                    <span className="vrm-cn-corps">
                      <span className="vrm-cn-meta"><span>{NOTIONS.arrives.un}</span>{r.at ? <time dateTime={new Date(r.at).toISOString()}>{heureCourte(r.at)}</time> : null}</span>
                      <span className="vrm-cn-ti">{r.titre || 'Un achat'}</span>
                      <span className="vrm-cn-tx">Première case libre : <b>{r.ou}</b></span>
                      <span className="vrm-cn-actions">
                        <Bouton variante="primaire" taille="petit" data-centre-ranger-ouvrir={r.tx} onClick={() => { onFermer(); if (onRanger) onRanger(r); }}>Ranger</Bouton>
                        <Bouton variante="discret" taille="petit" data-centre-ranger-fait={r.tx} onClick={() => { if (onRangeFait) onRangeFait(r); }}>Déjà rangé</Bouton>
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {entrees === undefined ? <div className="vrm-cn-vide" aria-busy="true"><span className="vrm-cn-attente" aria-hidden="true"/><span>Lecture en cours…</span></div>
          : entrees === null ? (
            <EtatPanne quoi="Tes notifications" raison="La base n’a pas répondu." onReessayer={lire} data-centre-passu=""/>
          ) : !entrees.length ? (
            rangees.length ? null : <div className="vrm-cn-vide" data-centre-vide=""><span className="vrm-cn-vide-ic" aria-hidden="true"><Icon name="bell2" size={22}/></span><b className="vrm-cn-vide-titre">Rien pour l’instant</b><span>Une vente, une offre ou un colis arrivé s’affichera ici.</span></div>
          ) : groupes.map((g) => (
            <div key={g.cle} className="vrm-cn-jour">
              <h3 className="vrm-cn-jour-titre">{g.titre}</h3>
              <ul>
                {regrouperLignes(g.items).map((e) => (
                  <li key={e.groupe ? e.cle : e.seq}>
                    {e.groupe ? <GroupeNotifs g={e} lu={lu} onOuvrir={ouvrir} Icon={Icon}/> : <LigneNotif e={e} nl={!estLue(e, lu)} onOuvrir={ouvrir} Icon={Icon}/>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {visibles && filtre && !visibles.length ? <div className="vrm-cn-vide"><span>Aucune de ce type.</span></div> : null}
      </div>
      <div className="vrm-cn-pied">
        <button type="button" className="vrm-cn-lien" data-centre-reglages="" onClick={() => { onFermer(); onReglages(); }}>Réglages des notifications</button>
      </div>
    </SheetShell>
  );
}
