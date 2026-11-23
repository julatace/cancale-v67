// ═══════════════════════════════════════════════════════════════════════════
// OÙ S'ARRÊTENT LES NOUVEAUX INSCRITS (15 nov.) — `/api/compte?mode=pilotage&quoi=parcours`
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « un onglet dans le compte admin pour voir ce que ceux qui créent des
// comptes auront ». Réglages → Nouveaux comptes : l'aperçu du parcours (bac à sable,
// src/modeExemple.js) et, ICI, un tableau ANONYME des vrais inscrits.
//
// QUI : le PROPRIÉTAIRE de l'installation seul — la même garde que le tableau de bord
// (`proprietaireInstallation`, jeton vérifié AVANT par `vendeurExige`). Un autre
// compte ⇒ 403 et RIEN n'est lu ; propriétaire pas su ⇒ 503.
//
// AUCUNE DONNÉE PERSONNELLE NE SORT : ni e-mail, ni identifiant, ni nom, ni date au
// jour près — la semaine de création (lundi), et des oui / non. Le propriétaire et le
// propriétaire NEUTRE ne comptent pas.
//
// SEULEMENT CE QUE LA BASE MESURE DÉJÀ, chaque mesure avec son « pas su » (§5) :
//   · compte créé         — Supabase Auth (`created_at`) ;
//   · app ouverte         — une ligne `main` existe (l'app l'écrit au premier lancement) ;
//   · extension vue       — une trace écrite par l'extension : `ext_appareil_*` (5.327+),
//                           un compte Vinted rangé (`vinted_accounts`), `lbc_accounts`, `vc_session` ;
//   · première lecture    — une lecture rangée : `harvest_*_listings`, `harvest_*_orders_*`,
//                           `lbc_listings`, `lbc_ventes`, `vc_listings`, `vc_ventes` ;
//   · étape du parcours   — `main.vrm_parcours_nouveau` (projeté, petit) : n'existe que
//                           depuis le 15 nov. — un compte d'avant ⇒ « pas mesuré », dit ;
//   · abonné              — la table `abonnements` (statut ; les abonnements de test écartés).
// Une lecture ratée ⇒ cette mesure vaut `null` partout, avec sa raison — jamais 0.
// Toutes les lectures projettent (`select=owner` …), jamais `data` entier (§4.4), et
// paginent (`lireTout` du tableau de bord : Range + ordre stable).
// ═══════════════════════════════════════════════════════════════════════════
import { proprietaireInstallation } from './signalement.js';
import { lireComptes, lireTout } from './pilotage.js';
import { fetchAvecDelai } from './fetch-delai.js';
// (16 nov., satisfaction-clients, point 4) Les 10 premières minutes : LA règle de l'app (étape atteinte + temps,
// regroupés par étape, rien sous 5 vendeurs, coupable), importée telle quelle.
import { agregerDemarrage, CLE_MESURE_DEMARRAGE, CLE_MESURE_COUPEE } from '../../src/mesureDemarrage.js';

const NEUTRE = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cfg = (env) => ({ service: env.SUPABASE_SERVICE_KEY || '' });
// (20 nov.) Les six pages du parcours (src/parcoursNouveau/regle.js ETAPES_NOUVEAU) ; une position rangée avec
// une étape du 15 nov. compte dans la page qui la remplace (la même table que ANCIENNES_ETAPES).
export const ETAPES_PN = ['plateformes', 'extension', 'comptes', 'etiquetage', 'historique', 'pret'];
const ANCIENNES_PN = { bienvenue: 'plateformes', numeros: 'etiquetage', journee: 'pret', abonnement: 'pret' };
const STATUTS_PAYES = new Set(['active', 'past_due']);

export const REQUETES = Object.freeze({
  mains: `app_data?id=eq.main&select=owner,pn:data->vrm_parcours_nouveau,md:data->${CLE_MESURE_DEMARRAGE},off:data->>${CLE_MESURE_COUPEE}`,
  vinted: 'vinted_accounts?select=owner',
  extension: 'app_data?or=(id.like.ext_appareil_*,id.in.(lbc_accounts,vc_session))&select=owner',
  lecture: 'app_data?or=(id.like.harvest_*_listings,id.like.harvest_*_orders_*,id.in.(lbc_listings,lbc_ventes,vc_listings,vc_ventes))&select=owner',
  abonnements: 'abonnements?select=owner,statut,mode_test',
});

// Le lundi (UTC) de la semaine d'une date, « AAAA-MM-JJ » ; `null` si illisible.
export function semaineDe(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const jour = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - jour)).toISOString().slice(0, 10);
}
const ensemble = (rows) => (Array.isArray(rows) ? new Set(rows.map((r) => String((r && r.owner) || '').toLowerCase()).filter((o) => UUID.test(o))) : null);

// LE CALCUL, pur (le banc et l'audit l'exécutent sur une base inventée).
// `lu` : { comptes: [{id, cree}] | null, mains, vinted, extension, lecture, abonnements } (lignes ou null).
export function calculerParcours({ proprio, lu }) {
  const raisons = {};
  const comptes = Array.isArray(lu.comptes) ? lu.comptes.filter((c) => c && UUID.test(c.id) && c.id !== proprio && c.id !== NEUTRE) : null;
  if (!comptes) return { ok: true, total: null, raisons: { comptes: 'comptes-illisibles' } };
  const mains = Array.isArray(lu.mains) ? new Map(lu.mains.filter((r) => r && UUID.test(String(r.owner || ''))).map((r) => [String(r.owner).toLowerCase(), r.pn && typeof r.pn === 'object' ? r.pn : null])) : null;
  if (!mains) raisons.ouvert = 'base';
  const vinted = ensemble(lu.vinted), ext = ensemble(lu.extension), lect = ensemble(lu.lecture);
  // Une lecture rangée PROUVE l'extension (seule l'extension en écrit) : mesuré le 15 nov., un compte lu
  // dont la ligne `vinted_accounts` a disparu comptait « lu » sans « extension vue ».
  const extension = vinted && ext ? new Set([...vinted, ...ext, ...(lect || [])]) : null;
  if (!extension) raisons.extension = 'base';
  if (!lect) raisons.lecture = 'base';
  const abos = Array.isArray(lu.abonnements) ? new Map(lu.abonnements.filter((r) => r && UUID.test(String(r.owner || '')) && r.mode_test !== true).map((r) => [String(r.owner).toLowerCase(), String(r.statut || '')])) : null;
  if (!abos) raisons.abonnes = 'base';

  const lignes = comptes.map((c) => {
    const ouvert = mains ? mains.has(c.id) : null;
    const pn = mains && mains.get(c.id);
    const etape = pn ? (pn.fini === true ? 'fini' : (ETAPES_PN.includes(pn.etape) ? pn.etape : (ANCIENNES_PN[pn.etape] || 'plateformes'))) : null;
    const statut = abos ? (abos.get(c.id) || '') : null;
    return {
      semaine: semaineDe(c.cree),
      ouvert,
      extension: extension ? extension.has(c.id) : null,
      lecture: lect ? lect.has(c.id) : null,
      etape,                       // null : pas mesuré (compte d'avant le 15 nov., ou app jamais ouverte)
      abonne: statut === null ? null : statut === 'trialing' ? 'essai' : STATUTS_PAYES.has(statut) ? 'paye' : 'non',
    };
  });
  // Trié par semaine puis par avancée : aucun ordre d'identifiant ne transparaît.
  const rang = (l) => (l.lecture ? 3 : l.extension ? 2 : l.ouvert ? 1 : 0);
  lignes.sort((a, b) => String(b.semaine || '').localeCompare(String(a.semaine || '')) || rang(b) - rang(a));
  const compte = (f) => (lignes.some((l) => f(l) === null) ? null : lignes.filter((l) => f(l) === true).length);
  const entonnoir = {
    crees: lignes.length,
    ouvert: compte((l) => l.ouvert),
    extension: compte((l) => l.extension),
    lecture: compte((l) => l.lecture),
    parcoursFini: mains ? lignes.filter((l) => l.etape === 'fini').length : null,
    abonnes: compte((l) => (l.abonne === null ? null : l.abonne !== 'non')),
  };
  // Où ils s'arrêtent : la DERNIÈRE marche mesurée de chacun.
  const arrets = mains && extension && lect ? { cree: 0, ouvert: 0, extension: 0, lecture: 0 } : null;
  if (arrets) for (const l of lignes) arrets[l.lecture ? 'lecture' : l.extension ? 'extension' : l.ouvert ? 'ouvert' : 'cree'] += 1;
  const etapes = mains ? Object.fromEntries([...ETAPES_PN, 'fini'].map((e) => [e, lignes.filter((l) => l.etape === e).length])) : null;
  const sansMesureParcours = mains ? lignes.filter((l) => l.etape === null).length : null;
  const parSemaine = new Map();
  for (const l of lignes) if (l.semaine) parSemaine.set(l.semaine, (parSemaine.get(l.semaine) || 0) + 1);
  const semaines = [...parSemaine.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([semaine, n]) => ({ semaine, n }));
  return { ok: true, total: lignes.length, entonnoir, arrets, etapes, sansMesureParcours, semaines, lignes, raisons };
}

export async function routeParcoursComptes({ utilisateur, env = process.env, fetcher = fetchAvecDelai } = {}) {
  if (!utilisateur || !UUID.test(String(utilisateur.id || ''))) return { code: 401, corps: { ok: false, raison: 'session' } };
  if (!cfg(env).service) return { code: 503, corps: { ok: false, raison: 'non-configure' } };
  const proprio = await proprietaireInstallation({ env, fetcher });
  if (!proprio) return { code: 503, corps: { ok: false, raison: 'proprietaire-inconnu' } };
  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };
  // La garde est passée : seulement maintenant, la clé de service lit.
  const [comptes, mains, vinted, extension, lecture, abonnements] = await Promise.all([
    lireComptes(env, fetcher),
    lireTout(env, fetcher, REQUETES.mains),
    lireTout(env, fetcher, REQUETES.vinted),
    lireTout(env, fetcher, REQUETES.extension),
    lireTout(env, fetcher, REQUETES.lecture),
    lireTout(env, fetcher, REQUETES.abonnements),
  ]);
  const corps = calculerParcours({ proprio, lu: { comptes, mains, vinted, extension, lecture, abonnements } });
  // Regroupé PAR ÉTAPE, jamais par compte : seulement des nombres, et rien sous le seuil d'anonymat.
  corps.demarrage = agregerDemarrage(mains, { proprio });
  return { code: 200, corps };
}
