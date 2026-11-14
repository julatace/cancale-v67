// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 151 — L'IMPRIMANTE THERMIQUE JUMELÉE : la feuille du jumelage, la ligne, l'envoi
// ════════════════════════════════════════════════════════════════════════════
//  Le jumelage, UNE fois : « Choisir mon imprimante » (la fenêtre du navigateur, dans son
//  toucher) ⇒ « Imprimer la page d'essai » ⇒ « Elle est sortie, nette ? » — Oui ⇒ retenue
//  (sur cet ordinateur) ; Non ⇒ le langage suivant, et un nouvel essai. Ensuite « Imprimer (N) »
//  envoie les étiquettes au câble, sans fenêtre d'impression (App.jsx, `sortirLot`).
//  Sans WebUSB ni Web Serial (Safari, iPhone, Firefox), ou interdit par la page : rien ne
//  change, le PDF s'ouvre comme avant ; la ligne le dit une fois, sans erreur.
//  Les quatre formes de bouton (direction t25) ; tout texte par tr() (clés `exp.direct.*`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { CLE_IMPRIMANTE_DIRECTE, jumelageValide, voiesDisponibles, langageSuivant, raisonEchec } from './thermiqueDirecte.js';
import { choisirImprimante, retrouver, envoyer, pageEssai, rasteriserPdf, octetsPour } from './imprimanteUsb.js';
import './expedition.css';

// ── LE JUMELAGE RETENU, PARTAGÉ (sur cet appareil : localStorage, jamais le nuage) ──
const _ecoutes = new Set();
const lireJumelage = () => { try { return jumelageValide(JSON.parse(localStorage.getItem(CLE_IMPRIMANTE_DIRECTE) || 'null')); } catch (_) { return null; } };
export const ecrireJumelage = (j) => {
  try { if (j) localStorage.setItem(CLE_IMPRIMANTE_DIRECTE, JSON.stringify(j)); else localStorage.removeItem(CLE_IMPRIMANTE_DIRECTE); } catch (_) {}
  for (const f of _ecoutes) { try { f(jumelageValide(j)); } catch (_) {} }
};
export const jumelageActuel = () => lireJumelage();
export const voiesActuelles = () => { try { return voiesDisponibles(navigator, document); } catch (_) { return { usb: false, serie: false, raison: 'navigateur' }; } };
export function useImprimanteDirecte() {
  const [j, setJ] = React.useState(lireJumelage);
  React.useEffect(() => { _ecoutes.add(setJ); return () => { _ecoutes.delete(setJ); }; }, []);
  const [voies] = React.useState(voiesActuelles);
  return { jumelage: j, voies };
}

// L'ENVOI D'UN LOT (le PDF tamponné, déjà prêt) : dessiné à 203 dpi, mis en langage, envoyé.
// Rend { etiquettes, octets } ; une erreur porte `raison` (thermiqueDirecte.RAISONS_ECHEC).
export async function imprimerDirect({ jumelage, octetsPdf, chargerPdfjs }) {
  const j = jumelageValide(jumelage);
  if (!j) { const e = new Error('pasJumelee'); e.raison = 'pasTrouvee'; throw e; }
  let pages;
  try { const L = await chargerPdfjs(); pages = await rasteriserPdf(L, document, octetsPdf); } catch (err) { const e = new Error(String((err && err.message) || err)); e.raison = 'rendu'; throw e; }
  const app = await retrouver(navigator, j);
  const octets = octetsPour(j, pages);
  await envoyer(app, j.voie, octets, { baud: j.baud });
  return { etiquettes: pages.length, octets: octets.length };
}

// LA LIGNE à côté du papier retenu (seulement en papier thermique) : jumelée ⇒ son nom (un
// toucher ouvre la feuille) ; possible ⇒ « Imprimer sans fenêtre › » ; impossible ⇒ une ligne.
export function LigneImprimanteDirecte({ format, jumelage, voies, onOuvrir, desactive = false }) {
  if (format !== 'thermique') return null;
  const v = voies || { usb: false, serie: false, raison: 'navigateur' };
  if (!v.usb && !v.serie) return <span className="vrm-exp-ligne-dite" data-impr-directe="indispo" data-impr-directe-raison={v.raison}>{tr(`exp.direct.indispo.${v.raison === 'politique' ? 'politique' : 'navigateur'}`)}</span>;
  return (
    <button type="button" className="sb-lien" data-impr-directe={jumelage ? 'jumelee' : 'jumeler'} disabled={desactive} onClick={onOuvrir}
      aria-label={jumelage ? tr('exp.direct.ligneAria', { nom: jumelage.nom }) : tr('exp.direct.jumeler')}>
      {jumelage ? tr('exp.direct.ligne', { nom: jumelage.nom }) : tr('exp.direct.jumeler')}<span aria-hidden="true"> ›</span>
    </button>
  );
}

// LA FEUILLE DU JUMELAGE. `Feuille` = SheetShell de l'app (portail, Échap, FermeAuRetour).
export function FeuilleJumelage({ Feuille, onFermer, toast = () => {} }) {
  const voies = React.useMemo(voiesActuelles, []);
  const [retenu, setRetenu] = React.useState(lireJumelage);
  const [etape, setEtape] = React.useState(() => (lireJumelage() ? 'retenue' : 'depart'));   // depart · essai · question · retenue
  const [fiche, setFiche] = React.useState(null);
  const appareil = React.useRef(null);
  const [occupe, setOccupe] = React.useState(false);
  const [souci, setSouci] = React.useState('');
  const [essais, setEssais] = React.useState(0);
  const choisir = async (voie) => {
    setSouci('');
    try {
      const r = await choisirImprimante(navigator, voie);   // DANS le toucher : aucune attente avant
      appareil.current = r.appareil; setFiche(r.fiche); setEtape('essai'); setEssais(0);
    } catch (e) { const rs = raisonEchec(e); if (rs !== 'annule') setSouci(rs); }
  };
  const essayer = async (f = fiche) => {
    if (!f || !appareil.current) return;
    setOccupe(true); setSouci('');
    try {
      const p = pageEssai(document, { langage: f.langage, nom: f.nom, textes: { titre: tr('exp.direct.essai.titrePage'), consigne: tr('exp.direct.essai.consignePage') } });
      await envoyer(appareil.current, f.voie, octetsPour(f, [p]), { baud: f.baud });
      setEssais((n) => n + 1); setEtape('question');
    } catch (e) { setSouci(raisonEchec(e)); }
    finally { setOccupe(false); }
  };
  const oui = () => { const j = jumelageValide({ ...fiche, essaiOk: true, at: Date.now() }); if (!j) return; ecrireJumelage(j); setRetenu(j); setEtape('retenue'); toast(tr('exp.direct.retenue', { nom: j.nom })); };
  const autreLangage = () => { const f = { ...fiche, langage: langageSuivant(fiche.langage) }; setFiche(f); essayer(f); };
  const oublier = () => { ecrireJumelage(null); setRetenu(null); setFiche(null); appareil.current = null; setEtape('depart'); };
  const nomLangage = (l) => tr(`exp.direct.langage.${l}`);
  return (
    <Feuille onClose={onFermer} maxWidth={480} z={9000} titre={tr('exp.direct.titre')} data-impr-jumelage={etape} data-noswipe="1">
      <div className="vrm-exp" data-espace="ventes">
        {etape === 'depart' ? <>
          <p className="vrm-exp-phrase">{tr('exp.direct.phrase')}</p>
          <p className="vrm-exp-sous">{tr('exp.direct.gratuit')}</p>
          {souci ? <p className="vrm-exp-souci" role="status" data-impr-souci={souci}>{tr(`exp.direct.echec.${souci}`)}</p> : null}
          <div className="vrm-exp-pied">
            {voies.serie ? <button type="button" className="sb-lien" data-impr-choisir="serie" onClick={() => choisir('serie')}>{tr('exp.direct.serie')}</button> : null}
            {voies.usb ? <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-impr-choisir="usb" onClick={() => choisir('usb')}>{tr('exp.direct.choisir')}</button>
              : voies.serie ? null : <span className="vrm-exp-ligne-dite">{tr(`exp.direct.indispo.${voies.raison === 'politique' ? 'politique' : 'navigateur'}`)}</span>}
          </div>
        </> : null}
        {etape === 'essai' || etape === 'question' ? <>
          <p className="vrm-exp-phrase" data-impr-fiche-nom={fiche && fiche.nom} data-impr-fiche-langage={fiche && fiche.langage}>{tr('exp.direct.choisie', { nom: fiche ? fiche.nom : '', langage: nomLangage(fiche ? fiche.langage : 'tspl') })}</p>
          {etape === 'essai' ? <p className="vrm-exp-sous">{tr('exp.direct.essai.phrase')}</p> : <p className="vrm-exp-phrase" data-impr-question-essai="">{tr('exp.direct.essai.question')}</p>}
          {souci ? <p className="vrm-exp-souci" role="status" data-impr-souci={souci}>{tr(`exp.direct.echec.${souci}`)}</p> : null}
          <div className="vrm-exp-pied">
            {etape === 'essai' ? <>
              <button type="button" className="sb-lien" onClick={oublier}>{tr('exp.direct.annuler')}</button>
              <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-impr-essai="" aria-busy={occupe ? 'true' : undefined} disabled={occupe} onClick={() => essayer()}>{occupe ? tr('exp.direct.envoi') : tr('exp.direct.essai.bouton')}</button>
            </> : <>
              <button type="button" className="sb-touche sb-touche--feuille" data-impr-essai-non="" disabled={occupe} onClick={autreLangage}>{tr('exp.direct.essai.non', { langage: nomLangage(langageSuivant(fiche.langage)) })}</button>
              <button type="button" className="sb-btn-plein sb-btn-plein--barre" data-impr-essai-oui="" disabled={occupe} onClick={oui}>{tr('exp.direct.essai.oui')}</button>
            </>}
          </div>
          {etape === 'question' && essais >= 3 ? <p className="vrm-exp-sous" data-impr-rien-sorti="">{tr('exp.direct.essai.rien')}</p> : null}
        </> : null}
        {etape === 'retenue' && retenu ? <>
          <p className="vrm-exp-phrase" data-impr-retenue={retenu.nom}>{tr('exp.direct.retenuePhrase', { nom: retenu.nom, langage: nomLangage(retenu.langage) })}</p>
          <p className="vrm-exp-sous">{tr('exp.direct.ensuite')}</p>
          <div className="vrm-exp-pied">
            <button type="button" className="sb-lien" data-impr-oublier="" onClick={oublier}>{tr('exp.direct.oublier')}</button>
            <button type="button" className="sb-touche sb-touche--feuille" data-impr-fermer="" onClick={onFermer}>{tr('exp.direct.fermer')}</button>
          </div>
        </> : null}
      </div>
    </Feuille>
  );
}
