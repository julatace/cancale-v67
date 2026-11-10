// ═══════════════════════════════════════════════════════════════════════════
// ANNONCES · À COMPLÉTER (10 nov., lot U) — la vue, minimale
// ═══════════════════════════════════════════════════════════════════════════
// La règle : src/annoncesACompleter.js. Une ligne = la photo, le manque NOMMÉ,
// le geste : « Modifier ↗ » ouvre la page de modification de Vinted (rien n'est
// envoyé à Vinted par VRM) ; « Prix d'achat » ouvre la saisie de VRM. Un filtre
// par manque (confort de l'écran, rien d'écrit). Ce qui n'est pas lu est DIT
// (« Photos pas lues sur 2 annonces »), jamais compté comme un manque.
import React from 'react';
import { MANQUES, NOM_PAS_SU, texteManque } from './annoncesACompleter.js';
import './styles-a-completer.css';

const NOM_FILTRE = { photos: 'Photos', marque: 'Marque', taille: 'Taille', etat: 'État', numero: 'N°', achat: 'Prix d’achat' };

export default function AnnoncesACompleter({ res, Photo, onPrixAchat }) {
  const [filtre, setFiltre] = React.useState('');
  if (!res || res.etat === 'encours') return <section className="vrm-qd vrm-ac" data-a-completer="encours"><div className="vrm-qd-vide">…</div></section>;
  if (res.etat === 'passu') return <section className="vrm-qd vrm-ac" data-a-completer="passu"><div className="vrm-qd-vide">— annonces pas lues.</div></section>;
  const cles = MANQUES.filter((k) => res.parManque[k] > 0);
  const f = filtre && res.parManque[filtre] > 0 ? filtre : '';
  const items = f ? res.items.filter((a) => a.manques.some((m) => m.cle === f)) : res.items;
  const pasSu = Object.keys(NOM_PAS_SU).filter((k) => res.pasSu[k] > 0);
  return (
    <section className="vrm-qd vrm-ac" data-a-completer="lu" data-a-completer-n={res.n} data-a-completer-total={res.total}>
      <div className="vrm-qd-tete"><h2 className="vrm-display vrm-qd-titre">À compléter<span className="vrm-qd-n">{res.n}</span></h2></div>
      {cles.length > 1 ? (
        <div className="vrm-filtres vrm-ac-filtres" role="group" aria-label="Filtrer par manque">
          <button type="button" aria-pressed={!f} data-ac-filtre="" onClick={() => setFiltre('')}>Tout</button>
          {cles.map((k) => <button key={k} type="button" aria-pressed={f === k} data-ac-filtre={k} onClick={() => setFiltre(k)}>{NOM_FILTRE[k]}<span className="vrm-of-n">{res.parManque[k]}</span></button>)}
        </div>
      ) : null}
      {pasSu.length ? <p className="vrm-ac-passu" data-ac-pas-su={pasSu.join(' ')}>{pasSu.map((k) => `${NOM_PAS_SU[k]} sur ${res.pasSu[k]} annonce${res.pasSu[k] > 1 ? 's' : ''}`).join(' · ')}.</p> : null}
      {!res.n ? <div className="vrm-qd-vide" data-a-completer-vide="">Rien à compléter.</div> : (
        <ul className="vrm-qd-liste">
          {items.map((a) => (
            <li key={a.id} className="vrm-qd-ligne vrm-ac-ligne" data-ac-annonce={a.id} data-ac-manques={a.manques.map((m) => m.cle).join(' ')}>
              {a.photo && Photo ? <Photo src={a.photo} className="vrm-qd-photo" alt=""/> : <span className="vrm-qd-photo" aria-hidden="true"/>}
              <span className="vrm-qd-centre">
                <span className="vrm-qd-nom">{a.num ? <span className="vrm-qd-num">N°{a.num}</span> : null}{a.titre || 'Sans titre'}</span>
                <span className="vrm-ac-manques">
                  {a.manques.map((m) => <span key={m.cle} className="vrm-ac-manque" data-ac-manque={m.cle}>{texteManque(m)}</span>)}
                </span>
                {a.compte ? <span className="vrm-qd-sous">{a.compte}</span> : null}
              </span>
              <span className="vrm-ac-gestes">
                {a.vinted && a.lien ? <a className="vrm-qd-agir vrm-ac-agir" data-ac-modifier={a.id} href={a.lien} target="_blank" rel="noreferrer" aria-label={`Modifier ${a.titre || 'l’annonce'} sur Vinted`}>Modifier ↗</a> : null}
                {a.achat && onPrixAchat ? <button type="button" className="vrm-qd-agir vrm-ac-agir" data-ac-prix-achat={a.id} onClick={() => onPrixAchat(a.id)} aria-label={`Saisir le prix d’achat de ${a.titre || 'l’annonce'}`}>Prix d’achat</button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
