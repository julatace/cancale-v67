// ── src/natif/ecrans/Automatisations.jsx — « Automatisations » : les automatismes de VRM en DEUX VOLETS (19 nov. soir) ─────
// Julien (captures d'un outil de vendeur) : la liste des automatismes avec « Activé / Désactivé », et le détail en
// sections MESSAGES (plusieurs messages, un au hasard ; ✎ 🗑 interrupteur ; « + Ajouter »), CIBLAGE, DÉLAIS ; en bas
// « Réinitialiser » et un plein « Démarrer ». NATIF.md §2 bis.
// Une VUE : l'état « Activé » est LU par le branchement (src/automatisations/Branchement.jsx) dans le VRAI réglage de
// chaque moteur, et chaque geste écrit dans la clé EXISTANTE de ce moteur (aucun nouveau moteur, aucune garde retirée).
//
// Props : items [{ cle, titre, sous, icone, actif (true · false · null = pas su), compte?, onglets?, detail(onglet) → nœud,
//   plein?: { libelle, onClick, indisponible, raison, chargement }, reinitialiser?: fn, modifie? }] ; choisi / onChoisir ; Icon.
// Les briques du détail : SectionAuto, MessagesAuto, ReglageAuto, ChoixAuto, ChampNombre, PhraseAuto.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Page, PagePoussee } from '../Page.jsx';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Interrupteur } from '../Rangee.jsx';
import { Bouton } from '../Bouton.jsx';
import { Feuille } from '../Feuille.jsx';
import { useOrdinateur } from '../Coque.jsx';
import '../jetons.css';
import '../natif.css';
import '../tableau.css';
import './automatisations.css';

export function EtatAuto({ actif }) {
  const t = actif === true ? 'on' : actif === false ? 'off' : 'passu';
  return <span className="n-au-etat" data-au-etat={t}><span className="n-au-etat-point" aria-hidden="true"/>{tr('auto.etat.' + t)}</span>;
}
export function SectionAuto({ titre, phrase = '', children, attrs = null }) {
  return (
    <section className="n-au-section" {...(attrs || {})}>
      <h3 className="n-au-section-titre">{titre}</h3>
      {phrase ? <p className="n-au-phrase">{phrase}</p> : null}
      {children}
    </section>
  );
}
export function PhraseAuto({ children, ton = 'neutre' }) { return <p className="n-au-phrase" data-au-ton={ton}>{children}</p>; }
// Une ligne de réglage : le nom, la phrase grise, le contrôle à droite.
export function ReglageAuto({ libelle, phrase = '', children, attrs = null }) {
  return (
    <div className="n-au-reglage" {...(attrs || {})}>
      <div className="n-au-reglage-texte"><span className="n-au-reglage-nom">{libelle}</span>{phrase ? <span className="n-au-reglage-phrase">{phrase}</span> : null}</div>
      <div className="n-au-reglage-controle">{children}</div>
    </div>
  );
}
// Un choix parmi quelques paliers (jamais une saisie libre là où le moteur n'en accepte pas).
export function ChoixAuto({ valeur, options, onChange, libelle, attrs = null }) {
  return (
    <select className="n-au-choix" value={String(valeur)} aria-label={libelle} onChange={(e) => onChange(e.target.value)} {...(attrs || {})}>
      {options.map((o) => <option key={o.cle} value={String(o.cle)}>{o.libelle}</option>)}
    </select>
  );
}
// (20 nov., chasse-bugs-2) Saisie LIBRE, validation à la SORTIE (blur, Entrée) : avant, chaque frappe était ramenée dans
// [min, max] — vider un palier posait 1 (« 5 » devenait « 15 »), « 1 » vers « 10 » était ramené à 5. Pendant la saisie, seul
// un nombre déjà dans les bornes part ; à la sortie, hors bornes ⇒ ramené dans les bornes, vide ⇒ « aucun » si `videPermis`,
// sinon la valeur d'avant revient. Banc : scripts/bancs/champ-nombre.cjs.
export function ChampNombre({ valeur, onChange, libelle, unite = '', min = 0, max = 999, attrs = null, videPermis = true }) {
  const v0 = valeur == null ? '' : String(valeur);
  const [texte, setTexte] = React.useState(v0);
  const edite = React.useRef(false);
  React.useEffect(() => { if (!edite.current) setTexte(v0); }, [v0]);
  const dansBornes = (t) => t !== '' && Number(t) >= min && Number(t) <= max;
  const valider = () => {
    edite.current = false;
    if (texte === '') { if (videPermis) { if (v0 !== '') onChange(''); } else setTexte(v0); return; }
    const n = String(Math.min(max, Math.max(min, Number(texte))));
    setTexte(n);
    if (n !== v0) onChange(n);
  };
  return (
    <span className="n-au-nombre">
      <input type="text" inputMode="numeric" className="n-au-nombre-champ" value={texte} aria-label={libelle}
        onChange={(e) => { edite.current = true; const t = e.target.value.replace(/[^\d]/g, '').slice(0, 4); setTexte(t); if (dansBornes(t) && String(Number(t)) !== v0) onChange(String(Number(t))); }}
        onBlur={valider} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} {...(attrs || {})}/>
      {unite ? <span className="n-au-nombre-unite">{unite}</span> : null}
    </span>
  );
}

// MESSAGES : chaque message sur une carte (le texte, son étiquette, ✎ 🗑 et son interrupteur), puis « + Ajouter un message ».
export function MessagesAuto({ messages, onModifier, onSupprimer, onBasculer, onAjouter, etiquette = '', maxi = 5, erreur = '' }) {
  const [edition, setEdition] = React.useState(null);     // { i (-1 = nouveau), texte }
  const enregistrer = () => { if (!edition) return; const t = edition.texte.trim(); if (!t) { setEdition(null); return; } if (edition.i < 0) onAjouter(t); else onModifier(edition.i, t); setEdition(null); };
  return (
    <div className="n-au-messages" data-au-messages={String(messages.length)}>
      {messages.map((m, i) => (
        <div key={i} className="n-au-message" data-au-message={i} data-au-message-actif={m.actif ? '1' : '0'}>
          <div className="n-au-message-texte"><span className="n-au-message-corps">{m.texte}</span>{etiquette ? <span className="n-au-message-etiquette">{etiquette}</span> : null}</div>
          <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.msg.modifier')} title={tr('auto.msg.modifier')} data-au-modifier={i} onClick={() => setEdition({ i, texte: m.texte })}>✎</button>
          <button type="button" className="n-tt-bouton n-tt-bouton-icone n-au-icone" aria-label={tr('auto.msg.supprimer')} title={tr('auto.msg.supprimer')} data-au-supprimer={i} onClick={() => onSupprimer(i)}>🗑</button>
          <Interrupteur actif={m.actif} libelle={tr('auto.msg.actif', { n: i + 1 })} onChange={(v) => onBasculer(i, v)} attrs={{ 'data-au-basculer': i }}/>
        </div>
      ))}
      {erreur ? <p className="n-au-phrase" data-au-ton="ambre" role="alert" data-au-erreur="">{erreur}</p> : null}
      {messages.length < maxi ? <span><button type="button" className="n-tt-bouton" data-au-ajouter="" onClick={() => setEdition({ i: -1, texte: '' })}>＋ {tr('auto.msg.ajouter')}</button></span> : null}
      <Feuille ouverte={!!edition} onFermer={() => setEdition(null)} titre={edition && edition.i < 0 ? tr('auto.msg.nouveau') : tr('auto.msg.modifier')} attrs={{ 'data-au-edition': '' }}
        pied={<Bouton variante="plein" onClick={enregistrer} attrs={{ 'data-au-edition-ok': '' }}>{tr('auto.msg.garder')}</Bouton>}>
        {edition ? <div className="n-au-edition"><textarea className="n-au-zone" rows={5} value={edition.texte} aria-label={tr('auto.msg.texte')} onChange={(e) => setEdition({ ...edition, texte: e.target.value })} data-au-zone=""/></div> : null}
      </Feuille>
    </div>
  );
}

export default function Automatisations({ items = [], choisi = '', onChoisir, Icon = null, compte = '' }) {
  const ordinateur = useOrdinateur();
  const [onglet, setOnglet] = React.useState('config');
  const it = items.find((x) => x.cle === choisi) || (ordinateur ? items[0] : null) || null;
  React.useEffect(() => { setOnglet('config'); }, [it && it.cle]);
  const liste = (
    <Groupe attrs={{ 'data-au-liste': '' }}>
      {items.map((x) => <Rangee key={x.cle} icone={Icon && x.icone ? <Icon name={x.icone} size={22}/> : null} titre={x.titre} sousTitre={x.sous} lignes={1}
        pastille={<EtatAuto actif={x.actif}/>} fin={ordinateur ? null : 'chevron'} selectionnee={ordinateur && it && it.cle === x.cle} onClick={() => onChoisir(x.cle)}
        attrs={{ 'data-au-item': x.cle, 'data-au-actif': x.actif === true ? '1' : x.actif === false ? '0' : '' }}/>)}
    </Groupe>
  );
  const pied = it && (it.plein || it.reinitialiser) ? (
    <div className="n-au-pied" data-au-pied="">
      {it.reinitialiser ? <Bouton variante="texte" onClick={it.reinitialiser} indisponible={!it.modifie} raison={!it.modifie ? '' : ''} attrs={{ 'data-au-reinit': '' }}>{tr('auto.reinitialiser')}</Bouton> : <span/>}
      {it.plein ? <Bouton variante="plein" chargement={!!it.plein.chargement} indisponible={!!it.plein.indisponible} raison={it.plein.raison || ''} onClick={it.plein.onClick} attrs={{ 'data-au-plein': it.cle, 'data-v2-principal': 'auto' }}>{it.plein.libelle}</Bouton> : null}
    </div>
  ) : null;
  const detail = it ? (
    <div className="n-au-detail" data-au-detail={it.cle}>
      <header className="n-au-tete">
        <div className="n-au-tete-texte"><h2 className="n-au-titre">{it.titre}</h2><p className="n-au-phrase">{it.sous}</p></div>
        <EtatAuto actif={it.actif}/>
      </header>
      {it.compte ? <div className="n-au-compte"><ReglageAuto libelle={tr('auto.compte')}><ChoixAuto libelle={tr('auto.compte')} valeur={it.compte.valeur} options={it.compte.options} onChange={it.compte.onChange} attrs={{ 'data-au-compte': '' }}/></ReglageAuto></div> : null}
      {it.onglets && it.onglets.length > 1 ? <div className="n-au-onglets" role="tablist">{it.onglets.map((o) => <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} className="n-au-onglet" data-au-onglet={o.cle} onClick={() => setOnglet(o.cle)}>{o.libelle}</button>)}</div> : null}
      <div className="n-au-corps">{it.detail(onglet)}</div>
    </div>
  ) : null;
  if (ordinateur) {
    return (
      <Page titre={tr('auto.titre')} plein={pied} attrs={{ 'data-au-ecran': '', 'data-au-vue': 'volets' }}>
        <div className="n-tt-tete"><span className="n-tt-compte"><span className="n-tt-compte-point" aria-hidden="true"/>{compte || tr('tableau.tousComptes')}</span></div>
        <div className="n-au-volets">
          <div className="n-au-volet-liste">{liste}</div>
          <div className="n-au-volet-detail">{detail}</div>
        </div>
      </Page>
    );
  }
  return (
    <>
      <Page titre={tr('auto.titre')} attrs={{ 'data-au-ecran': '', 'data-au-vue': 'liste' }}>{liste}</Page>
      <PagePoussee ouverte={!!choisi && !!it} titre={it ? it.titre : ''} libelleRetour={tr('auto.titre')} onRetour={() => onChoisir('')} plein={pied}>{detail}</PagePoussee>
    </>
  );
}
