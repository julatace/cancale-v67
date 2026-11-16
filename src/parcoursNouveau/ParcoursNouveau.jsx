// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS D'UN NOUVEAU — L'ÉCRAN (15 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// La règle : ./regle.js. Ici le dessin seul, en « verre dépoli » (le choix de Julien,
// src/design/studio-verre.css) : le bleu profond en fond, une plaque de verre par étape,
// le titre en blanc, UN plein par écran (le geste de l'étape), « Précédent » et
// « Plus tard » en liens. Huit segments en haut : où on en est, ce qui est prouvé.
// Aucune requête ici : l'écran reçoit les états (preuves lues par la coque) et rend
// les gestes à la coque (`onChoisirPlateformes`, `onChoisirNumeros`…), qui écrit.
// Tout texte passe par tr() (cinq langues). Les captures sont celles du MODE EXEMPLE
// (public/accueil/*.webp, `modeExemple: true`), marquées « Exemple · inventé ».
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import MarquePlateforme from '../plateformes/Marque.jsx';
import { ETAPES_NOUVEAU, SITES_PARCOURS, progression, captureDe, LIENS_EXTENSION, estDerniere } from './regle.js';
import './parcours-nouveau.css';
import { motsNavigateur } from '../navigateurExtension.js';   // (16 nov.) la page des extensions de CE navigateur, jamais « chrome:// » en dur

// Des noms propres (jamais traduits) dans les dessins.
const DOMAINE_VINTED = 'vinted.fr', NOM_ORION = 'Orion';
const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
const LIEN_SITE = { vinted: 'https://www.vinted.fr', leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', vestiaire: 'https://www.vestiairecollective.com/' };

function Diode({ etat }) {
  return <span className="pn-diode" data-etat={etat} aria-hidden="true" />;
}
function Statut({ etat, children, cle }) {
  return <p className="pn-statut" data-pn-statut={cle || ''} data-etat={etat} role="status"><Diode etat={etat} />{children}</p>;
}
function Puces({ lignes }) {
  return (
    <ol className="pn-puces">
      {lignes.map((l, i) => <li key={i}><span className="pn-puce-n" aria-hidden="true">{i + 1}</span><span>{l}</span></li>)}
    </ol>
  );
}

// ── Les illustrations : des captures du mode exemple, ou un dessin en trait ──
function Capture({ cle, sombre }) {
  const src = captureDe(cle, sombre);
  if (!src) return null;
  return (
    <div className="pn-telephone" data-pn-capture={cle}>
      <img src={src} alt="" width="390" height="844" loading="eager" decoding="async" />
      <span className="pn-marque-exemple">{tr('pn.exemple')}</span>
    </div>
  );
}
function DessinNavigateur() {
  return (
    <svg className="pn-dessin" viewBox="0 0 320 220" aria-hidden="true" focusable="false">
      <rect x="10" y="20" width="300" height="180" rx="18" className="pn-d-cadre" />
      <path d="M10 58h300" className="pn-d-trait" />
      <circle cx="34" cy="39" r="5" className="pn-d-point" /><circle cx="52" cy="39" r="5" className="pn-d-point" /><circle cx="70" cy="39" r="5" className="pn-d-point" />
      <rect x="92" y="30" width="150" height="18" rx="9" className="pn-d-champ" />
      <g transform="translate(262 28)"><rect width="34" height="22" rx="7" className="pn-d-badge" /><text x="17" y="15.5" textAnchor="middle" className="pn-d-badge-t">VRM</text></g>
      <rect x="34" y="82" width="120" height="10" rx="5" className="pn-d-ligne" />
      <rect x="34" y="104" width="190" height="10" rx="5" className="pn-d-ligne pn-d-ligne-2" />
      <rect x="34" y="126" width="160" height="10" rx="5" className="pn-d-ligne pn-d-ligne-2" />
      <path d="M279 52 C 270 92, 220 120, 200 150" className="pn-d-fleche" />
      <rect x="150" y="146" width="132" height="34" rx="12" className="pn-d-carte" />
      <text x="216" y="168" textAnchor="middle" className="pn-d-carte-t">{DOMAINE_VINTED + ' ✓'}</text>
    </svg>
  );
}
function DessinIphone() {
  return (
    <svg className="pn-dessin" viewBox="0 0 320 220" aria-hidden="true" focusable="false">
      <rect x="96" y="6" width="128" height="208" rx="26" className="pn-d-cadre" />
      <rect x="140" y="14" width="40" height="8" rx="4" className="pn-d-point" />
      <g transform="translate(118 44)">
        <rect width="38" height="38" rx="10" className="pn-d-tuile" /><circle cx="19" cy="19" r="11" className="pn-d-orion" /><path d="M19 10 L22 19 L19 28 L16 19 Z" className="pn-d-aiguille" />
        <text x="19" y="54" textAnchor="middle" className="pn-d-nom">{NOM_ORION}</text>
      </g>
      <g transform="translate(166 44)">
        <rect width="38" height="38" rx="10" className="pn-d-tuile pn-d-tuile-accent" /><text x="19" y="25" textAnchor="middle" className="pn-d-v">V</text>
        <text x="19" y="54" textAnchor="middle" className="pn-d-nom">Vinted</text>
      </g>
      <rect x="112" y="120" width="96" height="44" rx="12" className="pn-d-carte" />
      <text x="160" y="139" textAnchor="middle" className="pn-d-carte-t">{tr('pn.dessin.ouvrirUrl')}</text>
      <text x="160" y="154" textAnchor="middle" className="pn-d-nom">{DOMAINE_VINTED}</text>
      <path d="M188 104 C 196 108, 194 114, 186 120" className="pn-d-fleche" />
    </svg>
  );
}
function DessinHistorique() {
  const h = [22, 34, 28, 46, 40, 58, 52, 64, 60, 76, 70, 88];
  return (
    <svg className="pn-dessin" viewBox="0 0 320 220" aria-hidden="true" focusable="false">
      {h.map((v, i) => <rect key={i} x={24 + i * 23.5} y={180 - v * 1.6} width="14" height={v * 1.6} rx="7" className={i < 8 ? 'pn-d-barre pn-d-barre-lue' : 'pn-d-barre'} />)}
      <path d="M18 186h284" className="pn-d-trait" />
    </svg>
  );
}
function Plateformes({ choisis }) {
  return (
    <div className="pn-anneau" aria-hidden="true">
      {SITES_PARCOURS.map((s) => <span key={s} className="pn-anneau-site" data-choisi={choisis.includes(s) ? '1' : '0'}><MarquePlateforme site={s} taille={26} carre /></span>)}
    </div>
  );
}
function Pile({ sombre }) {
  return (
    <div className="pn-pile" aria-hidden="true">
      <Capture cle="numeros" sombre={sombre} />
      <Capture cle="journee" sombre={sombre} />
    </div>
  );
}

// ── Les contenus d'étape ──
function EtapeBienvenue({ etats }) {
  return (
    <div className="pn-verre">
      <Statut etat={etats.bienvenue.etat} cle="bienvenue">{tr('pn.bienvenue.compte')}</Statut>
      <ol className="pn-sommaire">
        {ETAPES_NOUVEAU.slice(1).map((e, i) => <li key={e} data-etat={etats[e] ? etats[e].etat : 'afaire'}><span className="pn-puce-n" aria-hidden="true">{i + 2}</span>{tr('pn.court.' + e)}</li>)}
      </ol>
    </div>
  );
}

function EtapePlateformes({ choix, setChoix, erreur }) {
  const basculer = (s) => setChoix((c) => (c.includes(s) ? c.filter((x) => x !== s) : SITES_PARCOURS.filter((x) => x === s || c.includes(x))));
  return (
    <div className="pn-verre">
      <div className="pn-choix-sites" role="group" aria-label={tr('pn.plateformes.titre')}>
        {SITES_PARCOURS.map((s) => (
          <button key={s} type="button" className="pn-site" data-pn-site={s} aria-pressed={choix.includes(s)} onClick={() => basculer(s)}>
            <MarquePlateforme site={s} taille={22} carre />
            <span>{NOM_SITE[s]}</span>
            <span className="pn-coche" aria-hidden="true">{choix.includes(s) ? '✓' : ''}</span>
          </button>
        ))}
      </div>
      {erreur ? <p className="pn-erreur" role="alert">{erreur}</p> : null}
    </div>
  );
}

function phraseExtension(x, appareil, dansOrion) {
  if (x.etat === 'fait') return tr('pn.extension.etat.fait');
  if (x.etat === 'inutile') return tr('pn.extension.etat.inutile');
  if (x.etat === 'encours') return tr('pn.extension.etat.encours');
  if (x.etat === 'passu') return tr('pn.extension.etat.passu');
  if (x.detail === 'pasconnectee') return tr('pn.extension.etat.pasconnectee');
  if (x.detail === 'autrecompte') return tr('pn.extension.etat.autrecompte');
  if (appareil === 'iphone' && !dansOrion) return tr('pn.extension.etat.absenteSafari');
  return tr('pn.extension.etat.absente');
}
function EtapeExtension({ etats, appareil, dansOrion }) {
  const x = etats.extension;
  const lignes = appareil === 'iphone' ? [tr('pn.extension.i1'), tr('pn.extension.i2'), tr('pn.extension.i3')]
    : appareil === 'android' ? [tr('pn.extension.a1'), tr('pn.extension.a2')]
      : [tr('pn.extension.o1'), tr('pn.extension.o2', { page: motsNavigateur().pageExt || tr('pn.extension.page') }), tr('pn.extension.o3')];
  return (
    <div className="pn-verre">
      <Statut etat={x.etat} cle="extension">{phraseExtension(x, appareil, dansOrion)}</Statut>
      {x.etat !== 'fait' && x.etat !== 'inutile' ? <Puces lignes={lignes} /> : null}
      {appareil === 'iphone' && x.etat !== 'fait' ? <p className="pn-note" data-pn-ecran-accueil="">{tr('pn.extension.ecranAccueil')}</p> : null}
      <p className="pn-liens">
        <a className="pn-lien" href={LIENS_EXTENSION.aide} target="_blank" rel="noopener">{tr('pn.extension.aide')}</a>
        {appareil === 'iphone' ? <a className="pn-lien" href={LIENS_EXTENSION.aideRaccourci} target="_blank" rel="noopener" data-pn-raccourci="">{tr('pn.extension.raccourci')}</a> : null}
      </p>
    </div>
  );
}

function etatSite(site, etats) {
  const c = etats.comptes;
  if (site === c.site) {
    if (c.etat === 'fait') return ['fait', tr('pn.comptes.fait')];
    if (c.etat === 'passu') return ['passu', tr('pn.comptes.passu')];
    if (c.etat === 'encours') return ['encours', tr('pn.etat.encours')];
    if (c.detail === 'vu') return ['encours', tr('pn.comptes.vu')];
    return ['afaire', tr('pn.comptes.afaire')];
  }
  return ['info', tr('pn.comptes.plusTard')];
}
function EtapeComptes({ etats, sites, onOuvrirReglage }) {
  const liste = sites.length ? sites : ['vinted'];
  return (
    <div className="pn-verre pn-verre-liste">
      {liste.map((s) => {
        const [etat, phrase] = etatSite(s, etats);
        return (
          <div key={s} className="pn-rangee" data-pn-compte={s} data-etat={etat}>
            <span className="pn-rangee-icone"><MarquePlateforme site={s} taille={20} carre /></span>
            <span className="pn-rangee-texte"><b>{NOM_SITE[s]}</b><span><Diode etat={etat} />{phrase}</span></span>
            {s === 'ebay'
              ? <button type="button" className="pn-lien pn-rangee-geste" onClick={() => onOuvrirReglage && onOuvrirReglage('ebay')} title={tr('pn.comptes.ebayChemin')}>{tr('pn.comptes.ebay')}</button>
              : etat !== 'fait' && s !== etats.comptes.site ? <a className="pn-lien pn-rangee-geste" href={LIEN_SITE[s]} target="_blank" rel="noopener">{tr('pn.comptes.ouvrir', { site: s === 'vestiaire' ? 'Vestiaire' : NOM_SITE[s] })}</a> : null}
          </div>
        );
      })}
    </div>
  );
}

const CHOIX_NUM = ['vrm', 'moi', 'cartons'];
function EtapeNumeros({ choix, setChoix }) {
  return (
    <div className="pn-verre pn-verre-liste" role="radiogroup" aria-label={tr('pn.numeros.titre')}>
      {CHOIX_NUM.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={choix === c} className="pn-rangee pn-rangee-choix" data-pn-numeros={c} onClick={() => setChoix(c)}>
          <span className="pn-radio" aria-hidden="true" data-on={choix === c ? '1' : '0'} />
          <span className="pn-rangee-texte"><b>{tr('pn.numeros.' + c)}</b><span>{tr('pn.numeros.' + c + '.desc')}</span></span>
        </button>
      ))}
      <p className="pn-note">{tr('pn.numeros.change')}</p>
    </div>
  );
}

function EtapeHistorique({ etats }) {
  const h = etats.historique;
  const phrase = h.etat === 'fait' ? tr('pn.historique.fait')
    : h.etat === 'inutile' ? tr('pn.historique.inutile')
      : h.etat === 'passu' ? tr('pn.historique.passu')
        : h.etat === 'encours' && h.souci ? tr('pn.historique.souci')
          : h.etat === 'encours' && h.n != null ? (h.N != null ? tr('pn.historique.encoursSur', { n: h.n, N: h.N }) : tr('pn.historique.encours', { n: h.n }))
            : h.etat === 'encours' ? tr('pn.etat.encours') : tr('pn.historique.afaire');
  return (
    <div className="pn-verre">
      <Statut etat={h.souci ? 'afaire' : h.etat} cle="historique">{phrase}</Statut>
      <p className="pn-note">{tr('pn.historique.ou')}</p>
    </div>
  );
}

function EtapeJournee() {
  return (
    <div className="pn-verre">
      <Puces lignes={[tr('pn.journee.l1'), tr('pn.journee.l2'), tr('pn.journee.l3')]} />
    </div>
  );
}

function EtapeAbonnement({ etats, prix }) {
  const a = etats.abonnement;
  const phrase = a.abo === 'essai' && Number.isInteger(a.jours) ? tr('pn.abonnement.essai', { n: a.jours })
    : a.abo === 'actif' || a.abo === 'proprietaire' ? tr('pn.abonnement.actif')
      : a.etat === 'passu' ? tr('pn.abonnement.passu')
        : prix.accesOffert ? tr('pn.abonnement.offert') : null;
  return (
    <div className="pn-verre">
      {phrase ? <Statut etat={a.etat === 'passu' ? 'passu' : 'fait'} cle="abonnement">{phrase}</Statut> : null}
      <div className="pn-offres">
        <div className="pn-offre" data-pn-offre="solo"><b>{tr('pn.abonnement.solo')}</b><span className="pn-prix">{tr('pn.abonnement.parMois', { prix: prix.solo })}</span><span>{tr('pn.abonnement.solo.desc')}</span></div>
        <div className="pn-offre" data-pn-offre="pro"><b>{tr('pn.abonnement.pro')}{!prix.proOuvert ? <em className="pn-bientot">{tr('pn.abonnement.bientot')}</em> : null}</b><span className="pn-prix">{tr('pn.abonnement.parMois', { prix: prix.pro })}</span><span>{tr('pn.abonnement.pro.desc')}</span></div>
      </div>
      <p className="pn-note">{tr('pn.abonnement.sans')}</p>
    </div>
  );
}

// ── L'ÉCRAN ──
export default function ParcoursNouveau({
  etape = 'bienvenue', etats, appareil = 'ordinateur', dansOrion = false, sombre = false, prenom = '', vend = 'sneakers',
  prix = { solo: '16,99', pro: '19,99', proOuvert: false, accesOffert: true },
  plateformesDepart = [], numerosDepart = null,
  onAller, onPlusTard, onFin, onChoisirPlateformes, onChoisirNumeros, onOuvrirReglage,
}) {
  useLangue();
  const [choixSites, setChoixSites] = React.useState(() => (plateformesDepart && plateformesDepart.length ? plateformesDepart : ['vinted']));
  const [choixNum, setChoixNum] = React.useState(numerosDepart || 'vrm');
  const [erreur, setErreur] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const titreRef = React.useRef(null);
  React.useEffect(() => { setErreur(''); try { titreRef.current && titreRef.current.focus({ preventScroll: true }); } catch (_) {} }, [etape]);
  React.useEffect(() => { if (plateformesDepart && plateformesDepart.length) setChoixSites(plateformesDepart); }, [plateformesDepart && plateformesDepart.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (numerosDepart) setChoixNum(numerosDepart); }, [numerosDepart]);

  const pg = progression(etape, etats);
  const i = ETAPES_NOUVEAU.indexOf(etape);
  const suivante = ETAPES_NOUVEAU[i + 1] || null;
  const aller = (e) => { if (e && onAller) onAller(e); };

  // Le plein : LE geste de l'étape (un lien quand il emmène ailleurs, sinon « Continuer »).
  let plein = { libelle: tr('pn.continuer'), faire: () => aller(suivante) };
  if (etape === 'bienvenue') plein = { libelle: tr('pn.commencer'), faire: () => aller(suivante) };
  if (etape === 'plateformes') plein = { libelle: tr('pn.continuer'), faire: async () => {
    if (!choixSites.length) { setErreur(tr('pn.plateformes.aucun')); return; }
    setOccupe(true); const ok = onChoisirPlateformes ? await onChoisirPlateformes(choixSites) : true; setOccupe(false);
    if (ok === false) { setErreur(tr('pn.plateformes.pasEcrit')); return; }
    aller(suivante);
  } };
  if (etape === 'extension' && etats.extension.etat !== 'fait' && etats.extension.etat !== 'inutile') {
    if (appareil === 'iphone') plein = dansOrion ? { libelle: tr('pn.extension.fichierOrion'), href: LIENS_EXTENSION.orionFichier } : { libelle: tr('pn.extension.orion'), href: LIENS_EXTENSION.orion, nouvel: true };
    else if (appareil === 'ordinateur') plein = { libelle: tr('pn.extension.telecharger'), href: LIENS_EXTENSION.zip, telecharger: true };
  }
  if (etape === 'comptes' && etats.comptes.etat === 'afaire' && LIEN_SITE[etats.comptes.site]) plein = { libelle: tr('pn.comptes.ouvrir', { site: etats.comptes.site === 'vestiaire' ? 'Vestiaire' : NOM_SITE[etats.comptes.site] }), href: LIEN_SITE[etats.comptes.site], nouvel: true };
  if (etape === 'numeros') plein = { libelle: tr('pn.continuer'), faire: async () => {
    setOccupe(true); const ok = onChoisirNumeros ? await onChoisirNumeros(choixNum) : true; setOccupe(false);
    if (ok === false) { setErreur(tr('pn.plateformes.pasEcrit')); return; }
    aller(suivante);
  } };
  if (estDerniere(etape)) plein = { libelle: tr('pn.cestParti'), faire: () => onFin && onFin() };
  // Un plein qui EMMÈNE (télécharger, ouvrir un site) : « Continuer » reste, en lien, à côté.
  const continuerLien = plein.href ? <button type="button" className="pn-lien pn-pied-continuer" data-pn-continuer="" onClick={() => aller(suivante)}>{tr('pn.continuer')}</button> : null;

  const titre = etape === 'bienvenue' ? (prenom ? tr('pn.bienvenue.titrePrenom', { prenom }) : tr('pn.bienvenue.titre'))
    : etape === 'numeros' && vend === 'autre' ? tr('pn.numeros.titreAutre') : tr(`pn.${etape}.titre`);
  const phrase = etape === 'extension' ? tr('pn.extension.phrase.' + appareil) : tr(`pn.${etape}.phrase`);

  const illustration = etape === 'bienvenue' ? <Pile sombre={sombre} />
    : etape === 'plateformes' ? <Plateformes choisis={choixSites} />
      : etape === 'extension' ? (appareil === 'iphone' ? <DessinIphone /> : <DessinNavigateur />)
        : etape === 'comptes' ? <Plateformes choisis={(etats.plateformes && etats.plateformes.sites && etats.plateformes.sites.length) ? etats.plateformes.sites : ['vinted']} />
          : etape === 'numeros' ? <Capture cle="numeros" sombre={sombre} />
            : etape === 'historique' ? <DessinHistorique />
              : etape === 'journee' ? <Capture cle="journee" sombre={sombre} />
                : null;

  const sitesChoisis = etats.plateformes && etats.plateformes.sites && etats.plateformes.sites.length ? etats.plateformes.sites : choixSites;
  return (
    <div className="pn" role="dialog" aria-modal="true" aria-labelledby="pn-titre" data-parcours-nouveau="" data-pn-etape={etape} data-pn-appareil={appareil}>
      <header className="pn-tete">
        <div className="pn-progres" role="progressbar" aria-valuemin={1} aria-valuemax={pg.total} aria-valuenow={pg.rang} aria-label={tr('pn.rang', { n: pg.rang, total: pg.total })}>
          {ETAPES_NOUVEAU.map((e, k) => {
            const et = etats[e] ? etats[e].etat : 'afaire';
            const marque = e === etape ? 'courant' : (et === 'fait' || et === 'inutile') ? 'fait' : k < i ? 'vu' : 'afaire';
            return <button key={e} type="button" className="pn-segment" data-pn-segment={e} data-marque={marque} aria-label={`${k + 1} · ${tr('pn.court.' + e)} · ${tr('pn.etat.' + (et === 'info' ? 'afaire' : et))}`} aria-current={e === etape ? 'step' : undefined} onClick={() => aller(e)} />;
          })}
        </div>
        <div className="pn-tete-ligne">
          <span className="pn-rang" data-pn-rang={`${pg.rang}/${pg.total}`}>{tr('pn.rang', { n: pg.rang, total: pg.total })} · {tr('pn.court.' + etape)}</span>
          {!estDerniere(etape) ? <button type="button" className="pn-lien" data-pn-plus-tard="" onClick={() => onPlusTard && onPlusTard()}>{tr('pn.plusTard')}</button> : null}
        </div>
      </header>
      <div className="pn-corps" key={etape}>
        {illustration ? <figure className="pn-illu" aria-hidden="true">{illustration}</figure> : null}
        <section className="pn-texte">
          <h1 id="pn-titre" className="pn-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
          <p className="pn-phrase">{phrase}</p>
          {etape === 'bienvenue' ? <EtapeBienvenue etats={etats} /> : null}
          {etape === 'plateformes' ? <EtapePlateformes choix={choixSites} setChoix={setChoixSites} erreur={erreur} /> : null}
          {etape === 'extension' ? <EtapeExtension etats={etats} appareil={appareil} dansOrion={dansOrion} /> : null}
          {etape === 'comptes' ? <EtapeComptes etats={etats} sites={sitesChoisis} onOuvrirReglage={onOuvrirReglage} /> : null}
          {etape === 'numeros' ? <><EtapeNumeros choix={choixNum} setChoix={setChoixNum} />{erreur ? <p className="pn-erreur" role="alert">{erreur}</p> : null}</> : null}
          {etape === 'historique' ? <EtapeHistorique etats={etats} /> : null}
          {etape === 'journee' ? <EtapeJournee /> : null}
          {etape === 'abonnement' ? <EtapeAbonnement etats={etats} prix={prix} /> : null}
        </section>
      </div>
      <footer className="pn-pied">
        {i > 0 ? <button type="button" className="pn-lien pn-pied-precedent" data-pn-precedent="" onClick={() => aller(ETAPES_NOUVEAU[i - 1])}>{tr('pn.precedent')}</button> : null}
          {continuerLien}
          {plein.href
            ? <a className="sb-btn-plein pn-plein" data-pn-plein="" href={plein.href} {...(plein.telecharger ? { download: '' } : {})} {...(plein.nouvel ? { target: '_blank', rel: 'noopener' } : {})}>{plein.libelle}</a>
            : <button type="button" className="sb-btn-plein pn-plein" data-pn-plein="" disabled={occupe} onClick={plein.faire}>{plein.libelle}</button>}
      </footer>
    </div>
  );
}
