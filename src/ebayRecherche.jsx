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
import React,{useEffect,useRef,useState} from 'react';
import {appelerEbay} from './ebayRequetes.js';
import {veillesDuFil,MAX_VEILLES_ACTIVES} from './operations/metier.js';

export const RELIRE_MS = 15 * 60 * 1000;
// Le jour de Paris (le plafond du serveur repart à minuit, heure de Paris).
export const jourParis = (t = Date.now()) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); } catch (_) { return new Date(t).toISOString().slice(0, 10); } };
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

// (30 oct., revue) Le repère du modèle seulement quand il ne trompe pas : pas
// sur une clé GÉNÉRIQUE (« air max » couvre 90, 95, 270, TN… à des prix sans
// rapport), pas sur un accessoire (lacets, boîte vide, semelles…) ni une taille
// enfant. Mieux vaut un blanc qu'un faux.
const MODELES_GENERIQUES = new Set(['air max', 'dunk', 'blazer', 'forum', 'chuck']);
const PAS_UNE_PAIRE = /\b(lacets?|boites?|box|vides?|semelles?|insoles?|chaussettes?|porte cles?|stickers?|embouts?|enfants?|bebes?|kids?|junior|toddler|gs|td|ps|replica|repliques?)\b/;
export function repereAdmis(titre, modele) {
  if (!modele || MODELES_GENERIQUES.has(modele)) return false;
  const t = String(titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ');
  return !PAS_UNE_PAIRE.test(t);
}
export const criteresDeVeille = (v) => ({
  mots: v.mots, exclus: v.exclus || '', pointure: v.pointure || '', minimum: v.minimum ?? null, maximum: v.maximum ?? null,
  etat: v.etatArticle || 'tous', pays: v.pays || 'tous', categorie: v.categorie || '', achatImmediat: v.achatImmediat !== false, livraisonFR: v.livraisonFR !== false,
});

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

const eur = (c) => (Number.isFinite(c) ? (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—');
const ko = (n) => (Number.isFinite(n) ? (Math.max(1, Math.round(n / 102.4)) / 10).toLocaleString('fr-FR') + ' Ko' : '—');
const heure = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };

const phraseRepere = (rp) => <>Repère du modèle « {rp.modele} »{rp.partiel ? ' (pour les paires de ce modèle)' : ''} : {eur(Math.round(rp.moyenne * 100))} en moyenne sur {rp.n} de tes ventes — le modèle, pas cette paire.</>;
function Resultat({ x, nouveau, rp, C }) {
  return <div className="vrm-buy-row vrm-ebay-res" data-ebay-resultat={x.itemId} data-nouveau={nouveau ? 'oui' : 'non'}>
    <div className="vrm-buy-ph" style={{ background: C.card2 || C.bg }}>{x.photo ? <img src={x.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
    <div className="vrm-buy-main" style={{ minWidth: 0 }}>
      <div className="vrm-buy-title" style={{ color: C.text }} title={x.titre}>{nouveau && <span data-badge-nouveau="" style={{ fontSize: 10.5, fontWeight: 700, color: C.accent, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>nouveau</span>}{x.titre || 'Annonce ' + x.itemId}</div>
      <div className="vrm-buy-meta" style={{ color: C.muted, flexWrap: 'wrap' }}>
        <span data-ebay-prix={x.prix} data-ebay-port={x.port == null ? 'inconnu' : x.port} style={{ color: C.text, fontWeight: 600 }}>{x.port == null ? <>{eur(x.prix)} <span style={{ fontWeight: 400, color: C.muted }}>+ port non indiqué</span></> : x.port === 0 ? <>{eur(x.prix)} <span style={{ fontWeight: 400, color: C.muted }}>port compris</span></> : <>{eur(x.total)} <span style={{ fontWeight: 400, color: C.muted }}>({eur(x.prix)} + {eur(x.port)} de port)</span></>}</span>
        {x.etat && <span>· {x.etat}</span>}
        {x.enchere && !x.achatImmediat && <span>· enchère</span>}
        {x.vendeur && <span>· {x.vendeur}{Number.isFinite(x.avis) ? ` (${String(x.avis).replace('.', ',')} %)` : ''}</span>}
      </div>
      {rp && <div data-ebay-repere={rp.modele} style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{phraseRepere(rp)}</div>}
    </div>
    <div className="vrm-buy-act"><a href={x.url} target="_blank" rel="noreferrer noopener" data-voir-ebay="" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 10px', color: C.text, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Voir sur eBay ↗</a></div>
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
function Liste({ r, nouveaux, repere, C, max = 8, cle }) {
  const [tout, setTout] = useState(false);
  if (!r) return null;
  const items = r.items || [];
  const vus = tout ? items : items.slice(0, max);
  const { commun, parLigne } = reperesDeListe(vus.map((x) => x.titre), repere);
  const filtres = [r.horsBudget ? `${r.horsBudget} au-dessus du budget (port compris)` : '', r.exclus ? `${r.exclus} avec un mot exclu` : '', r.autreDevise ? `${r.autreDevise} dans une autre devise` : ''].filter(Boolean);
  const ecartees = (r.horsBudget || 0) + (r.exclus || 0) + (r.autreDevise || 0);
  return <div data-ebay-liste={cle || ''} data-ebay-nb={items.length}>
    {!items.length ? <p data-ebay-vide={ecartees ? 'ecartees' : ''} style={{ fontSize: 12.5, color: C.muted, margin: '6px 0' }}>{ecartees
      // eBay EN AVAIT : c'est VRM qui les a écartées (le filtre de prix d'eBay
      // ne compte pas le port, VRM l'ajoute ensuite).
      ? <>Aucune annonce gardée : eBay en avait {ecartees}, toutes écartées — {filtres.join(' · ')}.</>
      : <>eBay n’a aucune annonce pour ces critères en ce moment.</>}</p>
      : <>{commun && <p data-ebay-repere={commun.modele} data-ebay-repere-liste={commun.partiel ? 'partiel' : 'tout'} style={{ fontSize: 11.5, color: C.muted, margin: '0 0 6px', lineHeight: 1.4 }}>{phraseRepere(commun)}</p>}
        <div className="vrm-buy-list" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>{vus.map((x, i) => <Resultat key={x.itemId} x={x} nouveau={nouveaux && nouveaux.has(x.itemId)} rp={parLigne[i]} C={C} />)}</div></>}
    {items.length > max && <button type="button" onClick={() => setTout((v) => !v)} style={{ marginTop: 6, minHeight: 44, border: 'none', background: 'transparent', color: C.text, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>{tout ? 'Voir moins' : `Voir les ${items.length}`}</button>}
    {items.length > 0 && filtres.length > 0 && <p style={{ fontSize: 11.5, color: C.muted, margin: '6px 0 0' }}>Écartées : {filtres.join(' · ')}.</p>}
  </div>;
}

export default function RechercheEbay({ headers, theme: C, owner, repere, session }) {
  const S = { input: { width: '100%', minHeight: 44, padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, background: C.card, fontFamily: 'inherit', fontSize: 16, boxSizing: 'border-box' }, bouton: { minHeight: 44, padding: '0 14px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, background: C.card, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }, label: { display: 'grid', gap: 5, fontSize: 12, color: C.muted } };
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
      return { erreur: e.status === 401 ? MSG_SESSION : (e.message || 'Je n’ai pas pu chercher sur eBay.'), reason: e.reason || '', status: e.status || 0 };
    }
  };

  // Les recherches enregistrées (la même liste que l'espace Organisation).
  const lireVeilles = async () => {
    try {
      const r = await fetch(ENDPOINT_OPS, { headers: headers(), cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok || !j.donnees) { if (vivant.current) setVeilles(null); return; }
      if (vivant.current) setVeilles({ liste: j.donnees.veilles || [], revision: j.donnees.revision });
    } catch (_) { if (vivant.current) setVeilles(null); }
  };
  useEffect(() => {
    lireVeilles();
    const maj = (e) => { const d = e && e.detail; if (d && Array.isArray(d.veilles)) setVeilles({ liste: d.veilles, revision: d.revision }); };
    // L'espace « Recherches enregistrées » (plus bas) lit la même liste : s'il
    // échoue, c'est le fil qui le dit, une fois (§7).
    const echec = () => { if (vivant.current) setVeilles(null); };
    window.addEventListener('vrm:veilles-maj', maj);
    window.addEventListener('vrm:veilles-echec', echec);
    return () => { window.removeEventListener('vrm:veilles-maj', maj); window.removeEventListener('vrm:veilles-echec', echec); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (Number.isNaN(c.maximum)) { setManuel({ erreur: 'Prix maximum : un montant en euros (ex. 80 ou 79,90) — rien n’a été envoyé à eBay.' }); return; }
    setManuel('encours'); setAjout('');
    const res = await appeler(c);
    if (vivant.current) setManuel(res);
  };
  const ajouterAuFil = async () => {
    const c = criteresManuels();
    if (!(c.maximum > 0)) { setAjout('Indique un prix maximum pour l’ajouter au fil.'); return; }
    if (!veilles || !Number.isSafeInteger(veilles.revision)) { setAjout('Je n’ai pas pu lire tes recherches enregistrées : rien n’est ajouté. Réessaie.'); return; }
    setAjout('encours');
    try {
      const titre = (c.mots + (c.pointure ? ' · ' + c.pointure : '')).slice(0, 160);
      const corps = { id: crypto.randomUUID(), revision: veilles.revision, type: 'veille.creer', donnees: { titre, mots: c.mots, exclus: '', categorie: '', minimum: null, maximum: c.maximum, etatArticle: c.etat, pays: 'tous', pointure: c.pointure, achatImmediat: c.achatImmediat, livraisonFR: c.livraisonFR } };
      const r = await fetch(ENDPOINT_OPS, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) { setAjout((j && j.message) || 'Pas enregistrée : réessaie dans un instant.'); return; }
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
      setVeilles({ liste: j.donnees.veilles || [], revision: j.donnees.revision });
      setAjout('ok');
      try { window.dispatchEvent(new Event('vrm:operations-relire')); } catch (_) {}
    } catch (_) { setAjout('Pas enregistrée : la connexion a coupé. Réessaie.'); }
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

  return <section data-ebay-recherche="" style={{ display: 'grid', gap: 18, marginBottom: 18 }}>
    <div>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: C.text }}>Chercher des paires sur eBay</h3>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Les annonces les plus récentes d’abord. VRM ne fait que lire : pour acheter, tu ouvres l’annonce sur eBay.</p>
      <form onSubmit={chercher} data-ebay-form-recherche="" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', alignItems: 'end' }}>
        <label style={{ ...S.label, gridColumn: '1 / -1' }}>Modèle, marque…<input aria-label="Mots à chercher" value={f.mots} onChange={(e) => setF({ ...f, mots: e.target.value })} placeholder="ex. salomon xt-6" style={S.input} /></label>
        <label style={S.label}>Pointure<input aria-label="Pointure" inputMode="decimal" value={f.pointure} onChange={(e) => setF({ ...f, pointure: e.target.value })} placeholder="42 ou 42,5" style={S.input} /></label>
        <label style={S.label}>Prix max, port compris (€)<input aria-label="Prix maximum" inputMode="decimal" value={f.maximum} onChange={(e) => setF({ ...f, maximum: e.target.value })} placeholder="ex. 80" style={S.input} /></label>
        <label style={S.label}>État<select aria-label="État" value={f.etat} onChange={(e) => setF({ ...f, etat: e.target.value })} style={S.input}><option value="tous">Tous</option><option value="neuf">Neuf</option><option value="occasion">Occasion</option></select></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, color: C.text }}><input type="checkbox" checked={f.achatImmediat} onChange={(e) => setF({ ...f, achatImmediat: e.target.checked })} style={{ width: 20, height: 20 }} />Achat immédiat</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, color: C.text }}><input type="checkbox" checked={f.livraisonFR} onChange={(e) => setF({ ...f, livraisonFR: e.target.checked })} style={{ width: 20, height: 20 }} />Livrable en France</label>
        <button type="submit" disabled={manuel === 'encours' || plafondJour === jourParis()} data-geste="chercher" style={{ ...S.bouton, background: C.text, color: C.card, border: 'none' }}>{manuel === 'encours' ? 'Recherche…' : 'Chercher'}</button>
      </form>
      <div aria-live="polite" style={{ marginTop: 10 }}>
        {manuel && manuel.erreur && <p data-ebay-recherche-etat="pas-su" style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{manuel.erreur}</p>}
        {manuel && manuel.r && <>
          <Liste r={manuel.r} repere={repere} C={C} cle="manuel" />
          {manuel.r.criteres && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" onClick={ajouterAuFil} disabled={ajout === 'encours' || ajout === 'ok'} data-geste="ajouter-fil" style={S.bouton}>{ajout === 'ok' ? 'Ajoutée au fil ✓' : 'Ajouter au fil'}</button>
            {ajout && ajout !== 'ok' && ajout !== 'encours' && <span style={{ fontSize: 12, color: C.muted }}>{ajout}</span>}
          </div>}
        </>}
      </div>
    </div>

    <div data-ebay-fil={veilles === undefined ? 'en-cours' : veilles === null ? 'pas-su' : dansFil.length} data-ebay-fil-nouveaux={nbNouveaux}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: C.text }}>Ton fil{nbNouveaux > 0 ? <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}> · {nbNouveaux} nouvelle{nbNouveaux > 1 ? 's' : ''}</span> : null}</h3>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Tes recherches enregistrées, relues à l’ouverture de cet onglet puis au plus toutes les 15 minutes tant que VRM est ouvert et visible. « Nouveau » = pas vue depuis ta dernière visite.</p>
      {veilles === undefined && <p style={{ fontSize: 12.5, color: C.muted }}>Lecture de tes recherches enregistrées…</p>}
      {veilles === null && <p data-ebay-fil-etat="pas-su" style={{ fontSize: 12.5, color: C.muted }}>Je n’ai pas pu lire tes recherches enregistrées — rien n’est perdu. <button type="button" onClick={() => { lireVeilles(); try { window.dispatchEvent(new Event('vrm:operations-relire')); } catch (_) {} }} style={{ ...S.bouton, marginLeft: 6 }}>Réessayer</button></p>}
      {veilles && !dansFil.length && <p data-ebay-fil-vide="" style={{ fontSize: 12.5, color: C.muted }}>Ton fil est vide : cherche une paire ci-dessus puis « Ajouter au fil », ou ajoute une recherche plus bas.</p>}
      {horsFil > 0 && <p data-ebay-hors-fil={horsFil} style={{ fontSize: 12, color: C.muted }}>{horsFil > 1 ? `${horsFil} autres recherches actives ne sont pas relues` : '1 autre recherche active n’est pas relue'} : {MAX_FIL} au plus, les plus récentes d’abord — archive celles qui ne servent plus.</p>}
      {plafondAuj && <p data-ebay-plafond="" style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>Tes recherches eBay du jour sont faites : le fil s’arrête jusqu’à minuit (heure de Paris).</p>}
      {plafondFilAuj && <p data-ebay-plafond-fil="" style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>Ton fil a fait ses {(ap && ap.plafondFil) || 150} relectures du jour : il s’arrête jusqu’à minuit (heure de Paris). Les recherches restantes sont gardées pour chercher à la main, ci-dessus.</p>}
      {!filArrete && arret && <p data-ebay-fil-panne={arret.raison} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{arret.message}{arret.raison !== 'session' && arret.raison !== 'session-renouvel' ? ` Prochain essai vers ${heureMs(arret.ici + RELIRE_MS)}, ou « Relire maintenant ».` : ''}</p>}
      {premieres > 0 && <p data-ebay-fil-premiere={premieres} style={{ fontSize: 11.5, color: C.muted, margin: '0 0 8px' }}>{premieres > 1 ? `Première lecture de ${premieres} recherches` : 'Première lecture d’une recherche'} : rien n’y est marqué « nouveau ».</p>}
      <div style={{ display: 'grid', gap: 14 }}>{dansFil.map((v) => { const e = fil[v.id] || {}; const nv = e.r ? nouveauxV(v, e.r) : null; const aff = etatAffiche(e);
        return <article key={v.id} data-ebay-fil-recherche={v.id} data-etat={aff}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <b style={{ fontSize: 13.5, color: C.text }}>{v.titre}</b>
            <span style={{ fontSize: 11.5, color: C.muted }}>{v.mots}{v.pointure ? ' · ' + v.pointure : ''} · {eur(v.maximum)} max</span>
            {e.lueA && <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 'auto' }}>lue à {heure(e.lueA)}</span>}
          </div>
          {e.etat === 'encours' && !e.r && <p style={{ fontSize: 12.5, color: C.muted }}>Recherche sur eBay…</p>}
          {(aff === 'pas-su' || aff === 'plafond') && <p data-ebay-fil-etat={aff} style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>{e.r ? 'Pas relue — ce que tu vois date de la dernière lecture.' : 'Pas lue.'}</p>}
          {aff === 'criteres' && <p data-ebay-fil-etat="criteres" style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>Critères refusés : {e.erreur} Modifie cette recherche plus bas (elle ne sera pas relue avant).</p>}
          {e.r && <Liste r={e.r} nouveaux={nv} repere={repere} C={C} cle={v.id} />}
        </article>; })}</div>
      {dansFil.length > 0 && !filArrete && <button type="button" onClick={() => relireFil(true)} data-geste="relire-fil" style={{ ...S.bouton, marginTop: 10 }}>Relire maintenant</button>}
    </div>

    <div data-ebay-donnees="" style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
      <b style={{ color: C.text, fontWeight: 600 }}>Les données</b>
      <p style={{ margin: '4px 0' }} data-ebay-appels={ap ? ap.aujourdhui : ''}>{ap ? <>Aujourd’hui : {ap.aujourdhui} recherche{ap.aujourdhui > 1 ? 's' : ''} sur {ap.plafond} (ton plafond dans VRM){Number.isFinite(ap.fil) && Number.isFinite(ap.plafondFil) ? <>, dont {ap.fil} par le fil ({ap.plafondFil} au plus : le reste est gardé pour chercher à la main)</> : null}.</> : <>Chaque recherche = un appel à eBay ; {MAX_FIL} recherches au plus dans le fil, relues au plus toutes les 15 min.</>}</p>
      <p style={{ margin: '4px 0' }} data-ebay-quota={usage && usage.quotaEbay ? usage.quotaEbay.restant : ''}>{usage && usage.quotaEbay ? <>eBay : {usage.quotaEbay.restant.toLocaleString('fr-FR')} recherches restantes sur {usage.quotaEbay.limite.toLocaleString('fr-FR')} aujourd’hui, pour toute l’application VRM (dit par eBay).</> : <>eBay limite toute l’application VRM à 5 000 recherches par jour (documentation d’eBay — pas encore mesuré).</>}</p>
      {usage && usage.octets && <p style={{ margin: '4px 0' }} data-ebay-octets={usage.octets.vrm}>Dernière recherche : {ko(usage.octets.ebay)} reçus d’eBay par VRM, {ko(usage.octets.vrm)} envoyés à cet appareil (hors photos, chargées à l’affichage).</p>}
      {octetsJour && octetsJour.n > 0 && <p style={{ margin: '4px 0' }} data-ebay-octets-jour={octetsJour.vrm}>Aujourd’hui sur cet appareil : {octetsJour.n} recherche{octetsJour.n > 1 ? 's' : ''}, {ko(octetsJour.vrm)} reçus ici ({ko(octetsJour.ebay)} reçus d’eBay par VRM, réduits avant l’envoi).</p>}
    </div>
  </section>;
}
