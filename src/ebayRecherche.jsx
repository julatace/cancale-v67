// ── eBAY → ACHATS : CHERCHER, ET UN FIL (29 octobre) ────────────────────────
// Julien : « Pour le côté achat je comprends pas à quoi ça sert, honnêtement à
// rien je pense ; je pense que tu peux faire la recherche comme pour Vinted,
// avec un feed ; après, à voir, tout dépend si ça utilisera beaucoup de
// données. »
//
//   · CHERCHER : mots, pointure, prix max, état, achat immédiat, livrable en
//     France — les plus récentes d'abord. UN appel à eBay par recherche
//     (`/api/ebay` action `chercher`, jeton d'APPLICATION de VRM, jamais le
//     sien), au plus 30 annonces.
//   · LE FIL : ses recherches enregistrées (les « veilles » de l'espace
//     Organisation — la MÊME liste, §11 ; 10 actives au plus), relues à
//     l'ouverture de l'onglet puis au plus toutes les 15 min, app ouverte ET
//     visible — jamais en tâche de fond serveur. Une annonce jamais vue depuis
//     sa dernière visite porte « nouveau » — par son itemId, une identité.
//   · LES DONNÉES : le serveur rend ce qu'il a compté (recherches du jour sur
//     le plafond VRM) et MESURÉ (octets reçus d'eBay, envoyés ici) ; l'écran le
//     dit. Plafond atteint ⇒ le fil s'arrête et le dit.
//   · Rien n'est acheté par VRM : « Voir sur eBay ↗ ».
//   · Le repère de revente est celui du MODÈLE (ses ventes Vinted, la règle
//     `moyennesParModele`), dit comme tel — jamais le prix de cette paire.
//   · (16 nov., lot ebay-achats-refonte — Julien : « Améliore eBay, c'est de la
//     merde ») TROIS cartes lisibles : « Chercher sur eBay » (un champ, pointure,
//     prix max ; le reste sous « Plus de critères ») · « Mes recherches » (une
//     ligne par recherche, « Me prévenir » en interrupteur, le détail au toucher ;
//     remplace l'espace Organisation monté ici) · « Nouvelles annonces »
//     (src/AlertesEbay.jsx). « Les données » repliées sous « Détails », le quota
//     dit en un coin. Aucune règle eBay ne change (quotas, fil, port, VRM
//     n'achète jamais). docs/passation/2026-11-16-ebay-achats-refonte.md
import React,{useEffect,useRef,useState} from 'react';
import { motsVendeur } from './profilVendeur.js';
import {appelerEbay} from './ebayRequetes.js';
import Pourquoi from './composants/PourquoiReplie.jsx';
import {veillesDuFil,MAX_VEILLES_ACTIVES,criteresDeVeille,veillesEnAlerte,montantSaisi,erreurCriteresEbay,SITES_REVENTE} from './operations/metier.js';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import AlertesEbay from './AlertesEbay.jsx';
import './ebay/achats-ebay.css';

export const RELIRE_MS = 15 * 60 * 1000;
// Le jour de Paris (le plafond du serveur repart à minuit, heure de Paris).
export const jourParis = (t = Date.now()) => { try { return (globalThis.__vrmFmtJourEbay || (globalThis.__vrmFmtJourEbay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }))).format(new Date(t)); } catch (_) { return jourParisRegle(t); } };
export const MAX_FIL = MAX_VEILLES_ACTIVES;
const ENDPOINT_OPS = '/api/compte?mode=operations';

// Faut-il relire ? Jamais en arrière-plan, au plus toutes les 15 min.
export function aRelire(lueA, maintenant, visible) {
  if (!visible) return false;
  const t = Date.parse(lueA || '');
  return !Number.isFinite(t) || maintenant - t >= RELIRE_MS;
}
// Les recherches du fil : actives, les plus récentes d'abord, 10 au plus — la
// règle de metier.js, que l'espace Organisation lit aussi (« Dans le fil » /
// « Hors du fil », §11).
export const rechercheDuFil = veillesDuFil;

// (30 oct., revue) Une lecture RATÉE attend comme une lecture réussie : rien
// avant 15 min (sauf « Relire maintenant »). Avant, une recherche en échec
// n'avait pas d'heure : le fil la relançait à chaque minute, chaque relance
// comptait dans les 200 du jour (le serveur compte avant d'appeler eBay) et
// dans le quota d'eBay commun à toute l'application — une panne d'eBay
// épuisait le plafond en ~20 min. Et une panne commune (eBay, session,
// compteur) arrête le fil ENTIER : on ne relance pas les 9 autres recherches
// pour apprendre la même chose.
export function attenteEchec(echec, maintenant) {
  if (!echec || !Number.isFinite(echec.ici)) return false;
  // Une attente COURTE (la session qui se renouvelle) porte sa propre échéance.
  if (Number.isFinite(echec.jusqua)) return maintenant < echec.jusqua;
  return maintenant - echec.ici < RELIRE_MS;
}
// La raison d'une lecture ratée. `criteres` (400) ne se réessaie qu'après une
// modification de la recherche (une nouvelle version, une autre clé) ;
// le reste arrête tout le fil 15 min.
// (30 oct., revue) Un 401 n'est pas toujours une session perdue : au réveil
// (iPhone en PWA rouvert après une heure), le jeton a expiré et le
// renouvellement est en route. Le fil attendait 15 min en demandant de se
// reconnecter à quelqu'un de connecté. Désormais : renouveler, puis réessayer
// UNE fois ; « reconnecte-toi » seulement si le service REFUSE le renouvellement
// (ou qu'il n'y a plus de session), ou qu'un second 401 suit un renouvellement
// réussi. Renouvellement « pas su » (réseau) ⇒ un nouvel essai dans une minute.
export const MSG_SESSION = 'Ta session VRM a expiré : reconnecte-toi (rien n’a été envoyé à eBay).';
export const MSG_SESSION_RENOUVEL = 'Ta session VRM se renouvelle : je relis ton fil dans une minute (rien n’a été envoyé à eBay).';
export const ATTENTE_RENOUVEL_MS = 60 * 1000;
export function raisonEchec(res) {
  if (!res) return 'ebay';
  if (res.reason === 'plafond') return 'plafond';
  if (res.reason === 'plafond-fil') return 'plafond-fil';
  if (res.reason === 'criteres' || res.status === 400) return 'criteres';
  if (res.status === 401) return res.renouvel === 'pas-su' ? 'session-renouvel' : 'session';
  if (res.reason === 'pas-su') return 'pas-su';
  return 'ebay';
}

// (6 nov., vitesse 2) `repereAdmis` vit dans repereEbay.js (l'app s'en sert sans
// charger cet écran) ; ré-exporté ici, ses lecteurs ne changent pas.
import { repereAdmis } from './repereEbay.js';
import { jourParis as jourParisRegle } from './dateParis.js';
export { repereAdmis };
// (11 nov.) La forme vit dans metier.js : le serveur des alertes la lit aussi (§11).
export { criteresDeVeille };

// « Nouveau » depuis la dernière visite : une annonce absente de ce qui était
// connu AVANT cette visite. Première lecture d'une recherche ⇒ rien n'est
// marqué (on ne sait pas ce qu'il avait déjà vu).
const cleVus = (owner) => 'vrm_ebay_fil_vus_' + (owner || 'local');
const lireVus = (owner) => { try { const o = JSON.parse(localStorage.getItem(cleVus(owner)) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };
const ecrireVus = (owner, vid, ids) => { try { const o = lireVus(owner); const avant = Array.isArray(o[vid] && o[vid].ids) ? o[vid].ids : []; o[vid] = { ids: [...new Set([...avant, ...ids])].slice(-500), at: Date.now() }; localStorage.setItem(cleVus(owner), JSON.stringify(o)); } catch (_) {} };
export function nouveauxDe(items, connus) {
  if (!connus || !Array.isArray(connus.ids)) return new Set();
  const vu = new Set(connus.ids);
  return new Set((items || []).map((x) => x.itemId).filter((id) => !vu.has(id)));
}

// Le cache de l'onglet : changer d'onglet et revenir ne repart pas chez eBay
// avant 15 min (au rechargement de la page, si).
const CACHE = new Map();
// Les échecs : par recherche (critères refusés) et pour tout le fil (panne).
const REFUS = new Map();      // clé (owner:id:version) → message
let ARRET = null;              // { ici, raison, message }
// Les octets du jour sur CET appareil (sa question : « beaucoup de données ? »).
const cleOctets = (owner) => 'vrm_ebay_octets_' + (owner || 'local');
const lireOctets = (owner) => { try { const o = JSON.parse(localStorage.getItem(cleOctets(owner)) || 'null'); return o && o.jour === jourParis() ? o : null; } catch (_) { return null; } };
const noterOctets = (owner, oct) => { if (!oct) return null; try { const a = lireOctets(owner) || { jour: jourParis(), n: 0, ebay: 0, vrm: 0 }; const o = { jour: a.jour, n: a.n + 1, ebay: a.ebay + (Number(oct.ebay) || 0), vrm: a.vrm + (Number(oct.vrm) || 0) }; localStorage.setItem(cleOctets(owner), JSON.stringify(o)); return o; } catch (_) { return null; } };

const eur = (c) => (Number.isFinite(c) ? (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—');
const ko = (n) => (Number.isFinite(n) ? (Math.max(1, Math.round(n / 102.4)) / 10).toLocaleString('fr-FR') + ' Ko' : '—');
const heure = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const jourHeureCourt = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''; };

const phraseRepere = (rp) => <>Repère du modèle « {rp.modele} »{rp.partiel ? ` (pour les ${motsVendeur().noms} de ce modèle)` : ''} : {eur(Math.round(rp.moyenne * 100))} en moyenne sur {rp.n} de tes ventes — le modèle, pas {motsVendeur().ce}.</>;
// (16 nov., refonte) Une annonce : photo, titre, prix (port compris ou dit), lien eBay. Les couleurs
// viennent de la carte (src/ebay/achats-ebay.css), plus du thème JS posé sur le fond bleu.
function Resultat({ x, nouveau, rp }) {
  return <div className="eba-annonce" data-ebay-resultat={x.itemId} data-nouveau={nouveau ? 'oui' : 'non'}>
    <div className="eba-ph">{x.photo ? <img src={x.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
    <div className="vrm-buy-main eba-a-main">
      <div className="eba-a-titre" title={x.titre}>{nouveau && <span data-badge-nouveau="" className="eba-nouveau">{tr('ebayAchats.nouveau')}</span>}{x.titre || tr('ebayAchats.annonce', { id: x.itemId })}</div>
      <div className="eba-a-meta">
        <span data-ebay-prix={x.prix} data-ebay-port={x.port == null ? 'inconnu' : x.port}>{x.port == null ? <><span className="eba-prix">{eur(x.prix)}</span> {tr('alertesEbay.portInconnu')}</> : x.port === 0 ? <><span className="eba-prix">{eur(x.prix)}</span> {tr('alertesEbay.portCompris')}</> : <><span className="eba-prix">{eur(x.total)}</span> {tr('alertesEbay.dontPort', { prix: eur(x.prix), port: eur(x.port) })}</>}</span>
        {x.etat && <span>· {x.etat}</span>}
        {x.enchere && !x.achatImmediat && <span>· {tr('ebayAchats.enchere')}</span>}
        {x.vendeur && <span>· {x.vendeur}{Number.isFinite(x.avis) ? ` (${String(x.avis).replace('.', ',')} %)` : ''}</span>}
      </div>
      {rp && <div data-ebay-repere={rp.modele} className="eba-gris" style={{ fontSize: 12 }}>{phraseRepere(rp)}</div>}
    </div>
    <div className="eba-a-act"><a className="eba-lien" href={x.url} target="_blank" rel="noreferrer noopener" data-voir-ebay="">{tr('alertesEbay.voir')}</a></div>
  </div>;
}

// Le repère se dit UNE fois au-dessus de la liste quand toutes les lignes QUI
// EN ONT UN portent le même modèle (§7) ; sur la ligne seulement quand deux
// modèles différents se côtoient — là seulement il distingue.
// (30 oct., revue) Une ligne SANS repère (lacets, taille enfant, modèle
// générique) ne décide plus : avant, un seul accessoire dans la liste faisait
// écrire la même phrase sous chacune des 20 autres paires. Quand certaines
// lignes n'en ont pas, la phrase le dit (« pour les paires de ce modèle »).
export function reperesDeListe(titres, repere) {
  const rps = titres.map((t) => (repere ? repere(t) : null));
  const avec = rps.filter(Boolean);
  const cles = new Set(avec.map((r) => r.modele));
  const commun = avec.length >= 2 && cles.size === 1 ? { ...avec[0], partiel: avec.length < titres.length } : null;
  return { commun, parLigne: commun ? titres.map(() => null) : rps };
}
function Liste({ r, nouveaux, repere, max = 8, cle }) {
  const [tout, setTout] = useState(false);
  if (!r) return null;
  const items = r.items || [];
  const vus = tout ? items : items.slice(0, max);
  const { commun, parLigne } = reperesDeListe(vus.map((x) => x.titre), repere);
  const filtres = [r.horsBudget ? tr('ebayAchats.ecarte.budget', { n: r.horsBudget }) : '', r.exclus ? tr('ebayAchats.ecarte.exclus', { n: r.exclus }) : '', r.autreDevise ? tr('ebayAchats.ecarte.devise', { n: r.autreDevise }) : ''].filter(Boolean);
  const ecartees = (r.horsBudget || 0) + (r.exclus || 0) + (r.autreDevise || 0);
  return <div data-ebay-liste={cle || ''} data-ebay-nb={items.length} style={{ display: 'grid', gap: 6, minWidth: 0 }}>
    {!items.length ? <p data-ebay-vide={ecartees ? 'ecartees' : ''} className="eba-gris">{ecartees
      // eBay EN AVAIT : c'est VRM qui les a écartées (le filtre de prix d'eBay
      // ne compte pas le port, VRM l'ajoute ensuite).
      ? tr('ebayAchats.toutesEcartees', { n: ecartees, raisons: filtres.join(' · ') })
      : tr('ebayAchats.aucuneAnnonce')}</p>
      : <>{commun && <p data-ebay-repere={commun.modele} data-ebay-repere-liste={commun.partiel ? 'partiel' : 'tout'} className="eba-gris" style={{ fontSize: 12 }}>{phraseRepere(commun)}</p>}
        <div className="eba-annonces">{vus.map((x, i) => <Resultat key={x.itemId} x={x} nouveau={nouveaux && nouveaux.has(x.itemId)} rp={parLigne[i]} />)}</div></>}
    {items.length > max && <button type="button" className="eba-lien eba-plus-liste" onClick={() => setTout((v) => !v)}>{tout ? tr('ebayAchats.voirMoins') : tr('ebayAchats.voirTout', { n: items.length })}</button>}
    {items.length > 0 && filtres.length > 0 && <p className="eba-gris" style={{ fontSize: 12 }}>{tr('ebayAchats.ecartees', { raisons: filtres.join(' · ') })}</p>}
  </div>;
}

// L'interrupteur « Me prévenir » (l'alerte d'une recherche : le SERVEUR la relit chaque heure).
function Interrupteur({ on, titre, disabled, onBasculer }) {
  return <button type="button" role="switch" aria-checked={on ? 'true' : 'false'} aria-label={tr('alertesEbay.allumer') + ' · ' + titre} className="eba-inter" disabled={disabled} onClick={onBasculer} data-veille-alerte={on ? 'allumee' : 'eteinte'}>
    <span className="eba-inter-piste" aria-hidden="true" /><span className="eba-inter-libelle">{tr('alertesEbay.allumer')}</span>
  </button>;
}

// La création ou la modification d'une recherche (la même règle que l'espace Organisation :
// `veille.creer` / `veille.modifier`, jugée par metier.js côté serveur).
const versSaisie = (v) => ({ titre: v ? v.titre || '' : '', mots: v ? v.mots || '' : '', pointure: v ? v.pointure || '' : '', maximum: v && Number.isFinite(v.maximum) ? (v.maximum / 100).toFixed(2).replace('.', ',') : '', minimum: v && Number.isFinite(v.minimum) ? (v.minimum / 100).toFixed(2).replace('.', ',') : '', exclus: v ? v.exclus || '' : '', categorie: v ? v.categorie || '' : '', etatArticle: v ? v.etatArticle || 'tous' : 'tous', pays: v ? v.pays || 'tous' : 'tous', achatImmediat: v ? v.achatImmediat !== false : true, livraisonFR: v ? v.livraisonFR !== false : true });
function EditionRecherche({ initial, sn, occupe, erreur, onEnregistrer, onAnnuler }) {
  const [f, setF] = useState(() => versSaisie(initial));
  const [local, setLocal] = useState('');
  const ch = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const envoyer = (e) => {
    e.preventDefault(); setLocal('');
    let maximum, minimum = null;
    try { maximum = montantSaisi(f.maximum); if (String(f.minimum).trim()) minimum = montantSaisi(f.minimum); } catch (_) { setLocal(tr('ebayAchats.erreurMontant')); return; }
    const err = erreurCriteresEbay({ mots: f.mots, pointure: f.pointure, categorie: f.categorie });
    if (err) { setLocal(err); return; }
    const titre = (f.titre.trim() || (f.mots.trim() + (f.pointure.trim() ? ' · ' + f.pointure.trim() : ''))).slice(0, 160);
    onEnregistrer({ titre, mots: f.mots, exclus: f.exclus, categorie: f.categorie.trim(), minimum, maximum, etatArticle: f.etatArticle, pays: f.pays, pointure: f.pointure.trim(), achatImmediat: f.achatImmediat, livraisonFR: f.livraisonFR });
  };
  return <form className="eba-edition" data-ebay-edition={initial ? initial.id : 'nouvelle'} onSubmit={envoyer}>
    <div className="eba-edition-titre">{initial ? tr('ebayAchats.modifierTitre') : tr('ebayAchats.nouvelleTitre')}</div>
    <label className="eba-champ">{tr('ebayAchats.champ.mots')}<input value={f.mots} onChange={ch('mots')} maxLength={200} required enterKeyHint="done" placeholder={tr('ebayAchats.champ.motsExemple')} /></label>
    <div className={'eba-duo' + (sn || f.pointure ? '' : ' is-seul')}>
      {(sn ? true : !!f.pointure) ? <label className="eba-champ">{tr('ebayAchats.champ.pointure')}<input value={f.pointure} onChange={ch('pointure')} inputMode="decimal" maxLength={4} placeholder="42" /></label> : null}
      <label className="eba-champ">{tr('ebayAchats.champ.budget')}<input value={f.maximum} onChange={ch('maximum')} inputMode="decimal" required placeholder="80" /></label>
    </div>
    <label className="eba-champ">{tr('ebayAchats.champ.nom')}<input value={f.titre} onChange={ch('titre')} maxLength={160} placeholder={tr('ebayAchats.champ.nomVide')} /></label>
    <details className="eba-repli"><summary>{tr('ebayAchats.plusCriteres')}</summary><div className="eba-repli-corps">
      <label className="eba-champ">{tr('ebayAchats.champ.exclus')}<input value={f.exclus} onChange={ch('exclus')} maxLength={200} placeholder={tr('ebayAchats.champ.exclusExemple')} /></label>
      <div className="eba-duo">
        <label className="eba-champ">{tr('ebayAchats.champ.minimum')}<input value={f.minimum} onChange={ch('minimum')} inputMode="decimal" placeholder="—" /></label>
        <label className="eba-champ">{tr('ebayAchats.champ.etat')}<select value={f.etatArticle} onChange={ch('etatArticle')}><option value="tous">{tr('ebayAchats.etat.tous')}</option><option value="neuf">{tr('ebayAchats.etat.neuf')}</option><option value="occasion">{tr('ebayAchats.etat.occasion')}</option></select></label>
      </div>
      <div className="eba-duo">
        <label className="eba-champ">{tr('ebayAchats.champ.pays')}<select value={f.pays} onChange={ch('pays')}>{['tous', 'FR', 'BE', 'DE', 'ES', 'IT'].map((p) => <option key={p} value={p}>{tr('ebayAchats.pays.' + p)}</option>)}</select></label>
        <label className="eba-champ">{tr('ebayAchats.champ.categorie')}<input value={f.categorie} onChange={ch('categorie')} inputMode="numeric" maxLength={10} placeholder="—" /></label>
      </div>
      <label className="eba-coche"><input type="checkbox" checked={f.achatImmediat} onChange={ch('achatImmediat')} />{tr('ebayAchats.achatImmediat')}</label>
      <label className="eba-coche"><input type="checkbox" checked={f.livraisonFR} onChange={ch('livraisonFR')} />{tr('ebayAchats.livrableFR')}</label>
    </div></details>
    {(local || erreur) && <p role="alert" className="eba-alerte is-ambre">{local || erreur}</p>}
    <div className="eba-actions">
      <button type="submit" className="eba-btn is-plein" disabled={occupe} data-geste="enregistrer-edition">{occupe ? tr('ebayAchats.enregistrement') : tr('ebayAchats.enregistrer')}</button>
      <button type="button" className="eba-btn" onClick={onAnnuler} data-geste="annuler-edition">{tr('ebayAchats.annuler')}</button>
    </div>
  </form>;
}

// Le prix de revente d'une recherche en alerte (facultatif : sans lui, la médiane de SES ventes du modèle).
function PrixRevente({ v, occupe, onEnregistrer }) {
  const [ouvert, setOuvert] = useState(false);
  const [prix, setPrix] = useState(Number.isSafeInteger(v.revente) ? (v.revente / 100).toFixed(2).replace('.', ',') : '');
  const [site, setSite] = useState(v.reventeSite || 'vinted');
  const [err, setErr] = useState('');
  const dit = Number.isSafeInteger(v.revente) ? tr('ebayAchats.revente', { prix: eur(v.revente), site: tr('alertesEbay.site.' + (v.reventeSite || 'vinted')) }) : tr('ebayAchats.reventeMediane');
  if (!ouvert) return <div className="eba-actions" style={{ gap: 4 }}><span className="eba-gris">{dit}</span><button type="button" className="eba-lien" onClick={() => setOuvert(true)} data-geste="prix-revente">{tr('ebayAchats.modifier')}</button></div>;
  const ok = async (e) => { e.preventDefault(); setErr(''); let r = null; if (String(prix).trim()) { try { r = montantSaisi(prix); } catch (_) { setErr(tr('ebayAchats.erreurMontant')); return; } } if (await onEnregistrer(r, site)) setOuvert(false); };
  return <form className="eba-edition" onSubmit={ok} data-ebay-revente="">
    <div className="eba-duo">
      <label className="eba-champ">{tr('alertesEbay.form.revente')}<input value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="decimal" placeholder={tr('alertesEbay.form.reventeVide')} /></label>
      <label className="eba-champ">{tr('alertesEbay.form.site')}<select value={site} onChange={(e) => setSite(e.target.value)}>{SITES_REVENTE.map((s) => <option key={s} value={s}>{tr('alertesEbay.site.' + s)}</option>)}</select></label>
    </div>
    {err && <p role="alert" className="eba-alerte is-ambre">{err}</p>}
    <div className="eba-actions"><button type="submit" className="eba-btn is-plein" disabled={occupe}>{tr('ebayAchats.enregistrer')}</button><button type="button" className="eba-btn" onClick={() => setOuvert(false)}>{tr('ebayAchats.annuler')}</button></div>
  </form>;
}

export default function RechercheEbay({ headers, theme: C, owner, repere, session, vend = 'sneakers', exemple = '', revente, contexte }) {
  useLangue();
  // (11 nov., lot DJ2) « Pointure » et l'exemple de basket : seulement pour Sneakers.
  // Hors Sneakers, la taille s'écrit dans les mots (la règle `pointure` attend 2 chiffres).
  const sn = vend !== 'autre';
  const [f, setF] = useState({ mots: '', pointure: '', maximum: '', etat: 'tous', achatImmediat: true, livraisonFR: true });
  const [manuel, setManuel] = useState(undefined);   // undefined rien · 'encours' · {r} · {erreur}
  const [usage, setUsage] = useState(null);           // { appels, octets, quotaEbay, plafondEbayDoc }
  const [plafondJour, setPlafondJour] = useState('');
  const [plafondFilJour, setPlafondFilJour] = useState('');   // la part du FIL est faite (la main garde la sienne)
  const [veilles, setVeilles] = useState(undefined);  // undefined lecture · null pas su · { liste, revision }
  const [fil, setFil] = useState({});                 // vid → { etat, r?, erreur?, lueA? }
  const [ajout, setAjout] = useState('');
  const [arret, setArret] = useState(ARRET);           // la panne commune du fil (une phrase, une fois)
  const [octetsJour, setOctetsJour] = useState(() => lireOctets(owner));
  // (16 nov., refonte) Mes recherches : la ligne ouverte, l'édition, l'historique, l'écriture.
  const [ouverte, setOuverte] = useState('');
  const [edition, setEdition] = useState(null);       // null · 'nouvelle' · une recherche
  const [archives, setArchives] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreurOps, setErreurOps] = useState('');
  const [etatsAlertes, setEtatsAlertes] = useState({}); // vid → état lu par la route `alertes`
  const vusAvant = useRef(lireVus(owner));
  const enVol = useRef(false);
  const vivant = useRef(true);
  useEffect(() => () => { vivant.current = false; }, []);

  const noterUsage = (j) => { if (j && j.appels) setUsage((u) => ({ ...(u || {}), appels: j.appels, ...(j.octets ? { octets: j.octets } : {}), ...(j.quotaEbay !== undefined ? { quotaEbay: j.quotaEbay, plafondEbayDoc: j.plafondEbayDoc } : {}) })); };
  const appeler = async (criteres, essai = 0) => {
    try { const j = await appelerEbay('chercher', criteres, headers); noterUsage(j); const o = noterOctets(owner, j.octets); if (o && vivant.current) setOctetsJour(o); return { r: j }; }
    catch (e) {
      if (e.status === 401 && essai === 0 && session && session.renouveler) {
        // Le jeton a pu expirer pendant la veille : on le renouvelle, puis UN essai.
        let ok = null; try { ok = await session.renouveler(); } catch (_) { ok = null; }
        if (ok === true) return appeler(criteres, 1);
        return ok === null ? { erreur: MSG_SESSION_RENOUVEL, reason: 'session', status: 401, renouvel: 'pas-su' } : { erreur: MSG_SESSION, reason: 'session', status: 401, renouvel: 'refuse' };
      }
      if (e.reason === 'plafond') setPlafondJour(jourParis());
      if (e.reason === 'plafond-fil') setPlafondFilJour(jourParis());
      // Un second 401 juste après un renouvellement réussi : la session est vraiment perdue.
      return { erreur: e.status === 401 ? MSG_SESSION : (e.message || tr('ebayAchats.pasPuChercher')), reason: e.reason || '', status: e.status || 0 };
    }
  };

  // Les recherches enregistrées (la même liste que l'espace Organisation). Chaque lecture et
  // chaque écriture est annoncée (`vrm:veilles-maj`) : « Nouvelles annonces » lit la même liste.
  const recevoirVeilles = (d) => {
    const v = { liste: d.veilles || [], revision: d.revision };
    if (vivant.current) setVeilles(v);
    try { window.dispatchEvent(new CustomEvent('vrm:veilles-maj', { detail: { veilles: v.liste, revision: v.revision, source: 'ebay-achats' } })); } catch (_) {}
  };
  const lireVeilles = async () => {
    try {
      const r = await fetch(ENDPOINT_OPS, { headers: headers(), cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok || !j.donnees) { if (vivant.current) setVeilles(null); return; }
      recevoirVeilles(j.donnees);
    } catch (_) { if (vivant.current) setVeilles(null); }
  };
  useEffect(() => {
    lireVeilles();
    const maj = (e) => { const d = e && e.detail; if (d && d.source !== 'ebay-achats' && Array.isArray(d.veilles)) setVeilles({ liste: d.veilles, revision: d.revision }); };
    window.addEventListener('vrm:veilles-maj', maj);
    return () => { window.removeEventListener('vrm:veilles-maj', maj); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Une écriture (créer, modifier, archiver, alerte…) : comparer-et-échanger sur la révision
  // lue (le serveur refuse une révision dépassée). Ratée ⇒ rien n'est supposé : on relit.
  const envoyerOps = async (type, donnees, id) => {
    if (occupe) return false;
    if (!veilles || !Number.isSafeInteger(veilles.revision)) { setErreurOps(tr('ebayAchats.pasLues')); return false; }
    setOccupe(true); setErreurOps('');
    try {
      const corps = { id: id || crypto.randomUUID(), revision: veilles.revision, type, donnees };
      const r = await fetch(ENDPOINT_OPS, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok || !j.donnees) { if (vivant.current) setErreurOps((j && j.message) || tr('ebayAchats.pasEnregistre')); lireVeilles(); return false; }
      recevoirVeilles(j.donnees);
      return true;
    } catch (_) { if (vivant.current) setErreurOps(tr('ebayAchats.connexionCoupee')); lireVeilles(); return false; }
    finally { if (vivant.current) setOccupe(false); }
  };

  const { fil: dansFil, horsFil } = rechercheDuFil(veilles && veilles.liste);
  const cleV = (v) => `${owner || ''}:${v.id}:${v.version || 1}`;

  // Relire le fil : une recherche à la fois, seulement visible, au plus toutes
  // les 15 min, et plus rien une fois le plafond du jour atteint.
  const relireFil = async (force) => {
    if (enVol.current || !dansFil.length) return;
    if (force) { ARRET = null; setArret(null); }
    // Une panne commune : rien n'est relancé avant 15 min (l'horloge de cet appareil).
    if (ARRET && attenteEchec(ARRET, Date.now())) { setArret(ARRET); return; }
    if ((plafondJour && plafondJour === jourParis()) || (plafondFilJour && plafondFilJour === jourParis())) return;
    enVol.current = true;
    try {
      // Au réveil, le renouvellement de la session part sur le même évènement :
      // on l'attend AVANT de lire, plutôt que d'envoyer l'ancien jeton.
      if (session && session.prete) {
        let sp = true; try { sp = await session.prete(); } catch (_) { sp = null; }
        if (!vivant.current) return;
        if (sp === false) { ARRET = { ici: Date.now(), raison: 'session', message: MSG_SESSION }; setArret(ARRET); return; }
        if (sp === null) { ARRET = { ici: Date.now(), jusqua: Date.now() + ATTENTE_RENOUVEL_MS, raison: 'session-renouvel', message: MSG_SESSION_RENOUVEL }; setArret(ARRET); return; }
      }
      for (const v of dansFil) {
        if (!vivant.current) return;
        if (plafondJour && plafondJour === jourParis()) return;
        if (plafondFilJour && plafondFilJour === jourParis()) return;
        const k = cleV(v), c = CACHE.get(k);
        // Critères refusés par la route : pas de nouvel essai pour CETTE version.
        if (REFUS.has(k)) { const m = REFUS.get(k); setFil((p) => (p[v.id] && p[v.id].etat === 'criteres' ? p : { ...p, [v.id]: { etat: 'criteres', erreur: m } })); continue; }
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (!force && c && !aRelire(c.ici, Date.now(), visible)) { setFil((p) => (p[v.id] && p[v.id].lueA === c.lueA && p[v.id].etat === 'lu' ? p : { ...p, [v.id]: { etat: 'lu', r: c.r, lueA: c.lueA } })); continue; }
        if (!visible) continue;
        setFil((p) => ({ ...p, [v.id]: { ...(p[v.id] || {}), etat: 'encours' } }));
        const res = await appeler({ ...criteresDeVeille(v), source: 'fil' });
        if (!vivant.current) return;
        if (res.r) {
          const lueA = res.r.lueA || new Date().toISOString();
          // La borne des 15 min se juge sur l'horloge de CET appareil (l'heure où
          // la réponse est arrivée ici), jamais sur celle du serveur : un
          // téléphone en avance relisait à chaque minute, un en retard jamais.
          CACHE.set(k, { lueA, ici: new Date().toISOString(), r: res.r });
          ecrireVus(owner, v.id, (res.r.items || []).map((x) => x.itemId));
          ARRET = null; setArret(null);
          setFil((p) => ({ ...p, [v.id]: { etat: 'lu', r: res.r, lueA } }));
          continue;
        }
        const raison = raisonEchec(res);
        if (raison === 'criteres') { REFUS.set(k, res.erreur); setFil((p) => ({ ...p, [v.id]: { etat: 'criteres', erreur: res.erreur } })); continue; }
        setFil((p) => ({ ...p, [v.id]: { ...(p[v.id] || {}), etat: raison === 'plafond' || raison === 'plafond-fil' ? 'plafond' : 'pas-su' } }));
        if (raison === 'plafond' || raison === 'plafond-fil') return;
        // eBay injoignable, session expirée, compteur illisible : la même cause
        // pour toutes les recherches ⇒ le fil s'arrête, et le dit une fois.
        ARRET = { ici: Date.now(), raison, message: res.erreur, ...(raison === 'session-renouvel' ? { jusqua: Date.now() + ATTENTE_RENOUVEL_MS } : {}) };
        setArret(ARRET);
        return;
      }
    } finally { enVol.current = false; }
  };
  const signature = dansFil.map((v) => v.id + ':' + (v.version || 1)).join(',');
  useEffect(() => { if (veilles && veilles.liste) relireFil(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signature, plafondJour, plafondFilJour]);
  useEffect(() => {
    const t = setInterval(() => { relireFil(false); }, 60 * 1000);
    const vis = () => { if (document.visibilityState === 'visible') relireFil(false); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, plafondJour, plafondFilJour]);

  const prixCentimes = (s) => { const t = String(s || '').trim().replace(',', '.'); if (!t) return null; if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return NaN; const [a, b = ''] = t.split('.'); return Number(a) * 100 + Number(b.padEnd(2, '0')); };
  const criteresManuels = () => ({ mots: f.mots, pointure: f.pointure.trim(), maximum: prixCentimes(f.maximum), etat: f.etat, achatImmediat: f.achatImmediat, livraisonFR: f.livraisonFR, pays: 'tous' });
  const chercher = async (e) => {
    e && e.preventDefault();
    const c = criteresManuels();
    if (Number.isNaN(c.maximum)) { setManuel({ erreur: tr('ebayAchats.prixInvalide') }); return; }
    setManuel('encours'); setAjout('');
    const res = await appeler(c);
    if (vivant.current) setManuel(res);
  };
  const ajouterAuFil = async () => {
    const c = criteresManuels();
    if (!(c.maximum > 0)) { setAjout(tr('ebayAchats.prixPourEnregistrer')); return; }
    if (!veilles || !Number.isSafeInteger(veilles.revision)) { setAjout(tr('ebayAchats.pasLues')); return; }
    setAjout('encours');
    try {
      const titre = (c.mots + (c.pointure ? ' · ' + c.pointure : '')).slice(0, 160);
      const corps = { id: crypto.randomUUID(), revision: veilles.revision, type: 'veille.creer', donnees: { titre, mots: c.mots, exclus: '', categorie: '', minimum: null, maximum: c.maximum, etatArticle: c.etat, pays: 'tous', pointure: c.pointure, achatImmediat: c.achatImmediat, livraisonFR: c.livraisonFR } };
      const r = await fetch(ENDPOINT_OPS, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) { setAjout((j && j.message) || tr('ebayAchats.pasEnregistre')); return; }
      // Le résultat de la recherche qui vient d'être faite EST la première
      // lecture de la nouvelle recherche : pas un second appel à eBay pour la
      // même chose (il compterait dans les 200 du jour).
      const nv = (j.donnees.veilles || []).find((x) => x && x.id === corps.id);
      if (nv && manuel && manuel.r) {
        const ids = (manuel.r.items || []).map((x) => x.itemId);
        CACHE.set(`${owner || ''}:${nv.id}:${nv.version || 1}`, { lueA: manuel.r.lueA || new Date().toISOString(), ici: new Date().toISOString(), r: manuel.r });
        ecrireVus(owner, nv.id, ids);
        vusAvant.current = { ...vusAvant.current, [nv.id]: { ids } };   // il vient de les voir : rien de « nouveau »
        setFil((p) => ({ ...p, [nv.id]: { etat: 'lu', r: manuel.r, lueA: manuel.r.lueA || new Date().toISOString() } }));
      }
      recevoirVeilles(j.donnees);
      setAjout('ok');
    } catch (_) { setAjout(tr('ebayAchats.connexionCoupee')); }
  };
  const exporter = () => {
    try {
      const blob = new Blob([JSON.stringify({ exporte: new Date().toISOString(), veilles: (veilles && veilles.liste) || [] }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'VRM-recherches-ebay-' + jourParis() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {}
  };

  const nouveauxV = (v, r) => nouveauxDe(r && r.items, vusAvant.current[v.id]);
  const nbNouveaux = dansFil.reduce((s, v) => s + (fil[v.id] && fil[v.id].r ? nouveauxV(v, fil[v.id].r).size : 0), 0);
  const ap = usage && usage.appels;
  const plafondAuj = plafondJour === jourParis();
  const plafondFilAuj = !plafondAuj && plafondFilJour === jourParis();
  const filArrete = plafondAuj || plafondFilAuj;
  // Ce que montre chaque recherche (§7 : une cause commune se dit une fois en
  // tête du fil ; la recherche ne garde qu'une mention courte).
  const etatAffiche = (e) => e.etat === 'criteres' ? 'criteres' : e.etat === 'encours' ? 'encours' : e.etat === 'lu' ? 'lu' : filArrete ? 'plafond' : arret ? 'pas-su' : (e.etat || 'attente');
  const premieres = dansFil.filter((v) => { const e = fil[v.id]; return e && e.r && (e.r.items || []).length > 0 && !vusAvant.current[v.id]; }).length;
  const heureMs = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const filIds = new Set(dansFil.map((v) => v.id));
  const actives = veilles && veilles.liste ? veilles.liste.filter((v) => v && v.etat === 'preparee').sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))) : [];
  const archivees = veilles && veilles.liste ? veilles.liste.filter((v) => v && v.etat === 'archivee') : [];
  const enAlerte = veillesEnAlerte((veilles && veilles.liste) || []);

  // Une ligne de « Mes recherches » : nom ; budget · pointure · ce que le fil en sait ; l'interrupteur.
  const ligne = (v) => {
    const dans = filIds.has(v.id), e = fil[v.id] || {}, aff = dans ? etatAffiche(e) : 'hors', nv = e.r ? nouveauxV(v, e.r) : null, n = nv ? nv.size : 0;
    const ouvert = ouverte === v.id;
    const etatCourt = aff === 'criteres' ? <span className="eba-ambre">{tr('ebayAchats.etatCourt.criteres')}</span>
      : aff === 'encours' && !e.r ? tr('ebayAchats.etatCourt.encours')
      : n > 0 ? <span className="eba-nv">{tr('ebayAchats.nouvelles', { n })}</span>
      : e.r ? tr('ebayAchats.etatCourt.lue', { n: (e.r.items || []).length })
      : aff === 'pas-su' || aff === 'plafond' ? tr('ebayAchats.etatCourt.pasLue') : '';
    const ra = etatsAlertes[v.id];
    return <article key={v.id} className="eba-rech" data-ebay-fil-recherche={v.id} data-etat={aff} data-ops-fil={dans ? 'dans' : v.etat === 'archivee' ? 'archivee' : 'hors'} data-ebay-nouvelles={n}>
      <div className="eba-rech-ligne">
        <button type="button" className="eba-ligne" data-ebay-ligne="" aria-expanded={ouvert ? 'true' : 'false'} onClick={() => { setOuverte(ouvert ? '' : v.id); setEdition(null); }}>
          <span className="eba-nom">{v.titre}</span>
          <span className="eba-sous">{tr('ebayAchats.budget', { prix: eur(v.maximum) })}{v.pointure ? ' · ' + v.pointure : ''}{etatCourt ? <> · {etatCourt}</> : null}</span>
        </button>
        {dans ? <Interrupteur on={v.alerte === true} titre={v.titre} disabled={occupe || !veilles} onBasculer={() => envoyerOps('veille.alerte', { cible: v.id, alerte: v.alerte !== true, revente: Number.isSafeInteger(v.revente) ? v.revente : null, site: v.reventeSite || 'vinted' })} />
          : <span className="eba-chip" data-ebay-hors="">{v.etat === 'archivee' ? tr('ebayAchats.archivee') : tr('ebayAchats.horsFil')}</span>}
      </div>
      {ouvert && <div className="eba-rech-detail" data-ebay-detail="">
        {edition && edition !== 'nouvelle' && edition.id === v.id
          ? <EditionRecherche initial={v} sn={sn} occupe={occupe} erreur={erreurOps} onAnnuler={() => setEdition(null)} onEnregistrer={async (d) => { if (await envoyerOps('veille.modifier', { ...d, cible: v.id, versionAttendue: v.version || 1 })) setEdition(null); }} />
          : <>
            {aff === 'criteres' && <p data-ebay-fil-etat="criteres" className="eba-alerte is-ambre">{tr('ebayAchats.criteresRefuses', { raison: e.erreur || '' })}</p>}
            {(aff === 'pas-su' || aff === 'plafond') && <p data-ebay-fil-etat={aff} className="eba-gris">{e.r ? tr('ebayAchats.pasRelue') : tr('ebayAchats.pasLueLong')}</p>}
            {aff === 'encours' && !e.r && <p className="eba-gris">{tr('ebayAchats.rechercheEnCours')}</p>}
            {e.r && <Liste r={e.r} nouveaux={nv} repere={repere} cle={v.id} />}
            <div className="eba-crit">
              <span><b>{v.mots}</b>{v.exclus ? ' · ' + tr('ebayAchats.sans', { mots: v.exclus }) : ''}</span>
              <span>{tr('ebayAchats.etat.' + (v.etatArticle || 'tous'))} · {tr('ebayAchats.pays.' + (v.pays || 'tous'))}</span>
              {e.lueA && <span>{tr('ebayAchats.lueA', { h: heure(e.lueA) })}</span>}
            </div>
            {v.alerte === true && <>
              <p className="eba-gris" data-alerte-recherche={v.id} data-alerte-recherche-etat={!ra ? 'attente' : ra.refus ? 'refus' : ra.echec ? 'echec' : 'lue'}>{tr('ebayAchats.alerte')} {!ra ? tr('alertesEbay.etat.attente') : ra.refus ? tr('alertesEbay.etat.refus', { raison: ra.refus }) : ra.echec ? tr('alertesEbay.etat.echec', { heure: heure(ra.at) }) : ra.premiere && ra.premiere === ra.at ? tr('alertesEbay.etat.premiere', { heure: heure(ra.at) }) : tr('alertesEbay.etat.lue', { heure: heure(ra.at), n: Number.isSafeInteger(ra.n) ? ra.n : 0 })}</p>
              <PrixRevente v={v} occupe={occupe} onEnregistrer={(r, site) => envoyerOps('veille.alerte', { cible: v.id, alerte: true, revente: r, site })} />
            </>}
            <div className="eba-actions">
              {v.etat === 'preparee' ? <>
                <button type="button" className="eba-btn" disabled={occupe} onClick={() => setEdition(v)} data-geste="modifier-recherche">{tr('ebayAchats.modifier')}</button>
                <button type="button" className="eba-btn" disabled={occupe} onClick={() => envoyerOps('veille.dupliquer', { cible: v.id, titre: (v.titre.slice(0, 150) + ' ' + tr('ebayAchats.copie')).slice(0, 160) })} data-geste="dupliquer-recherche">{tr('ebayAchats.dupliquer')}</button>
                <button type="button" className="eba-btn" disabled={occupe} onClick={async () => { if (await envoyerOps('veille.archiver', { cible: v.id })) setOuverte(''); }} data-geste="archiver-recherche">{tr('ebayAchats.archiver')}</button>
              </> : <button type="button" className="eba-btn" disabled={occupe} onClick={() => envoyerOps('veille.restaurer', { cible: v.id })} data-geste="restaurer-recherche">{tr('ebayAchats.restaurer')}</button>}
            </div>
            {(v.evenements || []).length > 0 && <details className="eba-repli"><summary>{tr('ebayAchats.modifications', { n: v.evenements.length })}</summary>
              <div className="eba-details">{(v.evenements || []).slice().reverse().slice(0, 20).map((ev) => <p key={ev.id}>{jourHeureCourt(ev.cree)} · {tr('ebayAchats.histo.' + (['modification', 'archivage', 'restauration', 'alerte', 'alerte-arretee'].includes(ev.nature) ? ev.nature : 'autre'))}{ev.avant && ev.apres && ev.avant.maximum !== ev.apres.maximum ? ' · ' + eur(ev.avant.maximum) + ' → ' + eur(ev.apres.maximum) : ''}</p>)}</div>
            </details>}
          </>}
      </div>}
    </article>;
  };

  return <section className="eba" data-ebay-recherche="">
    {/* ── (a) CHERCHER SUR eBAY ─────────────────────────────────────────── */}
    <div className="eba-carte" data-ebay-bloc="chercher">
      <div className="eba-tete"><h3 className="eba-titre">{tr('ebayAchats.chercher.titre')}</h3></div>
      <form onSubmit={chercher} data-ebay-form-recherche="" className="eba-form">
        <label className="eba-champ">{sn ? tr('ebayAchats.champ.modele') : tr('ebayAchats.champ.article')}<input type="search" enterKeyHint="search" aria-label="Mots à chercher" value={f.mots} onChange={(e) => setF({ ...f, mots: e.target.value })} placeholder={sn ? 'ex. salomon xt-6' : (exemple || 'ex. lampe vintage').replace(/^ex : /, 'ex. ')} /></label>
        <div className={'eba-duo' + (sn ? '' : ' is-seul')}>
          {sn ? <label className="eba-champ">{tr('ebayAchats.champ.pointure')}<input aria-label="Pointure" inputMode="decimal" enterKeyHint="search" value={f.pointure} onChange={(e) => setF({ ...f, pointure: e.target.value })} placeholder="42" /></label> : null}
          <label className="eba-champ">{tr('ebayAchats.champ.prixMax')}<input aria-label="Prix maximum" inputMode="decimal" enterKeyHint="search" value={f.maximum} onChange={(e) => setF({ ...f, maximum: e.target.value })} placeholder="80" /></label>
        </div>
        <details className="eba-repli" data-ebay-plus-criteres=""><summary>{tr('ebayAchats.plusCriteres')}</summary><div className="eba-repli-corps">
          <label className="eba-champ">{tr('ebayAchats.champ.etat')}<select aria-label="État" value={f.etat} onChange={(e) => setF({ ...f, etat: e.target.value })}><option value="tous">{tr('ebayAchats.etat.tous')}</option><option value="neuf">{tr('ebayAchats.etat.neuf')}</option><option value="occasion">{tr('ebayAchats.etat.occasion')}</option></select></label>
          <label className="eba-coche"><input type="checkbox" checked={f.achatImmediat} onChange={(e) => setF({ ...f, achatImmediat: e.target.checked })} />{tr('ebayAchats.achatImmediat')}</label>
          <label className="eba-coche"><input type="checkbox" checked={f.livraisonFR} onChange={(e) => setF({ ...f, livraisonFR: e.target.checked })} />{tr('ebayAchats.livrableFR')}</label>
        </div></details>
        <div className="eba-envoi">
          <button type="submit" className="eba-btn is-plein" disabled={manuel === 'encours' || plafondAuj} data-geste="chercher">{manuel === 'encours' ? tr('ebayAchats.recherche') : tr('ebayAchats.chercher.bouton')}</button>
          {ap && Number.isFinite(ap.aujourdhui) && Number.isFinite(ap.plafond) ? <span className="eba-quota" data-ebay-quota-court="">{tr('ebayAchats.quotaCourt', { n: ap.aujourdhui, max: ap.plafond })}</span> : null}
        </div>
      </form>
      <div aria-live="polite" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        {manuel && manuel.erreur && <p data-ebay-recherche-etat="pas-su" className="eba-alerte">{manuel.erreur}</p>}
        {manuel && manuel.r && <>
          <Liste r={manuel.r} repere={repere} cle="manuel" />
          {manuel.r.criteres && <div className="eba-actions">
            <button type="button" className="eba-btn" onClick={ajouterAuFil} disabled={ajout === 'encours' || ajout === 'ok'} data-geste="ajouter-fil">{ajout === 'ok' ? tr('ebayAchats.enregistree') : tr('ebayAchats.enregistrerRecherche')}</button>
            {ajout && ajout !== 'ok' && ajout !== 'encours' && <span className="eba-gris">{ajout}</span>}
          </div>}
        </>}
      </div>
      <details className="eba-repli" data-ebay-details=""><summary>{tr('ebayAchats.details')}</summary>
        <div data-ebay-donnees="" className="eba-details">
          <p data-ebay-appels={ap ? ap.aujourdhui : ''}>{ap ? <>Aujourd’hui : {ap.aujourdhui} recherche{ap.aujourdhui > 1 ? 's' : ''} sur {ap.plafond} (ton plafond dans VRM){Number.isFinite(ap.fil) && Number.isFinite(ap.plafondFil) ? <>, dont {ap.fil} par le fil ({ap.plafondFil} au plus : le reste est gardé pour chercher à la main)</> : null}.</> : <>Chaque recherche = un appel à eBay ; {MAX_FIL} recherches au plus dans le fil, relues au plus toutes les 15 min.</>}</p>
          <p data-ebay-quota={usage && usage.quotaEbay ? usage.quotaEbay.restant : ''}>{usage && usage.quotaEbay ? <>eBay : {usage.quotaEbay.restant.toLocaleString('fr-FR')} recherches restantes sur {usage.quotaEbay.limite.toLocaleString('fr-FR')} aujourd’hui, pour toute l’application VRM (dit par eBay).</> : <>eBay limite toute l’application VRM à 5 000 recherches par jour (documentation d’eBay — pas encore mesuré).</>}</p>
          {usage && usage.octets && <p data-ebay-octets={usage.octets.vrm}>Dernière recherche : {ko(usage.octets.ebay)} reçus d’eBay, {ko(usage.octets.vrm)} vers cet appareil (sans les photos).</p>}
          {octetsJour && octetsJour.n > 0 && <p data-ebay-octets-jour={octetsJour.vrm}>Aujourd’hui sur cet appareil : {octetsJour.n} recherche{octetsJour.n > 1 ? 's' : ''}, {ko(octetsJour.vrm)} reçus ({ko(octetsJour.ebay)} reçus d’eBay, réduits).</p>}
          <p>{tr('ebayAchats.jamaisAchat')}</p>
        </div>
      </details>
    </div>

    {/* ── (b) MES RECHERCHES ────────────────────────────────────────────── */}
    <div className="eba-carte" data-ebay-bloc="recherches" data-ebay-fil={veilles === undefined ? 'en-cours' : veilles === null ? 'pas-su' : dansFil.length} data-ebay-fil-nouveaux={nbNouveaux}>
      <div className="eba-tete">
        <h3 className="eba-titre">{tr('ebayAchats.mes.titre')}{veilles && actives.length ? <span className="eba-n"> · {actives.length}</span> : null}</h3>
        <button type="button" className="eba-btn" disabled={!veilles || occupe} onClick={() => { setEdition('nouvelle'); setOuverte(''); }} data-geste="ajouter-recherche">{tr('ebayAchats.ajouter')}</button>
        <details className="eba-menu" data-ebay-menu="">
          <summary aria-label={tr('ebayAchats.menu')}>···</summary>
          <div className="eba-menu-corps" role="menu">
            <button type="button" role="menuitem" disabled={!dansFil.length || filArrete} onClick={(e) => { e.currentTarget.closest('details').open = false; relireFil(true); }} data-geste="relire-fil">{tr('ebayAchats.relire')}</button>
            <button type="button" role="menuitem" onClick={(e) => { e.currentTarget.closest('details').open = false; setArchives((a) => !a); }} data-geste="historique">{archives ? tr('ebayAchats.historiqueCacher') : tr('ebayAchats.historique', { n: archivees.length })}</button>
            <button type="button" role="menuitem" disabled={!veilles} onClick={(e) => { e.currentTarget.closest('details').open = false; exporter(); }} data-geste="exporter">{tr('ebayAchats.exporter')}</button>
          </div>
        </details>
      </div>
      {edition === 'nouvelle' && <EditionRecherche initial={null} sn={sn} occupe={occupe} erreur={erreurOps} onAnnuler={() => setEdition(null)} onEnregistrer={async (d) => { if (await envoyerOps('veille.creer', d)) setEdition(null); }} />}
      {erreurOps && edition === null && <p role="alert" className="eba-alerte is-ambre">{erreurOps}</p>}
      {veilles === undefined && <p className="eba-gris">{tr('ebayAchats.lecture')}</p>}
      {veilles === null && <p data-ebay-fil-etat="pas-su" className="eba-texte">{tr('ebayAchats.pasLuesPhrase')} <button type="button" className="eba-lien" onClick={lireVeilles}>{tr('commun.reessayer')}</button></p>}
      {veilles && !actives.length && <p data-ebay-fil-vide="" className="eba-gris">{tr('ebayAchats.vide')}</p>}
      {plafondAuj && <p data-ebay-plafond="" className="eba-alerte">{tr('ebayAchats.plafond')}</p>}
      {plafondFilAuj && <div data-ebay-plafond-fil="" className="eba-alerte">{tr('ebayAchats.plafondFil', { n: (ap && ap.plafondFil) || 150 })} <Pourquoi label={tr('ebayAchats.pourquoi')}>{tr('ebayAchats.plafondFilPourquoi', { n: (ap && ap.plafondFil) || 150 })}</Pourquoi></div>}
      {!filArrete && arret && <p data-ebay-fil-panne={arret.raison} className="eba-alerte">{arret.message}{arret.raison !== 'session' && arret.raison !== 'session-renouvel' ? ' ' + tr('ebayAchats.prochainEssai', { h: heureMs(arret.ici + RELIRE_MS) }) : ''}</p>}
      {premieres > 0 && <p data-ebay-fil-premiere={premieres} className="eba-gris">{tr('ebayAchats.premiere', { n: premieres })}</p>}
      {horsFil > 0 && <p data-ebay-hors-fil={horsFil} className="eba-gris">{tr('ebayAchats.horsFilPhrase', { n: horsFil, max: MAX_FIL })}</p>}
      {veilles && actives.length > 0 && <div className="eba-liste">{actives.map(ligne)}</div>}
      {veilles && archives && <>
        <p className="eba-gris" data-ebay-archives={archivees.length}>{archivees.length ? tr('ebayAchats.archivees', { n: archivees.length }) : tr('ebayAchats.aucuneArchivee')}</p>
        {archivees.length > 0 && <div className="eba-liste">{archivees.map(ligne)}</div>}
      </>}
    </div>

    {/* ── (c) NOUVELLES ANNONCES (les alertes : le serveur relit chaque heure) ── */}
    <AlertesEbay headers={headers} theme={C} revente={revente} contexte={contexte} veilles={veilles && veilles.liste} enAlerte={enAlerte.length} onRecherches={setEtatsAlertes} />
  </section>;
}
