// ═══════════════════════════════════════════════════════════════════════════
// « VESTIAIRE PAS LU DEPUIS 5 JOURS » SUR AUJOURD'HUI (27 nov., Julien : « Vas-y fais tout »)
// ═══════════════════════════════════════════════════════════════════════════
// UNE rangée : le site et depuis combien de jours il n'est pas relu, le geste en dessous (« Ouvre-le dans le Chrome de
// l'extension »), le reste sous « Pourquoi ? » (le compte, la date, ce que ça change, les autres comptes en retard).
// « Compris » la range pour CE compte et CETTE lecture (src/lectureAncienne.js) : jamais une carte de reproche qui revient
// à chaque ouverture (§2.10). La règle et la source : la publication de la ligne de fraîcheur (src/fraicheur.js) — rien
// n'est relu ici, rien n'est recalculé. Textes par tr().
import React from 'react';
import { tr } from '../i18n/index.js';
import { Groupe, Rangee } from '../natif/index.js';
import { Actions, Pourquoi } from '../natif/Actions.jsx';
import { fraicheurPubliee, suivreFraicheur } from '../fraicheur.js';
import { nomPlateforme } from '../plateformes.js';
import { lecturesAnciennes, aMontrer, ranger } from '../lectureAncienne.js';

const CLE = 'vrm_lecture_ancienne_rangee';
const lireRanges = () => { try { const v = JSON.parse(localStorage.getItem(CLE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const ecrireRanges = (v) => { try { localStorage.setItem(CLE, JSON.stringify(v)); } catch (_) { /* rangée pour cette visite seulement */ } };
const dateCourte = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }); } catch (_) { return ''; } };

export default function LigneLectureAncienne({ Icon = null }) {
  const [f, setF] = React.useState(() => fraicheurPubliee());
  const [ranges, setRanges] = React.useState(lireRanges);
  React.useEffect(() => suivreFraicheur(setF), []);
  const maintenant = Date.now();
  const liste = aMontrer(lecturesAnciennes(f, maintenant), ranges);
  if (!liste.length) return null;
  const x = liste[0];
  const site = nomPlateforme(x.plateforme) || x.plateforme;
  const titre = tr('lectAnc.titre', { site, n: x.jours });
  const autres = liste.slice(1).map((y) => tr('lectAnc.autre', { site: nomPlateforme(y.plateforme) || y.plateforme, nom: y.nom, n: y.jours }));
  const compris = () => { const r = ranger(ranges, x); setRanges(r); ecrireRanges(r); };
  // (27 nov., lot tout-va-bien) « Tout va bien ? » : chaque morceau (extension, sites, e-mails, capture, favoris, serveur).
  const toutVaBien = () => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=settings&reglage=toutvabien' })); } catch (_) {} };
  return (
    <Groupe attrs={{ 'data-lecture-ancienne': x.cle, 'data-lecture-ancienne-jours': String(x.jours), 'data-lecture-ancienne-n': String(liste.length) }}>
      <Rangee icone={Icon ? <Icon name="clock" size={22}/> : null} titre={titre} sousTitre={tr('lectAnc.geste')} sousLignes={2} ton="neutre"
        attrs={{ 'data-lecture-ancienne-rangee': '', 'aria-label': [titre, x.nom, tr('lectAnc.geste')].filter(Boolean).join(' · ') }}/>
      <Pourquoi attrs={{ 'data-lecture-ancienne-pourquoi': '' }}>
        <p>{tr('lectAnc.pourquoi', { site, nom: x.nom || site, date: dateCourte(x.depuisMs) })}</p>
        {autres.length ? <p data-lecture-ancienne-autres={String(autres.length)}>{tr('lectAnc.aussi')} {autres.join(' · ')}</p> : null}
      </Pourquoi>
      <Actions className="n-actions-cible" elements={[{ cle: 'compris', icone: Icon ? <Icon name="check" size={18}/> : null, libelle: tr('lectAnc.compris'), onClick: compris, attrs: { 'data-lecture-ancienne-compris': x.cle } },
        { cle: 'toutvabien', icone: Icon ? <Icon name="heart" size={18}/> : null, libelle: tr('tvb.s.lienFraicheur'), onClick: toutVaBien, attrs: { 'data-lecture-ancienne-toutvabien': '' } }]}/>
    </Groupe>
  );
}
