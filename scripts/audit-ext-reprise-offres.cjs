#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LE SERVICE WORKER TUÉ AU MILIEU D'UNE RÉPONSE À UNE OFFRE — JAMAIS DEUX FOIS LE MÊME GESTE
//  (22 nov., audit complet de l'extension)
//
//  Chrome tue un service worker MV3 quand il veut (§4.9). La republication, le prix en attente, les favoris et les
//  commandes à distance ont chacun leur audit de reprise ; la NÉGOCIATION (contre-offre par palier, acceptation,
//  refus, « rester flexible », et le message qui suit) n'en avait pas.
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs). Pour chaque séquence et pour CHAQUE écriture chez
//  Vinted qu'elle fait, la k-ième écriture ne revient jamais (le worker meurt pendant qu'elle est en vol), puis un
//  worker NEUF repart du même `chrome.storage.local` et de la même base, plusieurs passages. Deux mondes :
//   · « arrivée »     : Vinted a reçu la requête (l'offre n'attend plus) ;
//   · « pas arrivée » : Vinted ne l'a jamais reçue (l'offre attend encore).
//  On juge, sur les DEUX vies ensemble :
//   R1  aucune écriture identique (méthode, chemin, corps) ne part deux fois quand la première est arrivée ;
//   R2  jamais deux contre-offres au même prix dans la même négociation, même si la première n'est pas arrivée
//       (« mieux vaut un blanc qu'un faux ») ;
//   R3  jamais deux acceptations de la même offre arrivées chez Vinted ;
//   R4  après la reprise, une NOUVELLE offre du même acheteur reçoit le palier SUIVANT, jamais le même.
//  `--src <background.js>` : une autre copie ; `--mutation memo-apres` : le mémo du palier écrit APRÈS le geste ⇒ rouge.
//  Données inventées (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
let BG = cheminSource();
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11) || (process.argv.includes('--mutation') ? process.argv[process.argv.indexOf('--mutation') + 1] : '');
const MUTATIONS = {
  // Le mémo du palier n'est plus écrit AVANT le geste : un worker tué rejoue le même palier.
  'memo-apres': ["        await chrome.storage.local.set({ vrmContreOffres: jt, vrmOffresFaites: st, vrmOffresPrevues: pv });\n        const rc = await contreOffreAuto(", "        const rc = await contreOffreAuto("],
};
if (mut) {
  const M = MUTATIONS[mut]; if (!M) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8');
  if (!s.includes(M[0])) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(os.tmpdir(), `bg-reprise-offres-${mut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.split(M[0]).join(M[1]));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 500) : '')); } };
const T0 = Date.now(), iso = (t) => new Date(t).toISOString();
const ecriture = (x) => String(x.methode || '').toUpperCase() !== 'GET';
const cle = (x) => `${x.methode} ${x.chemin} ${typeof x.corps === 'string' ? x.corps : JSON.stringify(x.corps || null)}`;
const prixOffre = (x) => { try { const b = typeof x.corps === 'string' ? JSON.parse(x.corps) : (x.corps || {}); return Number(b.offer && b.offer.price); } catch (_) { return NaN; } };
const estContre = (x) => /\/transactions\/777\/offers$/.test(x.chemin) && x.methode === 'POST';
const estAccept = (x) => /offer_requests\/\d+\/accept$/.test(x.chemin);

// Un monde : `etat` est partagé par les deux vies (stockage, base, ce que Vinted sait).
function vie(etat, { reglages, tuerA = 0, arrive = true }) {
  const f = faireFond({ src: BG, connecte: '111', lignes: etat.lignes, store: etat.store, vinted: (req) => {
    if (!ecriture(req)) return { status: 200, body: { code: 0 } };
    etat.nEcritures++;
    const meurt = tuerA && etat.nEcritures === tuerA && !etat.tue;
    if (!meurt || arrive) { etat.arrivees.push(req); if (estContre(req) || estAccept(req) || /\/reject$/.test(req.chemin)) etat.offre = null; }   // Vinted l'a reçue : l'offre n'attend plus
    if (meurt) { etat.tue = true; return new Promise(() => {}); }   // la réponse ne revient jamais : le worker est mort
    return { status: 200, body: { code: 0 } };
  } });
  f.ctx.offresEnAttente = async () => (etat.offre ? [Object.assign({ acheteur: '555', noteBrute: { rep: '0.96', rc: '40', cap: new Date().toISOString() } }, etat.offre)] : []);
  f.ctx.relireOffre = async (acc, o) => ({ etat: etat.offre && String(etat.offre.oid) === String(o.oid) ? 'attend' : 'plus' });
  f.ctx.secuGeste = async () => null;
  f.ctx.porteDiscretion = async () => null;
  f.ctx.prolongerVerrouStock = async () => true;
  f.ctx.delaiOffreMs = () => -60000;
  void reglages;
  return f;
}
function monde(plus = {}, auto = false, offre) {
  return { nEcritures: 0, tue: false, arrivees: [], store: {}, offre: offre || { conv: '9001', prix: 70, tx: '777', oid: '901', item: '4242', pseudo: 'acheteuse', article: 'Paire' },
    lignes: {
      main: { vinted_offres_auto: auto, vinted_offres_garde: { v: 1, at: T0, complet: true, items: [] }, vinted_offres_paliers: Object.assign({ actif: true, paliers: [50, 80, 100], messages: [] }, plus), vinted_annonce_numeros: { 4242: { numero: '12', accountId: '111', min: 85 } }, vinted_buyprice_by_num: {} },
      vinted_listing_dates: {},
      harvest_111_listings: { type: 'listings', capturedAt: iso(T0 - 600000), payload: { items: [{ id: 4242, title: 'Paire', price: { amount: '100.0' } }] } },
    } };
}
const passages = async (f, n = 2, ms = 2500) => { for (let i = 0; i < n; i++) await Promise.race([f.ctx.autoAccepterOffresUnPassage('111', 'v'), new Promise((r) => setTimeout(r, ms))]); };

const SEQUENCES = [
  { nom: 'contre-offre par palier + son message', plus: { msgContre: ['Je peux faire {price}'] }, offre: null },
  { nom: '« rester flexible » : acceptation + message', plus: { flexible: { actif: true, ecart: 2 }, msgAccepte: ['Ok pour {price} !'] }, offre: { conv: '9001', prix: 92, tx: '777', oid: '909', item: '4242', pseudo: 'acheteuse', article: 'Paire' } },
];

(async () => {
  for (const S of SEQUENCES) {
    console.log(`\n${S.nom}`);
    // La séquence entière, sans arrêt : combien d'écritures ?
    const e0 = monde(S.plus, false, S.offre);
    const f0 = vie(e0, {});
    await passages(f0, 2);
    const N = e0.arrivees.length;
    dit(N >= 2, `la séquence complète fait ${N} écriture(s) chez Vinted (geste + message)`, JSON.stringify(e0.arrivees.map((x) => x.methode + ' ' + x.chemin)));
    for (let k = 1; k <= N; k++) for (const arrive of [true, false]) {
      const nom = `tué à l’écriture ${k}/${N} (${arrive ? 'arrivée' : 'pas arrivée'} chez Vinted)`;
      const e = monde(S.plus, false, S.offre);
      const f1 = vie(e, { tuerA: k, arrive });
      await passages(f1, 2, 700);
      if (!e.tue) { dit(false, `${nom} : le worker a bien été tué`); continue; }
      // Le worker NEUF : même stockage, même base. Trois passages (l'alarme le réveille plusieurs fois).
      const f2 = vie(e, {});
      await passages(f2, 3);
      const vues = {}; for (const x of e.arrivees) vues[cle(x)] = (vues[cle(x)] || 0) + 1;
      const doubles = Object.keys(vues).filter((c) => vues[c] > 1);
      dit(doubles.length === 0, `R1 ${nom} : aucune écriture identique arrivée deux fois`, doubles.join(' | '));
      const contres = [...f1.j.vinted, ...f2.j.vinted].filter(estContre).map(prixOffre);
      dit(new Set(contres).size === contres.length, `R2 ${nom} : jamais deux contre-offres au même prix (parties : ${contres.join(', ') || 'aucune'})`, JSON.stringify(contres));
      dit(e.arrivees.filter(estAccept).length <= 1, `R3 ${nom} : au plus une acceptation arrivée`, e.arrivees.filter(estAccept).length);
      if (S.offre === null) {
        // R4 : l'acheteur refait une offre ⇒ le palier SUIVANT (88), jamais 93 une seconde fois.
        e.offre = { conv: '9001', prix: 75, tx: '777', oid: '902', item: '4242', pseudo: 'acheteuse', article: 'Paire' };
        await passages(f2, 2);
        const apres = [...f1.j.vinted, ...f2.j.vinted].filter(estContre).map(prixOffre);
        dit(apres.filter((p) => p === 93).length <= 1 && apres.includes(88), `R4 ${nom} : la nouvelle offre reçoit le palier suivant (88 €), 93 € n’est pas rejoué`, JSON.stringify(apres));
      }
    }
  }
  console.log(`\n${ko ? '❌' : '✅'} reprise des offres après un worker tué : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
