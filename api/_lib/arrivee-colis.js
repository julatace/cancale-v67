// ─────────────────────────────────────────────────────────────────────────────
// LA DATE D'ARRIVÉE D'UN COLIS À RETIRER — une règle pour le serveur (qui la
// garde au rangement) et l'app (qui l'affiche), §11. Pure : aucune lecture.
//
// (21 octobre) « Je veux que l'on voie la date à laquelle il est arrivé. »
// MESURÉ (lecture seule) : la ligne `email_track_*` d'un colis est RÉÉCRITE par
// chaque email du transporteur, et `receivedAt` avec. Or les rappels arrivent
// APRÈS l'arrivée (« Libère de la place dans la consigne », « Le temps file :
// votre colis vous attend ») : 6 des 30 colis « disponibles » portaient la date
// d'un RAPPEL. La présenter comme date d'arrivée serait une date fausse.
//   · email d'ARRIVÉE (« Votre colis … est disponible », « … est arrivé en
//     relais ») ⇒ sa date EST l'arrivée (`sur: 'oui'`) ;
//   · rappel, transfert à la main (« TR : »), sujet inconnu ⇒ le colis était
//     arrivé AU PLUS TARD ce jour-là (`sur: 'borne'`) — jamais présenté comme
//     la date d'arrivée ;
//   · le serveur garde désormais la date du premier email d'arrivée
//     (`arriveLe`) : un rappel suivant ne l'efface plus.
// ─────────────────────────────────────────────────────────────────────────────

export const RAPPEL_COLIS = /lib[èe]re\s+de\s+la\s+place|le\s+temps\s+file|attend\s+(?:toujours|encore|avec\s+impatience)|\brappel\b|n['’]oublie|dernier\s+jour|plus\s+que\s+\d|sans\s+attendre|toujours\s+disponible|bient[ôo]t\s+(?:la\s+fin|retourn|renvoy)|va\s+(?:bient[ôo]t\s+)?(?:repartir|[êe]tre\s+(?:retourn|renvoy))/i;
export const TRANSFERT_EMAIL = /^\s*(?:tr|fwd?|re)\s*:/i;
export const ARRIVEE_COLIS = /est\s+disponible|est\s+arriv|arriv[ée]e?\s+(?:en|au|à|dans)|t['’]attend|vous\s+attend|pr[êe]t\s+[àa]\s+[êe]tre\s+retir|d[ée]pos[ée]\s+(?:en|au|à|dans)\s+(?:point|relais|consigne|casier|bureau)|livr[ée]\s+(?:en|au|à|dans)\s+(?:point|relais|consigne|casier)/i;

// L'email dit-il que le colis VIENT d'arriver (pas un rappel, pas un transfert) ?
export function estEmailArrivee(sujet) {
  const s = String(sujet || '');
  if (!s || TRANSFERT_EMAIL.test(s) || RAPPEL_COLIS.test(s)) return false;
  return ARRIVEE_COLIS.test(s);
}

const isoValide = (v) => { const ms = Date.parse(String(v || '')); return Number.isFinite(ms) && ms > 0 ? ms : null; };

// Au RANGEMENT (api/email-inbound) : la date d'arrivée à garder sur la ligne.
// `prev` = la ligne d'avant (ou null), `now` = la date de l'email traité.
export function arriveLeAuRangement(prev, sujet, statut, now) {
  if (prev && isoValide(prev.arriveLe)) return String(prev.arriveLe);
  if (statut !== 'available') return null;
  if (estEmailArrivee(sujet) && isoValide(now)) return String(now);
  // La ligne d'avant était déjà l'email d'arrivée : sa date est la bonne.
  if (prev && prev.status === 'available' && estEmailArrivee(prev.subject) && isoValide(prev.receivedAt)) return String(prev.receivedAt);
  return null;
}

// À L'AFFICHAGE : { ms, sur: 'oui' | 'borne' } ou null (inconnue).
export function arriveeColisEmail(t) {
  if (!t) return null;
  const a = isoValide(t.arriveLe);
  if (a) return { ms: a, sur: 'oui' };
  if (t.status !== 'available') return null;
  const r = isoValide(t.receivedAt);
  if (!r) return null;
  return { ms: r, sur: estEmailArrivee(t.subject) ? 'oui' : 'borne' };
}

// Un colis vu par Vinted (conversation lue par l'extension, `panel_colis_relais`).
// ⚠️ `at` est l'heure où l'extension a LU le message d'arrivée, pas l'heure du
// message : ce n'est qu'une borne (le colis était déjà là). Rien d'autre ne date
// l'arrivée (mesuré : la commande ne porte que la date d'achat, la transaction
// la date du paiement). Sans `at` : inconnue.
export function arriveeColisVinted(rel) {
  if (!rel) return null;
  const a = isoValide(rel.arriveLe);
  if (a) return { ms: a, sur: 'oui' };
  const at = isoValide(rel.at);
  return at ? { ms: at, sur: 'borne' } : null;
}

// AAAA-MM-JJ dans le fuseau de l'appareil (celui de la date affichée).
export function jourLocal(ms) {
  const d = new Date(ms); if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// La phrase, une pour toutes les cartes : « Arrivé le 18 oct. · il y a 3 j ».
export function texteArrivee(arr, maintenant = Date.now()) {
  if (!arr) return 'Date d’arrivée inconnue';
  const d = new Date(arr.ms);
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const debut = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
  const j = Math.round((debut(maintenant) - debut(arr.ms)) / 86400000);
  const age = j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} j`;
  return arr.sur === 'oui' ? `Arrivé le ${jour} · ${age}` : `Arrivé au plus tard le ${jour} · ${age}`;
}
