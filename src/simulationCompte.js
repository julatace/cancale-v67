// ── SIMULER UNE CRÉATION DE COMPTE (11 nov., Julien : « je veux même dans le
// compte admin des simulations de création de compte ») ─────────────────────
// Le parcours d'arrivée d'un NOUVEAU vendeur, joué de bout en bout sur des
// comptes FICTIFS, dans une base SIMULÉE en mémoire :
//   · jamais la vraie base : ce module n'importe rien qui lise ou écrive le
//     réseau, le localStorage ou Supabase — `scripts/audit-simulation-compte.cjs`
//     l'exécute avec `fetch`, `XMLHttpRequest`, `localStorage`, `indexedDB` piégés
//     et exige ZÉRO appel ;
//   · aucun e-mail envoyé, aucun compte Supabase créé (l'inscription fabrique un
//     identifiant `5100…` qui ne ressemble à aucun vrai) ;
//   · les RÈGLES jouées sont les VRAIES : Ma configuration
//     (src/configurationDepart.js : `choixInitiaux`, `ecrituresEtape`,
//     `appliquerEcritures`, `ecritureFin`), le parcours (src/parcoursArrivee.js :
//     les six preuves, `etatParcours`, `etapeAMontrer`), les mots (« paire » /
//     « article », src/profilVendeur.js), Solo / Pro (api/_lib/plan-regle.js) ;
//   · les lectures du parcours sont les MÊMES requêtes que l'app (`REQUETES`,
//     recopiées d'App.jsx et comparées par l'audit), servies par un petit
//     PostgREST en mémoire (like, select, alias `n:data->>nItems`, limit).
// Chaque étape rend ✓ (franchie) ou ✗ (bloquée, avec ce qui a accroché), et le
// scénario dit s'il s'est passé comme ATTENDU (un ✗ voulu — sans extension —
// est conforme ; un ✓ qui n'aurait pas dû l'être ne l'est pas).
// JS pur, sans React.
import { ETAPES_PARCOURS, etatParcours, etapeAMontrer, preuveCompte, preuveConfiguration, preuveExtension, preuveEmails, preuveVinted, preuvePremiere, reussite } from './parcoursArrivee.js';
import { etapesActives, choixInitiaux, ecrituresEtape, appliquerEcritures, ecritureFin, lireConfiguration, CLE_CONFIGURATION } from './configurationDepart.js';
import { CLE_JE_VENDS, jeVendsEffectif, motsArticle, nomsCategories } from './profilVendeur.js';
import { CLE_PLATEFORMES } from './plateformesAffichage.js';
import { regleVentes, venteHorsPlan } from '../api/_lib/plan-regle.js';

// Les requêtes du parcours, telles qu'App.jsx les envoie (`lireEmailsParcours`,
// `lireAnnoncesParcours`, `lireCommandesParcours`). L'audit exige le même texte.
export const REQUETES = {
  emails: 'id=like.email_reception_*&select=id&limit=1',
  annonces: 'id=like.harvest_*_listings&select=id,n:data->>nItems',
  commandes: 'id=like.harvest_*_orders_*&select=id,n:data->>nItems',
};
// Le filtre d'App.jsx (`ligneDeSaSession`) : une ligne d'un compte Vinted.
const ligneDeSaSession = (id) => /^harvest_(\d+)_(?!enligne$)/.exec(String(id || ''));

// ── LA BASE SIMULÉE ─────────────────────────────────────────────────────────
// `lignes` : { id, data } du vendeur fictif ; `comptes` : ses comptes Vinted.
// `panne` : { emails | annonces | commandes : true } ⇒ cette lecture échoue (null).
export function baseSimulee() {
  const b = { lignes: [], comptes: [], main: {}, panne: {}, requetes: [], ecritures: [] };
  b.ecrire = (id, data) => { b.ecritures.push(id); const i = b.lignes.findIndex((l) => l.id === id); if (i >= 0) b.lignes[i] = { id, data }; else b.lignes.push({ id, data }); };
  b.poserMain = (cle, valeur) => { b.ecritures.push(`main.${cle}`); b.main = { ...b.main, [cle]: valeur }; };
  b.lire = (nom) => {
    const q = REQUETES[nom];
    b.requetes.push(q);
    if (b.panne[nom]) return null;
    return servir(b.lignes, q);
  };
  return b;
}
// Un PostgREST minuscule : `id=like.motif`, `select=a,b:data->>c`, `limit=n`.
export function servir(lignes, requete) {
  const p = new URLSearchParams(requete);
  let out = lignes.slice();
  const id = p.get('id') || '';
  if (id.startsWith('like.')) {
    const re = new RegExp('^' + id.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    out = out.filter((l) => re.test(l.id));
  }
  if (p.get('limit')) out = out.slice(0, Number(p.get('limit')));
  const sel = (p.get('select') || 'id').split(',');
  return out.map((l) => {
    const o = {};
    for (const s of sel) {
      const m = /^(?:([^:]+):)?data->>(\w+)$/.exec(s);
      if (m) { const v = l.data ? l.data[m[2]] : null; o[m[1] || m[2]] = v == null ? null : String(v); }
      else o[s] = l[s];
    }
    return o;
  });
}

// ── LES SCÉNARIOS ───────────────────────────────────────────────────────────
// `vends` : catégories de « Tu vends quoi ? » ; `plateformes` ; `statut` ;
// `offre` : 'solo' | 'pro' ; `extension` : 'connectee' | 'absente' |
// 'pasconnectee' | 'autrecompte' ; `emails` : un e-mail arrive ? ;
// `vinted` : nombre d'annonces par compte relié ([] = aucun compte) ;
// `vente` : index du compte qui vend (null = aucune vente) ; `achat` ;
// `panne` : lectures qui échouent ; `attendu` : l'état final de chaque étape.
export const SCENARIOS = [
  { id: 'sneakers-solo', nom: 'Sneakers · Solo · tout se passe bien', vends: ['sneakers'], plateformes: ['vinted'], statut: 'micro-vente', offre: 'solo',
    extension: 'connectee', emails: true, vinted: [12], vente: 0,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'fait', emails: 'fait', vinted: 'fait', premiere: 'fait' }, mot: 'paire' },
  { id: 'lunettes-pro', nom: 'Lunettes · Pro · 2 comptes Vinted', vends: ['lunettes'], plateformes: ['vinted', 'leboncoin'], statut: 'particulier', offre: 'pro',
    extension: 'connectee', emails: true, vinted: [8, 3], vente: 1,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'fait', emails: 'fait', vinted: 'fait', premiere: 'fait' }, mot: 'article' },
  { id: 'vetements-solo-2', nom: 'Vêtements et livres · Solo · vend sur son 2e compte', vends: ['vetements', 'livres'], plateformes: ['vinted'], statut: 'societe', offre: 'solo',
    extension: 'connectee', emails: true, vinted: [5, 4], vente: 1, compteVendeur: 0,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'fait', emails: 'fait', vinted: 'fait', premiere: 'fait' }, mot: 'article', horsOffre: true },
  { id: 'sans-extension', nom: 'Sneakers · Solo · sans extension', vends: ['sneakers'], plateformes: ['vinted'], statut: 'inconnu', offre: 'solo',
    extension: 'absente', emails: true, vinted: [], vente: null,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'afaire', emails: 'fait', vinted: 'afaire', premiere: 'attente' }, mot: 'paire' },
  { id: 'autre-compte', nom: 'Extension connectée à un AUTRE compte VRM', vends: ['montres'], plateformes: ['vinted', 'ebay'], statut: 'micro-vente', offre: 'pro',
    extension: 'autrecompte', emails: false, vinted: [], vente: null,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'afaire', emails: 'afaire', vinted: 'afaire', premiere: 'attente' }, mot: 'article' },
  { id: 'dressing-en-cours', nom: 'Vinted relié, dressing pas encore lu · achat seulement', vends: ['sneakers', 'vetements'], plateformes: ['vinted'], statut: 'particulier', offre: 'solo',
    extension: 'connectee', emails: true, vinted: [null], vente: null, achat: 0,
    attendu: { compte: 'fait', configuration: 'fait', extension: 'fait', emails: 'fait', vinted: 'attente', premiere: 'fait' }, mot: 'article' },
  { id: 'panne-emails', nom: 'La base ne répond pas pendant la lecture des e-mails', vends: ['jeux'], plateformes: ['vinted'], statut: 'micro-services', offre: 'pro',
    extension: 'connectee', emails: true, vinted: [6], vente: 0, panne: { emails: true },
    attendu: { compte: 'fait', configuration: 'fait', extension: 'fait', emails: 'passu', vinted: 'fait', premiere: 'fait' }, mot: 'article' },
];

// Ce qui a accroché, en une phrase (≤ 12 mots), d'après l'état LU.
function accroche(e) {
  if (!e || e.etat === 'fait') return '';
  if (e.etat === 'passu') return 'Pas pu vérifier : la lecture a échoué.';
  if (e.etat === 'encours') return 'Lecture encore en cours.';
  if (e.cle === 'configuration') return 'Ma configuration pas terminée.';
  if (e.cle === 'extension') return e.detail === 'autrecompte' ? 'Extension connectée à un autre compte VRM.' : e.detail === 'pasconnectee' ? 'Extension installée, pas connectée.' : 'Extension pas installée.';
  if (e.cle === 'emails') return 'Aucun e-mail reçu.';
  if (e.cle === 'vinted') return e.etat === 'attente' ? 'Dressing pas encore lu.' : 'Aucun compte Vinted relié.';
  if (e.cle === 'premiere') return 'Aucune vente ni achat lu.';
  return 'Pas fait.';
}

// Les choix posés à chaque étape de Ma configuration (ce que le vendeur touche).
function choixPour(sc, cle, choix) {
  if (cle === 'vends') return { ...choix, vends: sc.vends.slice(), vendsAutre: '' };
  if (cle === 'plateformes') return { ...choix, plateformes: sc.plateformes.slice() };
  if (cle === 'statut') return { ...choix, statut: sc.statut };
  if (cle === 'micro') return { ...choix, rythme: 'mensuel', liberatoire: 'non', acre: 'non' };
  if (cle === 'societe') return { ...choix, tvaSociete: 'franchise' };
  if (cle === 'numero') return { ...choix, numero: 'vrm' };
  if (cle === 'affichage') return { ...choix, affichage: 'simple' };
  return choix;
}

const UID_VINTED = (i) => String(5100000001 + i * 1111);
let _n = 0;
const uidFictif = () => { _n += 1; const h = (0x5100000 + _n).toString(16).padStart(12, '0'); return `51000000-0000-4000-8000-${h}`; };

// Joue UN scénario. Rend { sc, etapes:[{ cle, titre, etat, ok, conforme, accroche,
// reussite, apercu:{ etat, montree } }], config:[…], mots, horsOffre, conforme, base }.
export function jouerScenario(sc, { maintenant = Date.now() } = {}) {
  const base = baseSimulee();
  base.panne = { ...(sc.panne || {}) };
  const journal = [];
  const preuves = {};
  const instantanes = [];
  const photo = (cle) => {
    const etat = etatParcours(preuves, { maintenant });
    // La miniature montre l'écran de CETTE étape, juste après son geste (✓ ou ce qui bloque).
    instantanes.push({ cle, etat, montree: cle });
  };
  // 1. Inscription : un identifiant FICTIF, aucune requête.
  const uid = uidFictif();
  preuves.compte = preuveCompte(uid);
  for (const e of ETAPES_PARCOURS.slice(1)) preuves[e.cle] = { etat: 'encours' };
  photo('compte');
  // 2. « Tu vends quoi ? » : Ma configuration, ses étapes et ses écritures réelles.
  let lus = {};
  const initial = choixInitiaux(lus);
  let choix = { ...initial };
  const config = [];
  for (const et of etapesActives(choixPour(sc, 'statut', choix))) {
    if (et.cle === 'recap') continue;
    choix = choixPour(sc, et.cle, choix);
    const ecritures = ecrituresEtape(et.cle, choix, initial, lus);
    for (const w of ecritures) base.poserMain(w.cle, w.valeur);
    lus = appliquerEcritures(lus, ecritures);
    config.push({ cle: et.cle, titre: et.titre, ecrit: ecritures.map((w) => w.cle) });
  }
  const fin = ecritureFin('fait', choix);
  base.poserMain(fin.cle, fin.valeur);
  lus = appliquerEcritures(lus, [fin]);
  const conf = lireConfiguration(base.main[CLE_CONFIGURATION]);
  preuves.configuration = preuveConfiguration({ pret: true, etat: conf ? conf.etat : null, plateformes: !!base.main[CLE_PLATEFORMES] });
  const vend = jeVendsEffectif(base.main[CLE_JE_VENDS], { proprietaire: false }).vend;
  const mots = motsArticle(vend);
  photo('configuration');
  // 3. Extension : le pont dit ce que dirait la vraie (connectée à CE compte ou non).
  //    Connectée ⇒ elle range les comptes Vinted (seule elle en écrit).
  const vinted = Array.isArray(sc.vinted) ? sc.vinted : [];
  if (sc.extension === 'connectee') vinted.forEach((_, i) => base.comptes.push({ vinted_user_id: UID_VINTED(i), login: `simulation_${i + 1}` }));
  preuves.extension = preuveExtension(sc.extension, base.comptes);
  photo('extension');
  // 4. E-mails : « Reçu ✓ » quand un e-mail arrive à son adresse VRM.
  if (sc.emails) base.ecrire('email_reception_' + '5'.repeat(16), { de: 'simulation', recuLe: new Date(maintenant).toISOString() });
  preuves.emails = preuveEmails(base.lire('emails'));
  photo('emails');
  // 5. Vinted lu : le dressing de chaque compte relié (null = pas encore lu).
  if (sc.extension === 'connectee') vinted.forEach((n, i) => { if (n != null) base.ecrire(`harvest_${UID_VINTED(i)}_listings`, { nItems: n, capturedAt: new Date(maintenant).toISOString() }); });
  const annonces = base.lire('annonces');
  preuves.vinted = preuveVinted(base.comptes, annonces ? annonces.filter((x) => ligneDeSaSession(x && x.id)) : null);
  photo('vinted');
  // 6. Première vente (ou premier achat) lue par l'extension.
  if (sc.extension === 'connectee') vinted.forEach((_, i) => {
    base.ecrire(`harvest_${UID_VINTED(i)}_orders_sold`, { nItems: sc.vente === i ? 1 : 0 });
    base.ecrire(`harvest_${UID_VINTED(i)}_orders_purchased`, { nItems: sc.achat === i ? 1 : 0 });
  });
  const commandes = base.lire('commandes');
  preuves.premiere = preuvePremiere(commandes ? commandes.filter((x) => ligneDeSaSession(x && x.id)) : null);
  photo('premiere');
  // Solo : la vente d'un autre compte que le compte vendeur choisi sort de l'offre.
  const regle = regleVentes({ plan: sc.offre === 'pro' ? 'pro' : 'solo', compteVendeur: sc.offre === 'solo' && base.comptes.length ? UID_VINTED(sc.compteVendeur || 0) : null });
  const horsOffre = sc.vente != null && base.comptes[sc.vente] ? venteHorsPlan(regle, base.comptes[sc.vente].vinted_user_id) : false;

  const final = etatParcours(preuves, { maintenant });
  const etapes = final.etapes.map((e) => {
    const attendu = sc.attendu ? sc.attendu[e.cle] : 'fait';
    const ins = instantanes.find((x) => x.cle === e.cle);
    return { cle: e.cle, titre: e.titre, court: e.court, etat: e.etat, ok: e.etat === 'fait', attendu, conforme: e.etat === attendu, accroche: accroche(e), reussite: reussite(e), apercu: ins ? { etat: ins.etat, montree: ins.montree } : null };
  });
  const motOk = !sc.mot || mots.nom === sc.mot;
  const horsOk = !!sc.horsOffre === !!horsOffre;
  journal.push(...base.requetes);
  return {
    sc, uid, etapes, config, final, apercuFin: { etat: final, montree: etapeAMontrer(final, null) },
    mots: { vend, nom: mots.nom, categories: nomsCategories(sc.vends) }, motOk, horsOffre, horsOk,
    conforme: etapes.every((e) => e.conforme) && motOk && horsOk,
    requetes: journal, ecritures: base.ecritures.slice(),
  };
}

export function jouerTout(opts) { return SCENARIOS.map((sc) => jouerScenario(sc, opts)); }
