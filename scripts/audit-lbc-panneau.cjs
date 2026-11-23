#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN DANS LE PANNEAU (5.445, 23 nov.) — « pareil pour Leboncoin »
//  Captures de Julien (23 nov.) : sur leboncoin.fr le panneau disait « Tes annonces
//  n'ont pas pu être lues » SUR « Mes annonces », « Tes ventes n'ont pas pu être
//  lues » après « 12 ventes lues », et « Ouvre « Mes transactions » » sur chaque
//  écran. Mesuré sur sa base : les lectures du fond répondaient (200) ; le panneau
//  avait gardé 60 s une réponse « compte de l'onglet pas encore reconnu » (sans
//  annonces ni ventes) et la lisait comme « pas pu être lues ». Et `lbc_ventes`
//  mêle ventes (`isSeller`) et ACHATS : le panneau montrait ses achats comme des
//  ventes, en « à expédier », au prix ×100.
//
//  Cet audit EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs, fausse base à
//  état, projections appliquées) et la vraie règle de l'app (src/App.jsx) :
//   R. la règle d'une transaction (annulée / finalisée / partie) = celle de l'app,
//      ligne pour ligne, sur une grille de cas ;
//   V. ventes = `isSeller === true`, achats = `false`, sens inconnu = ni l'un ni
//      l'autre (compté à part) ; une vente livrée n'est jamais « à expédier » ;
//      prix en centimes ⇒ euros ; n° de suivi = `label.reference` seulement ;
//      adresse de suivi chez un transporteur connu seulement ; un autre compte ne
//      se montre pas ;
//   A. une sortie « pas encore » le DIT (`attente`) au lieu de rendre une liste vide ;
//   M. conversations : celles de CE compte, aucun nom ; porte-monnaie de CE compte ;
//   C. capture : la liste des conversations n'est rangée que pour le compte de
//      l'onglet, qui doit aussi être celui de la page et un des siens ; aucun nom
//      rangé ; une lecture ratée n'écrit rien ; les autres comptes restent ;
//   G. « Ouvre « Mes transactions » » se tait quand CE compte a été lu ailleurs.
//  `--prouve` : rouge sur origin/main, puis chaque mutation rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process'), vm = require('vm');
const RACINE = process.env.LBCP_RACINE || path.join(__dirname, '..');
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const SRC = process.env.LBCP_SRC || path.join(RACINE, 'vinted-sync-extension', 'background.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 300) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && (e.stack || e.message)); } };
const T0 = Date.now(), J = 864e5, iso = (ms) => new Date(ms).toISOString();
const A = '11111111-2222-4333-8444-555555555555', B = '99999999-8888-4777-8666-555555555555';
const ONGLET = (id = 9) => ({ tab: { id, url: 'https://www.leboncoin.fr/compte/part/mes-annonces' }, frameId: 0 });

function lignes(extra = {}) {
  const tx = (id, o) => Object.assign({ txId: String(id), account: 'lbc-account:' + A, title: 'Nike Dunk Low 42', price: 5800, dateVente: iso(T0 - J) }, o);
  return Object.assign({
    main: {},
    lbc_listings: { updatedAt: iso(T0), items: { 3000000001: { id: '3000000001', subject: 'Nike Dunk Low 42', price: 58, status: 'active', account: A, images: ['https://img.leboncoin.fr/a.jpg'], stats: { favoris: 4, vues: 120, messages: 2 } } } },
    lbc_ventes: { updatedAt: iso(T0), ventes: {
      v1: tx(100000001, { isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement effectué', parcelStatus: 'delivered', parcelColor: 'finished', deliveryMethod: 'mondial_relay', deliveryLabel: 'Mondial Relay', label: { reference: '71911374', trackingUrl: 'https://www.mondialrelay.fr/suivi/?n=71911374' } }),
      v2: tx(100000002, { isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement validé', dateVente: iso(T0) }),
      v3: tx(100000003, { isSeller: true, stepStatus: 'validation', stepLabel: 'Colis en cours de livraison', parcelStatus: 'in_transit', label: { reference: 'AB12', trackingUrl: 'https://piege.example/suivi' } }),
      a1: tx(200000001, { isSeller: false, stepStatus: 'validation', stepLabel: 'Terminé', parcelStatus: 'delivered', parcelColor: 'finished', price: 2500 }),
      a2: tx(200000002, { isSeller: false, stepStatus: 'validation', stepLabel: 'Paiement validé', price: 1000 }),
      x1: tx(300000001, { stepStatus: 'cancelled' }),
      autre: tx(400000001, { account: 'lbc-account:' + B, isSeller: true, stepStatus: 'validation', title: 'Nike Dunk Low 42' }),
    } },
    lbc_messages: { compteurs: { [A]: { unread: 7, at: iso(T0) } } },
    lbc_conversations: { comptes: { [A]: { at: iso(T0), liste: [{ conv: 'aaaaaaaa-0000-4000-8000-000000000001', annonce: '3000000001', titre: 'Nike Dunk Low 42', photo: '', at: iso(T0 - 60000), apercu: 'Toujours dispo ?', nonlus: 1 }] },
      [B]: { at: iso(T0), liste: [{ conv: 'bbbbbbbb-0000-4000-8000-000000000001', titre: 'Autre compte', at: iso(T0), apercu: 'x', nonlus: 3 }] } } },
    lbc_porte_monnaie: { comptes: { [A]: { available: 0, incoming: 0, at: iso(T0) }, [B]: { available: 999, incoming: 1, at: iso(T0) } } },
  }, extra);
}
function monde(opts = {}) {
  const store = Object.assign({ vrmLbcCompte: { v: 2, id: 'lbc-account:' + A, name: 'Totomondu' }, vrmLbcTransport: { 9: { compte: 'lbc-account:' + A, capteur: true, source: 'prive', at: T0 } } }, opts.store || {});
  return faireFond({ src: SRC, lignes: opts.lignes || lignes(), store, onglets: [{ id: 9, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }], lectureKO: opts.lectureKO, ecritureKO: opts.ecritureKO });
}
const listes = (f, sender = ONGLET()) => f.ctx.carteListes({ from: 'vrm-badge', action: 'carteListes' }, sender);

// La règle de l'app, telle quelle (les trois `const` de src/App.jsx).
function regleApp() {
  const t = fs.readFileSync(APP, 'utf8');
  const pick = (nom) => { const i = t.indexOf('const ' + nom + ' ='); if (i < 0) throw new Error(nom + ' absente de App.jsx'); const finLigne = t.indexOf('\n', i); const bloc = /\{\s*$/.test(t.slice(i, finLigne)); const j = bloc ? t.indexOf('\n};', i) + 3 : finLigne; return t.slice(i, j); };
  const code = ['lbcAnnulee', 'lbcFinalisee', 'lbcExpediee'].map(pick).join('\n') + '\n;({ lbcAnnulee, lbcFinalisee, lbcExpediee })';
  return vm.runInNewContext(code, {});
}

(async () => {
  console.log('R. La règle d’une transaction = celle de l’app');
  await essai('R', async () => {
    const app = regleApp(), f = monde();
    const ext = { a: f.ctx.lbcTxAnnulee, f: f.ctx.lbcTxFinalisee, e: f.ctx.lbcTxExpediee };
    dit(typeof ext.a === 'function' && typeof ext.f === 'function' && typeof ext.e === 'function', 'le fond porte les trois règles (annulée, finalisée, partie)');
    const cas = [];
    for (const stepStatus of [undefined, 'validation', 'done', 'cancelled', 'paid'])
      for (const parcelStatus of [undefined, 'delivered', 'in_transit', 'out_for_delivery', 'refunded', 'waiting_deposit'])
        for (const parcelColor of [undefined, 'finished', 'in_progress'])
          for (const stepLabel of [undefined, 'Paiement effectué', 'Terminé', 'En cours de livraison', 'Colis à envoyer', 'Paiement validé', 'Annulée'])
            cas.push({ stepStatus, parcelStatus, parcelColor, stepLabel });
    const diff = typeof ext.a !== 'function' ? cas : cas.filter((o) => (app.lbcAnnulee(o) !== ext.a(o) || app.lbcFinalisee(o) !== ext.f(o) || app.lbcExpediee(o) !== ext.e(o)));
    dit(cas.length > 500 && diff.length === 0, `${cas.length} cas : même verdict que l’app partout`, JSON.stringify(diff[0]));
  });

  console.log('V. Ventes et achats du compte de l’onglet');
  await essai('V', async () => {
    const r = await listes(monde());
    const V = r.ventes || {}, Ac = r.achats || {};
    const ids = (l) => ((l && l.liste) || []).map((x) => x.tx).sort().join(',');
    dit(ids(V) === '100000001,100000002,100000003', 'ventes = les trois `isSeller: true` de CE compte (ni achat, ni sens inconnu, ni l’autre compte)', ids(V));
    dit(ids(Ac) === '200000001,200000002', 'achats = les deux `isSeller: false`', ids(Ac));
    dit(V.inconnues === 1, 'la transaction sans sens est comptée à part (1), jamais rangée', V.inconnues);
    const v = (id) => ((V.liste || []).concat(Ac.liste || [])).find((x) => x.tx === id) || {};
    dit(v('100000001').etat === 'finalisee', 'vente « Paiement effectué », colis livré ⇒ finalisée (pas « à expédier »)', v('100000001').etat);
    dit(v('100000002').etat === 'a_expedier', 'vente payée, rien de parti ⇒ à expédier', v('100000002').etat);
    dit(v('100000003').etat === 'en_route', 'vente en cours de livraison ⇒ en route', v('100000003').etat);
    dit(v('200000001').etat === 'finalisee' && v('200000002').etat === 'pas_su', 'achat reçu ⇒ finalisé ; achat payé pas parti ⇒ pas un « à expédier »', v('200000001').etat + '/' + v('200000002').etat);
    dit(v('100000001').prix === 58 && v('200000001').prix === 25, 'prix en centimes ⇒ euros (5800 ⇒ 58)', v('100000001').prix);
    dit(v('100000001').suivi === '71911374' && v('100000001').transporteurCle === 'mondialrelay' && /mondialrelay\.fr/.test(v('100000001').suiviUrl || ''), 'n° de suivi = label.reference, transporteur reconnu, suivi chez Mondial Relay', JSON.stringify(v('100000001')));
    dit(!v('100000003').suiviUrl, 'une adresse de suivi hors transporteur connu n’est jamais donnée', v('100000003').suiviUrl);
    dit(!JSON.stringify(r).includes('400000001'), 'la vente d’un autre compte Leboncoin n’apparaît nulle part');
    const an = (r.annonces && r.annonces.liste || [])[0] || {};
    dit(an.favoris === 4 && an.vues === 120, 'annonce : favoris et vues en NOMBRES relevés', JSON.stringify(an));
  });

  console.log('A. « Pas encore » se dit, jamais une liste vide');
  await essai('A', async () => {
    const f = monde({ store: { vrmLbcCompte: null, vrmLbcTransport: {} } });
    const r = await listes(f);
    dit(r.ok && r.attente === 'compte' && !r.annonces, 'compte de l’onglet pas reconnu ⇒ attente « compte »', JSON.stringify(r));
    const g = monde({ store: { __sansSession: true } });
    const r2 = await listes(g);
    dit(r2.ok && r2.attente === 'vrm', 'pas de session VRM ⇒ attente « vrm »', JSON.stringify(r2));
  });

  console.log('M. Conversations et porte-monnaie de CE compte');
  await essai('M', async () => {
    const r = await listes(monde());
    const m = r.messages || {};
    dit((m.liste || []).length === 1 && m.liste[0].conv === 'aaaaaaaa-0000-4000-8000-000000000001' && m.nonlusSite === 7, 'la conversation de CE compte (pas celle de l’autre), et ses 7 non lus', JSON.stringify(m));
    dit(!/partner|name|pseudo/i.test(JSON.stringify(m.liste || [])), 'aucun nom d’interlocuteur dans la liste rendue');
    dit(r.porteMonnaie && r.porteMonnaie.disponible === 0 && r.porteMonnaie.aVenir === 0, 'porte-monnaie de CE compte (0), jamais celui de l’autre', JSON.stringify(r.porteMonnaie));
    const r2 = await listes(monde({ lignes: lignes({ lbc_porte_monnaie: undefined }) }));
    dit(r2.porteMonnaie && r2.porteMonnaie.jamais === true, 'porte-monnaie jamais lu ⇒ « jamais », pas 0', JSON.stringify(r2.porteMonnaie));
  });

  console.log('C. Capture des conversations et du porte-monnaie');
  await essai('C', async () => {
    const f = monde();
    f.ctx.comptesMiens = async () => new Set(['lbc-account:' + A, A]);
    const msg = { moi: A, liste: [{ conv: 'cccccccc-0000-4000-8000-000000000009', annonce: '3000000001', titre: 'Nike', at: iso(T0), apercu: 'Bonjour', nonlus: 2, qui: 'Jean Dupont', name: 'Jean Dupont' }] };
    const r = await f.ctx.rangerLbcConversations(msg, ONGLET());
    const row = f.lignes.lbc_conversations || {};
    dit(r && r.ok && row.comptes && row.comptes[A] && row.comptes[A].liste[0].conv === 'cccccccc-0000-4000-8000-000000000009', 'la liste du compte de l’onglet est rangée', JSON.stringify(r));
    dit(row.comptes && row.comptes[B] && row.comptes[B].liste[0].titre === 'Autre compte', 'l’autre compte reste tel quel');
    dit(!/Jean Dupont/.test(JSON.stringify(row)), 'aucun nom rangé (ni `qui`, ni `name`)');
    const f2 = monde(); f2.ctx.comptesMiens = async () => new Set([A]);
    const avant = JSON.stringify(f2.lignes.lbc_conversations);
    const r2 = await f2.ctx.rangerLbcConversations({ moi: B, liste: msg.liste }, ONGLET());
    dit(r2 && r2.ok === false && JSON.stringify(f2.lignes.lbc_conversations) === avant, 'un autre compte que celui de l’onglet ⇒ rien rangé');
    const f3 = monde({ lectureKO: (u) => /lbc_conversations/.test(u) }); f3.ctx.comptesMiens = async () => new Set([A]);
    const avant3 = JSON.stringify(f3.lignes.lbc_conversations);
    const r3 = await f3.ctx.rangerLbcConversations(msg, ONGLET());
    dit(r3 && r3.ok === false && JSON.stringify(f3.lignes.lbc_conversations) === avant3, 'lecture ratée ⇒ rien écrit (§5)');
    const f4 = monde();
    const r4 = await f4.ctx.rangerLbcPorteMonnaie({ available: 1250, incoming: 0 }, ONGLET());
    dit(r4 && r4.ok && f4.lignes.lbc_porte_monnaie.comptes[A].available === 1250 && f4.lignes.lbc_porte_monnaie.comptes[B].available === 999, 'porte-monnaie rangé pour le compte de l’onglet, l’autre gardé');
    const f5 = monde({ store: { vrmLbcTransport: { 9: { compte: 'lbc-account:' + A, ambigue: true } } } });
    const r5 = await f5.ctx.rangerLbcPorteMonnaie({ available: 1, incoming: 0 }, ONGLET());
    dit(r5 && r5.ok === false, 'onglet ambigu (deux comptes) ⇒ porte-monnaie pas rangé');
  });

  console.log('G. Le geste « Ouvre « Mes transactions » »');
  await essai('G', async () => {
    const f = monde();
    const base = { vrm: { connecte: true }, transport: { capteur: true, compte: 'lbc-account:' + A, lecture: { compte: A, total: 9, at: T0 } }, connu: { v: 2, id: 'lbc-account:' + A, name: 'Totomondu' }, lecture: null, code: '', maintenant: T0 };
    const sans = f.ctx.resumeCarteLbc(base);
    const avec = f.ctx.resumeCarteLbc(Object.assign({}, base, { txLu: { [A]: { etat: 'enregistre', nombre: 12, at: T0 - 3600e3 } } }));
    dit(/Mes transactions/.test(sans.geste), 'jamais lue ⇒ le geste est dit', sans.geste);
    dit(avec.ventes.ok === true && !/Mes transactions/.test(avec.geste), 'lue pour CE compte dans un autre onglet ⇒ « 12 lues », plus de geste', JSON.stringify(avec));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  if (process.argv.includes('--prouve') && !process.env.LBCP_SRC && !process.env.LBCP_RACINE) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbcp-'));
    const lancer = (env) => { try { return cp.execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, env), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
    const rouges = (sortie) => { const m = /(\d+) ✅ · (\d+) ❌/.exec(sortie); return m ? Number(m[2]) : 99; };
    // 1) le code d'AVANT (origin/main) : l'arbre entier, ce banc copié dedans.
    const avant = path.join(tmp, 'avant'); fs.mkdirSync(avant);
    cp.execSync(`git -C ${JSON.stringify(RACINE)} archive origin/main | tar -x -C ${JSON.stringify(avant)}`);
    fs.copyFileSync(__filename, path.join(avant, 'scripts', path.basename(__filename)));
    const nAvant = rouges(lancer({ LBCP_RACINE: avant }));
    console.log(`  --prouve : origin/main ⇒ ${nAvant} ❌`); if (!(nAvant > 0)) { console.log('  ❌ le contrôle ne rougit pas sur le code d’avant'); process.exitCode = 1; }
    // 2) les mutations (chacune réaffaiblit UNE règle).
    const SRC0 = fs.readFileSync(SRC, 'utf8');
    const MUT = [
      ['sens deviné (achat rangé en vente)', "const sens = x.isSeller === true ? 'vente' : x.isSeller === false ? 'achat' : null;", "const sens = x.isSeller === false ? 'achat' : 'vente';"],
      ['finalisée ignorée', "const etat = lbcTxAnnulee(x) ? 'annulee' : lbcTxFinalisee(x) ? 'finalisee' :", "const etat = lbcTxAnnulee(x) ? 'annulee' : false ? 'finalisee' :"],
      ['prix pas converti', 'Math.round(n) / 100 : null; };', 'n : null; };'],
      ['suivi chez n’importe qui', "const url = lab && HOTES_SUIVI_LBC.test(String(lab.trackingUrl || '')) ? String(lab.trackingUrl) : '';", "const url = lab && lab.trackingUrl ? String(lab.trackingUrl) : '';"],
      ['attente muette', "if (!moi) return { ok: true, plateforme, compte: null, attente: 'compte' };", 'if (!moi) return { ok: true, plateforme, compte: null };'],
      ['conversation d’un autre compte rangée', "if (!/^[0-9a-f-]{8,64}$/.test(moi) || !onglet || onglet.toLowerCase() !== moi)", "if (!/^[0-9a-f-]{8,64}$/.test(moi) || !onglet)"],
      ['lecture ratée qui écrit', "if (rows === null) { noterDiag(id + '_lecture_ratee'); return { ok: false }; }", 'if (rows === null) { /* muté */ }'],
      ['geste par onglet seulement', 'const rv = rvOnglet || rvCompte;', 'const rv = rvOnglet;'],
      ['règle d’annulation divergente', "function lbcTxAnnulee(o) { return o.stepStatus === 'cancelled' ||", "function lbcTxAnnulee(o) { return o.stepStatus === 'cancelled' && "],
    ];
    for (const [nom, a, b] of MUT) {
      if (!SRC0.includes(a)) { console.log(`  ❌ mutation « ${nom} » : texte introuvable`); process.exitCode = 1; continue; }
      const p = path.join(tmp, 'mut.js'); fs.writeFileSync(p, SRC0.replace(a, b));
      const n = rouges(lancer({ LBCP_SRC: p }));
      console.log(`  ${n > 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${n} ❌`); if (!(n > 0)) process.exitCode = 1;
    }
  }
  if (ko) process.exitCode = 1;
})();
