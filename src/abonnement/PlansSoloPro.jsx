// ═══════════════════════════════════════════════════════════════════════════
// SOLO ET PRO À L'ÉCRAN (9 nov.) — Julien : « Ça peut être 1 compte vendeur et
// plein de comptes achat, donc sur ces comptes on prend que les achats ; pour
// avoir toutes ses ventes de tous ses comptes il prend l'abonnement du dessus. »
// ═══════════════════════════════════════════════════════════════════════════
//   · `QuelCompteVend` : la feuille « Quel compte vend ? » — ses comptes par
//     IDENTITÉ (vinted_user_id, le pseudo n'est qu'un libellé), le compte qui a
//     le plus de ventes lues est PROPOSÉ (rien n'est appliqué sans son clic),
//     changement une fois tous les 30 jours (dit avec la date).
//   · `BandeauCompteVendeur` : la ligne de la coque tant qu'un Solo n'a pas
//     choisi (rien n'est bridé avant son choix) ; porte la feuille, que
//     Paramètres → Abonnement ouvre aussi (`ouvrirQuelCompte`).
//   · `VentesHorsPlan` : sur Ventes, les ventes des comptes d'achat en APERÇU —
//     les 3 premières nettes, le reste flouté, `inert`, aucun geste — et
//     « Passe à Pro pour gérer les ventes de X ». Rien n'est supprimé ; le
//     nombre de colis à envoyer est DIT (un colis caché est un colis perdu).
//   · (9 nov., soir — Solo PAR PLATEFORME) la même feuille pour Leboncoin, eBay
//     et Vestiaire (`plateforme`) : un compte vendeur par plateforme, choisi par
//     LUI, un geste chacun, 30 jours chacun ; `VentesAutresHorsPlan` montre en
//     aperçu les ventes de leurs comptes d'achat (« Tous » de Ventes).
// La règle : api/_lib/plan-regle.js. L'état : src/abonnement/planVentes.js.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { compteDefaut, compteDefautAutre, comptesHorsPlan, venteHorsPlan, OFFRES, JOURS_CHANGEMENT_VENDEUR, PLATEFORMES_SOLO, NOMS_PLATEFORMES_SOLO, idCompteVendeur, prixCompteSupTexte, PRIX_COMPTE_SUP_CENTIMES } from '../../api/_lib/plan-regle.js';
import { abonnementPublie, publierAbonnement, suivreAbonnement } from './etatAbonnement.js';
import { reglePlanCourante, suivrePlan } from './planVentes.js';
import { APERCU_LIGNES, bloquerGestes } from './apercu.js';
import './plans.css';

const dateLongue = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };
const uidDe = (o) => String((o && o._acc && o._acc.vinted_user_id) || '');

export const EVT_QUEL_COMPTE = 'vrm:quel-compte';
// (13 nov., lot 56) La feuille « Un compte Vinted qui vend de plus » (Solo, +3 €/mois).
export const EVT_COMPTE_SUP = 'vrm:compte-sup';
export function ouvrirCompteSup(uid = '') { try { window.dispatchEvent(new CustomEvent(EVT_COMPTE_SUP, { detail: { uid: String(uid || '') } })); } catch (_) {} }
// L'état des comptes de plus, tel que le SERVEUR l'a rendu (jamais calculé ici) :
// `{ payes, liste, libres, ouvert, texte }`, ou `null` hors Solo / pas su.
export function supDe(x) {
  if (!x || typeof x !== 'object' || x.plan !== 'solo' || !x.comptesSup || typeof x.comptesSup !== 'object') return null;
  const c = x.comptesSup, o = (x.offres && x.offres.compteSup) || {};
  const liste = Array.isArray(c.liste) ? c.liste.map(String) : [];
  return { payes: Number(c.payes) || 0, liste, libres: Math.max(0, Number(c.libres) || 0), max: Number(c.max) || 20, ouvert: o.ouvert === true, texte: o.ouvert && o.texte ? o.texte : null };
}
// Le prix d'un compte de plus, à l'écran : celui que STRIPE dit quand l'offre est
// ouverte, sinon la valeur de VRM (« +3 €/mois », dite « bientôt »).
export const texteSup = (s) => (s && s.texte ? `+${s.texte.replace(' / mois', '/mois')}` : `+${prixCompteSupTexte(PRIX_COMPTE_SUP_CENTIMES)}/mois`);
export async function changerCompteSup(action, uid, enTete, extra) {
  try {
    const r = await fetch('/api/compte?mode=compte-vendeur', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTete ? enTete() : {}) }, body: JSON.stringify({ action, uid, ...(extra || {}) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok && j.comptesSup) {
      const x = abonnementPublie();
      if (x && typeof x === 'object') publierAbonnement({ ...x, comptesSup: j.comptesSup });
      return { ok: true };
    }
    return { ok: false, message: (j && j.message) || "Rien n'a changé. Réessaie dans un instant." };
  } catch (_) { return { ok: false, message: 'Pas de connexion : rien n’a changé. Réessaie dans un instant.' }; }
}
// `plateforme` : 'vinted' (défaut) · 'leboncoin' · 'ebay' · 'vestiaire'.
export function ouvrirQuelCompte(plateforme = 'vinted') { try { window.dispatchEvent(new CustomEvent(EVT_QUEL_COMPTE, { detail: { plateforme } })); } catch (_) {} }
// Le compte vendeur CHOISI d'une plateforme, tel que le serveur l'a rendu (`null` = pas choisi).
export function choixDe(x, plateforme) {
  if (!x || typeof x !== 'object') return null;
  if (plateforme === 'vinted') return x.compteVendeur && x.compteVendeur.uid ? { id: String(x.compteVendeur.uid), prochainChangement: x.compteVendeur.prochainChangement || null } : null;
  const c = x.comptesVendeurs && x.comptesVendeurs[plateforme];
  const id = c && idCompteVendeur(plateforme, c.id);
  return id ? { id, prochainChangement: c.prochainChangement || null } : null;
}
// Les plateformes où un Solo doit encore choisir : Vinted comme avant (dès le Solo),
// les autres seulement à partir de DEUX comptes (un seul compte vend forcément).
export function plateformesAChoisir(x, autres) {
  if (!x || x.plan !== 'solo') return [];
  const out = [];
  if (!choixDe(x, 'vinted')) out.push('vinted');
  for (const p of PLATEFORMES_SOLO) { const l = autres && autres[p] && autres[p].comptes; if (Array.isArray(l) && l.length >= 2 && !choixDe(x, p)) out.push(p); }
  return out;
}

function useAbonnementPublie() {
  const [x, setX] = React.useState(() => abonnementPublie());
  React.useEffect(() => suivreAbonnement(setX), []);
  return x;
}
function useRegle() {
  const [r, setR] = React.useState(() => reglePlanCourante());
  React.useEffect(() => suivrePlan(setR), []);
  return r;
}

// Envoie le choix au serveur (qui vérifie tout) ; rend { ok, message }.
export async function choisirCompteVendeur(uid, enTete, plateforme = 'vinted') {
  try {
    const corps = plateforme === 'vinted' ? { uid } : { plateforme, id: uid };
    const r = await fetch('/api/compte?mode=compte-vendeur', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTete ? enTete() : {}) }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok && plateforme === 'vinted' && j.compteVendeur) {
      const x = abonnementPublie();
      if (x && typeof x === 'object') publierAbonnement({ ...x, compteVendeur: j.compteVendeur });
      return { ok: true };
    }
    if (r.ok && j && j.ok && plateforme !== 'vinted' && j.comptesVendeurs) {
      const x = abonnementPublie();
      if (x && typeof x === 'object') publierAbonnement({ ...x, comptesVendeurs: j.comptesVendeurs });
      return { ok: true };
    }
    return { ok: false, message: (j && j.message) || "Ton choix n'a pas été enregistré. Réessaie dans un instant." };
  } catch (_) { return { ok: false, message: 'Pas de connexion : rien n’a changé. Réessaie dans un instant.' }; }
}

// `plateforme` 'vinted' : `comptes` [{uid, nom}], `ventes` les ventes Vinted lues.
// Autre plateforme : `comptes` [{uid: identité, nom}], `comptesDesVentes` le compte de
// chaque vente lue (`null` = pas lues ⇒ rien de proposé, « ventes pas lues »).
export function QuelCompteVend({ plateforme = 'vinted', comptes, ventes, comptesDesVentes, enTete, onFerme }) {
  const x = useAbonnementPublie();
  const vinted = plateforme === 'vinted';
  const ch = choixDe(x, plateforme);
  const actuel = ch ? ch.id : '';
  const attendre = ch && ch.prochainChangement ? ch.prochainChangement : null;
  const nomP = NOMS_PLATEFORMES_SOLO[plateforme] || plateforme;
  const lues = vinted ? Array.isArray(ventes) : Array.isArray(comptesDesVentes);
  const propose = React.useMemo(() => (vinted ? compteDefaut(comptes, ventes)
    : compteDefautAutre(plateforme, (comptes || []).map((c) => c.uid), comptesDesVentes)), [vinted, plateforme, comptes, ventes, comptesDesVentes]);
  const [choix, setChoix] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const nVentes = React.useMemo(() => {
    const n = new Map();
    if (vinted && Array.isArray(ventes)) for (const v of ventes) { const u = uidDe(v); n.set(u, (n.get(u) || 0) + 1); }
    if (!vinted && Array.isArray(comptesDesVentes)) for (const c0 of comptesDesVentes) { const c = idCompteVendeur(plateforme, c0); if (c) n.set(c, (n.get(c) || 0) + 1); }
    return n;
  }, [vinted, plateforme, ventes, comptesDesVentes]);
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') onFerme(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onFerme]);
  const valider = async () => {
    if (!choix || choix === actuel) return;
    setOccupe(true); setMsg('');
    const r = await choisirCompteVendeur(choix, enTete, plateforme);
    setOccupe(false);
    if (r.ok) onFerme(); else setMsg(r.message);
  };
  const liste = Array.isArray(comptes) ? comptes : [];
  return createPortal(
    <div className="vrm-plan-voile" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
      <div className="vrm-plan-feuille" role="dialog" aria-modal="true" aria-labelledby="vrm-plan-titre" data-quel-compte="" data-quel-compte-plateforme={plateforme} data-propose={propose || undefined}>
        <div className="vrm-plan-feuille-titre" id="vrm-plan-titre">{vinted ? 'Quel compte vend ?' : `Quel compte vend sur ${nomP} ?`}</div>
        <div className="vrm-plan-phrase">Avec Solo, un compte vend par plateforme : ici, sur {nomP}, ses ventes, annonces, colis à envoyer et sa compta comptent. Tes autres comptes {nomP} restent des comptes d'achat : leurs achats et leurs retraits sont tous là, rien n'est supprimé.{' '}
          {attendre ? `Tu pourras changer de compte vendeur ${nomP} le ${dateLongue(attendre)}.` : `Tu pourras en changer une fois tous les ${JOURS_CHANGEMENT_VENDEUR} jours.`}</div>
        {!liste.length && <div className="vrm-plan-phrase" data-quel-compte-vide="">Aucun compte {nomP} relié pour l'instant : relie ton compte qui vend, puis reviens ici.</div>}
        <div role="radiogroup" aria-label="Le compte qui vend" className="vrm-plan-comptes">
          {liste.map((c) => {
            const u = vinted ? String(c.uid) : (idCompteVendeur(plateforme, c.uid) || String(c.uid)); const n = nVentes.get(u) || 0;
            const coche = (choix || actuel) === u;
            return (
              <button type="button" role="radio" aria-checked={coche} key={u} data-compte-uid={u} data-compte-actuel={u === actuel ? '' : undefined}
                className="vrm-plan-compte" disabled={occupe || (!!attendre && u !== actuel)} onClick={() => setChoix(u)}>
                <span className="vrm-plan-rond" aria-hidden="true" data-coche={coche ? '' : undefined}/>
                <span className="vrm-plan-compte-nom">{c.nom}{c.nom !== `n° ${u}` && <span className="vrm-plan-compte-id"> · {u === 'principal' ? 'compte principal' : `n° ${u}`}</span>}</span>
                <span className="vrm-plan-compte-detail">{lues ? `${n} vente${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}` : 'ventes pas lues'}{u === propose && u !== actuel ? ' · proposé' : ''}{u === actuel ? ' · compte vendeur' : ''}</span>
              </button>
            );
          })}
        </div>
        {msg && <div role="alert" className="vrm-plan-alerte">{msg}</div>}
        <div className="vrm-plan-actions">
          <button type="button" className="vrm-b vrm-b-secondaire" onClick={onFerme}>Plus tard</button>
          <button type="button" className="vrm-b vrm-b-primaire" data-valider-compte="" disabled={occupe || !choix || choix === actuel} onClick={valider}>{occupe ? 'Un instant…' : 'Ce compte vend'}</button>
        </div>
      </div>
    </div>, document.body);
}

// (13 nov., lot 56) « Un compte Vinted qui vend de plus » : ses comptes Vinted qui ne
// vendent pas encore, un choix, une case CGV si une place doit être ACHETÉE. Offre
// fermée et aucune place libre ⇒ « Bientôt », rien d'achetable. Le serveur vérifie
// tout (le compte est à lui, Solo, la quantité payée) : l'écran ne décide rien.
export function AjouterCompteVendeur({ comptes, ventes, uidPropose, enTete, onFerme }) {
  const x = useAbonnementPublie();
  const s = supDe(x);
  const inclus = choixDe(x, 'vinted');
  const vendent = new Set([inclus ? inclus.id : '', ...(s ? s.liste : [])].filter(Boolean));
  const liste = (Array.isArray(comptes) ? comptes : []).filter((c) => c && !vendent.has(String(c.uid)));
  const [choix, setChoix] = React.useState(() => (uidPropose && liste.some((c) => String(c.uid) === uidPropose) ? uidPropose : ''));
  const [cgv, setCgv] = React.useState(false);
  const [occupe, setOccupe] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') onFerme(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onFerme]);
  const nVentes = React.useMemo(() => { const n = new Map(); if (Array.isArray(ventes)) for (const v of ventes) { const u = uidDe(v); n.set(u, (n.get(u) || 0) + 1); } return n; }, [ventes]);
  const placeLibre = !!(s && s.libres > 0);
  const achat = !placeLibre;
  const ferme = achat && !(s && s.ouvert);
  const prix = texteSup(s);
  const valider = async () => {
    if (!choix || ferme || (achat && !cgv)) return;
    setOccupe(true); setMsg('');
    const r = await changerCompteSup('ajouter-sup', choix, enTete, achat ? { cgv: true } : null);
    setOccupe(false);
    if (r.ok) onFerme(); else setMsg(r.message);
  };
  return createPortal(
    <div className="vrm-plan-voile" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
      <div className="vrm-plan-feuille" role="dialog" aria-modal="true" aria-labelledby="vrm-sup-titre" data-ajouter-compte-sup="" data-sup-ferme={ferme ? '' : undefined} data-sup-place-libre={placeLibre ? '' : undefined}>
        <div className="vrm-plan-feuille-titre" id="vrm-sup-titre">Un compte Vinted qui vend de plus</div>
        <div className="vrm-plan-phrase" data-sup-phrase="">Solo : 1 compte Vinted vendeur inclus · <b data-sup-prix="">{prix}</b> par compte de plus. Ses ventes, annonces, colis et sa compta comptent comme celles du compte inclus.{' '}
          {placeLibre ? 'Tu as déjà une place payée et libre : rien de plus à payer.' : 'Stripe calcule au prorata sur ta prochaine facture ; tu le retires quand tu veux.'}</div>
        {!inclus && <div className="vrm-plan-phrase" data-sup-sans-inclus="">Choisis d’abord le compte inclus (« Quel compte vend ? »).</div>}
        {ferme && <div className="vrm-plan-phrase" data-sup-bientot=""><b>Bientôt.</b> Pas encore ouvert au paiement : rien ne t'est demandé.</div>}
        {!liste.length && <div className="vrm-plan-phrase" data-sup-vide="">Tous tes comptes Vinted reliés vendent déjà. Relie un autre compte, puis reviens ici.</div>}
        <div role="radiogroup" aria-label="Le compte qui vendra" className="vrm-plan-comptes">
          {liste.map((c) => {
            const u = String(c.uid), n = nVentes.get(u) || 0, coche = choix === u;
            return (
              <button type="button" role="radio" aria-checked={coche} key={u} data-sup-uid={u} className="vrm-plan-compte" disabled={occupe || ferme || !inclus} onClick={() => setChoix(u)}>
                <span className="vrm-plan-rond" aria-hidden="true" data-coche={coche ? '' : undefined}/>
                <span className="vrm-plan-compte-nom">{c.nom}{c.nom !== `n° ${u}` && <span className="vrm-plan-compte-id"> · n° {u}</span>}</span>
                <span className="vrm-plan-compte-detail">{Array.isArray(ventes) ? `${n} vente${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}` : 'ventes pas lues'}</span>
              </button>
            );
          })}
        </div>
        {achat && !ferme && liste.length > 0 && (
          <label className="vrm-plan-phrase vrm-plan-case" data-sup-cgv="">
            <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)}/>
            <span>J'accepte les <a href="/legal/cgv.html" target="_blank" rel="noopener noreferrer">conditions générales de vente</a> (option {prix} par compte).</span>
          </label>
        )}
        {msg && <div role="alert" className="vrm-plan-alerte" data-sup-msg="">{msg}</div>}
        <div className="vrm-plan-actions">
          <button type="button" className="vrm-b vrm-b-secondaire" onClick={onFerme}>Plus tard</button>
          <button type="button" className="vrm-b vrm-b-primaire" data-valider-sup="" disabled={occupe || ferme || !inclus || !choix || (achat && !cgv)} onClick={valider}>
            {occupe ? 'Un instant…' : ferme ? 'Bientôt' : placeLibre ? 'Ce compte vend aussi' : `Ajouter · ${prix}`}</button>
        </div>
      </div>
    </div>, document.body);
}

// La ligne de la coque + la feuille (ouverte aussi depuis Paramètres → Abonnement).
// `autres` : { leboncoin|ebay|vestiaire: { comptes: [{uid, nom}], comptesDesVentes: [id]|null } }
// (lus par la coque). La ligne nomme la PREMIÈRE plateforme qui attend son choix.
export function BandeauCompteVendeur({ comptes, ventes, autres, enTete }) {
  const x = useAbonnementPublie();
  const [ouvert, setOuvert] = React.useState('');
  React.useEffect(() => { const f = (e) => setOuvert((e && e.detail && e.detail.plateforme) || 'vinted'); window.addEventListener(EVT_QUEL_COMPTE, f); return () => window.removeEventListener(EVT_QUEL_COMPTE, f); }, []);
  const [sup, setSup] = React.useState(null);
  React.useEffect(() => { const f = (e) => setSup({ uid: (e && e.detail && e.detail.uid) || '' }); window.addEventListener(EVT_COMPTE_SUP, f); return () => window.removeEventListener(EVT_COMPTE_SUP, f); }, []);
  const manque = plateformesAChoisir(x, autres);
  const p = manque[0] || '';
  const nomP = NOMS_PLATEFORMES_SOLO[p] || '';
  const a = ouvert && ouvert !== 'vinted' ? (autres && autres[ouvert]) || { comptes: [], comptesDesVentes: null } : null;
  return (<>
    {p && (
      <div className="vrm-bandeau-abo" role="status" data-bandeau-compte-vendeur="" data-bandeau-plateforme={p} data-bandeau-a-choisir={manque.join(',')}>
        <span className="vrm-bandeau-abo-texte">{p === 'vinted'
          ? <>Ton offre Solo : choisis le compte qui vend. Tant que tu n'as pas choisi, tous tes comptes comptent.</>
          : <>Ton offre Solo : choisis le compte qui vend sur {nomP}. Tant que tu n'as pas choisi, tous tes comptes {nomP} comptent.</>}</span>
        <button type="button" className="vrm-lien-action vrm-bandeau-abo-geste" onClick={() => setOuvert(p)}>Choisir</button>
      </div>
    )}
    {ouvert === 'vinted' && <QuelCompteVend comptes={comptes} ventes={ventes} enTete={enTete} onFerme={() => setOuvert('')}/>}
    {a && <QuelCompteVend plateforme={ouvert} comptes={a.comptes} comptesDesVentes={a.comptesDesVentes} enTete={enTete} onFerme={() => setOuvert('')}/>}
    {sup && <AjouterCompteVendeur comptes={comptes} ventes={ventes} uidPropose={sup.uid} enTete={enTete} onFerme={() => setSup(null)}/>}
  </>);
}

// (9 nov., Solo par plateforme) Les ventes Leboncoin / eBay / Vestiaire des comptes
// d'achat, en APERÇU (« Tous » de Ventes) : 3 nettes, le reste flouté, `inert`, aucun
// geste ; le nombre de colis à envoyer est DIT (ils restent dans Colis). `lignes` :
// [{ cle, site, compteId, compte, titre, prix, aEnvoyer }] — déjà jugées hors offre
// par l'écran (`venteAutreHorsPlan`).
export function VentesAutresHorsPlan({ lignes, onPro }) {
  const blocs = React.useMemo(() => {
    const par = new Map();
    for (const l of Array.isArray(lignes) ? lignes : []) {
      if (!l || !l.compteId) continue;
      const k = l.site + ':' + l.compteId;
      const b = par.get(k) || { cle: k, site: l.site, compteId: l.compteId, nom: l.compte || (l.compteId === 'principal' ? 'compte principal' : `n° ${String(l.compteId).slice(0, 12)}`), ventes: [], aEnvoyer: 0 };
      b.ventes.push(l); if (l.aEnvoyer) b.aEnvoyer += 1;
      par.set(k, b);
    }
    return [...par.values()];
  }, [lignes]);
  const ref = React.useRef(null);
  React.useEffect(() => { const r = ref.current; if (!r) return undefined; return bloquerGestes(r, null); }, [blocs.length]);
  React.useEffect(() => { const r = ref.current; if (r) r.querySelectorAll('[data-apercu-floute]').forEach((e) => { try { e.inert = true; } catch (_) {} e.setAttribute('inert', ''); }); });
  if (!blocs.length) return null;
  return (
    <div ref={ref} className="vrm-plan-hors" data-ventes-autres-hors-plan={blocs.length}>
      {blocs.map((b) => {
        const nomP = NOMS_PLATEFORMES_SOLO[b.site] || b.site;
        return (
          <section key={b.cle} className="vrm-plan-bloc" data-hors-plan-site={b.site} data-hors-plan-compte={b.compteId} data-hors-plan-n={b.ventes.length} data-hors-plan-a-envoyer={b.aEnvoyer} aria-label={`Ventes ${nomP} de ${b.nom}`}>
            <div className="vrm-plan-bloc-tete">
              <h3 className="vrm-plan-bloc-titre">Ventes {nomP} de {b.nom}</h3>
              <div className="vrm-plan-phrase">{b.ventes.length} vente{b.ventes.length > 1 ? 's' : ''}{b.aEnvoyer ? `, dont ${b.aEnvoyer} à envoyer (dans Colis)` : ''} — hors de ton offre Solo (un compte vendeur par plateforme) : ni dans tes listes, ni dans tes totaux. Rien n'est supprimé.</div>
            </div>
            <ul className="vrm-plan-lignes">
              {b.ventes.map((l, i) => {
                const net = i < APERCU_LIGNES;
                return (
                  <li key={l.cle} className="vrm-plan-ligne" {...(net ? {} : { 'data-apercu-floute': '', 'aria-hidden': 'true' })}>
                    <span className="vrm-plan-ligne-titre">{l.titre || 'Article'}</span>
                    <span className="vrm-plan-ligne-prix">{l.prix || ''}</span>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="vrm-b vrm-b-primaire" data-apercu-garde="" data-passer-pro="" onClick={onPro}>Passe à Pro pour gérer les ventes {nomP} de {b.nom}</button>
          </section>
        );
      })}
    </div>
  );
}

// Les ventes des comptes d'achat, en aperçu (Ventes). `comptes` : [{uid, nom}] ;
// `aEnvoyer(o)` : la vente attend son colis (DIT, jamais caché).
export function VentesHorsPlan({ ventes, comptes, aEnvoyer, prix, onPro }) {
  const regle = useRegle();
  const sx = supDe(useAbonnementPublie());
  const blocs = React.useMemo(() => {
    if (!regle.bride || !Array.isArray(ventes)) return [];
    return comptesHorsPlan(regle, comptes).map((c) => {
      const u = String(c.uid);
      const siennes = ventes.filter((o) => uidDe(o) === u && venteHorsPlan(regle, u));
      return { uid: u, nom: c.nom, ventes: siennes, aEnvoyer: aEnvoyer ? siennes.filter(aEnvoyer).length : 0 };
    }).filter((b) => b.ventes.length);
  }, [regle, ventes, comptes, aEnvoyer]);
  const ref = React.useRef(null);
  React.useEffect(() => { const r = ref.current; if (!r) return undefined; return bloquerGestes(r, null); }, [blocs.length]);
  // `inert` posé sur le DOM (React 18 ne connaît pas l'attribut) : ni focus, ni clic, ni lecture.
  React.useEffect(() => { const r = ref.current; if (r) r.querySelectorAll('[data-apercu-floute]').forEach((e) => { try { e.inert = true; } catch (_) {} e.setAttribute('inert', ''); }); });
  if (!blocs.length) return null;
  return (
    <div ref={ref} className="vrm-plan-hors" data-ventes-hors-plan={blocs.length}>
      {blocs.map((b) => (
        <section key={b.uid} className="vrm-plan-bloc" data-hors-plan-compte={b.uid} data-hors-plan-n={b.ventes.length} data-hors-plan-a-envoyer={b.aEnvoyer} aria-label={`Ventes de ${b.nom}`}>
          <div className="vrm-plan-bloc-tete">
            <h3 className="vrm-plan-bloc-titre">Ventes de {b.nom}</h3>
            <div className="vrm-plan-phrase">{b.ventes.length} vente{b.ventes.length > 1 ? 's' : ''}{b.aEnvoyer ? `, dont ${b.aEnvoyer} à envoyer` : ''} — hors de ton offre Solo : ni dans tes listes, ni dans tes totaux. Rien n'est supprimé.</div>
          </div>
          <ul className="vrm-plan-lignes">
            {b.ventes.map((o, i) => {
              const net = i < APERCU_LIGNES;
              return (
                <li key={String(o.transaction_id != null ? o.transaction_id : i)} className="vrm-plan-ligne"
                  {...(net ? {} : { 'data-apercu-floute': '', 'aria-hidden': 'true' })}>
                  <span className="vrm-plan-ligne-titre">{o.title || 'Article'}</span>
                  <span className="vrm-plan-ligne-prix">{prix ? prix(o) : ''}</span>
                </li>
              );
            })}
          </ul>
          <div className="vrm-plan-actions" style={{ justifyContent: 'flex-start' }}>
            {/* (13 nov., lot 56) Ce compte peut vendre AUSSI, en Solo (feuille ; le serveur décide). Fermé ⇒ « bientôt ». */}
            {sx && (sx.ouvert || sx.libres > 0)
              ? <button type="button" className="vrm-b vrm-b-secondaire" data-apercu-garde="" data-sup-ajouter={b.uid} onClick={() => ouvrirCompteSup(b.uid)}>Faire vendre ce compte · {texteSup(sx)}</button>
              : sx && <span className="vrm-plan-phrase" data-sup-bientot-bloc={b.uid}>Bientôt : faire vendre ce compte en Solo, {texteSup(sx)}.</span>}
            <button type="button" className="vrm-b vrm-b-primaire" data-apercu-garde="" data-passer-pro="" onClick={onPro}>Passe à Pro pour gérer les ventes de {b.nom}</button>
          </div>
        </section>
      ))}
    </div>
  );
}

// Les deux offres côte à côte (Paramètres → Abonnement). `x` : la réponse du serveur.
export function OffresSoloPro({ x, prixSolo, prixActuel, prixProAffiche, onChoisirPro, onChoisirSolo, occupe }) {
  const plan = x && x.plan;
  const pro = (x && x.offres && x.offres.pro) || { ouvert: false };
  const supOuvert = !!(x && x.offres && x.offres.compteSup && x.offres.compteSup.ouvert);
  // Le prix de SON offre est celui de SON abonnement (lu chez Stripe), jamais celui du moment.
  const texteSolo = (plan === 'solo' && prixActuel) || (x && x.offres && x.offres.solo && x.offres.solo.texte) || prixSolo;
  const textePro = (plan === 'pro' && prixActuel) || (pro.ouvert && pro.texte ? pro.texte : prixProAffiche);
  return (
    <div className="vrm-plan-offres" data-offres="" data-plan={plan || 'pas-su'} data-pro-ouvert={pro.ouvert ? '' : undefined}>
      <div className="vrm-plan-offre" data-offre="solo" data-offre-actuelle={plan === 'solo' ? '' : undefined}>
        <div className="vrm-plan-offre-nom">{OFFRES.solo.nom}{plan === 'solo' && <span className="vrm-plan-pastille">Ton offre</span>}</div>
        <div className="vrm-plan-offre-prix" data-prix-solo="">{texteSolo}</div>
        <div className="vrm-plan-phrase">{OFFRES.solo.phrase}</div>
        {/* (13 nov., lot 56) Plusieurs comptes Vinted dès Solo : le supplément, une ligne. */}
        <div className="vrm-plan-phrase vrm-plan-supplement" data-solo-supplement="" data-sup-ouvert={supOuvert ? '' : undefined}><b>{OFFRES.solo.supplement}</b>{!supOuvert && <span className="vrm-plan-pastille" data-sup-pastille-bientot="">Bientôt</span>}</div>
        {plan === 'pro' && onChoisirSolo && <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={onChoisirSolo} data-passer-solo="">Revenir à Solo</button>}
      </div>
      <div className="vrm-plan-offre" data-offre="pro" data-offre-actuelle={plan === 'pro' ? '' : undefined}>
        <div className="vrm-plan-offre-nom">{OFFRES.pro.nom}{plan === 'pro' && <span className="vrm-plan-pastille">Ton offre</span>}{!pro.ouvert && <span className="vrm-plan-pastille" data-pro-bientot="">Bientôt</span>}</div>
        <div className="vrm-plan-offre-prix" data-prix-pro="">{textePro}</div>
        <div className="vrm-plan-phrase">{OFFRES.pro.phrase}</div>
        {pro.ouvert && plan === 'solo' && onChoisirPro && <button type="button" className="vrm-b vrm-b-primaire" disabled={!!occupe} onClick={onChoisirPro} data-passer-pro="">{occupe === 'pro' ? 'Un instant…' : 'Passer à Pro'}</button>}
        {!pro.ouvert && <div className="vrm-plan-phrase" data-pro-ferme="">Pas encore ouvert au paiement : rien ne t'est demandé.</div>}
      </div>
    </div>
  );
}
