// ═══════════════════════════════════════════════════════════════════════════
// 5.455.7 (Julien, 27 nov. 23:10 : « entre les différents utilisateurs, on ne doit pas pouvoir voir une même template d'un
// utilisateur à l'autre ») — LES MESSAGES PAR DÉFAUT, UNIQUES À CHAQUE COMPTE VRM
// ═══════════════════════════════════════════════════════════════════════════
// Avant : un vendeur qui n'avait rien écrit recevait LE message par défaut (`MESSAGE_PAR_DEFAUT`), le même pour tous.
// Désormais : une banque de morceaux (salutation × entrée × corps × offre × détail × fin × ponctuation), 5 langues ; chaque
// compte VRM reçoit SON jeu de 3 versions, tiré d'une GRAINE dérivée de son identifiant (empreinte FNV-1a sur 64 bits,
// jamais l'identifiant en clair dans un texte ni un journal) : le même compte a toujours le même jeu, deux comptes n'ont pas
// le même. Ses propres versions gagnent toujours (ce module ne sert que quand il n'a RIEN écrit). Aucune variable : rien qui
// dépende d'une donnée pas sue. Chaque version ANNONCE l'offre (« offre ») : l'offre part avant le message (règle d'avant).
// Règle PURE (aucune lecture, aucun envoi), recopiée dans l'extension par le bloc <gardes-app>.
const BANQUE = {
  fr: {
    avant: ['Du coup', 'Alors', 'Bonne nouvelle', 'Petite info', 'Au fait', 'Pour info', 'D’ailleurs', 'Et puis', 'Ah et', 'En plus', 'En tout cas', 'Petit plus'],
    salut: ['Bonjour', 'Salut', 'Hello', 'Coucou', 'Bonsoir', 'Hey', 'Bonjour à toi', 'Salut à toi', 'Re-bonjour', 'Hello hello', 'Bien le bonjour', 'Yo'],
    entree: ['merci pour ton favori', 'j’ai vu ton favori', 'ton favori m’a fait plaisir', 'je vois que l’article te plaît', 'merci d’avoir aimé l’article', 'content que l’article t’intéresse', 'ton cœur sur l’annonce ne m’a pas échappé', 'tu as aimé mon annonce', 'l’article a l’air de te plaire', 'merci de ton intérêt', 'j’ai remarqué ton favori', 'super, l’article t’a tapé dans l’œil', 'merci pour le petit cœur', 'ravi que l’annonce te plaise'],
    corps: ['il est toujours disponible', 'il n’attend que toi', 'il est encore là', 'il est prêt à partir', 'je peux l’envoyer rapidement', 'il part vite une fois réglé', 'il est en très bon état', 'tout est sur les photos', 'il est bien emballé avant l’envoi', 'je l’expédie sous peu après l’achat', 'il est encore en vente', 'je le garde pour toi un moment', 'il est soigné et propre', 'je réponds vite si tu as une question'],
    offre: ['je t’ai fait une offre', 'je te propose une offre', 'je t’envoie une petite offre', 'une offre t’attend', 'je t’ai préparé une offre', 'voici une offre rien que pour toi', 'je te fais une offre', 'je viens de t’envoyer une offre', 'une offre est là pour toi', 'je t’ai mis une offre', 'je te glisse une offre', 'je te propose une offre sympa'],
    detail: ['dessus', 'sur l’article', 'pour toi', 'juste au-dessus', 'dans la conversation', 'à saisir', 'valable un moment', 'à prix doux', 'avec plaisir', 'si ça te dit'],
    fin: ['bonne journée', 'belle journée', 'à bientôt', 'au plaisir', 'bonne soirée', 'à très vite', 'n’hésite pas', 'dis-moi si ça te va', 'bonne fin de journée', 'je reste dispo', 'merci encore', 'à toi de voir', 'bon shopping', 'à plus'],
    ponct: [' !', ' :)', '.', ' 🙂', ' 😊', ' ^^', '…', ' !!'],
  },
  en: {
    avant: ['So', 'Good news', 'By the way', 'Quick note', 'Also', 'FYI', 'Anyway', 'Just so you know', 'Oh and', 'Plus', 'In any case', 'Heads up'],
    salut: ['Hi', 'Hello', 'Hey', 'Hi there', 'Hello there', 'Good day', 'Hey there', 'Greetings'],
    entree: ['thanks for the like', 'I saw your favourite', 'glad you like the item', 'thanks for your interest', 'I noticed your like', 'happy the listing caught your eye', 'thanks for the little heart', 'you liked my listing'],
    corps: ['it is still available', 'it is ready to ship', 'I can send it quickly', 'it is in very good condition', 'everything is in the photos', 'it ships soon after purchase', 'it is still for sale', 'I reply fast to questions'],
    offre: ['I made you an offer', 'here is an offer for you', 'I sent you a small offer', 'an offer is waiting for you', 'I prepared an offer', 'I just sent you an offer', 'there is an offer for you', 'I put an offer up for you'],
    detail: ['on it', 'on the item', 'just for you', 'right above', 'in the chat', 'worth a look', 'for a while', 'at a nice price'],
    fin: ['have a nice day', 'see you soon', 'cheers', 'have a good evening', 'let me know', 'thanks again', 'happy shopping', 'take care'],
    ponct: [' !', ' :)', '.', ' 🙂', ' 😊', ' ^^', '…', ' !!'],
  },
  es: {
    avant: ['Así que', 'Buena noticia', 'Por cierto', 'Un detalle', 'Además', 'Para que sepas', 'Total', 'Ojo', 'Y otra cosa', 'Encima', 'En todo caso', 'Atento'],
    salut: ['Hola', 'Buenas', 'Hey', 'Hola qué tal', 'Saludos', 'Buenos días', 'Holi', 'Hola de nuevo'],
    entree: ['gracias por el favorito', 'vi tu favorito', 'me alegra que te guste el artículo', 'gracias por tu interés', 'noté tu favorito', 'gracias por el corazoncito', 'te gustó mi anuncio', 'el artículo parece gustarte'],
    corps: ['sigue disponible', 'está listo para enviar', 'puedo enviarlo rápido', 'está en muy buen estado', 'todo está en las fotos', 'lo envío pronto tras la compra', 'sigue a la venta', 'respondo rápido a dudas'],
    offre: ['te hice una oferta', 'te propongo una oferta', 'te envío una pequeña oferta', 'una oferta te espera', 'te preparé una oferta', 'acabo de enviarte una oferta', 'hay una oferta para ti', 'te dejé una oferta'],
    detail: ['en él', 'en el artículo', 'solo para ti', 'justo arriba', 'en el chat', 'para aprovechar', 'por un tiempo', 'a buen precio'],
    fin: ['buen día', 'hasta pronto', 'un saludo', 'buenas tardes', 'dime qué te parece', 'gracias de nuevo', 'feliz compra', 'cuídate'],
    ponct: [' !', ' :)', '.', ' 🙂', ' 😊', ' ^^', '…', ' !!'],
  },
  it: {
    avant: ['Quindi', 'Bella notizia', 'A proposito', 'Piccola nota', 'Inoltre', 'Per info', 'Comunque', 'Sappi che', 'E poi', 'In più', 'In ogni caso', 'Occhio'],
    salut: ['Ciao', 'Salve', 'Buongiorno', 'Ehi', 'Ciao ciao', 'Buonasera', 'Ciao a te', 'Ben trovato'],
    entree: ['grazie per il preferito', 'ho visto il tuo preferito', 'felice che l’articolo ti piaccia', 'grazie per l’interesse', 'ho notato il tuo cuore', 'ti è piaciuto il mio annuncio', 'grazie per il cuoricino', 'l’articolo sembra piacerti'],
    corps: ['è ancora disponibile', 'è pronto per la spedizione', 'posso spedirlo in fretta', 'è in ottimo stato', 'è tutto nelle foto', 'spedisco subito dopo l’acquisto', 'è ancora in vendita', 'rispondo veloce alle domande'],
    offre: ['ti ho fatto un’offerta', 'ti propongo un’offerta', 'ti mando una piccola offerta', 'un’offerta ti aspetta', 'ti ho preparato un’offerta', 'ti ho appena mandato un’offerta', 'c’è un’offerta per te', 'ti ho lasciato un’offerta'],
    detail: ['sopra', 'sull’articolo', 'solo per te', 'qui sopra', 'nella chat', 'da cogliere', 'per un po’', 'a buon prezzo'],
    fin: ['buona giornata', 'a presto', 'un saluto', 'buona serata', 'fammi sapere', 'grazie ancora', 'buono shopping', 'stammi bene'],
    ponct: [' !', ' :)', '.', ' 🙂', ' 😊', ' ^^', '…', ' !!'],
  },
  de: {
    avant: ['Also', 'Gute Nachricht', 'Übrigens', 'Kurz noch', 'Außerdem', 'Zur Info', 'Jedenfalls', 'Nur damit du es weißt', 'Ach ja', 'Dazu', 'Auf jeden Fall', 'Kleiner Hinweis'],
    salut: ['Hallo', 'Hi', 'Hey', 'Guten Tag', 'Servus', 'Moin', 'Hallo zusammen', 'Grüß dich'],
    entree: ['danke für das Herz', 'ich habe deinen Favoriten gesehen', 'schön, dass dir der Artikel gefällt', 'danke für dein Interesse', 'mir ist dein Favorit aufgefallen', 'dir gefällt meine Anzeige', 'danke fürs kleine Herz', 'der Artikel scheint dir zu gefallen'],
    corps: ['er ist noch verfügbar', 'er ist versandbereit', 'ich kann schnell verschicken', 'er ist in sehr gutem Zustand', 'alles ist auf den Fotos', 'ich verschicke gleich nach dem Kauf', 'er ist noch zu haben', 'ich antworte schnell auf Fragen'],
    offre: ['ich habe dir ein Angebot gemacht', 'ich schlage dir ein Angebot vor', 'ich schicke dir ein kleines Angebot', 'ein Angebot wartet auf dich', 'ich habe dir ein Angebot vorbereitet', 'ich habe dir gerade ein Angebot geschickt', 'es gibt ein Angebot für dich', 'ich habe dir ein Angebot gemacht'],
    detail: ['dazu', 'für den Artikel', 'nur für dich', 'gleich oben', 'im Chat', 'zum Zugreifen', 'für eine Weile', 'zum guten Preis'],
    fin: ['schönen Tag', 'bis bald', 'liebe Grüße', 'schönen Abend', 'sag Bescheid', 'nochmals danke', 'viel Spaß beim Shoppen', 'mach’s gut'],
    ponct: [' !', ' :)', '.', ' 🙂', ' 😊', ' ^^', '…', ' !!'],
  },
};
export const LANGUES_DEFAUTS_FAVORIS = Object.freeze(Object.keys(BANQUE));
// Empreinte FNV-1a 64 bits (BigInt) de « vrm-favoris:{id} » : la graine ; l'identifiant n'est jamais rendu.
export function graineFavoris(idCompteVrm) {
  let h = 0xcbf29ce484222325n; const p = 0x100000001b3n, m = 0xffffffffffffffffn;
  for (const c of 'vrm-favoris:' + String(idCompteVrm == null ? '' : idCompteVrm)) { h ^= BigInt(c.codePointAt(0)); h = (h * p) & m; }
  // Brassage final (fmix64) : les bits bas d'un FNV ne dépendent que des bits bas — sans lui, deux identifiants voisins
  //    tombaient sur le même 1er message (mesuré : 1 collision sur 1 000).
  h ^= h >> 33n; h = (h * 0xff51afd7ed558ccdn) & m; h ^= h >> 33n; h = (h * 0xc4ceb9fe1a85ec53n) & m; h ^= h >> 33n;
  return h;
}
const PARTS = ['salut', 'entree', 'corps', 'avant', 'offre', 'detail', 'fin', 'ponct'];
function phraseDe(b, idx, langue) {
  const [s, e, c, a, o, d, f, p0] = PARTS.map((k, i) => b[k][idx[i]]);
  const maj = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const fr = langue === 'fr', p = !fr && p0 === ' !' ? '!' : p0;   // l'espace avant « ! » : en français seulement
  const tete = p0 === '.' ? `${s}, ${e}` : `${s}${fr ? ' !' : '!'} ${maj(e)}`;
  const o2 = langue === 'de' || /^I /.test(o) ? o : o.replace(/^./, (x) => x.toLowerCase());   // l'allemand et le « I » anglais gardent leur majuscule
  return `${tete}, ${c}. ${a}, ${o2} ${d}. ${maj(f)}${p}`.replace(/\s+/g, ' ').trim();
}
// (salutation × entrée × corps × liaison × offre × détail × fin × ponctuation : des dizaines de millions de 1ers messages par langue)
// Le jeu de N versions (3 par défaut) de CE compte, dans cette langue : chaque version tire chaque morceau de la graine
// (un pas différent par version, jamais deux fois le même morceau d'entrée ni d'offre dans le jeu).
export function defautsFavorisUniques(idCompteVrm, langue = 'fr', n = 3) {
  const b = BANQUE[langue] || BANQUE.fr;
  let g = graineFavoris(String(idCompteVrm) + (langue && langue !== 'fr' ? ':' + langue : ''));   // une graine par langue : des tirages indépendants
  const tirer = (k) => { const t = BigInt(b[k].length); const r = Number(g % t); g = g / t; if (g < 1000n) g = graineFavoris(String(g) + ':' + k); return r; };
  const out = [], vus = { entree: new Set(), offre: new Set() };
  for (let v = 0; v < n; v++) {
    const idx = PARTS.map((k) => { let i = tirer(k); if (vus[k]) { let tours = 0; while (vus[k].has(i) && tours++ < b[k].length) i = (i + 1) % b[k].length; vus[k].add(i); } return i; });
    out.push(phraseDe(b, idx, BANQUE[langue] ? langue : 'fr'));
  }
  return out;
}
