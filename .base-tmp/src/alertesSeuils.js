// ═══════════════════════════════════════════════════════════════════════════
// LES ALERTES DE SEUILS — À 80 %, PUIS À 100 %, UNE FOIS CHACUNE (15 nov., lot argent-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« vas-y fais tout ») : le plafond micro achat-revente (203 100 € en 2026), la
// franchise de TVA (85 000 € / 93 500 €) et DAC7 (30 ventes ou plus de 2 000 € par
// plateforme et par an), sur le CA de l'année civile TEL QUE L'APP LE CALCULE DÉJÀ —
// prévenir à 80 % puis à 100 %, une fois chacune, avec ce que ça implique en une phrase
// vraie et sourcée ; jamais de conseil fiscal inventé.
//
// AUCUN CHIFFRE N'EST RECALCULÉ ICI (§5) :
//   · le CA de l'année = `caAnnee` (src/microEntreprise.js) sur la ligne PUBLIÉE par
//     l'écran Ventes (`vinted_urssaf_mois`, datée au VERSEMENT) — la règle de la jauge
//     « Tes seuils » ; partiel ⇒ un MINIMUM (« au moins ») : un minimum au-dessus d'un
//     palier est une certitude, en dessous on ne dit rien (jamais « sous le seuil ») ;
//   · les seuils = `seuilsDe(année, activité)` (chiffres officiels vérifiés, rangés avec
//     leur source dans src/microEntreprise.js) ; une année sans chiffres vérifiés ⇒ rien ;
//   · DAC7 = `dac7ParPlateforme` et `atteintDac7` (src/seuilsAnnee.js : 30 ventes OU
//     PLUS de 2 000 €, en centimes entiers, plateforme par plateforme) ; une plateforme
//     pas lue ⇒ rien ; « atteint seulement avec les ventes pas encore datées » n'est
//     qu'une estimation ⇒ aucune alerte.
// LE RÉGIME N'EST JAMAIS DEVINÉ : plafond micro et TVA ne concernent qu'un
// micro-entrepreneur choisi (`regime === 'micro'`) ; aucun régime ⇒ seulement DAC7
// (c'est la plateforme qui transmet, quel que soit le statut du vendeur).
//
// LES PHRASES (une par seuil et par palier, 5 langues) disent ce que les textes
// officiels disent, rien de plus — chacune porte sa source :
//   · plafond micro (vente de marchandises) : F32353, entreprendre.service-public.gouv.fr
//     (« vérifié le 21 février 2026 ») — dépassé DEUX années de suite ⇒ sortie du
//     régime micro au 1er janvier suivant ; une seule année ne fait pas sortir ;
//   · franchise en base de TVA : F21746 (« vérifié le 1er janvier 2026 ») — au-delà de
//     85 000 € (sans 93 500 €) ⇒ TVA au 1er janvier suivant ; au-delà de 93 500 € ⇒ TVA
//     dès le jour du dépassement ;
//   · DAC7 : directive (UE) 2021/514 — la plateforme transmet à l'administration fiscale
//     les vendeurs qui font au moins 30 ventes ou plus de 2 000 € dans l'année, et leur
//     remet ces informations au plus tard le 31 janvier suivant.
// « Une fois chacune » : la clé `année:seuil[:plateforme]:palier`. Le registre des clés
// déjà dites est tenu par l'appelant (l'app : `vrm_seuils_vus`, sur SON « Compris » ;
// le serveur : son mémo de notification) — ici, seulement ce qui reste à dire.
// Module PUR (aucun accès au navigateur) : l'app, le serveur et l'audit l'importent.
// Exécuté par scripts/audit-argent-plus.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { caAnnee, seuilsDe } from './microEntreprise.js';
import { dac7ParPlateforme, atteintDac7, DAC7 } from './seuilsAnnee.js';

export const PALIERS = [80, 100];
export const PALIER_PROCHE = 80;
export const CLE_SEUILS_VUS = 'vrm_seuils_vus';

export const SOURCES_SEUILS = {
  micro: { nom: 'service-public.gouv.fr · F32353', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F32353' },
  tva: { nom: 'service-public.gouv.fr · F21746', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F21746' },
  tvaMajore: { nom: 'service-public.gouv.fr · F21746', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F21746' },
  dac7: { nom: 'Directive (UE) 2021/514 · DAC7', url: 'https://eur-lex.europa.eu/eli/dir/2021/514/oj' },
};

const palierDe = (ratio, depasse) => (depasse ? 100 : ratio * 100 >= PALIER_PROCHE ? 80 : null);

// Toutes les alertes ATTEINTES cette année (le plus haut palier de chaque seuil).
// `ligne` : `vinted_urssaf_mois` ; `regime` : celui qu'il a choisi (ou null/undefined) ;
// `activite` : 'vente' (défaut) | 'services' ; `now` : l'année civile (heure locale).
export function alertesSeuils({ ligne = null, now = new Date(), regime = null, activite = 'vente' } = {}) {
  const annee = now.getFullYear();
  const out = [];
  if (!ligne || !Array.isArray(ligne.mois)) return out;
  const s = seuilsDe(annee, activite === 'services' ? 'services' : 'vente');
  if (regime === 'micro' && s) {
    const cur = caAnnee(ligne, annee);
    if (cur && Number.isFinite(cur.ca)) {
      for (const [seuil, montant] of [['micro', s.plafondVente], ['tva', s.tvaBase], ['tvaMajore', s.tvaMajore]]) {
        if (!(montant > 0)) continue;
        // « Dépasse » : strictement au-dessus (le texte officiel), comparé en centimes.
        const depasse = Math.round(cur.ca * 100) > Math.round(montant * 100);
        const palier = palierDe(cur.ca / montant, depasse);
        if (!palier) continue;
        out.push({ cle: `${annee}:${seuil}:${palier}`, famille: `${annee}:${seuil}`, seuil, palier, annee, montant, ca: cur.ca, auMoins: !!cur.partiel,
          pct: Math.floor((cur.ca / montant) * 100), source: SOURCES_SEUILS[seuil] });
      }
    }
  }
  const D = dac7ParPlateforme({ ligne, annee });
  for (const p of (D && D.plateformes) || []) {
    if (!p || p.etat !== 'lu' || !Number.isFinite(p.n) || !Number.isFinite(p.centimes)) continue;
    const atteint = atteintDac7(p.n, p.centimes);
    const palier = palierDe(Math.max(p.n / DAC7.ventes, p.centimes / DAC7.centimes), atteint);
    if (!palier) continue;
    out.push({ cle: `${annee}:dac7:${p.plateforme}:${palier}`, famille: `${annee}:dac7:${p.plateforme}`, seuil: 'dac7', plateforme: p.plateforme, palier, annee,
      n: p.n, centimes: p.centimes, auMoins: !!p.partiel, source: SOURCES_SEUILS.dac7 });
  }
  return out;
}

// Ce qui RESTE à dire, une fois chacune : par seuil, le plus haut palier pas encore dit.
// Un 100 % atteint d'un coup (sans le 80 % dit avant) ne dit que le 100 % ; les deux clés
// sont à ranger (`marquer`). `vues` : un tableau, un Set ou un objet { clé: … }.
export function alertesADire(alertes, vues) {
  const dit = vues instanceof Set ? vues : new Set(Array.isArray(vues) ? vues.map(String) : vues && typeof vues === 'object' ? Object.keys(vues) : []);
  const out = [];
  for (const a of alertes || []) {
    if (!a || dit.has(a.cle)) continue;
    const marquer = PALIERS.filter((p) => p <= a.palier).map((p) => `${a.famille}:${p}`);
    out.push({ ...a, marquer });
  }
  return out;
}
// Le registre rangé, la clé ajoutée (objet { clé: horodatage }, jamais rien retiré).
export const vuesAvec = (vues, cles, quand = Date.now()) => {
  const base = vues && typeof vues === 'object' && !Array.isArray(vues) ? { ...vues } : {};
  for (const k of cles || []) if (!base[k]) base[k] = quand;
  return base;
};

// ── LES PHRASES, 5 LANGUES (une source pour l'app ET la notification) ───────
const LOC = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
const langueDe = (l) => (LOC[String(l || '').slice(0, 2)] ? String(l).slice(0, 2) : 'fr');
export const eurosSeuil = (x, langue = 'fr') => {
  try { return new Intl.NumberFormat(LOC[langueDe(langue)], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.floor(Number(x))); }
  catch (_) { return `${Math.floor(Number(x))} €`; }
};
const TXT = {
  fr: {
    titre: {
      micro: (a) => (a.palier === 100 ? `Plafond micro ${a.annee} dépassé` : `80 % du plafond micro ${a.annee}`),
      tva: (a) => (a.palier === 100 ? `Seuil de TVA ${a.annee} dépassé` : `80 % du seuil de TVA ${a.annee}`),
      tvaMajore: (a) => (a.palier === 100 ? `Seuil de TVA majoré dépassé` : `80 % du seuil de TVA majoré`),
      dac7: (a) => (a.palier === 100 ? `DAC7 ${a.plateforme} : seuil atteint` : `DAC7 ${a.plateforme} : 80 % du seuil`),
    },
    ou: (a, e) => (a.seuil === 'dac7' ? `${a.auMoins ? 'Au moins ' : ''}${a.n} vente${a.n > 1 ? 's' : ''} · ${e(a.centimes / 100)} sur ${a.plateforme} en ${a.annee}` : `${a.auMoins ? 'Au moins ' : ''}${e(a.ca)} sur ${e(a.montant)} en ${a.annee}`),
    phrase: {
      micro: (a) => (a.palier === 100 ? 'Dépassé deux années de suite, le régime micro s’arrête au 1er janvier suivant ; une seule année ne fait pas sortir.' : 'Au-delà du plafond deux années de suite, le régime micro s’arrête au 1er janvier suivant.'),
      tva: (a, e) => (a.palier === 100 ? `Au-delà de ${e(a.montant)} sans dépasser le seuil majoré, la TVA s’applique à partir du 1er janvier suivant.` : `Au-delà de ${e(a.montant)} dans l’année, la franchise de TVA s’arrête au 1er janvier suivant.`),
      tvaMajore: (a, e) => (a.palier === 100 ? 'Au-delà du seuil majoré, la TVA est due dès le jour du dépassement.' : `Au-delà de ${e(a.montant)} dans l’année, la TVA est due dès le jour du dépassement.`),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} transmet aux impôts le nombre et le montant de tes ventes de l’année, et te les remet avant le 31 janvier.` : `À 30 ventes ou plus de 2 000 € dans l’année, ${a.plateforme} transmet tes ventes aux impôts.`),
    },
    court: {
      micro: (a) => (a.palier === 100 ? 'Deux ans de suite au-dessus : sortie du régime micro au 1er janvier.' : 'Deux ans au-dessus du plafond : sortie du micro au 1er janvier.'),
      tva: (a) => (a.palier === 100 ? 'TVA à appliquer à partir du 1er janvier suivant.' : 'Au-delà, fin de la franchise de TVA au 1er janvier suivant.'),
      tvaMajore: (a) => (a.palier === 100 ? 'TVA due dès le jour du dépassement.' : 'Au-delà, TVA due dès le jour du dépassement.'),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} transmet tes ventes de l’année aux impôts.` : `À 30 ventes ou 2 000 €, ${a.plateforme} transmet tes ventes aux impôts.`),
    },
    source: 'Source',
  },
  en: {
    titre: {
      micro: (a) => (a.palier === 100 ? `Micro cap ${a.annee} exceeded` : `80% of the ${a.annee} micro cap`),
      tva: (a) => (a.palier === 100 ? `VAT threshold ${a.annee} exceeded` : `80% of the ${a.annee} VAT threshold`),
      tvaMajore: (a) => (a.palier === 100 ? 'Higher VAT threshold exceeded' : '80% of the higher VAT threshold'),
      dac7: (a) => (a.palier === 100 ? `DAC7 ${a.plateforme}: threshold reached` : `DAC7 ${a.plateforme}: 80% of threshold`),
    },
    ou: (a, e) => (a.seuil === 'dac7' ? `${a.auMoins ? 'At least ' : ''}${a.n} sale${a.n > 1 ? 's' : ''} · ${e(a.centimes / 100)} on ${a.plateforme} in ${a.annee}` : `${a.auMoins ? 'At least ' : ''}${e(a.ca)} of ${e(a.montant)} in ${a.annee}`),
    phrase: {
      micro: (a) => (a.palier === 100 ? 'Exceeded two years in a row, the micro scheme ends on the following 1 January; a single year does not end it.' : 'Above the cap two years in a row, the micro scheme ends on the following 1 January.'),
      tva: (a, e) => (a.palier === 100 ? `Above ${e(a.montant)} without passing the higher threshold, VAT applies from the following 1 January.` : `Above ${e(a.montant)} in the year, the VAT exemption ends on the following 1 January.`),
      tvaMajore: (a, e) => (a.palier === 100 ? 'Above the higher threshold, VAT is due from the day it is exceeded.' : `Above ${e(a.montant)} in the year, VAT is due from the day it is exceeded.`),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} reports the number and amount of your sales for the year to the tax office, and gives them to you before 31 January.` : `At 30 sales or more than €2,000 in the year, ${a.plateforme} reports your sales to the tax office.`),
    },
    court: {
      micro: (a) => (a.palier === 100 ? 'Two years in a row above: the micro scheme ends on 1 January.' : 'Two years above the cap: the micro scheme ends on 1 January.'),
      tva: (a) => (a.palier === 100 ? 'VAT applies from the following 1 January.' : 'Above it, the VAT exemption ends on the following 1 January.'),
      tvaMajore: (a) => (a.palier === 100 ? 'VAT due from the day it is exceeded.' : 'Above it, VAT is due from the day it is exceeded.'),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} reports your sales for the year to the tax office.` : `At 30 sales or €2,000, ${a.plateforme} reports your sales.`),
    },
    source: 'Source',
  },
  es: {
    titre: {
      micro: (a) => (a.palier === 100 ? `Límite micro ${a.annee} superado` : `80 % del límite micro ${a.annee}`),
      tva: (a) => (a.palier === 100 ? `Umbral de IVA ${a.annee} superado` : `80 % del umbral de IVA ${a.annee}`),
      tvaMajore: (a) => (a.palier === 100 ? 'Umbral de IVA mayor superado' : '80 % del umbral de IVA mayor'),
      dac7: (a) => (a.palier === 100 ? `DAC7 ${a.plateforme}: umbral alcanzado` : `DAC7 ${a.plateforme}: 80 % del umbral`),
    },
    ou: (a, e) => (a.seuil === 'dac7' ? `${a.auMoins ? 'Al menos ' : ''}${a.n} venta${a.n > 1 ? 's' : ''} · ${e(a.centimes / 100)} en ${a.plateforme} en ${a.annee}` : `${a.auMoins ? 'Al menos ' : ''}${e(a.ca)} de ${e(a.montant)} en ${a.annee}`),
    phrase: {
      micro: (a) => (a.palier === 100 ? 'Superado dos años seguidos, el régimen micro termina el 1 de enero siguiente; un solo año no basta.' : 'Por encima del límite dos años seguidos, el régimen micro termina el 1 de enero siguiente.'),
      tva: (a, e) => (a.palier === 100 ? `Por encima de ${e(a.montant)} sin superar el umbral mayor, el IVA se aplica desde el 1 de enero siguiente.` : `Por encima de ${e(a.montant)} en el año, la franquicia de IVA termina el 1 de enero siguiente.`),
      tvaMajore: (a, e) => (a.palier === 100 ? 'Por encima del umbral mayor, el IVA se debe desde el día en que se supera.' : `Por encima de ${e(a.montant)} en el año, el IVA se debe desde el día en que se supera.`),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} comunica a Hacienda el número y el importe de tus ventas del año, y te los entrega antes del 31 de enero.` : `Con 30 ventas o más de 2.000 € en el año, ${a.plateforme} comunica tus ventas a Hacienda.`),
    },
    court: {
      micro: (a) => (a.palier === 100 ? 'Dos años seguidos por encima: fin del régimen micro el 1 de enero.' : 'Dos años por encima del límite: fin del micro el 1 de enero.'),
      tva: (a) => (a.palier === 100 ? 'IVA aplicable desde el 1 de enero siguiente.' : 'Por encima, fin de la franquicia de IVA el 1 de enero siguiente.'),
      tvaMajore: (a) => (a.palier === 100 ? 'IVA debido desde el día en que se supera.' : 'Por encima, IVA debido desde el día en que se supera.'),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} comunica tus ventas del año a Hacienda.` : `Con 30 ventas o 2.000 €, ${a.plateforme} comunica tus ventas.`),
    },
    source: 'Fuente',
  },
  it: {
    titre: {
      micro: (a) => (a.palier === 100 ? `Limite micro ${a.annee} superato` : `80% del limite micro ${a.annee}`),
      tva: (a) => (a.palier === 100 ? `Soglia IVA ${a.annee} superata` : `80% della soglia IVA ${a.annee}`),
      tvaMajore: (a) => (a.palier === 100 ? 'Soglia IVA maggiorata superata' : '80% della soglia IVA maggiorata'),
      dac7: (a) => (a.palier === 100 ? `DAC7 ${a.plateforme}: soglia raggiunta` : `DAC7 ${a.plateforme}: 80% della soglia`),
    },
    ou: (a, e) => (a.seuil === 'dac7' ? `${a.auMoins ? 'Almeno ' : ''}${a.n} vendit${a.n > 1 ? 'e' : 'a'} · ${e(a.centimes / 100)} su ${a.plateforme} nel ${a.annee}` : `${a.auMoins ? 'Almeno ' : ''}${e(a.ca)} su ${e(a.montant)} nel ${a.annee}`),
    phrase: {
      micro: (a) => (a.palier === 100 ? 'Superato due anni di seguito, il regime micro termina il 1° gennaio successivo; un solo anno non basta.' : 'Oltre il limite due anni di seguito, il regime micro termina il 1° gennaio successivo.'),
      tva: (a, e) => (a.palier === 100 ? `Oltre ${e(a.montant)} senza superare la soglia maggiorata, l’IVA si applica dal 1° gennaio successivo.` : `Oltre ${e(a.montant)} nell’anno, la franchigia IVA termina il 1° gennaio successivo.`),
      tvaMajore: (a, e) => (a.palier === 100 ? 'Oltre la soglia maggiorata, l’IVA è dovuta dal giorno del superamento.' : `Oltre ${e(a.montant)} nell’anno, l’IVA è dovuta dal giorno del superamento.`),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} comunica al fisco il numero e l’importo delle tue vendite dell’anno, e te li consegna entro il 31 gennaio.` : `Con 30 vendite o più di 2.000 € nell’anno, ${a.plateforme} comunica le tue vendite al fisco.`),
    },
    court: {
      micro: (a) => (a.palier === 100 ? 'Due anni di seguito oltre: fine del regime micro il 1° gennaio.' : 'Due anni oltre il limite: fine del micro il 1° gennaio.'),
      tva: (a) => (a.palier === 100 ? 'IVA da applicare dal 1° gennaio successivo.' : 'Oltre, fine della franchigia IVA il 1° gennaio successivo.'),
      tvaMajore: (a) => (a.palier === 100 ? 'IVA dovuta dal giorno del superamento.' : 'Oltre, IVA dovuta dal giorno del superamento.'),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} comunica al fisco le tue vendite dell’anno.` : `Con 30 vendite o 2.000 €, ${a.plateforme} comunica le tue vendite.`),
    },
    source: 'Fonte',
  },
  de: {
    titre: {
      micro: (a) => (a.palier === 100 ? `Micro-Grenze ${a.annee} überschritten` : `80 % der Micro-Grenze ${a.annee}`),
      tva: (a) => (a.palier === 100 ? `MwSt-Schwelle ${a.annee} überschritten` : `80 % der MwSt-Schwelle ${a.annee}`),
      tvaMajore: (a) => (a.palier === 100 ? 'Erhöhte MwSt-Schwelle überschritten' : '80 % der erhöhten MwSt-Schwelle'),
      dac7: (a) => (a.palier === 100 ? `DAC7 ${a.plateforme}: Schwelle erreicht` : `DAC7 ${a.plateforme}: 80 % der Schwelle`),
    },
    ou: (a, e) => (a.seuil === 'dac7' ? `${a.auMoins ? 'Mindestens ' : ''}${a.n} Verk${a.n > 1 ? 'äufe' : 'auf'} · ${e(a.centimes / 100)} auf ${a.plateforme} ${a.annee}` : `${a.auMoins ? 'Mindestens ' : ''}${e(a.ca)} von ${e(a.montant)} ${a.annee}`),
    phrase: {
      micro: (a) => (a.palier === 100 ? 'Zwei Jahre in Folge überschritten, endet die Micro-Regelung am folgenden 1. Januar; ein einzelnes Jahr reicht nicht.' : 'Zwei Jahre in Folge über der Grenze, endet die Micro-Regelung am folgenden 1. Januar.'),
      tva: (a, e) => (a.palier === 100 ? `Über ${e(a.montant)}, ohne die erhöhte Schwelle zu überschreiten, gilt die MwSt ab dem folgenden 1. Januar.` : `Über ${e(a.montant)} im Jahr endet die MwSt-Befreiung am folgenden 1. Januar.`),
      tvaMajore: (a, e) => (a.palier === 100 ? 'Über der erhöhten Schwelle ist die MwSt ab dem Tag der Überschreitung fällig.' : `Über ${e(a.montant)} im Jahr ist die MwSt ab dem Tag der Überschreitung fällig.`),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} meldet dem Finanzamt Anzahl und Betrag deiner Verkäufe des Jahres und gibt sie dir vor dem 31. Januar.` : `Ab 30 Verkäufen oder mehr als 2.000 € im Jahr meldet ${a.plateforme} deine Verkäufe dem Finanzamt.`),
    },
    court: {
      micro: (a) => (a.palier === 100 ? 'Zwei Jahre in Folge darüber: Micro-Regelung endet am 1. Januar.' : 'Zwei Jahre über der Grenze: Micro endet am 1. Januar.'),
      tva: (a) => (a.palier === 100 ? 'MwSt gilt ab dem folgenden 1. Januar.' : 'Darüber endet die MwSt-Befreiung am folgenden 1. Januar.'),
      tvaMajore: (a) => (a.palier === 100 ? 'MwSt ab dem Tag der Überschreitung fällig.' : 'Darüber ist die MwSt ab dem Tag der Überschreitung fällig.'),
      dac7: (a) => (a.palier === 100 ? `${a.plateforme} meldet deine Verkäufe des Jahres dem Finanzamt.` : `Ab 30 Verkäufen oder 2.000 € meldet ${a.plateforme} deine Verkäufe.`),
    },
    source: 'Quelle',
  },
};
// Le texte d'une alerte dans une langue : { titre, ou, phrase, court, source }.
export function texteSeuil(a, langue = 'fr') {
  if (!a || !TXT.fr.titre[a.seuil]) return null;
  const l = langueDe(langue), T = TXT[l];
  const e = (x) => eurosSeuil(x, l);
  return { titre: T.titre[a.seuil](a), ou: T.ou(a, e), phrase: T.phrase[a.seuil](a, e), court: T.court[a.seuil](a, e), source: `${T.source} : ${a.source ? a.source.nom : ''}`, url: a.source ? a.source.url : '' };
}
