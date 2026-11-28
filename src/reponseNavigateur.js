// ════════════════════════════════════════════════════════════════════════════
//  UNE RÉPONSE PROPOSÉE PAR L'IA DE TON NAVIGATEUR (28 nov. 2026, lot ia-sans-cle)
//  À côté de SES réponses rapides (src/reponsesRapides.js, par mots-clés, sans IA) : quand le modèle intégré à Chrome
//  est PRÊT sur l'appareil (src/iaNavigateur.js), une puce « Proposer » écrit UNE réponse au dernier message de
//  l'acheteur. Aucune clé, rien ne part chez un tiers. Sans modèle : pas de puce (ses réponses rapides restent).
//  Module PUR : la consigne, le schéma imposé, la VALIDATION de ce que le modèle rend (`lireReponse`) — une sortie qui
//  n'est pas un texte court, propre, sans trou ni lien, ou que la règle des messages refuse (`sur`), n'est jamais
//  posée dans le champ. Rien n'est envoyé : la réponse REMPLIT le champ, l'envoi reste SON toucher.
// ════════════════════════════════════════════════════════════════════════════
export const REPONSE_MAX = 600;
const LANGUES = { fr: 'français', en: 'English', es: 'español', it: 'italiano', de: 'Deutsch' };

export function consigneReponse(langue = 'fr') {
  const l = LANGUES[langue] || LANGUES.fr;
  return `Tu aides un vendeur d'articles d'occasion à répondre à un acheteur. Tu écris UNE réponse courte (1 à 3 phrases), polie, naturelle, en ${l}, que le vendeur relira avant de l'envoyer lui-même. N'invente RIEN sur l'article : n'utilise que les informations données (titre, taille, prix). Si l'information demandée n'est pas fournie, dis que tu vérifies et que tu reviens vers lui. Ne promets aucune remise. Pas de lien, pas d'adresse, pas de numéro de téléphone, pas d'e-mail, aucun paiement hors de la plateforme. Réponds STRICTEMENT par {"texte":"…"}.`;
}
export const SCHEMA_REPONSE_MESSAGE = { type: 'object', additionalProperties: false, required: ['texte'], properties: { texte: { type: 'string', minLength: 1, maxLength: REPONSE_MAX } } };

// Le message envoyé au modèle : ce qu'on SAIT de l'article (jamais deviné) et les derniers messages.
export function messageReponse({ messages = [], vars = {} } = {}) {
  const fil = (Array.isArray(messages) ? messages : []).filter((m) => m && String(m.texte || '').trim()).slice(-6)
    .map((m) => (m.deMoi ? 'Vendeur : ' : 'Acheteur : ') + String(m.texte).slice(0, 600));
  const sait = {};
  if (vars.article) sait.article = String(vars.article).slice(0, 120);
  if (vars.taille) sait.taille = String(vars.taille).slice(0, 30);
  if (Number.isFinite(Number(vars.prix)) && Number(vars.prix) > 0) sait.prix = Number(vars.prix) + ' €';
  if (vars.pseudo) sait.acheteur = String(vars.pseudo).slice(0, 40);
  return `Article (seules informations sûres) : ${JSON.stringify(sait)}\nConversation :\n${fil.join('\n')}\nÉcris la réponse du vendeur au dernier message de l'acheteur.`;
}
// La conversation se termine-t-elle par un message de l'acheteur ? (sinon, rien à proposer)
export const aRepondre = (messages) => { const l = (Array.isArray(messages) ? messages : []).filter((m) => m && String(m.texte || '').trim()); return l.length > 0 && !l[l.length - 1].deMoi; };

// La sortie du modèle ⇒ le texte à poser, ou null. `sur(texte)` : la règle des messages de l'app (risquesMessage).
export function lireReponse(o, { sur = () => true } = {}) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (Object.keys(o).some((k) => k !== 'texte')) return null;
  const t = typeof o.texte === 'string' ? o.texte.replace(/\s+\n/g, '\n').trim() : '';
  if (!t || t.length > REPONSE_MAX) return null;
  if (/[{}<>]|\[\s*[A-Za-zÀ-ÿ_]+\s*\]/.test(t)) return null;                       // un trou, une balise : jamais posé
  if (/https?:\/\/|www\.|@[a-z0-9-]+\.[a-z]{2,}/i.test(t)) return null;           // un lien, un e-mail
  if (/(\+?\d[\s.-]?){9,}/.test(t)) return null;                                  // un numéro de téléphone
  try { if (!sur(t)) return null; } catch (_) { return null; }
  return t;
}
