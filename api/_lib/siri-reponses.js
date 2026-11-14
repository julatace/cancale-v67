// ═══════════════════════════════════════════════════════════════════════════
//  161 · « DIS SIRI, COMBIEN J'AI VENDU AUJOURD'HUI ? » — LES RÉPONSES (14 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Le Raccourci de l'iPhone appelle `GET /api/widget?mode=siri&q=…&k=<jeton>` (api/_lib/
// siri-jeton.js) et Siri lit la phrase rendue. AUCUN chiffre n'est recalculé ici
// (§5 « un seul propriétaire ») : on lit ce que l'app a PUBLIÉ —
//   · « vendu aujourd'hui » : `widget_stats.jour / caJour / ventesJour / caJourNonComptees`
//     (la règle `ventesFaites` de la coque, publiée seulement COMPLÈTE) ;
//   · « à envoyer »         : `widget_stats.aExpedier` ({ n, auMoins, at } — la publication
//     `vrm_colis_aposter` de Colis, recopiée pour la carte du logo) ;
//   · « prochain à retirer » : la ligne `siri_retrait` (publiée par l'app, seulement quand
//     un jeton Siri existe) : les colis COMPTÉS « à retirer », leur transporteur et le code
//     de LEUR commande (le verdict de la carte, `vrm_codes_hors_ligne`) — jamais un code
//     choisi entre deux.
// Trois états partout : une publication absente, d'un autre jour ou trop vieille ⇒ « je
// ne sais pas encore, ouvre VRM », jamais « 0 € ». Un total partiel ⇒ « au moins ».
// Module PUR (aucune lecture) : l'app l'importe pour publier, le serveur pour répondre.
// Tenu par scripts/audit-idees-argent.cjs (section S, EXÉCUTE la route).
// ═══════════════════════════════════════════════════════════════════════════
import { etatRetrait, estAVerifier } from './retrait-colis.js';

export const LIGNE_SIRI = 'vrm_siri';             // { h: sha256(jeton), at, debut, langue } — écrite par le serveur seul
export const LIGNE_SIRI_RETRAIT = 'siri_retrait'; // { at, uid, prochains: [...] } — publiée par l'app
export const FRAIS_MS = 12 * 3600000;             // au-delà, une publication n'est plus dite comme fraîche
export const QUESTIONS = Object.freeze(['vendu', 'retirer', 'envoyer', 'tout']);
export const LANGUES_SIRI = Object.freeze(['fr', 'en', 'es', 'it', 'de']);
const NOM_TRANSPORTEUR = { mondialrelay: 'Mondial Relay', chronopost: 'Chronopost', vinted: 'Vinted Go', vintedgo: 'Vinted Go', colissimo: 'Colissimo', dpd: 'DPD', shop2shop: 'Shop2Shop', relaiscolis: 'Relais Colis', ups: 'UPS' };
export const nomTransporteur = (c) => NOM_TRANSPORTEUR[String(c || '').toLowerCase().replace(/[\s_-]+/g, '')] || '';

export const jourParis = (ms = Date.now()) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const heureParis = (ms, l) => { const h = new Date(ms).toLocaleTimeString(l === 'en' ? 'en-GB' : l, { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }); return l === 'fr' ? h.replace(':', ' h ') : h; };
const eurTexte = (n, l) => {
  const v = Math.round(Number(n) * 100) / 100;
  const s = v % 1 === 0 ? String(v) : v.toFixed(2).replace('.', l === 'en' ? '.' : ',');
  return l === 'en' ? `${s} euros` : `${s} €`;
};
const plur = (n, un, plusieurs) => (n === 1 ? un : plusieurs);

// Les phrases, dans la langue choisie dans VRM (Paramètres → Langue, passée par le lien).
const P = {
  fr: {
    vendu: (e, n, auMoins) => `${auMoins ? 'Au moins ' : ''}${e} vendus aujourd’hui, ${n} ${plur(n, 'vente', 'ventes')}.`,
    venduRien: 'Aucune vente aujourd’hui pour l’instant.',
    venduPasSu: 'Je n’ai pas encore les ventes d’aujourd’hui : ouvre VRM une fois, puis redemande.',
    envoyer: (n, auMoins) => n === 0 ? 'Aucun colis à envoyer.' : `${auMoins ? 'Au moins ' : ''}${n} ${plur(n, 'colis à envoyer', 'colis à envoyer')}.`,
    envoyerPasSu: 'Je ne sais pas combien de colis sont à envoyer : ouvre VRM une fois, puis redemande.',
    retirer: (t, code, jours) => `Prochain colis à retirer : ${t || 'un colis'}${code ? `, code ${code.split('').join(' ')}` : ', pas de code noté'}${jours === 0 ? ', dernier jour aujourd’hui' : jours === 1 ? ', dernier jour demain' : ''}.`,
    retirerRien: 'Aucun colis à retirer.',
    retirerPasSu: 'Je ne sais pas encore quels colis sont à retirer : ouvre VRM une fois, puis redemande.',
    vu: (h) => ` (d’après VRM à ${h})`,
  },
  en: {
    vendu: (e, n, auMoins) => `${auMoins ? 'At least ' : ''}${e} sold today, ${n} ${plur(n, 'sale', 'sales')}.`,
    venduRien: 'No sales today yet.',
    venduPasSu: 'I don’t have today’s sales yet: open VRM once, then ask again.',
    envoyer: (n, auMoins) => n === 0 ? 'No parcels to send.' : `${auMoins ? 'At least ' : ''}${n} ${plur(n, 'parcel', 'parcels')} to send.`,
    envoyerPasSu: 'I don’t know how many parcels are waiting: open VRM once, then ask again.',
    retirer: (t, code, jours) => `Next parcel to collect: ${t || 'a parcel'}${code ? `, code ${code.split('').join(' ')}` : ', no code saved'}${jours === 0 ? ', last day today' : jours === 1 ? ', last day tomorrow' : ''}.`,
    retirerRien: 'No parcels to collect.',
    retirerPasSu: 'I don’t know yet which parcels are waiting: open VRM once, then ask again.',
    vu: (h) => ` (according to VRM at ${h})`,
  },
  es: {
    vendu: (e, n, auMoins) => `${auMoins ? 'Al menos ' : ''}${e} vendidos hoy, ${n} ${plur(n, 'venta', 'ventas')}.`,
    venduRien: 'Ninguna venta hoy por ahora.',
    venduPasSu: 'Aún no tengo las ventas de hoy: abre VRM una vez y vuelve a preguntar.',
    envoyer: (n, auMoins) => n === 0 ? 'Ningún paquete por enviar.' : `${auMoins ? 'Al menos ' : ''}${n} ${plur(n, 'paquete', 'paquetes')} por enviar.`,
    envoyerPasSu: 'No sé cuántos paquetes hay por enviar: abre VRM una vez y vuelve a preguntar.',
    retirer: (t, code, jours) => `Próximo paquete por recoger: ${t || 'un paquete'}${code ? `, código ${code.split('').join(' ')}` : ', sin código guardado'}${jours === 0 ? ', último día hoy' : jours === 1 ? ', último día mañana' : ''}.`,
    retirerRien: 'Ningún paquete por recoger.',
    retirerPasSu: 'Aún no sé qué paquetes hay por recoger: abre VRM una vez y vuelve a preguntar.',
    vu: (h) => ` (según VRM a las ${h})`,
  },
  it: {
    vendu: (e, n, auMoins) => `${auMoins ? 'Almeno ' : ''}${e} venduti oggi, ${n} ${plur(n, 'vendita', 'vendite')}.`,
    venduRien: 'Nessuna vendita oggi per ora.',
    venduPasSu: 'Non ho ancora le vendite di oggi: apri VRM una volta, poi richiedi.',
    envoyer: (n, auMoins) => n === 0 ? 'Nessun pacco da spedire.' : `${auMoins ? 'Almeno ' : ''}${n} ${plur(n, 'pacco', 'pacchi')} da spedire.`,
    envoyerPasSu: 'Non so quanti pacchi sono da spedire: apri VRM una volta, poi richiedi.',
    retirer: (t, code, jours) => `Prossimo pacco da ritirare: ${t || 'un pacco'}${code ? `, codice ${code.split('').join(' ')}` : ', nessun codice salvato'}${jours === 0 ? ', ultimo giorno oggi' : jours === 1 ? ', ultimo giorno domani' : ''}.`,
    retirerRien: 'Nessun pacco da ritirare.',
    retirerPasSu: 'Non so ancora quali pacchi sono da ritirare: apri VRM una volta, poi richiedi.',
    vu: (h) => ` (secondo VRM alle ${h})`,
  },
  de: {
    vendu: (e, n, auMoins) => `${auMoins ? 'Mindestens ' : ''}${e} heute verkauft, ${n} ${plur(n, 'Verkauf', 'Verkäufe')}.`,
    venduRien: 'Heute noch keine Verkäufe.',
    venduPasSu: 'Ich habe die heutigen Verkäufe noch nicht: öffne VRM einmal und frag dann erneut.',
    envoyer: (n, auMoins) => n === 0 ? 'Keine Pakete zu versenden.' : `${auMoins ? 'Mindestens ' : ''}${n} ${plur(n, 'Paket', 'Pakete')} zu versenden.`,
    envoyerPasSu: 'Ich weiß nicht, wie viele Pakete zu versenden sind: öffne VRM einmal und frag dann erneut.',
    retirer: (t, code, jours) => `Nächstes Paket zum Abholen: ${t || 'ein Paket'}${code ? `, Code ${code.split('').join(' ')}` : ', kein Code gespeichert'}${jours === 0 ? ', heute letzter Tag' : jours === 1 ? ', letzter Tag morgen' : ''}.`,
    retirerRien: 'Keine Pakete abzuholen.',
    retirerPasSu: 'Ich weiß noch nicht, welche Pakete warten: öffne VRM einmal und frag dann erneut.',
    vu: (h) => ` (laut VRM um ${h})`,
  },
};
const langueDe = (l) => (LANGUES_SIRI.includes(l) ? l : 'fr');

// ── Ce que l'APP publie ─────────────────────────────────────────────────────
// Le « vendu aujourd'hui » pour `widget_stats` (seulement quand la coque publie un vendu COMPLET).
//   caJour, ventesJour : `liveStats` (la règle `ventesFaites`) ; nonComptees : ventes du jour
//   sans montant lisible (comptées dans `ventesJour`, pas dans `caJour`) ⇒ « au moins ».
export function vendusDuJourPublies({ caJour, ventesJour, nonComptees = 0, maintenant = Date.now() } = {}) {
  const ca = Number(caJour), n = Number(ventesJour);
  if (!Number.isFinite(ca) || ca < 0 || !Number.isInteger(n) || n < 0) return null;
  return { jour: jourParis(maintenant), caJour: Math.round(ca * 100) / 100, ventesJour: n, caJourNonComptees: Math.max(0, Math.round(Number(nonComptees) || 0)) };
}

// La ligne `siri_retrait` : les 3 prochains colis COMPTÉS « à retirer » (la publication
// `vrm_colis_retirer.colis`, mêmes tuples [limite, arrivée, transporteur, identité, sûre,
// suivis, limiteAt, nom]), avec le code de LEUR commande seulement si la copie des codes
// (`vrm_codes_hors_ligne.codes`) en donne UN pour cette identité, compté, sans désaccord.
// Rend null quand la publication manque (rien n'est écrit : la dernière reste).
export function publicationSiriRetrait({ pubRetirer, codes, uid = '', maintenant = Date.now() } = {}) {
  if (!pubRetirer || typeof pubRetirer !== 'object' || !Array.isArray(pubRetirer.colis)) return null;
  const parId = new Map();
  for (const c of (Array.isArray(codes) ? codes : [])) {
    if (!c || !c.id || !c.compte || c.desaccord || !/^[A-Za-z0-9]{3,12}$/.test(String(c.code || ''))) continue;
    if (parId.has(c.id) && parId.get(c.id) !== String(c.code)) { parId.set(c.id, null); continue; }   // deux codes ⇒ aucun
    parId.set(c.id, String(c.code));
  }
  const aujourdhui = jourParis(maintenant);
  const l = [];
  for (const c of pubRetirer.colis) {
    if (!Array.isArray(c)) continue;
    const e = etatRetrait({ limite: c[0] || null, arriveeMs: Number(c[1]) || null, transporteur: c[2] || '', limiteAt: typeof c[6] === 'string' && c[6] ? c[6] : null }, maintenant, aujourdhui);
    if (estAVerifier(e)) continue;
    l.push({ t: String(c[2] || '').slice(0, 20), code: parId.get(String(c[3] || '')) || '', l: typeof c[0] === 'string' ? c[0] : '', la: typeof c[6] === 'string' ? c[6] : '', a: Number(c[1]) || 0, j: Number.isFinite(e.jours) ? e.jours : 9999 });
  }
  l.sort((x, y) => x.j - y.j);
  return { at: Number.isFinite(Number(pubRetirer.at)) ? Number(pubRetirer.at) : maintenant, uid: String(uid || ''), total: l.length, prochains: l.slice(0, 3).map(({ j, ...x }) => x) };
}

// ── Ce que le SERVEUR répond ────────────────────────────────────────────────
//   stats : `widget_stats` projeté ({ jour, caJour, ventesJour, caJourNonComptees, aExpedier, updatedAt })
//   retrait : la ligne `siri_retrait` ({ at, prochains, total }) ou null
// Rend { texte, etat: 'lu'|'pasSu', valeur? } — `valeur` pour le banc (jamais lue par Siri).
export function reponseVendu(stats, { maintenant = Date.now(), langue = 'fr' } = {}) {
  const L = P[langueDe(langue)];
  const s = stats && typeof stats === 'object' ? stats : null;
  if (!s || s.jour !== jourParis(maintenant) || !Number.isFinite(Number(s.caJour)) || !Number.isInteger(Number(s.ventesJour))) return { texte: L.venduPasSu, etat: 'pasSu' };
  const n = Number(s.ventesJour), ca = Number(s.caJour), nc = Number(s.caJourNonComptees) || 0;
  const at = Date.parse(s.updatedAt || '');
  const vu = Number.isFinite(at) ? L.vu(heureParis(at, langueDe(langue))) : '';
  if (n === 0) return { texte: L.venduRien.replace(/\.$/, vu + '.'), etat: 'lu', valeur: { eur: 0, n: 0 } };
  return { texte: L.vendu(eurTexte(ca, langueDe(langue)), n, nc > 0).replace(/\.$/, vu + '.'), etat: 'lu', valeur: { eur: ca, n, auMoins: nc > 0 } };
}
export function reponseEnvoyer(stats, { maintenant = Date.now(), langue = 'fr' } = {}) {
  const L = P[langueDe(langue)];
  const a = stats && stats.aExpedier && typeof stats.aExpedier === 'object' ? stats.aExpedier : null;
  const at = a ? Number(a.at) : NaN;
  if (!a || a.n == null || !Number.isInteger(Number(a.n)) || !Number.isFinite(at) || maintenant - at > FRAIS_MS || at - maintenant > 600000) return { texte: L.envoyerPasSu, etat: 'pasSu' };
  const n = Number(a.n);
  return { texte: L.envoyer(n, !!a.auMoins).replace(/\.$/, L.vu(heureParis(at, langueDe(langue))) + '.'), etat: 'lu', valeur: { n, auMoins: !!a.auMoins } };
}
export function reponseRetirer(retrait, { maintenant = Date.now(), langue = 'fr' } = {}) {
  const L = P[langueDe(langue)];
  const r = retrait && typeof retrait === 'object' ? retrait : null;
  const at = r ? Number(r.at) : NaN;
  if (!r || !Array.isArray(r.prochains) || !Number.isFinite(at) || maintenant - at > FRAIS_MS || at - maintenant > 600000) return { texte: L.retirerPasSu, etat: 'pasSu' };
  // Relu à l'heure de la question : un colis dont la limite est passée depuis sort (« à vérifier »).
  const auj = jourParis(maintenant);
  const vivants = r.prochains.map((x) => ({ x, e: etatRetrait({ limite: x.l || null, arriveeMs: Number(x.a) || null, transporteur: x.t || '', limiteAt: x.la || null }, maintenant, auj) }))
    .filter(({ e }) => !estAVerifier(e)).sort((p, q) => (Number.isFinite(p.e.jours) ? p.e.jours : 9999) - (Number.isFinite(q.e.jours) ? q.e.jours : 9999));
  const vu = L.vu(heureParis(at, langueDe(langue)));
  if (!vivants.length) return { texte: (Number(r.total) > r.prochains.length ? L.retirerPasSu : L.retirerRien.replace(/\.$/, vu + '.')), etat: Number(r.total) > r.prochains.length ? 'pasSu' : 'lu', valeur: { n: 0 } };
  const p = vivants[0];
  return { texte: L.retirer(nomTransporteur(p.x.t), String(p.x.code || ''), Number.isFinite(p.e.jours) ? p.e.jours : null).replace(/\.$/, vu + '.'), etat: 'lu', valeur: { transporteur: nomTransporteur(p.x.t), code: String(p.x.code || ''), n: vivants.length } };
}
export function reponseSiri(q, { stats, retrait, maintenant = Date.now(), langue = 'fr' } = {}) {
  const o = { maintenant, langue };
  if (q === 'vendu') return reponseVendu(stats, o);
  if (q === 'envoyer') return reponseEnvoyer(stats, o);
  if (q === 'retirer') return reponseRetirer(retrait, o);
  const t = [reponseVendu(stats, o), reponseEnvoyer(stats, o), reponseRetirer(retrait, o)];
  return { texte: t.map((x) => x.texte).join(' '), etat: t.every((x) => x.etat === 'lu') ? 'lu' : 'pasSu' };
}
