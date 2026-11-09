// ═══════════════════════════════════════════════════════════════════════════
// LA VEILLE DES PLANTAGES (6 nov., filet 4 « l'app ne bug jamais »)
// ═══════════════════════════════════════════════════════════════════════════
// Le journal des plantages (src/plantages.js) range chaque erreur de l'app dans
// `app_data` (`plantage_{empreinte}`, au nom du vendeur, sans donnée
// personnelle). Personne ne le lisait sans ouvrir Réglages : un écran mort chez
// un AUTRE vendeur ne se voyait jamais.
//
// Ici, au cron du matin (api/ship-reminders.js — PAS une 13ᵉ fonction) :
//   1. UNE lecture projetée (jamais `select=data`, §4.4) des plantages notés
//      depuis la dernière veille (48 h au plus), tous vendeurs (clé de service) ;
//   2. le bruit connu écarté : la liste BRUIT de src/plantages.js (importée,
//      jamais recopiée), les morceaux d'un ancien déploiement (rattrapés par un
//      rechargement, comptés à part : `estMorceauPerime`), les signalements de la
//      politique de contenu (`CSP …`, ce ne sont pas des plantages) ;
//   3. regroupés par message NORMALISÉ (les noms minifiés et les fichiers hachés
//      changent à chaque déploiement : la même erreur garde la même clé) ;
//   4. un groupe JAMAIS VU (absent du mémo `veille_plantages` du propriétaire)
//      ⇒ UNE notification au PROPRIÉTAIRE de l'installation (VRM_OWNER_UID)
//      seulement, jamais à un vendeur ; une fois par type.
// Le mémo est écrit AVANT d'envoyer : un mémo pas écrit ⇒ rien n'est envoyé
// (sinon la même notification repartirait chaque matin). Une lecture ratée
// n'écrit rien et n'envoie rien (« rien lu » ne vaut pas « rien »).
// L'app n'y gagne AUCUNE lecture : tout se passe sur le serveur.
// ═══════════════════════════════════════════════════════════════════════════
import { BRUIT, estMorceauPerime } from '../../src/plantages.js';
import { degradations, jourParis, texteLenteurs, SEUIL_DEGRADATION } from '../../src/mesuresTerrain.js';

export const ID_MEMO_VEILLE = 'veille_plantages';
export const FENETRE_MAX_MS = 48 * 3600e3;
export const MEMO_MAX = 200;   // le mémo reste une petite ligne (~20 Ko au plus)

// Les écrans, dits comme dans l'app (les noms de `tab`).
const ECRANS = {
  journee: 'Ma journée', ventes: 'Ventes', annonces: 'Annonces', messages: 'Messages', achats: 'Achats',
  cat_bord: 'Colis', cat_expedition: 'Colis', cat_annonces: 'Annonces', cat_ventes: 'Ventes',
  settings: 'Réglages', vintedaccounts: 'Comptes liés', compta: 'Comptabilité', comptabilite: 'Comptabilité',
  dashboard: 'Statistiques', garage: 'Stock', emails: 'E-mails', communaute: 'Communauté',
  organisation: 'Organisation', inventory: 'Inventaire', catalog: 'Catalogue', sales: 'Ventes (ancien)',
  stockvinted: 'Stock Vinted', masques: 'Masqués', fiche: 'Fiche d’une paire', prix: 'Le prix partout',
  publier: 'Publier ailleurs', bienvenue: 'Bienvenue', visite: 'Visite', sauvegarde: 'Sauvegarde',
  coque: 'la coque', recherche: 'Recherche',
};
export function nomEcran(ecran) {
  const brut = String(ecran || '').trim();
  if (!brut) return '';
  const tete = brut.split(/[:/]/)[0];
  return ECRANS[tete] || ECRANS[brut] || tete;
}
export function nomAppareil(nav) {
  const n = String(nav || '');
  if (/^iOS/.test(n)) return 'iPhone';
  if (/^Android/.test(n)) return 'Android';
  if (/^Mac/.test(n)) return 'Mac';
  if (/^Windows/.test(n)) return 'Windows';
  return n.trim();
}

// La clé d'un TYPE de plantage : le message sans ce qui change d'un déploiement
// ou d'une fois à l'autre (noms minifiés de 1 à 3 lettres, fichiers hachés,
// chiffres). Deux bugs différents gardent deux clés.
export function normaliserMessage(message) {
  return String(message || '')
    .replace(/\/assets\/([A-Za-z0-9_]+)-[A-Za-z0-9_-]{6,}\.(js|css)/g, '/assets/$1.$2')
    .replace(/(['"`])[A-Za-z_$][\w$]{0,2}\1/g, '$1?$1')
    .replace(/(?<![.\w$])[A-Za-z_$][\w$]{0,2}(?=( is not (defined|a function|a constructor|iterable)| before initialization))/g, '?')
    .replace(/(?<![.\w$])[A-Za-z_$][\w$]{0,2}(?=\.[\w$]+ is not a function)/g, '?')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 200);
}
// Une empreinte courte et stable de la clé (FNV-1a), pour le mémo.
export function cleType(message) {
  const t = normaliserMessage(message);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export function estBruit(l) {
  const m = String((l && l.message) || '');
  if (!m) return true;
  if (BRUIT.test(m)) return true;
  if (estMorceauPerime(m)) return true;
  if (String((l && l.origine) || '') === 'csp' || /^CSP /.test(m)) return true;
  return false;
}

// Les lignes lues ⇒ des groupes par type. `depuis` (ms) : seules les lignes
// notées depuis comptent.
export function regrouper(lignes, depuis = 0) {
  const groupes = new Map();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || estBruit(l)) continue;
    const t = Date.parse(l.at || '') || 0;
    if (!t || t < depuis) continue;
    const cle = cleType(l.message);
    let g = groupes.get(cle);
    if (!g) { g = { cle, message: String(l.message).slice(0, 200), ecrans: new Set(), appareils: new Set(), vendeurs: new Set(), n: 0, premier: t, dernier: t }; groupes.set(cle, g); }
    g.n += 1;
    const e = nomEcran(l.ecran); if (e) g.ecrans.add(e);
    const a = nomAppareil(l.navigateur); if (a) g.appareils.add(a);
    if (l.owner) g.vendeurs.add(String(l.owner));
    g.premier = Math.min(g.premier, t); g.dernier = Math.max(g.dernier, t);
  }
  return [...groupes.values()].sort((a, b) => a.premier - b.premier);
}

export function nouveauxGroupes(groupes, memo) {
  const vus = (memo && memo.vus && typeof memo.vus === 'object') ? memo.vus : {};
  return (groupes || []).filter((g) => !vus[g.cle]);
}

const entreParentheses = (g) => {
  const morceaux = [[...g.ecrans].slice(0, 2).join(', '), [...g.appareils].slice(0, 2).join(', ')].filter(Boolean);
  return morceaux.length ? ` (${morceaux.join(', ')})` : '';
};
// « VRM : un écran a planté (Colis, iPhone) — c'est noté, on corrige. »
export function texteVeille(nouveaux) {
  if (!nouveaux || !nouveaux.length) return null;
  if (nouveaux.length === 1) {
    const g = nouveaux[0];
    const quoi = g.ecrans.size ? 'un écran a planté' : 'l’app a planté';
    return { title: quoi.charAt(0).toUpperCase() + quoi.slice(1), body: `${entreParentheses(g).replace(/^ \(|\)$/g, '') || 'Chez un vendeur'} · détail dans Réglages → Sécurité des données.` };
  }
  const detail = nouveaux.slice(0, 3).map((g) => entreParentheses(g).replace(/^ \(|\)$/g, '')).filter(Boolean).join(' · ');
  return { title: `${nouveaux.length} nouveaux plantages`, body: `${detail ? detail + ' · ' : ''}détail dans Réglages → Sécurité des données.` };
}

// Le mémo après cette veille : les types déjà connus, plus les nouveaux, bornés.
export function memoApres(memo, nouveaux, maintenant) {
  const vus = Object.assign({}, (memo && memo.vus && typeof memo.vus === 'object') ? memo.vus : {});
  for (const g of nouveaux) vus[g.cle] = { at: new Date(maintenant).toISOString(), message: g.message.slice(0, 80) };
  const garder = Object.keys(vus).sort((a, b) => String((vus[b] && vus[b].at) || '').localeCompare(String((vus[a] && vus[a].at) || ''))).slice(0, MEMO_MAX);
  return { vus: Object.fromEntries(garder.map((k) => [k, vus[k]])), derniere: new Date(maintenant).toISOString() };
}

// Le passage complet, ses entrées et sorties injectées (le cron les branche sur
// la base et les notifications ; l'audit les joue avec des lectures ratées).
//   lireMemo()            → objet · null (absent) · undefined (pas su)
//   lireLignes(depuisIso) → tableau · null (pas su)
//   ecrireMemo(memo)      → true seulement si la base a confirmé
//   envoyer(notif)        → résultat de l'envoi
export async function passageVeillePlantages({ proprietaire, maintenant = Date.now(), lireMemo, lireLignes, ecrireMemo, envoyer }) {
  if (!proprietaire) return { fait: false, raison: 'VRM_OWNER_UID absent : personne à prévenir' };
  const memo = await lireMemo();
  if (memo === undefined) return { fait: false, raison: 'mémo illisible : rien envoyé' };
  const derniere = Date.parse((memo && memo.derniere) || '') || 0;
  const depuis = Math.max(maintenant - FENETRE_MAX_MS, derniere ? derniere - 3600e3 : 0);
  const lignes = await lireLignes(new Date(depuis).toISOString());
  if (!Array.isArray(lignes)) return { fait: false, raison: 'plantages illisibles : rien envoyé' };
  const groupes = regrouper(lignes, depuis);
  const nouveaux = nouveauxGroupes(groupes, memo);
  const suite = memoApres(memo, nouveaux, maintenant);
  if (!nouveaux.length) {
    await ecrireMemo(suite);   // l'heure de passage seulement ; un échec ne coûte rien
    return { fait: true, lus: lignes.length, types: groupes.length, nouveaux: 0, envoye: false };
  }
  if (!(await ecrireMemo(suite))) return { fait: false, raison: 'mémo pas écrit : rien envoyé (sinon chaque matin)', nouveaux: nouveaux.length };
  const notif = texteVeille(nouveaux);
  let envoi = null;
  try { envoi = await envoyer({ ...notif, url: '/?tab=settings', tag: 'vrm-veille-plantages' }); } catch (e) { envoi = { erreur: String((e && e.message) || e).slice(0, 120) }; }
  return { fait: true, lus: lignes.length, types: groupes.length, nouveaux: nouveaux.length, envoye: true, texte: notif.body, envoi };
}

// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., v36) LA VEILLE DES LENTEURS — dans la même veille du matin.
// ═══════════════════════════════════════════════════════════════════════════
// Les temps réels des vendeurs (src/mesuresTerrain.js, api/_lib/mesures-terrain.js)
// sont rangés en agrégats par jour de Paris. Chaque matin : hier (jour complet)
// contre avant-hier ; un écran dont le p75 (premier écran utile ou réponse au
// toucher) monte de plus de 30 %, sur au moins 20 mesures chaque jour, ⇒ UNE
// notification au PROPRIÉTAIRE de l'installation, une fois par jour (mémo
// `veille_lenteurs`, écrit AVANT d'envoyer, comme les plantages). Une lecture
// ratée n'écrit rien et n'envoie rien ; moins de deux jours mesurés ⇒ rien.
//   lireMemo()        → objet · null (absent) · undefined (pas su)
//   lireJours(jours)  → { [jour]: histogrammes | null (pas de ligne) } · null (pas su)
//   ecrireMemo(memo)  → true seulement si la base a confirmé
export const ID_MEMO_LENTEURS = 'veille_lenteurs';
export async function passageVeilleLenteurs({ proprietaire, maintenant = Date.now(), lireMemo, lireJours, ecrireMemo, envoyer }) {
  if (!proprietaire) return { fait: false, raison: 'VRM_OWNER_UID absent : personne à prévenir' };
  const hier = jourParis(maintenant - 864e5), avant = jourParis(maintenant - 2 * 864e5);
  const memo = await lireMemo();
  if (memo === undefined) return { fait: false, raison: 'mémo illisible : rien envoyé' };
  if (memo && memo.jour === hier) return { fait: true, deja: true, jour: hier };
  const jours = await lireJours([avant, hier]);
  if (!jours || typeof jours !== 'object') return { fait: false, raison: 'mesures illisibles : rien envoyé' };
  if (!jours[hier] || !jours[avant]) return { fait: true, jour: hier, compare: false, raison: 'pas deux jours de mesures' };
  const liste = degradations(jours[avant], jours[hier], { seuil: SEUIL_DEGRADATION });
  if (!liste.length) { await ecrireMemo({ jour: hier, n: 0 }); return { fait: true, jour: hier, degradations: 0, envoye: false }; }
  if (!(await ecrireMemo({ jour: hier, n: liste.length, liste: liste.slice(0, 10) }))) return { fait: false, raison: 'mémo pas écrit : rien envoyé (sinon chaque matin)', degradations: liste.length };
  const notif = texteLenteurs(liste, nomEcran);
  let envoi = null;
  try { envoi = await envoyer({ ...notif, url: '/?tab=settings', tag: 'vrm-veille-lenteurs' }); } catch (e) { envoi = { erreur: String((e && e.message) || e).slice(0, 120) }; }
  return { fait: true, jour: hier, degradations: liste.length, envoye: true, texte: notif.body, envoi };
}
