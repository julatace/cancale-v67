// ══════════════════════════════════════════════════════════════════════════════
//  LES QUESTIONS FRÉQUENTES REPÉRÉES DANS UN MESSAGE (14 nov., lot messages-achats-plus, n° 109)
//  docs/passation/2026-11-14-messages-achats-plus.md
// ══════════════════════════════════════════════════════════════════════════════
// « Dispo ? », « quelle taille ? », « des défauts ? » : VRM repère la question par
// une liste FERMÉE de mots, par langue (fr, en, es, it, de), et PROPOSE une réponse
// — c'est tout. AUCUNE IA, aucune clé, aucun appel réseau (§2.9) : ce module ne
// fait que comparer des mots. La réponse proposée :
//   · va dans le champ de réponse sur SON toucher, il la relit, et SON clic envoie ;
//   · ne contient que ce qui est SU : la taille de la fiche, et les infos qu'il a
//     écrites (src/infosPaire.js). Une réponse qui aurait besoin d'une info absente
//     n'est PAS proposée (elle dit ce qui manque) — on ne devine jamais une taille ;
//   · « Oui, toujours disponible » n'est jamais proposée sous une annonce PROUVÉE
//     partie (la même règle que les réponses rapides, `rapidesDuFil`).
// La langue de la réponse est celle du MESSAGE (mots repérés), sinon celle de l'app.
// Module PUR : exécuté par scripts/audit-messages-achats-plus.cjs (40 messages, 5 langues).
// ══════════════════════════════════════════════════════════════════════════════
import { phraseInfo } from './infosPaire.js';

export const LANGUES_MESSAGE = ['fr', 'en', 'es', 'it', 'de'];
export const SUJETS = ['dispo', 'taille', 'etat', 'mesures', 'prix', 'envoi', 'mainpropre'];

// Minuscules, sans accents, ponctuation ⇒ espace ; « größe » ⇒ « grosse ».
export function normaliser(t) {
  return ' ' + String(t == null ? '' : t).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ').replace(/[^a-z0-9½]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

// Les mots de chaque sujet. Un mot se repère ENTIER ; « mot* » repère le début d'un
// mot (« expedi* » : expédie, expédition…) ; une expression est une suite de mots.
export const MOTS = {
  dispo: {
    fr: ['dispo', 'disponible', 'toujours dispo*', 'encore dispo*', 'toujours en vente', 'encore en vente', 'toujours la', 'est elle vendue', 'deja vendu*'],
    en: ['available', 'still available', 'still have', 'still for sale', 'is it sold', 'sold already', 'still got'],
    es: ['disponible', 'sigue disponible', 'aun disponible', 'todavia disponible', 'lo tienes', 'la tienes', 'sigue a la venta', 'esta vendid*'],
    it: ['disponibile', 'ancora disponibile', 'e ancora', 'ce l hai ancora', 'ancora in vendita', 'gia vendut*'],
    de: ['verfugbar', 'noch verfugbar', 'noch da', 'noch zu haben', 'noch zu verkaufen', 'schon verkauft', 'noch erhaltlich'],
  },
  taille: {
    fr: ['taille', 'tailles', 'pointure', 'chausse*', 'taille grand', 'taille petit', 'taille normalement'],
    en: ['size', 'sizing', 'fit', 'fits', 'true to size', 'run small', 'run big', 'runs small', 'runs big', 'tts'],
    es: ['talla', 'tallaje', 'horma', 'numero calzas', 'que numero'],
    it: ['taglia', 'calzata', 'vestibilita', 'calza*', 'che numero'],
    de: ['grosse', 'passform', 'fallt klein', 'fallt gross', 'fallen klein', 'fallen gross', 'fallt normal', 'schuhgrosse'],
  },
  etat: {
    fr: ['defaut', 'defauts', 'etat', 'abime*', 'tache', 'taches', 'usure', 'usee', 'trou', 'rayure*', 'dechir*'],
    en: ['defect*', 'flaw', 'flaws', 'condition', 'damage*', 'stain*', 'scuff*', 'wear', 'worn', 'hole', 'scratch*'],
    es: ['defecto*', 'estado', 'mancha*', 'desgaste', 'rotura*', 'roto', 'rota', 'arañazo*', 'aranazo*', 'usad*'],
    it: ['difett*', 'condizion*', 'macchi*', 'usura', 'stato', 'rovinat*', 'graffi*', 'buco'],
    de: ['mangel', 'mangeln', 'zustand', 'fleck*', 'schaden', 'gebrauchsspuren', 'kratzer', 'loch', 'beschadig*'],
  },
  mesures: {
    fr: ['semelle', 'semelle interieure', 'longueur', 'mesure', 'mesures', 'cm', 'centimetre*'],
    en: ['insole', 'length', 'measure*', 'cm', 'inches', 'heel to toe'],
    es: ['plantilla', 'largo', 'longitud', 'medida*', 'cm', 'centimetro*'],
    it: ['soletta', 'lunghezza', 'misure', 'cm', 'centimetr*'],
    de: ['sohle', 'innensohle', 'lange', 'messen', 'cm', 'zentimeter'],
  },
  prix: {
    fr: ['prix', 'baisser', 'dernier prix', 'meilleur prix', 'negociable', 'negocier', 'reduc*', 'moins cher', 'petit geste'],
    en: ['price', 'lowest', 'best price', 'negotiable', 'discount', 'cheaper', 'last price', 'lower'],
    es: ['precio', 'rebaja*', 'negociable', 'descuento', 'ultimo precio', 'mas barato'],
    it: ['prezzo', 'sconto', 'trattabile', 'ultimo prezzo', 'meno caro'],
    de: ['preis', 'verhandelbar', 'rabatt', 'letzter preis', 'gunstiger', 'vb'],
  },
  envoi: {
    fr: ['envoi', 'envoyer', 'envoyez', 'expedi*', 'livraison', 'delai', 'delais', 'colis'],
    en: ['ship', 'shipping', 'ships', 'send', 'delivery', 'dispatch*'],
    es: ['envio', 'enviar', 'envias', 'entrega', 'mandar', 'mandas'],
    it: ['spedi*', 'invio', 'inviare', 'consegna'],
    de: ['versand', 'versenden', 'verschick*', 'lieferung', 'schickst'],
  },
  mainpropre: {
    fr: ['main propre', 'en main propre', 'remise en main', 'se voir', 'se rencontrer', 'recuperer sur place'],
    en: ['in person', 'meet up', 'meetup', 'pick up', 'pickup', 'collect in person'],
    es: ['en mano', 'quedar', 'en persona', 'recoger'],
    it: ['di persona', 'a mano', 'incontrarci', 'ritiro a mano', 'ritirare'],
    de: ['personlich', 'abholen', 'abholung', 'selbstabholung', 'treffen'],
  },
};
// Les petits mots qui disent la langue (en plus des mots des sujets).
const OUTILS = {
  fr: ['bonjour', 'bonsoir', 'salut', 'est', 'elle', 'il', 'encore', 'toujours', 'vous', 'merci', 'quelle', 'quel', 'svp', 'avez', 'c', 'est ce', 'je', 'oui', 'la', 'le', 'des', 'une'],
  en: ['hi', 'hello', 'hey', 'is', 'still', 'the', 'you', 'what', 'thanks', 'please', 'it', 'do', 'does', 'any', 'are', 'how', 'can'],
  es: ['hola', 'buenas', 'sigue', 'esta', 'gracias', 'que', 'tienes', 'el', 'por', 'favor', 'cual', 'hay', 'tiene', 'puedes', 'cuanto', 'es', 'la'],
  it: ['ciao', 'salve', 'ancora', 'grazie', 'che', 'sono', 'della', 'hai', 'quale', 'per', 'favore', 'puoi', 'il', 'e', 'la', 'ci'],
  de: ['hallo', 'hi', 'ist', 'noch', 'danke', 'die', 'der', 'das', 'sie', 'du', 'welche', 'gibt', 'es', 'wie', 'bitte', 'kannst', 'haben'],
};

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const _re = new Map();
function motRe(m) {
  if (!_re.has(m)) {
    const prefixe = m.endsWith('*');
    const corps = echapper(normaliser(prefixe ? m.slice(0, -1) : m).trim());
    _re.set(m, new RegExp(' ' + corps + (prefixe ? '[a-z0-9]*' : '') + ' '));
  }
  return _re.get(m);
}
const contient = (n, m) => motRe(m).test(n);

// La langue du message : celle qui a le plus de mots repérés (sujets + petits mots).
// Égalité ou rien ⇒ null (la langue de l'app sera prise).
export function langueDuMessage(texte) {
  const n = normaliser(texte);
  const score = {};
  for (const l of LANGUES_MESSAGE) {
    let s = 0;
    for (const m of OUTILS[l]) if (contient(n, m)) s += 1;
    for (const sujet of SUJETS) for (const m of MOTS[sujet][l]) if (contient(n, m)) s += 2;
    score[l] = s;
  }
  const tri = LANGUES_MESSAGE.slice().sort((a, b) => score[b] - score[a]);
  if (!score[tri[0]] || score[tri[0]] === score[tri[1]]) return null;
  return tri[0];
}

// Les sujets repérés : [{ sujet, langue }] — toutes langues confondues (un acheteur
// qui écrit « dispo ? size 43 ? » en mélange est compris), dans l'ordre de SUJETS.
export function questionsDe(texte) {
  const n = normaliser(texte);
  if (n.trim().length < 2) return [];
  const out = [];
  for (const sujet of SUJETS) {
    for (const l of LANGUES_MESSAGE) {
      if (MOTS[sujet][l].some((m) => contient(n, m))) { out.push({ sujet, langue: l }); break; }
    }
  }
  return out;
}

// ── LES RÉPONSES PROPOSÉES ──────────────────────────────────────────────────
// Ce sont des mots envoyés à l'acheteur (pas l'interface) : ils suivent SA langue.
const REPONSES = {
  dispo: { fr: 'Bonjour, oui, toujours disponible.', en: 'Hi, yes, it’s still available.', es: 'Hola, sí, sigue disponible.', it: 'Ciao, sì, è ancora disponibile.', de: 'Hallo, ja, noch verfügbar.' },
  prix: { fr: 'Vous pouvez me faire une offre avec le bouton « Faire une offre ».', en: 'You can send me an offer with the “Make an offer” button.', es: 'Puedes hacerme una oferta con el botón «Hacer una oferta».', it: 'Puoi farmi un’offerta con il pulsante «Fai un’offerta».', de: 'Du kannst mir über „Preis vorschlagen“ ein Angebot machen.' },
  envoi: { fr: 'J’envoie rapidement après l’achat, avec le suivi Vinted.', en: 'I ship quickly after purchase, with Vinted tracking.', es: 'Envío rápido tras la compra, con seguimiento de Vinted.', it: 'Spedisco subito dopo l’acquisto, con il tracciamento Vinted.', de: 'Ich versende schnell nach dem Kauf, mit Vinted-Sendungsverfolgung.' },
  mainpropre: { fr: 'Je préfère l’envoi par Vinted : nous sommes protégés tous les deux.', en: 'I prefer shipping through Vinted: we are both protected.', es: 'Prefiero el envío por Vinted: así estamos protegidos los dos.', it: 'Preferisco la spedizione tramite Vinted: siamo protetti entrambi.', de: 'Ich versende lieber über Vinted: so sind wir beide geschützt.' },
};

// La réponse proposée pour UN sujet.
//   ctx : { langue, infos (src/infosPaire.js), tailleFiche (la taille Vinted de la
//          fiche), partie (annonce prouvée vendue/supprimée) }
// Rend { texte } ou { texte: '', manque: 'taille'|'defauts'|'semelle'|'partie' }.
export function reponseProposee(sujet, { langue = 'fr', infos = null, tailleFiche = '', partie = false } = {}) {
  const l = LANGUES_MESSAGE.includes(langue) ? langue : 'fr';
  const inf = infos && !infos.cachee ? infos : {};
  if (sujet === 'dispo') return partie ? { texte: '', manque: 'partie' } : { texte: REPONSES.dispo[l] };
  if (sujet === 'taille') {
    if (!inf.taille) return { texte: '', manque: 'taille' };
    const morceaux = [];
    const tf = String(tailleFiche || '').trim();
    if (tf) morceaux.push(phraseInfo('tailleVinted', tf, l));
    morceaux.push(phraseInfo('taille', inf.taille, l));
    return { texte: morceaux.filter(Boolean).join(' ') };
  }
  if (sujet === 'etat') return inf.defauts ? { texte: phraseInfo('defauts', inf.defauts, l) } : { texte: '', manque: 'defauts' };
  if (sujet === 'mesures') return inf.semelle != null ? { texte: phraseInfo('semelle', inf.semelle, l) } : { texte: '', manque: 'semelle' };
  if (REPONSES[sujet]) return { texte: REPONSES[sujet][l] };
  return { texte: '', manque: 'sujet' };
}

// Tout ce que la rangée montre pour un message : [{ sujet, texte, manque? }],
// au plus 3 (les premiers sujets repérés). `langueApp` si le message ne dit rien.
export function propositionsPour(texte, { langueApp = 'fr', infos = null, tailleFiche = '', partie = false } = {}) {
  const q = questionsDe(texte);
  if (!q.length) return [];
  const langue = langueDuMessage(texte) || (LANGUES_MESSAGE.includes(langueApp) ? langueApp : 'fr');
  return q.slice(0, 3).map(({ sujet }) => ({ sujet, langue, ...reponseProposee(sujet, { langue, infos, tailleFiche, partie }) }));
}

// Le texte à lire dans un fil : les messages de l'ACHETEUR arrivés après le dernier
// message du vendeur (le reste a déjà sa réponse). `messages` : [{ deMoi, texte }].
export function questionEnAttente(messages) {
  const l = Array.isArray(messages) ? messages : [];
  const out = [];
  for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (!m) continue;
    if (m.deMoi) break;
    const t = String(m.texte || '').trim(); if (t) out.unshift(t);
    if (out.length >= 3) break;
  }
  return out.join(' \n ').slice(0, 1200);
}
