// ── src/conseiller/Conseiller.jsx — « Conseils du jour » (Aujourd'hui) et l'écran « Conseiller » (23 nov.) ──
// docs/passation/2026-11-23-conseiller.md. Les conseils arrivent CALCULÉS (src/conseiller/regles.js sur
// src/conseiller/sources.js) : ici, seulement leur texte (tr, 5 langues) et le geste. Rien ne part d'ici : un toucher
// OUVRE l'écran VRM où il fait le geste lui-même. Composants natifs, aucun style en ligne, aucune couleur en dur.
import React from 'react';
import { Carte, Groupe, Rangee, Bouton, Vide, Colonnes, Colonne, Plaque, Vignette, Progression, Pastille, BoutonIcone } from '../natif/index.js';
import { tr, monnaie, nombre, localeCourante } from '../i18n/index.js';
import { pourCarte, grouper, syntheseDuJour } from './regles.js';
import Presentation, { presentationVue } from './Presentation.jsx';
import './conseiller.css';

const eur = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : monnaie(Number(v), 'EUR', Number.isInteger(Number(v)) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : undefined));
// Le nom d'un jour de la semaine (0 = dimanche), dans la langue.
export function nomJour(i) {
  try { const d = new Date(2026, 10, 22 + Number(i)); return d.toLocaleDateString(localeCourante(), { weekday: 'long' }); } catch (_) { return ''; }
}
const ICONES = { colis: 'truck', offres: 'tag', seuil: 'balance', baisses: 'euro', prix: 'pencil', racheter: 'bag', rapporte: 'chart', dorment: 'sleep', jour: 'calendar', compte: 'users' };

// Le texte d'un conseil : { titre, preuve, geste } — chaque nombre vient de `c.params` (la même source que l'écran).
export function texteConseil(c) {
  const p = c.params || {};
  switch (c.id) {
    case 'colis': return { titre: tr('cons.colis.titre.' + p.quand, { n: p.n }), preuve: p.quand === 'demain' && p.nAuj > 0 ? tr('cons.colis.preuveDont', { n: p.nAuj }) : tr('cons.colis.preuve'), geste: tr('cons.colis.gs') };
    case 'offres': return { titre: tr('cons.offres.tt', { n: p.n }), preuve: p.avecAge ? tr('cons.offres.preuve', { n: p.jours, j: nombre(p.jours) }) : tr('cons.offres.preuveSansAge'), geste: tr('cons.offres.gs') };
    case 'seuil': return { titre: tr('cons.seuil.titre.' + p.seuil, { pct: p.pct, plateforme: p.plateforme }), preuve: tr(p.auMoins ? 'cons.seuil.preuveAuMoins' : 'cons.seuil.preuve'), geste: tr('cons.seuil.gs') };
    case 'baisses': return { titre: tr('cons.baisses.tt', { n: p.n }), preuve: tr('cons.baisses.preuve'), geste: tr('cons.baisses.gs') };
    case 'prix': return { titre: tr('cons.prix.tt', { n: p.n }), preuve: tr('cons.prix.preuve', { sur: nombre(p.sur), n: p.sur }), geste: tr('cons.prix.gs') };
    case 'racheter': return { titre: tr('cons.racheter.tt', { nom: p.nom }), preuve: tr('cons.racheter.preuve', { n: p.n, moyen: eur(p.moyen), jours: nombre(Math.round(p.jours)) }), geste: tr('cons.stats.gs') };
    case 'rapporte': return { titre: tr('cons.rapporte.tt', { nom: p.nom }), preuve: tr('cons.rapporte.preuve', { n: p.n, moyen: eur(p.moyen) }), geste: tr('cons.stats.gs') };
    case 'dorment': return { titre: tr(p.auMoins ? 'cons.dorment.titreAuMoins' : 'cons.dorment.tt', { n: p.n }), preuve: tr('cons.dorment.preuve'), geste: tr('cons.dorment.gs') };
    case 'jour': return { titre: tr('cons.jour.tt', { jour: nomJour(p.jour) }), preuve: tr('cons.jour.preuve', { n: p.n, total: p.total, moyenne: nombre(p.moyenne), veille: nomJour(p.veille) }), geste: tr('cons.stats.gs') };
    case 'compte': return { titre: tr('cons.compte.tt', { nom: p.nom }), preuve: tr('cons.compte.preuve', { n: p.n, n2: p.n2, deux: p.deux }), geste: tr('cons.stats.gs') };
    default: return { titre: '', preuve: '', geste: '' };
  }
}

// LE MINI-VISUEL d'un conseil (23 nov., coordinateur : « quand c'est parlant ») : les N° des colis, les photos de SES
// annonces concernées, la barre d'un seuil ou des prix saisis, la semaine des ventes, deux comptes côte à côte. Tout vient de
// `c.visuel` (posé par la règle, sur la même source) ; rien sinon. Hauteurs et largeurs en paliers (aucun style en ligne).
const palier = (x, max) => String(max > 0 ? Math.max(0, Math.min(10, Math.round((x / max) * 10))) : 0);
export function Visuel({ v, Photo = null }) {
  if (!v) return null;
  if (v.type === 'plaques') return <span className="n-cons-plaques" data-cons-visuel="plaques">{v.nums.map((n) => <Plaque key={n} numero={n}/>)}</span>;
  if (v.type === 'photos') {
    const montrees = v.photos.slice(0, 2);   // deux photos et « +N » : le bouton garde sa place, même au téléphone
    const reste = Math.max(0, (v.total || 0) - montrees.length);
    return <span className="n-cons-photos" data-cons-visuel="photos">{montrees.map((src, i) => <Vignette key={i} taille={36} image={Photo ? <Photo src={src} alt="" width={36} height={36} loading="lazy" decoding="async"/> : null} src={Photo ? '' : src}/>)}{reste > 0 ? <span className="n-cons-plus">+{nombre(reste)}</span> : null}</span>;
  }
  if (v.type === 'barre') return <span className="n-cons-barre" data-cons-visuel="barre"><Progression pct={v.pct} texte="" detail={nombre(v.pct) + ' %'}/></span>;
  if (v.type === 'semaine') {
    const max = Math.max(...v.n);
    return <span className="n-cons-semaine" data-cons-visuel="semaine" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 0].map((j) => <span key={j} className="n-cons-jour" data-actif={j === v.jour ? '1' : undefined}><span className="n-cons-baton" data-h={palier(v.n[j], max)}/><span className="n-cons-initiale">{nomJour(j).charAt(0).toUpperCase()}</span></span>)}</span>;
  }
  if (v.type === 'duo') {
    const max = Math.max(v.a, v.b);
    return <span className="n-cons-duo" data-cons-visuel="duo" aria-hidden="true"><span className="n-cons-trait" data-w={palier(v.a, max)} data-actif="1"/><span className="n-cons-trait" data-w={palier(v.b, max)}/></span>;
  }
  return null;
}

// Une rangée de conseil. « Aujourd'hui » (Julien, 23 nov. : « je n'aime pas l'orange ») : le titre en gras + une pastille
// de la couleur d'accent — jamais d'orange. Sur l'écran : le visuel, LE bouton du geste et « Pourquoi ? » sous le texte
// (`pied` : jamais un bouton dans un bouton) ; « Pourquoi ? » déplie l'explication de la règle, avec son visuel ANIMÉ quand
// il y en a un. Sur la carte d'Aujourd'hui : la rangée entière se touche (chevron).
// Le geste de chaque conseil : une icône et un verbe (Julien : « trop de texte, pas assez de beaux boutons »).
const ICONE_GESTE = { envoyer: 'truck', offres: 'chat', argent: 'euro', baisses: 'tag', prix: 'pencil', stats: 'chart', dorment: 'sync' };
function LigneConseil({ c, onGeste, Icon, Photo = null, ecran = false }) {
  const t = texteConseil(c);
  const [ouvert, setOuvert] = React.useState(false);
  const idPq = React.useId();
  const auj = c.ton === 'aujourdhui';
  const attrs = { 'data-cons': c.id, 'data-cons-geste': c.geste, 'data-cons-ton': c.ton, 'data-cons-chiffres': JSON.stringify(c.chiffres || {}), 'aria-label': `${auj ? tr('cons.aujourdhui') + ' — ' : ''}${t.titre}` };
  const icone = Icon ? <Icon name={ICONES[c.id] || 'ampoule'} size={22}/> : null;
  const pastille = auj ? <Pastille ton="accent">{tr('cons.aujourdhui')}</Pastille> : null;
  // La carte d'Aujourd'hui : le titre chiffré seul, la rangée se touche.
  if (!ecran) return <Rangee icone={icone} titre={t.titre} lignes={2} ton="neutre" pastille={pastille} fin="chevron" onClick={() => onGeste && onGeste(c.geste, c)} attrs={attrs}/>;
  // L'écran : le titre chiffré, le mini-visuel, UN beau bouton (icône + verbe) ; la preuve et la règle sous « Pourquoi ? ».
  return (
    <Rangee icone={icone} titre={t.titre} lignes={2} ton="neutre" pastille={pastille} attrs={attrs}
      fin={<BoutonIcone libelle={ouvert ? tr('cons.replier') : tr('cons.btnPq')} icone={Icon ? <Icon name="info" size={20}/> : null} actif={ouvert} onClick={() => setOuvert((x) => !x)}
        attrs={{ 'aria-expanded': ouvert ? 'true' : 'false', 'aria-controls': idPq, 'data-cons-pourquoi': c.id }}/>}
      pied={<div className="n-cons-bas">
        <div className="n-cons-pied">
          <Visuel v={c.visuel} Photo={Photo}/>
          <Bouton variante="teinte" icone={Icon ? <Icon name={ICONE_GESTE[c.geste] || 'check'} size={18}/> : null} onClick={() => onGeste && onGeste(c.geste, c)} attrs={{ 'data-cons-bouton': c.id }}>{t.geste}</Bouton>
        </div>
        {ouvert ? <div className="n-cons-explication" id={idPq} data-cons-explication={c.id}>
          {c.visuel ? <div className="n-cons-anime" aria-hidden="true"><Visuel v={c.visuel} Photo={Photo}/></div> : null}
          <div className="n-cons-textes"><p className="n-cons-preuve">{t.preuve}</p><p>{tr('cons.' + c.id + '.pq')}</p></div>
        </div> : null}
      </div>}/>
  );
}

// LA PHRASE DU JOUR : « 3 gestes à faire aujourd'hui · 130 € d'offres en attente · 2 pistes pour gagner plus ».
export function texteSynthese(S) {
  if (!S || !S.total) return tr('cons.vide');
  const morceaux = [S.faire ? tr('cons.synthese.faire', { n: S.faire }) : tr('cons.synthese.rienUrgent')];
  if (S.sommeOffres != null) morceaux.push(tr('cons.synthese.offres', { x: eur(S.sommeOffres) }));
  if (S.gagner) morceaux.push(tr('cons.synthese.gagner', { n: S.gagner }));
  return morceaux.join(' · ');
}

// La carte d'Aujourd'hui : la phrase du jour, puis 3 conseils au plus ; rien à dire ⇒ AUCUNE carte (jamais une carte vide).
export function CarteConseils({ liste, onGeste, onToutVoir = null, Icon = null }) {
  if (!Array.isArray(liste) || !liste.length) return null;
  const L = pourCarte(liste);
  const S = syntheseDuJour(liste);
  return (
    <Carte titre={tr('cons.carte')} sousTitre={texteSynthese(S)} n={liste.length > L.length ? liste.length : null}
      action={onToutVoir ? <Bouton variante="texte" onClick={onToutVoir} attrs={{ 'data-cons-tout': '' }}>{tr('cons.toutVoir')}</Bouton> : null}
      attrs={{ 'data-v2-bloc': 'conseils', 'data-cons-n': String(liste.length), 'data-cons-ids': L.map((c) => c.id).join(','), 'data-cons-synthese': JSON.stringify(S) }}>
      {L.map((c) => <LigneConseil key={c.id} c={c} onGeste={onGeste} Icon={Icon}/>)}
    </Carte>
  );
}

// L'écran « Conseiller » : la phrase du jour en tête, « Demande à VRM » juste dessous (passé en `demande`), puis trois
// groupes — à faire aujourd'hui · pour gagner plus · à savoir — en deux colonnes à l'ordinateur, à la suite au téléphone.
export function EcranConseiller({ liste, etat = 'lu', onGeste, Icon = null, Photo = null, demande = null }) {
  const lecture = etat === 'encours';
  const G = grouper(liste);
  const S = syntheseDuJour(liste);
  const groupe = (k) => (G[k].length ? <Groupe key={k} titre={tr('cons.groupe.' + k)} attrs={{ 'data-cons-groupe': k, 'data-cons-groupe-n': String(G[k].length) }}>
    {G[k].map((c) => <LigneConseil key={c.id} c={c} onGeste={onGeste} Icon={Icon} Photo={Photo} ecran/>)}</Groupe> : null);
  const vide = !lecture && (!Array.isArray(liste) || !liste.length);
  // (23 nov., Julien : « un vrai accompagnement ») la présentation animée au PREMIER passage ; « Revoir » la rouvre.
  const [pres, setPres] = React.useState(() => !presentationVue());
  return (
    <section className="n-cons" data-cons-ecran={etat} data-cons-n={Array.isArray(liste) ? String(liste.length) : ''} data-cons-synthese={JSON.stringify(S)} aria-label={tr('cons.ecran')}>
      <header className="n-cons-tete" data-cons-tete="">
        <p className="n-cons-phrase" aria-busy={lecture ? 'true' : undefined}>{lecture ? tr('cons.lecture') : texteSynthese(S)}</p>
        <p className="n-cons-sous"><Bouton variante="texte" taille="compact" onClick={() => setPres(true)} attrs={{ 'data-pres-revoir': '' }}>{tr('cons.pres.revoir')}</Bouton></p>
      </header>
      <Presentation ouverte={pres} onFermer={() => setPres(false)}/>
      {demande ? <div className="n-cons-demande">{demande}</div> : null}
      {vide ? <Groupe attrs={{ 'data-cons-groupe': 'vide' }}><Vide icone={Icon ? <Icon name="check" size={36}/> : null} phrase={tr('cons.vide')} detail={tr('cons.videSous')}/></Groupe> : null}
      {!lecture && !vide ? <Colonnes className="n-cons-colonnes">
        <Colonne>{groupe('faire')}{groupe('savoir')}</Colonne>
        <Colonne>{groupe('gagner')}</Colonne>
      </Colonnes> : null}
    </section>
  );
}
