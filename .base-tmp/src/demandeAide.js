// ═══════════════════════════════════════════════════════════════════════════
// « ÉCRIRE AU SUPPORT » — LA RÈGLE, UNE POUR L'APP ET LE SERVEUR (13 nov., lot 55)
// ═══════════════════════════════════════════════════════════════════════════
// VRM s'ouvre à d'autres vendeurs : il leur faut UN endroit pour écrire, et une
// réponse. « Signaler un problème » (api/_lib/signalement.js) reste l'outil du
// diagnostic (schéma de l'écran, requêtes, erreurs) ; ceci est la QUESTION au
// support : son texte, et SEULEMENT cinq faits techniques —
//   version de l'app · version de l'extension · écran · navigateur · heure.
// Rien d'autre ne part : ni pseudo, ni montant, ni e-mail d'acheteur, ni
// capture, ni plantage. Le texte tapé est masqué par la MÊME règle que les
// signalements (`masquer` : e-mails, montants, longs numéros, jetons ;
// `masquerPseudos` ; et, dans l'app, `masquerPourEnvoi` du mode stream).
//
// ⚠️ UNE RÈGLE (§11) : `normaliserDemandeAide` est la fonction de l'APERÇU (ce
//    qu'il voit avant d'envoyer) ET du serveur (ce qui est rangé, rejouée sur le
//    corps reçu, puis sur la ligne relue) — un champ qu'elle ne connaît pas ne
//    passe pas. Idempotente : l'aperçu EST ce qui est rangé.
// ⚠️ L'heure n'est pas dans le corps : le SERVEUR la pose (`at`), l'aperçu dit
//    « à l'envoi ». L'identifiant du compte est celui de SA session, jamais un
//    champ du corps. La réponse part à l'adresse de SON compte VRM, que le
//    propriétaire lit chez Supabase Auth au moment de répondre — elle n'est
//    jamais rangée dans la demande.
// Aucun import Node ici : l'app importe ce fichier.
// ═══════════════════════════════════════════════════════════════════════════
import { masquer, masquerPseudos, ECRANS, NAVIGATEURS, versionApp } from '../api/_lib/signalement.js';

export const PREFIXE_AIDE = 'demande_aide_';
export const DEMANDES_PAR_HEURE = 5;
export const TEXTE_AIDE_MAX = 2000;
export const TEXTE_AIDE_MIN = 3;
// D'où il écrit : Réglages → Aide, le garde-fou d'un écran tombé, le « ? » d'un écran.
export const DEPUIS_AIDE = ['reglages', 'garde', 'aide'];
// Les seuls champs d'une demande (l'audit le vérifie sur ce qui est RANGÉ).
export const CHAMPS_AIDE = ['texte', 'version', 'extension', 'ecran', 'navigateur', 'depuis'];
export const ID_AIDE = /^demande_aide_\d{10}_[1-9]$/;

const versionExt = (v) => (/^\d{1,3}\.\d{1,4}\.\d{1,4}$/.test(String(v || '')) ? String(v) : null);
const propre = (t) => String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

// LA demande, telle qu'elle part ET telle qu'elle est rangée. `null` si le texte manque.
// `opts.masque(texte)` (l'app seulement) : ce que l'écran sait sensible (mode stream).
export function normaliserDemandeAide(c, opts = {}) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const m2 = typeof opts.masque === 'function' ? (t) => { try { return String(opts.masque(t)); } catch (_) { return t; } } : (t) => t;
  const texte = masquerPseudos(masquer(propre(m2(String(c.texte == null ? '' : c.texte))))).slice(0, TEXTE_AIDE_MAX).trim();
  if (texte.length < TEXTE_AIDE_MIN) return null;
  return {
    texte,
    version: versionApp(c.version),
    extension: versionExt(c.extension),
    ecran: ECRANS.includes(String(c.ecran || '')) ? String(c.ecran) : '',
    navigateur: NAVIGATEURS.includes(c.navigateur) ? c.navigateur : 'inconnu',
    depuis: DEPUIS_AIDE.includes(c.depuis) ? c.depuis : 'reglages',
  };
}

// Ce qu'il voit avant d'envoyer — ligne par ligne, EXACTEMENT ce qui part.
export function lignesApercuAide(d) {
  if (!d) return [];
  return [
    ['Ton message', d.texte],
    ['Version de l’app', d.version || '—'],
    ['Version de l’extension', d.extension || 'pas connue ici'],
    ['Écran', d.ecran || '—'],
    ['Navigateur', d.navigateur],
    ['Heure', 'posée à l’envoi'],
  ];
}
export const PHRASE_RIEN_DAUTRE = 'Rien d’autre ne part : ni pseudo, ni montant, ni e-mail d’acheteur, ni capture de l’écran. Dans ton texte, les montants, e-mails, pseudos et longs numéros sont masqués.';
export const PHRASE_REPONSE = 'La réponse arrive par e-mail, à l’adresse de ton compte VRM.';
export const ACCUSE_AIDE = 'Reçu, réponse par e-mail.';

// ── CÔTÉ APP : l'envoi, et ce qu'il dit ─────────────────────────────────────
// `envoye: true` SEULEMENT sur une réponse `ok:true` qui porte l'id rangé.
export async function posterDemandeAide(demande, { entetes = {}, fetcher = (typeof fetch === 'function' ? fetch : null) } = {}) {
  try {
    const r = await fetcher('/api/compte?mode=aide', { method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(demande) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok === true && typeof j.id === 'string' && ID_AIDE.test(j.id)) return { envoye: true, id: j.id };
    return { envoye: false, raison: (j && j.raison) || (r.status === 401 ? 'session' : 'serveur'), reessayerDans: j && j.reessayerDans };
  } catch (_) { return { envoye: false, raison: 'reseau' }; }
}
export const PHRASES_REFUS_AIDE = {
  trop: (m) => `Pas envoyé : 5 demandes par heure au plus.${m ? ` Réessaie dans ${m} min.` : ''}`,
  session: () => 'Pas envoyé : connecte-toi à VRM, puis réessaie.',
  texte: () => 'Pas envoyé : écris ta question en quelques mots.',
  reseau: () => 'Pas envoyé : pas de connexion. Ton texte est gardé, réessaie.',
  base: () => 'Pas envoyé : le serveur n’a pas pu la ranger. Ton texte est gardé, réessaie.',
  'non-configure': () => 'Pas envoyé : le serveur n’est pas configuré pour le support.',
  serveur: () => 'Pas envoyé : le serveur n’a pas confirmé. Ton texte est gardé, réessaie.',
};
export const phraseRefusAide = (r) => (PHRASES_REFUS_AIDE[r && r.raison] || PHRASES_REFUS_AIDE.serveur)(r && r.reessayerDans);
