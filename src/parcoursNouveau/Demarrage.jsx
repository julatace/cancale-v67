// ═══════════════════════════════════════════════════════════════════════════
// BIEN DÉMARRER — LE PARCOURS D'UN NOUVEAU, EN PAGES POUSSÉES (20 nov. 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 20 nov. : « OK » à « un parcours de 5 minutes (installer l'extension, ouvrir Vinted, choisir
// l'étiquetage, premier import), une démo avec des données d'exemple ». Style Paramètres (NATIF.md §1 bis) :
// un grand titre, des groupes blancs, des rangées ; le sommaire liste les étapes et leur état, chaque
// étape est une page poussée (‹ retour), UN plein par page, « Passer cette étape » en texte, « Plus tard »
// en haut à droite — jamais bloquant.
// La règle (étapes, preuves, navigateur d'ici) : ./regle.js. Ici le dessin seul : aucune requête, aucune
// écriture — les gestes remontent à la coque (src/App.jsx `ParcoursNouveauApp`), qui lit et écrit.
// Tout texte passe par tr() (src/i18n/langues/*/demarrage.js, cinq langues).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { Groupe, Rangee, Bouton, Pastille, Progression } from '../natif/index.js';
import MarquePlateforme from '../plateformes/Marque.jsx';
import { ETAPES_NOUVEAU, SITES_PARCOURS, LIENS_EXTENSION } from './regle.js';
import './demarrage.css';

// Des noms propres, jamais traduits.
const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
const DOMAINE = { vinted: 'vinted.fr', leboncoin: 'leboncoin.fr', vestiaire: 'vestiairecollective.com', ebay: 'ebay.fr' };
const LIEN_SITE = { vinted: 'https://www.vinted.fr', leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', vestiaire: 'https://www.vestiairecollective.com/' };
const NOM_NAV = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', vivaldi: 'Vivaldi', 'orion-iphone': 'Orion', 'orion-mac': 'Orion', 'safari-iphone': 'Safari', 'safari-mac': 'Safari', firefox: 'Firefox', android: '', autre: '' };
// Les étapes comptées « 1 sur 5 » : « Tout est prêt » n'est pas une étape à faire.
const A_FAIRE = ETAPES_NOUVEAU.filter((e) => e !== 'pret');

const ouvrir = (url) => { try { window.open(url, '_blank', 'noopener'); } catch (_) {} };
const fait = (x) => !!x && (x.etat === 'fait' || x.etat === 'inutile');

// L'état court d'une étape, à droite de sa rangée (une pastille douce ; ambre = un geste à faire).
function EtatEtape({ x }) {
  const e = x ? x.etat : 'afaire';
  // L'import qui avance dit où il en est (lu), jamais « On regarde… ».
  if (e === 'encours' && x && x.n != null) return <Pastille ton="neutre">{x.N != null ? tr('dm.hist.surN', { n: x.n, N: x.N }) : tr('dm.hist.n', { n: x.n })}</Pastille>;
  const cle = e === 'fait' ? 'dm.etat.fait' : e === 'inutile' ? 'dm.etat.inutile' : e === 'encours' ? 'dm.etat.encours' : e === 'passu' ? 'dm.etat.passu' : 'dm.etat.afaire';
  return <Pastille ton={e === 'afaire' ? 'ambre' : 'neutre'}>{tr(cle)}</Pastille>;
}

// ── Le sommaire : les cinq étapes, leur état, et l'exemple ─────────────────────────────────
function Sommaire({ etats, onAller, onExemple }) {
  return (
    <>
      <Groupe titre={tr('dm.sommaire.groupe')} attrs={{ 'data-dm-sommaire': '' }}>
        {A_FAIRE.map((e, i) => (
          <Rangee key={e} titre={tr('dm.court.' + e)} sousTitre={tr('dm.sommaire.' + e)} pastille={<EtatEtape x={etats[e]}/>} fin="chevron"
            icone={<span className="dm-num" aria-hidden="true">{i + 1}</span>}
            onClick={() => onAller(e)} attrs={{ 'data-dm-etape': e, 'data-etat': etats[e] ? etats[e].etat : 'afaire' }}/>
        ))}
      </Groupe>
      {onExemple ? (
        <Groupe titre={tr('dm.exemple.groupe')}>
          <Rangee titre={tr('dm.exemple.titre')} sousTitre={tr('dm.exemple.sous')} sousLignes={2} fin="chevron" onClick={onExemple} attrs={{ 'data-dm-exemple': '' }}/>
        </Groupe>
      ) : null}
    </>
  );
}

// ── 1. Tu vends où ? ───────────────────────────────────────────────────────────────────────
function PagePlateformes({ choix, setChoix, erreur }) {
  const basculer = (s) => setChoix((c) => (c.includes(s) ? c.filter((x) => x !== s) : SITES_PARCOURS.filter((x) => x === s || c.includes(x))));
  return (
    <>
      <Groupe titre={tr('dm.plateformes.groupe')} attrs={{ role: 'group', 'aria-label': tr('dm.plateformes.titre') }}>
        {SITES_PARCOURS.map((s) => (
          <Rangee key={s} titre={NOM_SITE[s]} icone={<MarquePlateforme site={s} taille={22} carre/>} fin={choix.includes(s) ? 'coche' : null}
            onClick={() => basculer(s)} attrs={{ 'data-pn-site': s, 'aria-pressed': choix.includes(s) ? 'true' : 'false' }}/>
        ))}
      </Groupe>
      {erreur ? <p className="dm-erreur" role="alert">{erreur}</p> : null}
    </>
  );
}

// ── 2. L'extension ─────────────────────────────────────────────────────────────────────────
// Les pas d'installation, selon le navigateur d'ici (installationIci) : des rangées numérotées, lues.
function pasInstallation(inst) {
  const m = inst.mode;
  if (m === 'boutique') return ['dm.ext.pas.boutique1', 'dm.ext.pas.boutique2'];
  if (m === 'zip') return ['dm.ext.pas.zip1', 'dm.ext.pas.zip2', 'dm.ext.pas.zip3', 'dm.ext.pas.zip4'];
  if (m === 'orion') return ['dm.ext.pas.orion1', 'dm.ext.pas.orion2'];
  if (m === 'orion-app') return ['dm.ext.pas.orionApp1', 'dm.ext.pas.orionApp2', 'dm.ext.pas.orionApp3'];
  if (m === 'ordinateur') return ['dm.ext.pas.ordi1', 'dm.ext.pas.ordi2'];
  return ['dm.ext.pas.autre1', 'dm.ext.pas.autre2'];
}
function valeurExtension(ext) {
  if (ext.etat === 'fait') return tr('dm.ext.repond');
  if (ext.etat === 'inutile') return tr('dm.etat.inutile');
  if (ext.etat === 'encours') return tr('dm.ext.verif');
  if (ext.etat === 'passu') return tr('dm.etat.passu');
  return tr('dm.ext.absente');
}
function PageExtension({ ext, navExt, inst, pageExt, onBrancher, onDetails }) {
  const nom = NOM_NAV[inst.nav] || tr('dm.ext.ceNavigateur');
  const phrase = navExt && navExt.cle ? tr(navExt.cle, navExt.vars || {}) : '';
  return (
    <>
      <Groupe titre={tr('dm.ext.groupeIci')} attrs={{ 'data-dm-ext-etat': ext.etat, 'data-dm-ext-code': ext.code || '', 'data-dm-nav': inst.nav, 'data-dm-mode': inst.mode }}>
        <Rangee titre={tr('dm.ext.dans', { nav: nom })} sousTitre={phrase} sousLignes={2} valeur={valeurExtension(ext)} valeurForte={ext.etat === 'fait'}
          ton={ext.etat === 'afaire' ? 'ambre' : 'neutre'} attrs={{ 'data-dm-ext-ligne': '', role: 'status' }}/>
        {navExt && navExt.geste === 'brancher' && onBrancher ? <Rangee titre={tr('dm.ext.brancher')} fin="chevron" onClick={onBrancher} attrs={{ 'data-dm-brancher': '' }}/> : null}
        {onDetails ? <Rangee titre={tr('dm.ext.details')} fin="chevron" onClick={onDetails} attrs={{ 'data-dm-ext-details': '' }}/> : null}
      </Groupe>
      {ext.etat !== 'fait' && ext.etat !== 'inutile' ? (
        <Groupe titre={tr('dm.ext.groupePas')} attrs={{ 'data-dm-pas': inst.mode }}>
          {pasInstallation(inst).map((cle, i) => (
            <Rangee key={cle} icone={<span className="dm-num" aria-hidden="true">{i + 1}</span>} titre={tr(cle, { nav: nom, page: pageExt || tr('dm.ext.pageExt') })} lignes={2}/>
          ))}
        </Groupe>
      ) : null}
    </>
  );
}

// ── 3. Ouvre tes sites ─────────────────────────────────────────────────────────────────────
function PageComptes({ sites, captes, ouOuvrir, onEbay }) {
  return (
    <Groupe titre={tr('dm.comptes.groupe')}>
      {sites.map((s) => {
        const c = captes[s] || { etat: 'encours', noms: [] };
        const sous = c.etat === 'fait' ? tr('dm.comptes.capte', { compte: c.noms.slice(0, 2).join(', ') || NOM_SITE[s] })
          : c.etat === 'passu' ? tr('dm.etat.passu')
            : c.etat === 'encours' ? tr('dm.etat.encours')
              : s === 'ebay' ? tr('dm.comptes.ebay') : tr('dm.comptes.ouvre', { domaine: DOMAINE[s] });
        const geste = c.etat === 'fait' ? null : s === 'ebay' ? onEbay : (ouOuvrir ? () => ouvrir(LIEN_SITE[s]) : null);
        return (
          <Rangee key={s} titre={NOM_SITE[s]} icone={<MarquePlateforme site={s} taille={22} carre/>} sousTitre={sous} sousLignes={2}
            valeur={c.etat === 'fait' ? tr('dm.comptes.vu') : c.etat === 'afaire' ? tr('dm.etat.afaire') : ''} valeurForte={c.etat === 'fait'}
            ton={c.etat === 'afaire' ? 'ambre' : 'neutre'} fin={geste ? 'chevron' : null} onClick={geste}
            attrs={{ 'data-pn-compte': s, 'data-etat': c.etat, 'data-dm-n': c.n || 0 }}/>
        );
      })}
    </Groupe>
  );
}

// ── 5. Le premier import ───────────────────────────────────────────────────────────────────
function PageHistorique({ h }) {
  const pct = h.etat === 'fait' ? 100 : h.n != null && h.N ? Math.max(0, Math.min(100, Math.round((h.n / h.N) * 100))) : null;
  const phrase = h.etat === 'fait' ? tr('dm.hist.fini')
    : h.etat === 'inutile' ? tr('dm.hist.inutile')
      : h.etat === 'passu' ? tr('dm.etat.passu')
        : h.souci ? tr('dm.hist.souci')
          : h.etat === 'encours' && h.n != null ? (h.N != null ? tr('dm.hist.surN', { n: h.n, N: h.N }) : tr('dm.hist.n', { n: h.n }))
            : h.etat === 'encours' ? tr('dm.etat.encours') : tr('dm.hist.attend');
  return (
    <Groupe titre={tr('dm.hist.groupe')} attrs={{ 'data-dm-hist': h.etat, 'data-dm-hist-n': h.n == null ? '' : h.n, 'data-dm-hist-total': h.N == null ? '' : h.N }}>
      {h.etat === 'encours' || h.etat === 'fait'
        ? <div className="dm-progres"><Progression pct={pct} texte={tr('dm.hist.ligne')} detail={phrase}/></div>
        : <Rangee titre={tr('dm.hist.ligne')} sousTitre={phrase} sousLignes={2} ton={h.etat === 'afaire' ? 'ambre' : 'neutre'}/>}
    </Groupe>
  );
}

// ── 6. Tout est prêt ───────────────────────────────────────────────────────────────────────
function PagePret({ etats, onAller }) {
  return (
    <Groupe titre={tr('dm.pret.groupe')} attrs={{ 'data-dm-pret': A_FAIRE.filter((e) => !fait(etats[e])).length }}>
      {A_FAIRE.map((e) => (
        <Rangee key={e} titre={tr('dm.court.' + e)} pastille={<EtatEtape x={etats[e]}/>} fin={fait(etats[e]) ? null : 'chevron'}
          onClick={fait(etats[e]) ? null : () => onAller(e)} attrs={{ 'data-dm-reste': e, 'data-etat': etats[e] ? etats[e].etat : 'afaire' }}/>
      ))}
    </Groupe>
  );
}

// ── L'ÉCRAN ────────────────────────────────────────────────────────────────────────────────
// `etape` : null = le sommaire ; sinon la page poussée. `ext` : l'état EN DIRECT de l'extension
// (etatExtensionDirect) ; `navExt` : la règle de la page Extension (phrase, geste) ; `inst` :
// installationIci ; `captes` : comptesCaptes ; `etiquetage` : le réglage (EtiquetageReglage) déjà branché.
export default function Demarrage({
  etape = null, etats, ext, navExt = null, inst, pageExt = '', captes = {}, sites = ['vinted'], telephone = false,
  plateformesDepart = [], etiquetage = null, prenom = '',
  onAller, onPlusTard, onFin, onChoisirPlateformes, onBrancher, onExemple, onEbay, onDetailsExtension,
}) {
  useLangue();
  const [choix, setChoix] = React.useState(() => (plateformesDepart && plateformesDepart.length ? plateformesDepart : ['vinted']));
  const [erreur, setErreur] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const titreRef = React.useRef(null);
  const corpsRef = React.useRef(null);
  React.useEffect(() => { setErreur(''); try { if (corpsRef.current) corpsRef.current.scrollTop = 0; titreRef.current && titreRef.current.focus({ preventScroll: true }); } catch (_) {} }, [etape]);
  React.useEffect(() => { if (plateformesDepart && plateformesDepart.length) setChoix(plateformesDepart); }, [plateformesDepart && plateformesDepart.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const i = etape ? A_FAIRE.indexOf(etape) : -1;
  const suivante = etape ? (ETAPES_NOUVEAU[ETAPES_NOUVEAU.indexOf(etape) + 1] || null) : null;
  const aller = (e) => { if (onAller) onAller(e); };
  const premiere = A_FAIRE.find((e) => !fait(etats[e])) || 'pret';
  // Sur un téléphone sans extension (Safari, Chrome d'Android), ouvrir un site d'ici ne capte rien : la rangée ne mène nulle part.
  const ouOuvrir = !telephone || ext.etat === 'fait';

  // LE plein de la page.
  let plein = { libelle: tr('dm.continuer'), faire: () => aller(suivante) };
  if (!etape) plein = { libelle: tr(premiere === A_FAIRE[0] && !fait(etats[A_FAIRE[0]]) ? 'dm.commencer' : 'dm.reprendre'), faire: () => aller(premiere) };
  if (etape === 'plateformes') plein = { libelle: tr('dm.continuer'), faire: async () => {
    if (!choix.length) { setErreur(tr('dm.plateformes.aucun')); return; }
    setOccupe(true); const ok = onChoisirPlateformes ? await onChoisirPlateformes(choix) : true; setOccupe(false);
    if (ok === false) { setErreur(tr('dm.pasEcrit')); return; }
    aller(suivante);
  } };
  if (etape === 'extension' && !fait(ext)) {
    if (navExt && navExt.geste === 'brancher' && onBrancher) plein = { libelle: tr('dm.ext.brancher'), faire: onBrancher };
    else if (inst.mode === 'boutique') plein = { libelle: tr('dm.ext.boutique', { boutique: inst.nomBoutique }), href: inst.lien, nouvel: true };
    else if (inst.mode === 'zip') plein = { libelle: tr('dm.ext.telecharger'), href: inst.lien || LIENS_EXTENSION.zip, telecharger: true };
    else if (inst.mode === 'orion') plein = { libelle: tr('dm.ext.fichierOrion'), href: inst.lien };
    else if (inst.mode === 'orion-app') plein = { libelle: tr('dm.ext.installerOrion'), href: inst.lien, nouvel: true };
  }
  if (etape === 'comptes' && ouOuvrir) {
    const manque = sites.find((s) => s !== 'ebay' && captes[s] && captes[s].etat === 'afaire');
    if (manque) plein = { libelle: tr('dm.comptes.ouvrir', { domaine: DOMAINE[manque] }), href: LIEN_SITE[manque], nouvel: true };
  }
  if (etape === 'pret') plein = { libelle: tr('dm.pret.ouvrir'), faire: () => onFin && onFin() };

  const titre = !etape ? (prenom ? tr('dm.titrePrenom', { prenom }) : tr('dm.titre'))
    : etape === 'pret' ? tr(A_FAIRE.every((e) => fait(etats[e])) ? 'dm.pret.titre' : 'dm.pret.titrePresque')
      : tr('dm.' + etape + '.titre');
  const phrase = !etape ? tr('dm.phrase') : etape === 'pret' ? '' : tr('dm.' + etape + '.phrase');
  // « Passer » : toujours là sur une étape (jamais bloquant), sauf quand le plein fait déjà la même chose (« Continuer »).
  const passer = etape && etape !== 'pret' && (plein.href || (etape === 'extension' && navExt && navExt.geste === 'brancher') || (etape === 'plateformes'))
    ? <Bouton variante="texte" onClick={() => aller(suivante)} attrs={{ 'data-pn-continuer': '', 'data-dm-passer': '' }}>{etape === 'plateformes' ? tr('dm.passer') : fait(etats[etape]) || (etape === 'extension' && fait(ext)) ? tr('dm.continuer') : tr('dm.passer')}</Bouton>
    : null;

  return (
    <div className="dm" role="dialog" aria-modal="true" aria-labelledby="dm-titre" data-parcours-nouveau="" data-demarrage="" data-pn-etape={etape || 'sommaire'}
      data-pn-rang={i >= 0 ? `${i + 1}/${A_FAIRE.length}` : etape === 'pret' ? 'pret' : 'sommaire'}>
      <header className="dm-barre">
        <span className="dm-barre-gauche">
          {etape ? <button type="button" className="dm-retour" data-dm-retour="" onClick={() => aller(null)}><span className="dm-chevron" aria-hidden="true"/>{tr('dm.court.sommaire')}</button> : null}
        </span>
        <span className="dm-barre-titre" aria-hidden="true">{i >= 0 ? tr('dm.rang', { n: i + 1, total: A_FAIRE.length }) : ''}</span>
        <span className="dm-barre-droite">
          {etape !== 'pret' ? <button type="button" className="dm-lien" data-pn-plus-tard="" onClick={() => onPlusTard && onPlusTard()}>{tr('dm.plusTard')}</button> : null}
        </span>
      </header>
      <div className="dm-corps" ref={corpsRef} key={etape || 'sommaire'}>
        <div className="dm-colonne">
          <h1 id="dm-titre" className="dm-titre" tabIndex={-1} ref={titreRef}>{titre}</h1>
          {phrase ? <p className="dm-phrase">{phrase}</p> : null}
          {!etape ? <Sommaire etats={etats} onAller={aller} onExemple={onExemple}/> : null}
          {etape === 'plateformes' ? <PagePlateformes choix={choix} setChoix={setChoix} erreur={erreur}/> : null}
          {etape === 'extension' ? <PageExtension ext={ext} navExt={navExt} inst={inst} pageExt={pageExt} onBrancher={onBrancher} onDetails={onDetailsExtension}/> : null}
          {etape === 'comptes' ? <PageComptes sites={sites} captes={captes} ouOuvrir={ouOuvrir} onEbay={onEbay}/> : null}
          {etape === 'etiquetage' ? <div className="dm-etiquetage" data-dm-etiquetage={etats.etiquetage ? etats.etiquetage.etat : ''}>{etiquetage}</div> : null}
          {etape === 'historique' ? <PageHistorique h={etats.historique}/> : null}
          {etape === 'pret' ? <PagePret etats={{ ...etats, extension: ext }} onAller={aller}/> : null}
        </div>
      </div>
      <footer className="dm-pied">
        <div className="dm-colonne">
          {plein.href
            ? <a className="n-bouton dm-plein" data-n-variante="plein" data-pn-plein="" href={plein.href} {...(plein.telecharger ? { download: '' } : {})} {...(plein.nouvel ? { target: '_blank', rel: 'noopener' } : {})}><span className="n-bouton-libelle">{plein.libelle}</span></a>
            : <Bouton variante="plein" chargement={occupe} onClick={plein.faire} attrs={{ 'data-pn-plein': '' }}>{plein.libelle}</Bouton>}
          {passer}
        </div>
      </footer>
    </div>
  );
}
