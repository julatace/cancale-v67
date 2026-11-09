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
// La règle : api/_lib/plan-regle.js. L'état : src/abonnement/planVentes.js.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { compteDefaut, comptesHorsPlan, venteHorsPlan, OFFRES, JOURS_CHANGEMENT_VENDEUR } from '../../api/_lib/plan-regle.js';
import { abonnementPublie, publierAbonnement, suivreAbonnement } from './etatAbonnement.js';
import { reglePlanCourante, suivrePlan } from './planVentes.js';
import { APERCU_LIGNES, bloquerGestes } from './apercu.js';
import './plans.css';

const dateLongue = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };
const uidDe = (o) => String((o && o._acc && o._acc.vinted_user_id) || '');

export const EVT_QUEL_COMPTE = 'vrm:quel-compte';
export function ouvrirQuelCompte() { try { window.dispatchEvent(new CustomEvent(EVT_QUEL_COMPTE)); } catch (_) {} }

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
export async function choisirCompteVendeur(uid, enTete) {
  try {
    const r = await fetch('/api/compte?mode=compte-vendeur', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(enTete ? enTete() : {}) }, body: JSON.stringify({ uid }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok && j.compteVendeur) {
      const x = abonnementPublie();
      if (x && typeof x === 'object') publierAbonnement({ ...x, compteVendeur: j.compteVendeur });
      return { ok: true };
    }
    return { ok: false, message: (j && j.message) || "Ton choix n'a pas été enregistré. Réessaie dans un instant." };
  } catch (_) { return { ok: false, message: 'Pas de connexion : rien n’a changé. Réessaie dans un instant.' }; }
}

export function QuelCompteVend({ comptes, ventes, enTete, onFerme }) {
  const x = useAbonnementPublie();
  const actuel = x && x.compteVendeur && x.compteVendeur.uid ? String(x.compteVendeur.uid) : '';
  const attendre = x && x.compteVendeur && x.compteVendeur.prochainChangement ? x.compteVendeur.prochainChangement : null;
  const propose = React.useMemo(() => compteDefaut(comptes, ventes), [comptes, ventes]);
  const [choix, setChoix] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const nVentes = React.useMemo(() => {
    const n = new Map(); if (Array.isArray(ventes)) for (const v of ventes) { const u = uidDe(v); n.set(u, (n.get(u) || 0) + 1); } return n;
  }, [ventes]);
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') onFerme(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onFerme]);
  const valider = async () => {
    if (!choix || choix === actuel) return;
    setOccupe(true); setMsg('');
    const r = await choisirCompteVendeur(choix, enTete);
    setOccupe(false);
    if (r.ok) onFerme(); else setMsg(r.message);
  };
  const liste = Array.isArray(comptes) ? comptes : [];
  return createPortal(
    <div className="vrm-plan-voile" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
      <div className="vrm-plan-feuille" role="dialog" aria-modal="true" aria-labelledby="vrm-plan-titre" data-quel-compte="" data-propose={propose || undefined}>
        <div className="vrm-plan-feuille-titre" id="vrm-plan-titre">Quel compte vend ?</div>
        <div className="vrm-plan-phrase">Avec Solo, un compte vend : ses ventes, annonces, colis à envoyer et sa compta comptent. Tes autres comptes restent des comptes d'achat : leurs achats et leurs retraits sont tous là.{' '}
          {attendre ? `Tu pourras changer de compte vendeur le ${dateLongue(attendre)}.` : `Tu pourras en changer une fois tous les ${JOURS_CHANGEMENT_VENDEUR} jours.`}</div>
        {!liste.length && <div className="vrm-plan-phrase" data-quel-compte-vide="">Aucun compte Vinted relié pour l'instant : relie ton compte qui vend, puis reviens ici.</div>}
        <div role="radiogroup" aria-label="Le compte qui vend" className="vrm-plan-comptes">
          {liste.map((c) => {
            const u = String(c.uid); const n = nVentes.get(u) || 0;
            const coche = (choix || actuel) === u;
            return (
              <button type="button" role="radio" aria-checked={coche} key={u} data-compte-uid={u} data-compte-actuel={u === actuel ? '' : undefined}
                className="vrm-plan-compte" disabled={occupe || (!!attendre && u !== actuel)} onClick={() => setChoix(u)}>
                <span className="vrm-plan-rond" aria-hidden="true" data-coche={coche ? '' : undefined}/>
                <span className="vrm-plan-compte-nom">{c.nom}<span className="vrm-plan-compte-id"> · n° {u}</span></span>
                <span className="vrm-plan-compte-detail">{Array.isArray(ventes) ? `${n} vente${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}` : 'ventes pas lues'}{u === propose && u !== actuel ? ' · proposé' : ''}{u === actuel ? ' · compte vendeur' : ''}</span>
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

// La ligne de la coque + la feuille (ouverte aussi depuis Paramètres → Abonnement).
export function BandeauCompteVendeur({ comptes, ventes, enTete }) {
  const x = useAbonnementPublie();
  const [ouvert, setOuvert] = React.useState(false);
  React.useEffect(() => { const f = () => setOuvert(true); window.addEventListener(EVT_QUEL_COMPTE, f); return () => window.removeEventListener(EVT_QUEL_COMPTE, f); }, []);
  const soloSansChoix = !!(x && x.plan === 'solo' && !(x.compteVendeur && x.compteVendeur.uid));
  return (<>
    {soloSansChoix && (
      <div className="vrm-bandeau-abo" role="status" data-bandeau-compte-vendeur="">
        <span className="vrm-bandeau-abo-texte">Ton offre Solo : choisis le compte qui vend. Tant que tu n'as pas choisi, tous tes comptes comptent.</span>
        <button type="button" className="vrm-lien-action vrm-bandeau-abo-geste" onClick={() => setOuvert(true)}>Choisir</button>
      </div>
    )}
    {ouvert && <QuelCompteVend comptes={comptes} ventes={ventes} enTete={enTete} onFerme={() => setOuvert(false)}/>}
  </>);
}

// Les ventes des comptes d'achat, en aperçu (Ventes). `comptes` : [{uid, nom}] ;
// `aEnvoyer(o)` : la vente attend son colis (DIT, jamais caché).
export function VentesHorsPlan({ ventes, comptes, aEnvoyer, prix, onPro }) {
  const regle = useRegle();
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
          <button type="button" className="vrm-b vrm-b-primaire" data-apercu-garde="" data-passer-pro="" onClick={onPro}>Passe à Pro pour gérer les ventes de {b.nom}</button>
        </section>
      ))}
    </div>
  );
}

// Les deux offres côte à côte (Paramètres → Abonnement). `x` : la réponse du serveur.
export function OffresSoloPro({ x, prixSolo, prixProAffiche, onChoisirPro, onChoisirSolo, occupe }) {
  const plan = x && x.plan;
  const pro = (x && x.offres && x.offres.pro) || { ouvert: false };
  const texteSolo = (x && x.offres && x.offres.solo && x.offres.solo.texte) || prixSolo;
  const textePro = pro.ouvert && pro.texte ? pro.texte : prixProAffiche;
  return (
    <div className="vrm-plan-offres" data-offres="" data-plan={plan || 'pas-su'} data-pro-ouvert={pro.ouvert ? '' : undefined}>
      <div className="vrm-plan-offre" data-offre="solo" data-offre-actuelle={plan === 'solo' ? '' : undefined}>
        <div className="vrm-plan-offre-nom">{OFFRES.solo.nom}{plan === 'solo' && <span className="vrm-plan-pastille">Ton offre</span>}</div>
        <div className="vrm-plan-offre-prix" data-prix-solo="">{texteSolo}</div>
        <div className="vrm-plan-phrase">{OFFRES.solo.phrase}</div>
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
