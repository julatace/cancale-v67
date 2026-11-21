// ════════════════════════════════════════════════════════════════════════════
//  « AUJOURD'HUI » — LE FOND (19 nov., Julien : « il y a d'autres choses plus intéressantes pour cet onglet »).
//  Ce module ne CALCULE aucun chiffre et ne connaît aucune règle de vente : il DEMANDE chaque valeur à son
//  propriétaire (§5 de CLAUDE.md, « une seule règle par notion ») et range les réponses dans un modèle que l'écran
//  dessine. Pur (aucun React, aucune lecture) : exécuté tel quel par scripts/audit-aujourdhui.cjs.
//
//    chiffresAujourdhui  le vendu du jour, les sept jours, le mois (Vendu · Reçu · Bénéfice), l'argent à venir —
//                        par `valeur(id, periode)` = `valeurChiffre` (src/design/carteChiffres.js) sur les sources de
//                        la carte des chiffres, les MÊMES appels que l'écran Argent (`ArgentMoisV2`) ;
//    jourMontre          quel jour dit le grand chiffre (aujourd'hui s'il a vendu, sinon le dernier jour utile) ;
//    dernieresVentes     les N dernières lignes de « Vendu » (`ventesFaites`), par leur identité `plateforme:tx` ;
//    alerteDuJour        AU PLUS une alerte : une date limite LUE qui tombe aujourd'hui ou demain (ou déjà passée) —
//                        jamais une limite ESTIMÉE (vente + 7 j n'est qu'un plancher, §5).
//  Trois états partout : 'encours' (lecture) · 'passu' (« — » et la raison, jamais 0) · 'lu'.
// ════════════════════════════════════════════════════════════════════════════

const JOUR_MS = 86400000;

// Les sept derniers jours (heure locale, minuit → minuit), le plus ancien d'abord, aujourd'hui en dernier.
// Par dates (jamais +24 h) : un passage à l'heure d'hiver ne décale aucun jour.
export function septJours(maintenant = Date.now()) {
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  return [6, 5, 4, 3, 2, 1, 0].map((k) => {
    const d = new Date(minuit); d.setDate(d.getDate() - k);
    const f = new Date(d); f.setDate(f.getDate() + 1);
    return { k, de: d.getTime(), a: f.getTime(), cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, auj: k === 0 };
  });
}

// Le jour que dit le grand chiffre : aujourd'hui s'il y a du vendu aujourd'hui, sinon le dernier des sept où il a
// vendu (« le dernier chiffre utile », la règle de la frise du 9 nov.), sinon aujourd'hui. Rend son rang (0…6).
export function jourMontre(jours) {
  const n = jours.length; if (!n) return -1;
  if (jours[n - 1].v > 0) return n - 1;
  for (let i = n - 2; i >= 0; i--) if (jours[i].v > 0) return i;
  return n - 1;
}

// `valeur(id, periode)` → { valeur | null, partiel, manque, raison, B?, aDater? } (le résultat de `valeurChiffre`).
// `etatVendu` : 'lu' | 'pasSu' | 'encours' (`venduEtat` de la coque). `questions` = `questionsArgent` (src/argent.js) ;
// `chiffreBrut` = la règle du brut (src/beneficeNoms.js) ; `raisonCourte` = la raison d'un « — » (carteChiffres.js).
export function chiffresAujourdhui({ valeur, etatVendu = 'encours', sansCompte = false, maintenant = Date.now(), raisonCourte = () => '', questions, chiffreBrut, mois = '' }) {
  const etat = sansCompte ? 'passu' : etatVendu === 'lu' ? 'lu' : etatVendu === 'pasSu' ? 'passu' : 'encours';
  const jours = septJours(maintenant).map((j) => {
    const p = { de: j.de, a: j.a, label: '' };
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    return { ...j, v: V.valeur == null ? null : V.valeur, n: N.valeur == null ? null : N.valeur, partiel: !!V.partiel, raison: V.valeur == null ? (raisonCourte(V) || '') : '' };
  });
  const auj = jours[jours.length - 1];
  const raison = etat === 'passu' ? (raisonCourte(valeur('vendu', 'jour') || {}) || '') : (auj.raison || '');
  const vMois = { vendu: valeur('vendu', 'mois'), recu: valeur('recu', 'mois'), benefice: valeur('benefice', 'mois') };
  const Q = questions({ vendu: vMois.vendu, recu: vMois.recu, benefice: vMois.benefice, prevision: null, profil: null, raisonCourte, mois, dateCourte: (t) => String(t) });
  const q = (id) => Q.find((x) => x.id === id) || { valeur: null, partiel: false, note: '' };
  const cas = (id) => ({ valeur: q(id).valeur == null ? null : q(id).valeur, partiel: !!q(id).partiel, note: q(id).note || '' });
  // Le bénéfice : la règle de la case d'Argent — le net ; sinon le brut des ventes au prix connu, AVEC sa couverture
  // (« k ventes sur n »). Jamais « au moins » devant un bénéfice (§5).
  const Bn = vMois.benefice && vMois.benefice.B ? vMois.benefice.B : null;
  const manquent = Bn && Bn.n > Bn.nCout ? Bn.n - Bn.nCout : 0;
  const qB = q('benefice');
  const brut = qB.valeur == null && Bn && Bn.nCout > 0 && manquent > 0 ? chiffreBrut({ n: Bn.n, nCout: Bn.nCout, brut: Bn.brut }) : null;
  const benefice = brut && brut.valeur != null
    ? { valeur: brut.valeur, partiel: false, note: '', brut: true, couverture: { k: Bn.nCout, n: Bn.n } }
    : { valeur: qB.valeur == null ? null : qB.valeur, partiel: false, note: qB.note || '', brut: false, couverture: null };
  const at = valeur('attente', 'mois');
  return { etat, raison, jours, montre: jourMontre(jours), mois: { vendu: cas('vendu'), recu: cas('recu'), benefice },
    aVenir: at && at.valeur != null ? { valeur: at.valeur, partiel: !!at.partiel } : null };
}

// (19 nov., Julien : « je veux peut-être plus de stats dans l'onglet Ma journée, par exemple le CA, le bénéfice etc. »)
// LES CHIFFRES D'UNE PÉRIODE — Jour · Semaine · Mois : CA vendu, bénéfice, nombre de ventes, panier moyen, et l'écart du
// vendu avec la période d'avant AU MÊME MOMENT (hier à la même heure, la semaine dernière au même jour…). Aucune règle
// neuve : chaque valeur est DEMANDÉE à `valeur(id, période)` (= `valeurChiffre`, les mêmes appels que l'écran Argent) :
//   vendu / ventes  `ventesFaites` (date de vente, toutes plateformes) — « au moins » si un prix n'est pas lu ;
//   bénéfice        le mois : celui de la case d'Argent (`beneficeMois`, le net, sinon le brut et sa couverture) ;
//                   le jour, la semaine : `brut` (la publication `vrm_benefice_jours`, sa couverture si des prix
//                   d'achat manquent) — le bénéfice net ne se calcule qu'au mois (règle de l'URSSAF) ;
//   panier moyen    le vendu divisé par le nombre de ventes, SEULEMENT si les deux sont lus en entier (une moyenne sur
//                   une partie des ventes n'est pas un minimum : « — », la règle du panier de la carte) ;
//   écart           seulement entre deux vendus lus en entier, et une période d'avant qui a vendu (pas de « +∞ % »).
// `precedente(p)` → { de, a } : la période d'avant, coupée au même moment (fourni par l'app : ses règles de période).
export const PERIODES_STATS = ['jour', 'semaine', 'mois'];
export function statsPeriodes({ valeur, precedente = null, raisonCourte = () => '', beneficeMois = null, periodes = PERIODES_STATS }) {
  const lu = (x) => !!x && x.valeur != null;
  const out = {};
  for (const p of periodes) {
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    const vendu = { valeur: lu(V) ? V.valeur : null, partiel: lu(V) && !!V.partiel, note: lu(V) ? '' : (raisonCourte(V) || '') };
    const ventes = { valeur: lu(N) ? N.valeur : null, partiel: lu(N) && !!N.partiel, note: lu(N) ? '' : (raisonCourte(N) || '') };
    const entier = (x) => x.valeur != null && !x.partiel;
    const panier = entier(vendu) && entier(ventes) && ventes.valeur > 0
      ? { valeur: Math.round((vendu.valeur / ventes.valeur) * 100) / 100, note: '' }
      : { valeur: null, note: entier(ventes) && ventes.valeur === 0 ? 'aucune' : (vendu.partiel || ventes.partiel) ? 'partiel' : (vendu.note || ventes.note) };
    let benefice;
    if (p === 'mois' && beneficeMois) {
      const c = beneficeMois.couverture;
      benefice = { valeur: beneficeMois.valeur == null ? null : beneficeMois.valeur, brut: !!beneficeMois.brut, partiel: !!c, couverture: c ? `${c.k}/${c.n}` : '', note: beneficeMois.note || '' };
    } else {
      const Bb = valeur('brut', p) || {};
      const m = /^(\d+) sur (\d+)$/.exec(String(Bb.couverture || ''));
      benefice = lu(Bb) ? { valeur: Bb.valeur, brut: true, partiel: !!Bb.partiel, couverture: m ? `${m[1]}/${m[2]}` : '', note: '' } : { valeur: null, brut: true, partiel: false, couverture: '', note: raisonCourte(Bb) || '' };
      // (20 nov., chasse-bugs-2) La publication des jours (`vrm_benefice_jours`) arrive APRÈS la vente : « Ventes 1 · CA 60 € » à
      // côté de « Bénéfice brut 0 € » (mesuré, mode exemple) — 0 sur AUCUNE vente comptée n'est pas un bénéfice de 0 €. Rien de
      // compté alors que la période a vendu ⇒ « — · pas calculé » ; moins de ventes comptées que vendues ⇒ c'est dit (k/n).
      if (benefice.valeur != null && Number.isFinite(Bb.n) && entier(ventes) && ventes.valeur > Bb.n) {
        benefice = Bb.n === 0 ? { valeur: null, brut: true, partiel: false, couverture: '', note: raisonCourte({ valeur: null, raison: 'publication' }) || '' }
          : { ...benefice, partiel: true, couverture: benefice.couverture || `${Bb.n}/${ventes.valeur}` };
      }
    }
    let ecart = null;
    if (entier(vendu) && typeof precedente === 'function') {
      const P = valeur('vendu', precedente(p)) || {};
      if (lu(P) && !P.partiel && P.valeur > 0) ecart = Math.round(((vendu.valeur - P.valeur) / P.valeur) * 100);
    }
    // (21 nov., Julien : « bénéfice dans Ma journée — brut et net du mois, et d'aujourd'hui, les mêmes chiffres que
    // Comptabilité ») LES DEUX, CHACUN À SON PROPRIÉTAIRE, jamais recalculés ici :
    //   brut  `valeur('brut', p)` = `chiffreBrut` sur `vrm_benefice_jours` (la ligne « Bénéfice brut » de Comptabilité),
    //         sa couverture « k/n » quand des prix d'achat manquent — jamais « au moins » ;
    //   net   `valeur('benefice', p)` = `chiffreBenefice(beneficePeriode)` (« Ton bénéfice » de Comptabilité) ; au JOUR,
    //         la même règle sans les dépenses (elles se comptent au mois : `chargesAuMois`) — c'est dit.
    const Br = valeur('brut', p) || {};
    const mB = /^(\d+) sur (\d+)$/.exec(String(Br.couverture || ''));
    let brut = lu(Br) ? { valeur: Br.valeur, partiel: !!Br.partiel, couverture: mB ? `${mB[1]}/${mB[2]}` : '', note: '', raison: '' } : { valeur: null, partiel: false, couverture: '', note: raisonCourte(Br) || '', raison: Br.raison || '' };
    if (brut.valeur != null && Number.isFinite(Br.n) && entier(ventes) && ventes.valeur > Br.n) {
      brut = Br.n === 0 ? { valeur: null, partiel: false, couverture: '', note: raisonCourte({ valeur: null, raison: 'publication' }) || '', raison: 'publication' } : { ...brut, partiel: true, couverture: brut.couverture || `${Br.n}/${ventes.valeur}` };
    }
    const Nt = valeur('benefice', p) || {};
    const net = { valeur: lu(Nt) ? Nt.valeur : null, note: lu(Nt) ? '' : (raisonCourte(Nt) || ''), raison: lu(Nt) ? '' : (Nt.raison || ''),
      avantDepenses: !!(Nt.B && (Nt.B.chargesAuMois || Nt.B.depenses === 'jamais')), auMois: !!(Nt.B && Nt.B.chargesAuMois),
      // (21 nov., transp-depenses) Les dépenses NOTÉES aujourd'hui sont déduites (« net du jour », sans la mention du mois).
      duJour: !!(Nt.B && Nt.B.chargesAuMois === false && Number(Nt.B.depensesJour) > 0) };
    out[p] = { vendu, ventes, panier, benefice, brut, net, ecart };
  }
  return out;
}

// Les N dernières ventes : les lignes de « Vendu » datées et identifiées, la plus récente d'abord. Une ligne sans
// date ou sans identité n'y est pas (jamais un titre comme identité, §5) ; deux lignes de même identité : une seule.
export function dernieresVentes(lignes, n = 5) {
  if (!Array.isArray(lignes)) return null;                 // pas su ≠ aucune
  const vus = new Set(), out = [];
  for (const l of [...lignes].filter((x) => x && Number.isFinite(Number(x.ts)) && x.tx != null && String(x.tx) !== '' && x.plateforme).sort((a, b) => Number(b.ts) - Number(a.ts))) {
    const cle = l.plateforme + ':' + l.tx; if (vus.has(cle)) continue; vus.add(cle);
    out.push({ cle, plateforme: l.plateforme, tx: String(l.tx), ts: Number(l.ts), eur: l.eur, compte: l.compte || '' });
    if (out.length >= n) break;
  }
  return out;
}

// AU PLUS UNE ALERTE. Dans l'ordre : un colis à poster (limite LUE en retard, aujourd'hui ou demain), un colis à
// retirer qui presse (`urgents` : la règle du point ambre d'« À retirer »), un retour à déposer (limite lue ≤ 1 j).
//   aPoster : les colis de `toShip` ({ at, limite: 'email' | 'estimee', retard, depasse, daysLeft }) ;
//   urgentsRetrait : un nombre, ou null = pas su ; retours : [{ limiteJour }] ; joursAvant(jour) → jours restants.
export function alerteDuJour({ aPoster = [], urgentsRetrait = null, retours = [], joursAvant = () => null } = {}) {
  const lus = (aPoster || []).filter((t) => t && t.at != null && t.limite !== 'estimee' && (t.retard || (!t.depasse && Number.isFinite(t.daysLeft) && t.daysLeft <= 1)))
    .sort((a, b) => (b.retard ? 1 : 0) - (a.retard ? 1 : 0) || a.at - b.at);
  if (lus.length) return { id: 'poster', n: lus.length, premier: lus[0] };
  if (Number(urgentsRetrait) > 0) return { id: 'retirer', n: Number(urgentsRetrait), premier: null };
  const rA = (retours || []).filter((c) => { const j = c && c.limiteJour ? joursAvant(c.limiteJour) : null; return j != null && j >= 0 && j <= 1; });
  if (rA.length) return { id: 'retour', n: rA.length, premier: rA[0] };
  return null;
}

export const _interne = { JOUR_MS };

// ── (19 nov., Julien : « applique ce que tu proposes ») LES CARTES EN PLUS D'AUJOURD'HUI — toujours sans règle neuve ──

// LA COURBE DES 30 JOURS : le vendu de chaque jour (heure locale, minuit → minuit), le plus ancien d'abord, aujourd'hui
// en dernier ; chaque valeur DEMANDÉE à `valeur('vendu', { de, a })` (= `valeurChiffre`, `ventesFaites`). Pas su ⇒ null.
export function trenteJours(maintenant = Date.now()) {
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  const out = [];
  for (let k = 29; k >= 0; k--) {
    const d = new Date(minuit); d.setDate(d.getDate() - k);
    const f = new Date(d); f.setDate(f.getDate() + 1);
    out.push({ de: d.getTime(), a: f.getTime(), cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, auj: k === 0 });
  }
  return out;
}
export function courbe30({ valeur, maintenant = Date.now() }) {
  return trenteJours(maintenant).map((j) => {
    const p = { de: j.de, a: j.a, label: '' };
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    return { ...j, v: V.valeur == null ? null : V.valeur, partiel: !!V.partiel, n: N.valeur == null ? null : N.valeur };
  });
}

// PAR COMPTE ET PAR SITE (la règle de « Quel compte vend le mieux » : les lignes de « Vendu », un compte Vinted = son
// identifiant de connexion, les autres sites par plateforme). Chaque nombre est DEMANDÉ au propriétaire avec la
// sélection de la ligne (`valeur(id, période, sel)` = `valeurChiffre` sur { site, compte }). Rangé par CA, le plus fort
// d'abord ; une ligne sans vente dans la période n'est pas montrée. Lignes pas lues ⇒ null (pas su).
const SITE_DE_PLATEFORME = { Vinted: 'vinted', Vestiaire: 'vestiaire', Leboncoin: 'leboncoin', eBay: 'ebay' };
export function parCompteEtSite({ lignes, valeur, periodes = PERIODES_STATS }) {
  if (!Array.isArray(lignes)) return null;
  const vus = new Map();
  for (const l of lignes) {
    if (!l || !SITE_DE_PLATEFORME[l.plateforme]) continue;
    const vinted = l.plateforme === 'Vinted' && l.compte;
    const cle = vinted ? 'vinted|' + l.compte : SITE_DE_PLATEFORME[l.plateforme];
    if (!vus.has(cle)) vus.set(cle, { cle, nom: vinted ? String(l.compte) : l.plateforme, site: l.plateforme, sel: { site: SITE_DE_PLATEFORME[l.plateforme], compte: vinted ? { login: String(l.compte) } : null, periode: null } });
  }
  const out = {};
  for (const p of periodes) {
    out[p] = [...vus.values()].map((x) => {
      const V = valeur('vendu', p, x.sel) || {}, N = valeur('ventes', p, x.sel) || {};
      return { cle: x.cle, nom: x.nom, site: x.site, v: V.valeur == null ? null : V.valeur, vp: !!V.partiel, n: N.valeur == null ? null : N.valeur };
    }).filter((r) => (r.n || 0) > 0 || (r.v || 0) > 0).sort((a, b) => (b.v || 0) - (a.v || 0) || (b.n || 0) - (a.n || 0));
  }
  return out;
}

// CE QUE VRM A FAIT AUJOURD'HUI : les gestes ACCEPTÉS (résultat « ok ») notés au journal (`journal_vrm_*`, lus par la
// route du journal, src/securiteCompte.js), depuis minuit, comptés par famille. Journal pas lu ⇒ null ; rien ⇒ [].
export const FAMILLES_VRM = [['baisses', ['baisse_prix']], ['favoris', ['favori', 'favori_offre']], ['offres', ['offre_acceptee']],
  ['republications', ['republication']], ['bordereaux', ['bordereau']], ['messages', ['message_envoye']], ['offresFaites', ['offre_faite']]];
// (21 nov., lot journee-stats) L'heure d'un événement : la route rend des MILLISECONDES (`ms()` de
// api/_lib/securite-compte.js) — `Date.parse("1763…")` rendait NaN : « Ce que VRM a fait » ne comptait JAMAIS rien.
// Un nombre, une chaîne de chiffres ou une date ISO ; sinon null (l'événement n'est dans aucune période).
export const heureEvenement = (at) => {
  if (at == null || at === '') return null;
  const n = typeof at === 'number' ? at : /^\d+$/.test(String(at)) ? Number(at) : Date.parse(String(at));
  return Number.isFinite(n) && n > 0 ? n : null;
};
// LES GESTES DE VRM ACCEPTÉS entre deux instants [de, a) — LA règle de « Ce que VRM a fait » (Aujourd'hui) et des
// « gestes faits » de Statistiques (src/aujourdhui/pilotage.js) : résultat « ok », un type d'une famille de FAMILLES_VRM.
export const TYPES_VRM = FAMILLES_VRM.flatMap(([, t]) => t);
export function gestesVrmEntre(evenements, de, a) {
  if (!Array.isArray(evenements)) return null;
  return evenements.filter((e) => { const t = e && e.resultat === 'ok' && TYPES_VRM.includes(e.type) ? heureEvenement(e.at) : null; return t != null && t >= de && t < a; });
}
export function vrmDuJour(evenements, maintenant = Date.now()) {
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  const du = gestesVrmEntre(evenements, minuit.getTime(), maintenant + 60000);
  if (!du) return null;
  return FAMILLES_VRM.map(([cle, types]) => ({ cle, n: du.filter((e) => types.includes(e.type)).length })).filter((x) => x.n > 0);
}

// SUR TES ANNONCES AUJOURD'HUI : ce que l'extension a CAPTÉ depuis minuit (`capte_journal_*`, une entrée par identité :
// src/capteNotif/arrivee.js `fusionner`), compté par sorte. Les favoris ne sont pas dans ce journal : null (pas su).
export function capteDuJour(entrees, maintenant = Date.now()) {
  if (!Array.isArray(entrees)) return null;
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  const du = entrees.filter((e) => e && Number(e.t) >= minuit.getTime());
  const n = (s) => du.filter((e) => e.s === s).length;
  return { favoris: null, offres: n('offres'), messages: n('messages'), ventes: n('ventes') };
}

// LES CARTES D'AUJOURD'HUI, cochées et ordonnées par lui (`vrm_aujourdhui_cartes`, synchronisé). Par défaut : les
// chiffres, À envoyer, À retirer, la courbe, les dernières ventes. Une carte inconnue est ignorée ; une carte connue
// absente de l'ordre se pose à la fin (une carte ajoutée plus tard n'est jamais perdue).
// (19 nov., Julien : « tu peux trouver mieux, peut-être d'autres stats ») + stock en ligne, vitesse de vente, prévision du
// mois (les trois montrées d'office), marge, marques, paires qui dorment, argent à venir, vues et favoris.
// (« Meilleurs moments » : refusé par Julien le 19 nov. — ne pas l'ajouter.)
// (21 nov., lot journee-stats — Julien : « toute l'application doit être simplifiée et ergonomique », « ça fait trop vibe
// codé ») MA JOURNÉE EST COURTE : « Colis » (à envoyer · à retirer, une carte de hauteur fixe — pas la liste « À faire », rangée dans « À régler ») en haut, puis les chiffres
// clés (CA, ventes, bénéfice BRUT et NET, aujourd'hui et le mois — sans activation, sa demande), puis les dernières ventes.
// Toutes les autres statistiques sont dans Statistiques (Pilotage · Finances, 7 j · 30 j · 90 j), montrées d'office ;
// ici, elles restent ajoutables par « Personnaliser » (un choix d'affichage, pas une activation).
// Le choix rangé avant ce lot (sans `v: 2`) décrivait l'ANCIEN écran (8 cartes empilées) : il n'est plus suivi.
export const VERSION_CARTES = 2;
export const CARTES_AUJOURDHUI = ['colis', 'chiffres', 'ventes', 'envoyer', 'retirer', 'stock', 'vitesse', 'prevision', 'courbe', 'comptes', 'marge', 'marques', 'dorment', 'avenir', 'annonces', 'vues', 'vrm'];
export const CARTES_DEFAUT = ['colis', 'chiffres', 'ventes'];
export function cartesChoisies(brut) {
  const ok = brut && typeof brut === 'object' && Number(brut.v) === VERSION_CARTES && Array.isArray(brut.ordre) ? brut.ordre.filter((x, i, l) => CARTES_AUJOURDHUI.includes(x) && l.indexOf(x) === i) : null;
  const ordre = ok ? [...ok, ...CARTES_AUJOURDHUI.filter((x) => !ok.includes(x))] : [...CARTES_AUJOURDHUI];
  const montrees = ok && Array.isArray(brut.montrees) ? brut.montrees.filter((x) => CARTES_AUJOURDHUI.includes(x)) : CARTES_DEFAUT;
  return { ordre, montrees: new Set(montrees) };
}

// LE CHOIX DES CARTES, ENTRE SES APPAREILS (19 nov., « ça doit être bien fait ») : chaque écriture porte `rev` (un de
// plus que le plus grand connu) et `at`. Deux choix se départagent par `rev`, puis par `at` : un choix plus ancien reçu
// d'un autre appareil n'écrase JAMAIS un choix plus récent (comparer-et-échanger, la règle de `modifierCas`).
export function choixPlusRecent(a, b) {
  const ok = (x) => !!x && typeof x === 'object' && Array.isArray(x.ordre);
  if (!ok(a)) return ok(b) ? b : null;
  if (!ok(b)) return a;
  // (21 nov.) Un choix de l'écran d'aujourd'hui (`v: 2`) l'emporte sur un choix de l'ancien écran, quel que soit son `rev`.
  const va = Number(a.v) === VERSION_CARTES, vb = Number(b.v) === VERSION_CARTES;
  if (va !== vb) return va ? a : b;
  const ra = Number(a.rev) || 0, rb = Number(b.rev) || 0;
  if (ra !== rb) return ra > rb ? a : b;
  return (Number(b.at) || 0) > (Number(a.at) || 0) ? b : a;
}
export function nouveauChoix(avant, { ordre, montrees }, maintenant = Date.now()) {
  return { v: VERSION_CARTES, ordre: [...ordre], montrees: [...montrees], rev: (Number(avant && avant.rev) || 0) + 1, at: maintenant };
}

// LES CHIFFRES DU RELEVÉ PAR PÉRIODE (vitesse, marge, marques) — le relevé des ventes FINALISÉES de l'écran Ventes
// (`vrm_stats_ventes`, les lignes de Statistiques : { ts, eur, achat, marqueLue, modele, enLigne }) et les règles de
// Statistiques (src/statsVentes.js) : `delaisPar` (délai médian mise en ligne → vente, sa couverture « sur N »),
// `margesPar` (marge = brut ÷ CA des ventes au prix d'achat connu, « sur N »). Les marques : la marque LUE de l'annonce
// (`marqueLue`), jamais devinée d'un titre ; sans marque lue, la vente compte dans « sans marque lue ».
// `bornes(p)` → { de, a } (les règles de période de l'app). Relevé pas lu ⇒ null.
const top5 = (G) => (G ? { top: [...G.groupes].sort((a, b) => b.n - a.n || b.ca - a.ca).slice(0, 5).map((x) => ({ k: x.k, n: x.n, ca: x.ca })), sans: G.sansCle } : null);
export function releveParPeriode({ lignes, bornes, delaisPar, margesPar, periodes = PERIODES_STATS }) {
  if (!Array.isArray(lignes)) return null;
  const out = {};
  for (const p of periodes) {
    const B = bornes(p); if (!B) { out[p] = null; continue; }
    const L = lignes.filter((l) => l && Number.isFinite(l.ts) && l.ts >= B.de && (B.a == null || l.ts < B.a));
    const D = delaisPar(L, () => 'tout');
    const M = margesPar(L, () => 'tout');
    const g = M && M.groupes[0];
    const parMarque = margesPar(L, (l) => l.marqueLue || '');
    out[p] = {
      n: L.length,
      vitesse: D ? { mediane: D.mediane, nDelai: D.nDelai, n: D.n } : null,
      marge: g ? { pct: g.marge, brut: g.brut, nCout: g.nCout, n: g.n } : { pct: null, brut: null, nCout: 0, n: L.length },
      marques: parMarque ? { top: [...parMarque.groupes].sort((a, b) => b.ca - a.ca || b.n - a.n).slice(0, 5).map((x) => ({ k: x.k, n: x.n, ca: x.ca })), sansMarque: parMarque.sansCle } : null,
      // (21 nov., lot journee-stats) Les modèles (`modeleSur` : la marque LUE + un mot de modèle du titre, sinon rien) et les
      // tailles (la taille LUE de l'annonce reliée par SA transaction) — même règle de groupe que les marques.
      modeles: top5(margesPar(L, (l) => (l.modele && typeof l.modele === 'object' ? l.modele.nom : l.modele) || '')),
      tailles: top5(margesPar(L, (l) => l.taille || '')),
    };
  }
  return out;
}
