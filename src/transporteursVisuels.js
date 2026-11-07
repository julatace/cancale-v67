// ════════════════════════════════════════════════════════════════════════════
//  LES TRANSPORTEURS, À L'ÉCRAN — UN module (2 nov., §11)
//  Julien : « quand je fais une vente, je veux qu'à côté du bouton bordereau,
//  ça soit marqué Chronopost avec le logo Chronopost ou Mondial Relay avec le
//  logo Mondial Relay. Que ça soit pour les ventes et les achats » ; « dans les
//  colis je veux que tu mettes les transporteurs, après on fera des stats ».
//
//  Ici : QUI transporte un colis (`transporteurDuColis`) et COMMENT on l'écrit
//  (nom + logo). Une seule source pour chaque carte de colis, et pour les
//  statistiques à venir (`cleStatTransporteur`, posée en `data-transporteur`).
//
//  ⚠️ LE TRANSPORTEUR EST TOUJOURS LU, JAMAIS DEVINÉ (§5). Dans l'ordre :
//    1. la ligne lue CHEZ le transporteur pour ce n° (`transp_{c}_{n°}`, écrite
//       par le serveur seul) — c'est lui qui a répondu ;
//    2. ce que la PLATEFORME écrit (Vestiaire « Chronopost », Leboncoin
//       `deliveryMethod`, la conversation Vinted d'un achat, le transporteur
//       d'un e-mail) — et un e-mail de transporteur du MÊME n° ;
//    3. la FORME du n° quand elle ne désigne qu'un transporteur
//       (`transporteurDeForme` : 8 chiffres, 2 lettres + 9 chiffres + 2 lettres,
//       « VGS… » — mesurée sur ses 193 n°).
//  Rien de tout ça ⇒ « Transporteur pas lu », sans logo. Un e-mail
//  `shipping@relay.vinted.com` est rangé « vinted » PAR DÉFAUT par la route des
//  e-mails : ce n'est pas une preuve face à un transporteur NOMMÉ du même n°, ni
//  face à un n° de forme Chronopost stricte (la règle de `carrierLisible`).
//
//  ⚠️ LES LOGOS : jamais redessinés ici. L'image affichée est celle que le
//  transporteur publie lui-même sur SON domaine (son icône de site). Non
//  mesurées d'ici (le réseau de la machine est fermé) : chaque image peut
//  échouer, et la pastille retombe alors sur le nom seul, sans image cassée
//  (`PastilleTransporteur`). Un transporteur sans adresse sûre n'a pas de logo.
// ════════════════════════════════════════════════════════════════════════════
import { transporteurDeForme, colisInternational } from '../api/_lib/suivi-colis.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';

export const PAS_LU = 'Transporteur inconnu';  // (3 nov., critique #15) des mots simples, pas « pas lu »

// `logos` : adresses sur le domaine officiel du transporteur, essayées dans
// l'ordre (la première qui se charge gagne).
export const TRANSPORTEURS = Object.freeze({
  chronopost:   { nom: 'Chronopost',    logos: ['https://www.chronopost.fr/favicon.ico'] },
  mondialrelay: { nom: 'Mondial Relay', logos: ['https://www.mondialrelay.fr/favicon.ico'] },
  colissimo:    { nom: 'Colissimo',     logos: ['https://www.laposte.fr/favicon.ico'] },
  vinted:       { nom: 'Vinted Go',     logos: ['https://vintedgo.com/favicon.ico'] },
  relaiscolis:  { nom: 'Relais Colis',  logos: ['https://www.relaiscolis.com/favicon.ico'] },
  dpd:          { nom: 'DPD',           logos: ['https://www.dpd.fr/favicon.ico'] },
  ups:          { nom: 'UPS',           logos: ['https://www.ups.com/favicon.ico'] },
  gls:          { nom: 'GLS',           logos: ['https://gls-group.com/favicon.ico'] },
  colisprive:   { nom: 'Colis Privé',   logos: ['https://www.colisprive.com/favicon.ico'] },
  // Shop2Shop (réseau Chronopost) : aucune adresse de logo sûre ⇒ le nom seul.
  shop2shop:    { nom: 'Shop2Shop',     logos: [] },
  inpost:       { nom: 'InPost',        logos: ['https://inpost.fr/favicon.ico'] },
  dhl:          { nom: 'DHL',           logos: ['https://www.dhl.com/favicon.ico'] },
  fedex:        { nom: 'FedEx',         logos: ['https://www.fedex.com/favicon.ico'] },
});

const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le transporteur d'un TEXTE écrit par une source (clé rangée « mondialrelay »,
// libellé « Mondial Relay », `deliveryMethod` « mondial_relay »…). `null` si
// le texte ne nomme aucun transporteur connu (« autre », vide, inconnu).
export function cleTransporteur(raw) {
  const s = sansAccents(raw).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/mondial/.test(s)) return 'mondialrelay';
  if (/shop ?2 ?shop/.test(s)) return 'shop2shop';
  if (/chrono|pickup/.test(s)) return 'chronopost';
  if (/relais ?colis/.test(s)) return 'relaiscolis';
  if (/colis ?prive/.test(s)) return 'colisprive';
  if (/coliss|la ?poste|laposte/.test(s)) return 'colissimo';
  if (/vinted/.test(s)) return 'vinted';
  if (/inpost/.test(s)) return 'inpost';
  if (/\bdpd\b/.test(s)) return 'dpd';
  if (/\bups\b/.test(s)) return 'ups';
  if (/\bgls\b/.test(s)) return 'gls';
  if (/\bdhl\b/.test(s)) return 'dhl';
  if (/fedex/.test(s)) return 'fedex';
  return null;
}

export const nomDuTransporteur = (cle) => (cle && TRANSPORTEURS[cle] ? TRANSPORTEURS[cle].nom : '');
export const logosDuTransporteur = (cle) => (cle && TRANSPORTEURS[cle] ? TRANSPORTEURS[cle].logos.slice() : []);

const CHRONO_STRICT = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
// Un transporteur NOMMÉ l'emporte sur « vinted » (le défaut d'un e-mail shipping@).
const rang = (c) => (!c ? 0 : c === 'vinted' ? 1 : 2);

const ligneTranspDe = (transp, n) => {
  if (!transp || !n) return null;
  if (typeof transp.get === 'function') return transp.get(n) || null;
  if (Array.isArray(transp)) return transp.find((t) => t && normaliserSuivi(t.suivi) === n) || null;
  return null;
};

// Le transporteur d'UN colis. Entrées (toutes facultatives) :
//   declare     — le texte qu'écrit la plateforme ou l'e-mail du colis ;
//   suivi       — son n° de suivi ;
//   transp      — les lignes lues chez les transporteurs (Map par n° ou liste) ;
//   suivisEmail — les e-mails de suivi (`email_track_*`, { suivi, carrier }).
// Rend { cle, nom, source } — `cle` null et `nom` '' quand rien n'est lu ;
// `nom` seul (cle null) quand la plateforme écrit un transporteur que VRM ne
// connaît pas : il est LU, on le recopie tel quel, sans logo.
// `source` : 'transporteur' · 'plateforme' · 'email' · 'forme' · null.
// (7 nov., vitesse) Les e-mails de suivi rangés par n° normalisé, une fois par
// liste (la liste est une valeur : une nouvelle lecture est une nouvelle liste).
// Avant : chaque colis relisait et renormalisait TOUS les e-mails (Colis :
// ~0,5 s au téléphone). Mêmes lignes, dans le même ordre.
const _emailsParSuivi = new WeakMap();
function emailsDuSuivi(liste, n) {
  let m = _emailsParSuivi.get(liste);
  if (!m) {
    m = new Map();
    for (const l of liste) {
      if (!l) continue;
      const k = normaliserSuivi(l.suivi);
      if (!k) continue;
      const a = m.get(k); if (a) a.push(l); else m.set(k, [l]);
    }
    _emailsParSuivi.set(liste, m);
  }
  return m.get(n) || [];
}

export function transporteurDuColis({ declare = '', suivi = '', transp = null, suivisEmail = null } = {}) {
  const n = normaliserSuivi(suivi);
  const t = ligneTranspDe(transp, n);
  // (6 nov.) La ligne du transporteur ne NOMME le transporteur que s'il a RÉPONDU
  // (un état lu, une lecture datée) : une ligne `transp_chronopost_…` créée par un
  // essai qui n'a jamais abouti n'est que l'endroit où on a frappé, pas une preuve.
  // ⚠️ (6 nov., statut des colis) `fini` n'est PAS une réponse : le serveur le pose aussi
  // quand il ABANDONNE (« introuvable » trois fois, suivi expiré — `finiApres`). Mesuré sur sa
  // base : 3 lignes `transp_chronopost_…IE` « introuvable », fini, jamais lues, nommaient
  // « Chronopost » sur un colis postal irlandais. Seule une lecture réussie nomme.
  const cT = t && (t.lu || t.etat) ? cleTransporteur(t.carrier) : null;
  if (cT) return { cle: cT, nom: nomDuTransporteur(cT), source: 'transporteur' };
  let cle = null, source = null;
  const prendre = (c, s) => { if (c && rang(c) > rang(cle)) { cle = c; source = s; } };
  let cD = cleTransporteur(declare);
  // Le « vinted » par défaut d'un e-mail ne vaut rien face à un n° Chronopost strict.
  if (cD === 'vinted' && CHRONO_STRICT.test(n)) cD = null;
  prendre(cD, 'plateforme');
  if (n && Array.isArray(suivisEmail)) {
    for (const l of emailsDuSuivi(suivisEmail, n)) {
      let c = cleTransporteur(l.carrier);
      if (c === 'vinted' && CHRONO_STRICT.test(n)) c = null;
      prendre(c, 'email');
    }
  }
  if (cle && rang(cle) === 2) return { cle, nom: nomDuTransporteur(cle), source };
  const cF = n ? transporteurDeForme(n) : null;
  if (cF) return { cle: cF, nom: nomDuTransporteur(cF), source: 'forme' };
  if (cle) return { cle, nom: nomDuTransporteur(cle), source };
  // (6 nov.) Un n° postal international (S10 « …IE ») : son PAYS, lu dans le n°,
  // jamais un transporteur deviné (suivi-colis.js, `colisInternational`).
  const inter = colisInternational(n);
  if (inter && !String(declare || '').trim()) return { cle: null, nom: inter, source: 'pays' };
  // Un transporteur écrit mais inconnu de VRM : recopié tel quel (borné).
  const brut = String(declare == null ? '' : declare).replace(/\s+/g, ' ').trim();
  if (brut && !/^(autre|generic|transporteur|colis|other)$/i.test(brut) && !/^[a-z0-9_]+$/.test(brut)) return { cle: null, nom: brut.slice(0, 30), source: 'plateforme' };
  return { cle: null, nom: '', source: null };
}

// La clé pour les STATISTIQUES par transporteur (une seule source, celle de la
// carte) : la clé connue, « autre » pour un nom lu mais inconnu, « pas-lu ».
export const cleStatTransporteur = (t) => (t && t.cle ? t.cle : (t && t.nom ? 'autre' : 'pas-lu'));
