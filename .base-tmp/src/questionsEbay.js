// ═══════════════════════════════════════════════════════════════════════════
// LES QUESTIONS eBAY, UNE PAR ANNONCE (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : lire les questions des acheteurs eBay dans Messages (onglet eBay)
// et y répondre d'ici, sur SON clic. MESURÉ dans le code : VRM lisait déjà les
// échanges (Trading `GetMemberMessages`, 90 jours, `api/_lib/ebay-gestion.js`)
// et y répondait (`AddMemberMessageRTQ`, `confirme:true` exigé AVANT le jeton,
// la question RELUE chez eBay comme « AskSellerQuestion » juste avant l'envoi).
// Mais la liste mêlait tous les échanges et proposait « Envoyer » sur ceux
// auxquels le serveur refuse de répondre (un message qui n'est pas une question
// ⇒ 409 après le clic).
// Ici, les règles PURES de l'écran :
//   · `estQuestion` : `type` (MessageType) = « AskSellerQuestion » ET une
//     annonce identifiée (ItemID) — seule forme à laquelle VRM répond ;
//   · `questionsParAnnonce` : une ligne par annonce (ItemID), la question à
//     traiter d'abord (la plus ANCIENNE sans réponse, sinon la plus récente),
//     le nombre de questions et de questions sans réponse ;
//   · `ordreQuestions` : les questions d'une annonce, de la plus ancienne à la
//     plus récente (la navigation « 1 · 2 · 3 » du fil).
// L'article (photo, N°) vient de l'ItemID puis du SKU `VRM-{n°}` de CETTE
// annonce (`paireEbayDe`, App.jsx) — jamais du titre (§5).
// Exécuté par scripts/audit-questions-ebay.cjs.

const QUESTION = /^AskSellerQuestion$/;
const tsDe = (m) => { const t = Date.parse((m && m.date) || ''); return Number.isFinite(t) ? t : null; };
// La même règle que « non lu » de Ma journée (api/_lib/ebay-messages-nonlus.js,
// `messageEbayNonLu`) : `Unanswered` sans aucune réponse.
export const sansReponse = (m) => !!m && /^unanswered$/i.test(String(m.status || '')) && !(Array.isArray(m.responses) && m.responses.length);

export const estQuestion = (m) => !!m && QUESTION.test(String(m.type || '').trim()) && /^\d{1,24}$/.test(String(m.itemId || ''));

export const ordreQuestions = (questions) => (questions || []).slice().sort((a, b) => {
  const ta = tsDe(a), tb = tsDe(b);
  if (ta == null && tb == null) return String(a.id) < String(b.id) ? -1 : 1;
  if (ta == null) return 1; if (tb == null) return -1;
  return ta - tb || (String(a.id) < String(b.id) ? -1 : 1);
});

// → [{ itemId, titre, questions (anciennes → récentes), aTraiter, nSans, derniere }]
// Les groupes : du plus récent (dernière question) au plus ancien (11 nov.).
export const questionsParAnnonce = (messages) => {
  const par = new Map();
  for (const m of (Array.isArray(messages) ? messages : [])) {
    if (!estQuestion(m)) continue;
    const k = String(m.itemId);
    if (!par.has(k)) par.set(k, []);
    const L = par.get(k);
    if (!L.some((x) => String(x.id) === String(m.id))) L.push(m);
  }
  const groupes = [];
  for (const [itemId, L] of par) {
    const questions = ordreQuestions(L);
    const sans = questions.filter(sansReponse);
    const derniere = questions[questions.length - 1];
    groupes.push({ itemId, titre: (derniere && derniere.titre) || '', questions, nSans: sans.length, aTraiter: sans[0] || derniere, derniere, tsAttente: sans.length ? tsDe(sans[0]) : null, tsDerniere: tsDe(derniere) });
  }
  // (11 nov., Julien : « du plus récent au plus vieux ») Le plus récent en haut, comme
  // toutes les vues de Messages (src/ordreConversations.js) ; sans date, en bas. Une
  // question sans réponse ne passe plus devant : son point « non lu » la signale.
  return groupes.sort((a, b) => (a.tsDerniere == null) - (b.tsDerniere == null) || (b.tsDerniere || 0) - (a.tsDerniere || 0) || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
};
