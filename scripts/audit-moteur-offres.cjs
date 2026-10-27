// ════════════════════════════════════════════════════════════════════════════
//  LE MOTEUR D'ACCEPTATION AUTOMATIQUE DES OFFRES (Vinted) — EXÉCUTÉ (§4.10)
//
//  Décision de Julien, 27 octobre (« Moteur auto (accepte seul) », le risque sous
//  les yeux ; il a aussi dit, en propriétaire du compte, que l'acceptation auto
//  n'est PAS ce qui a bloqué `vanessa5723`). On NE vérifie donc pas que « rien
//  n'accepte » — on vérifie que ce qui accepte reste SOUS GARDE, en EXÉCUTANT le
//  vrai `autoAccepterOffres` de `background.js` dans un `vm` (faux Vinted qui
//  COMPTE les requêtes, fausse base à état) :
//    · offre ≥ mini  ⇒ UNE acceptation part (PUT …/accept), et elle est mémorisée ;
//    · offre < mini · interrupteur éteint · « pas su » · autre compte connecté ·
//      pause Vinted · offre déjà traitée  ⇒ RIEN ne part ;
//    · volume borné (OFFRES_MAX_PAR_VISITE) : 4 offres éligibles ⇒ 3 acceptées.
//
//  §6.1 — `--prouve` rejoue la scène « offre ≥ mini » sur le background.js de
//  `origin/main` (où le moteur n'existe pas) : 0 acceptation ⇒ la preuve est
//  rouge sur le code d'avant.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };

const UID = '111';
const nowISO = () => new Date().toISOString();

// Une conversation captée qui porte UNE offre en attente de CE compte.
function conv({ item, tx, oid, price, user = 500 }) {
  return {
    capturedAt: nowISO(),
    payload: { conversation: {
      id: 'c' + oid, description: 'Nike Air',
      opposite_user: { id: user, login: 'acheteur' },
      transaction: { item_id: String(item) },
      messages: [{
        entity_type: 'offer_request_message',
        entity: { user_id: user, current: true, status: 10, status_title: '',
          price: { amount: String(price), currency_code: 'EUR' },
          transaction_id: Number(tx), offer_request_id: Number(oid) },
      }],
    } },
  };
}

// Construit un fond : une liste d'offres, chacune avec son mini / refus sur l'annonce.
function monter({ offres, actif = true, msgRefus = '', store = {}, lectureKO, connecte = UID, src } = {}) {
  const nums = {};
  const lignes = {};
  for (const o of offres) {
    nums[String(o.item)] = { num: String(o.item), min: o.min, refuse: o.refuse };
    lignes[`harvest_${UID}_conv_${o.oid}`] = conv(o);
  }
  lignes.main = { capturedAt: nowISO(), vinted_offres_auto: actif, vinted_annonce_numeros: nums, vinted_offre_refus_msg: msgRefus };
  return faireFond({
    src, lignes, connecte, store, lectureKO,
    // Le faux Vinted accepte tout ce qu'on lui demande (200) — on mesure ce qui PART.
    vinted: () => ({ status: 200, body: {} }),
  });
}

const accepts = (j) => j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/accept$/.test(v.chemin)).length;
const refus = (j) => j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/reject$/.test(v.chemin)).length;
const messages = (j) => j.vinted.filter((v) => v.methode === 'POST' && /\/conversations\/[^/]+\/replies$/.test(v.chemin)).length;

async function run(opts) {
  const f = monter(opts);
  if (typeof f.ctx.autoAccepterOffres !== 'function') return { f, n: 0, absent: true };
  let n = 0; try { n = await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  return { f, n };
}

const OFFRE = { item: 444, tx: 9001, oid: 7001, price: 45, min: 40 };   // 45 ≥ 40

(async () => {
  if (process.argv.includes('--prouve')) {
    const cp = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
    const avant = path.join(os.tmpdir(), 'bg-avant-moteur-offres.js');
    fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }));
    const { f, n, absent } = await run({ offres: [OFFRE], src: avant });
    dit(accepts(f.j) === 0 && n === 0, "§6.1 — sur le code COMMITÉ (HEAD), aucune acceptation ne part (le moteur n'existe pas)",
      `accepts=${accepts(f.j)} n=${n} absent=${!!absent}`);
    console.log(ko ? `\n❌ preuve §6.1 : ${ko} rouge(s)` : `\n✅ preuve §6.1 : le moteur n'accepte RIEN sur le code d'avant — il fallait l'ajouter`);
    process.exit(ko ? 1 : 0);
  }

  // A — offre ≥ mini : UNE acceptation part, et elle est mémorisée.
  { const { f, n } = await run({ offres: [OFFRE] });
    dit(accepts(f.j) === 1 && n === 1, "offre ≥ mini : UNE acceptation part vers Vinted (PUT …/offer_requests/…/accept)", `accepts=${accepts(f.j)} n=${n}`);
    const memo = f.store.vrmOffresFaites || {};
    dit(!!memo[String(OFFRE.oid)], "l'offre acceptée est mémorisée (vrmOffresFaites) — jamais ré-acceptée", JSON.stringify(memo)); }

  // B — offre < mini : rien.
  { const { f } = await run({ offres: [{ ...OFFRE, min: 50 }] });   // 45 < 50
    dit(accepts(f.j) === 0, "offre SOUS le mini : rien n'est accepté (c'est à toi de contrer)"); }

  // C — interrupteur éteint : rien.
  { const { f } = await run({ offres: [OFFRE], actif: false });
    dit(accepts(f.j) === 0, "interrupteur éteint (défaut) : rien n'est accepté"); }

  // D — « pas su » : la ligne `main` est illisible ⇒ offreAutoReglages rend null.
  { const { f } = await run({ offres: [OFFRE], lectureKO: (u) => /id=eq\.main/.test(u) });
    dit(accepts(f.j) === 0, "« pas su » (main illisible, 522) : rien n'est accepté — on n'allume pas sur un trou"); }

  // E — navigateur connecté à un AUTRE compte : garde bloque.
  { const { f } = await run({ offres: [OFFRE], connecte: '999' });
    dit(accepts(f.j) === 0, "navigateur sur un AUTRE compte Vinted : la garde bloque, rien n'est accepté (§3)"); }

  // F — Vinted a demandé de ralentir : pause active ⇒ rien.
  { const { f } = await run({ offres: [OFFRE], store: { vrmPauseVinted: { jusqua: Date.now() + 600000, niveau: 1, statut: 429 } } });
    dit(accepts(f.j) === 0, "pause Vinted (429/403) active : rien ne part (arrêt net — §3)"); }

  // G — offre déjà traitée : jamais deux fois.
  { const { f } = await run({ offres: [OFFRE], store: { vrmOffresFaites: { [String(OFFRE.oid)]: Date.now() } } });
    dit(accepts(f.j) === 0, "offre déjà traitée (mémo) : jamais acceptée deux fois"); }

  // H — volume borné : 4 offres éligibles, OFFRES_MAX_PAR_VISITE plafonne à 3.
  { const quatre = [0, 1, 2, 3].map((i) => ({ item: 500 + i, tx: 9100 + i, oid: 7100 + i, price: 60, min: 40 }));
    const { f } = await run({ offres: quatre });
    dit(accepts(f.j) === 3, "volume borné : 4 offres éligibles ⇒ 3 acceptées au plus (OFFRES_MAX_PAR_VISITE)", `accepts=${accepts(f.j)}`); }

  // I — offre SOUS le seuil de refus : UN refus part ; pas de message si aucun texte.
  { const { f } = await run({ offres: [{ item: 444, tx: 9001, oid: 7001, price: 20, refuse: 30 }] });  // 20 < 30
    dit(refus(f.j) === 1 && accepts(f.j) === 0, "offre < refuse : UN refus part (PUT …/reject), aucune acceptation", `refus=${refus(f.j)} acc=${accepts(f.j)}`);
    dit(messages(f.j) === 0, "aucun message configuré ⇒ refus SANS rien écrire à l'acheteur"); }

  // J — offre ENTRE le refuse et le mini : rien (à lui de négocier).
  { const { f } = await run({ offres: [{ item: 444, tx: 9001, oid: 7001, price: 35, min: 40, refuse: 30 }] });  // 30 ≤ 35 < 40
    dit(accepts(f.j) === 0 && refus(f.j) === 0, "offre entre le refuse et le mini : ni accepté ni refusé"); }

  // K — refus AVEC le message du vendeur : le refus ET son message partent.
  { const { f } = await run({ offres: [{ item: 444, tx: 9001, oid: 7001, price: 20, refuse: 30 }], msgRefus: 'Merci, trop bas pour moi 🙂' });
    dit(refus(f.j) === 1 && messages(f.j) === 1, "refus + message du vendeur : le refus ET SON message (POST …/replies) partent", `refus=${refus(f.j)} msg=${messages(f.j)}`); }

  console.log(ko
    ? `\n❌ audit-moteur-offres : ${ko} contrôle(s) rouge(s), ${ok} vert(s)`
    : `\n✅ audit-moteur-offres : ${ok} contrôles — le moteur accepte sous garde, et rien ne part dans les six cas interdits`);
  process.exit(ko ? 1 : 0);
})();
