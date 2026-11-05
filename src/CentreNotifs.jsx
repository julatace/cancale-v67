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
import { createPortal } from 'react-dom';
import { TYPES_CENTRE, ETAT_CENTRE, entreesDuJournal, estLue, marquerLues, toutLu, parJour, heureCourte, rechercheDe } from './journalNotifs.js';

const nomType = (f) => (TYPES_CENTRE.find((t) => t.id === f) || {}).titre || (f === 'test' ? 'Essai' : 'Autre');

// La cloche de l'en-tête : la pastille dit le nombre de non-lues (rien si 0 ou
// pas su — « pas su » n'affiche jamais « 0 »).
export function BoutonCentreNotifs({ nonLues, onOuvrir, Icon }) {
  const n = Number.isSafeInteger(nonLues) && nonLues > 0 ? nonLues : 0;
  const lib = n ? `Notifications : ${n} non lue${n > 1 ? 's' : ''}` : 'Notifications';
  return (
    <button className="vrm-hbtn vrm-cn-cloche" type="button" data-centre-notifs-cloche="" data-non-lues={Number.isSafeInteger(nonLues) ? String(nonLues) : ''}
      aria-label={lib} title={lib} onClick={onOuvrir}>
      <Icon name="bell2" size={21}/>
      {n ? <span className="vrm-cn-pastille" aria-hidden="true">{n > 99 ? '99+' : n}</span> : null}
    </button>
  );
}

// La feuille. `charger()` rend `{ journal: data|null, lu: data|null }` ;
// `ecrireLu(next)` rend true si la base l'a pris.
export function FeuilleCentreNotifs({ onFermer, charger, ecrireLu, onAller, onReglages, Fermer, Icon, z = 9500 }) {
  const [etat, setEtat] = React.useState({ entrees: undefined, lu: null });
  const [filtre, setFiltre] = React.useState('');
  const vivant = React.useRef(true);
  const lire = React.useCallback(async () => {
    setEtat((e) => ({ ...e, entrees: undefined }));
    const r = await charger().catch(() => ({ journal: null, lu: null }));
    if (vivant.current) setEtat({ entrees: entreesDuJournal(r.journal), lu: r.lu });
  }, [charger]);
  React.useEffect(() => { vivant.current = true; lire(); return () => { vivant.current = false; }; }, [lire]);
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
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
  return createPortal(
    <div className="vrm-cn-voile" data-noswipe="1" onClick={onFermer} style={{ zIndex: z }}>
      <Fermer fermer={onFermer}/>
      <section className="vrm-cn-feuille" role="dialog" aria-modal="true" aria-label="Notifications" data-centre-notifs=""
        data-centre-etat={entrees === undefined ? 'lecture' : entrees === null ? 'passu' : entrees.length ? 'lu' : 'vide'}
        onClick={(e) => e.stopPropagation()}>
        <header className="vrm-cn-tete">
          <h2 className="vrm-cn-titre">Notifications</h2>
          {nonLues > 0 && lu !== null ? <button type="button" className="vrm-cn-bouton" data-centre-tout-lu="" onClick={toutMarquer}>Tout marquer lu</button> : null}
          <button type="button" className="vrm-cn-fermer" aria-label="Fermer" onClick={onFermer}><Icon name="close" size={20}/></button>
        </header>
        {types.length > 1 ? (
          <div className="vrm-cn-filtres" role="tablist" aria-label="Type de notification">
            <button type="button" role="tab" aria-selected={!filtre} className={'vrm-cn-filtre' + (!filtre ? ' is-actif' : '')} onClick={() => setFiltre('')}>Toutes</button>
            {types.map((t) => <button key={t.id} type="button" role="tab" aria-selected={filtre === t.id} data-centre-filtre={t.id} className={'vrm-cn-filtre' + (filtre === t.id ? ' is-actif' : '')} onClick={() => setFiltre(filtre === t.id ? '' : t.id)}>{t.titre}</button>)}
          </div>
        ) : null}
        <div className="vrm-cn-liste" data-defile="1">
          {entrees === undefined ? <div className="vrm-cn-vide">…</div>
            : entrees === null ? (
              <div className="vrm-cn-vide" data-centre-passu="">
                <b>—</b><span>La liste n’a pas pu être lue.</span>
                <button type="button" className="vrm-cn-bouton" onClick={lire}>Réessayer</button>
              </div>
            ) : !entrees.length ? (
              <div className="vrm-cn-vide" data-centre-vide=""><span>Aucune notification envoyée pour l’instant.</span></div>
            ) : groupes.map((g) => (
              <div key={g.cle} className="vrm-cn-jour">
                <h3 className="vrm-cn-jour-titre">{g.titre}</h3>
                <ul>
                  {g.items.map((e) => {
                    const nl = !estLue(e, lu);
                    return (
                      <li key={e.seq}>
                        <button type="button" className={'vrm-cn-ligne' + (nl ? ' is-non-lue' : '')} data-centre-entree={e.seq} data-centre-type={e.famille} data-non-lue={nl ? '1' : '0'} data-centre-url={e.url} onClick={() => ouvrir(e)}>
                          <span className="vrm-cn-point" aria-hidden="true"/>
                          <span className="vrm-cn-corps">
                            <span className="vrm-cn-meta"><span>{nomType(e.famille)}</span>{ETAT_CENTRE[e.etat] ? <span className="vrm-cn-etat" data-centre-etat-entree={e.etat}>{ETAT_CENTRE[e.etat]}</span> : null}<time dateTime={new Date(e.t).toISOString()}>{heureCourte(e.t)}</time></span>
                            <span className="vrm-cn-ti">{e.titre || 'Notification'}</span>
                            {e.texte ? <span className="vrm-cn-tx">{e.texte}</span> : null}
                          </span>
                          {rechercheDe(e.url) ? <span className="vrm-cn-chevron" aria-hidden="true">›</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
        <footer className="vrm-cn-pied">
          <button type="button" className="vrm-cn-bouton" data-centre-reglages="" onClick={() => { onFermer(); onReglages(); }}>Réglages des notifications</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
