// ════════════════════════════════════════════════════════════════════════════
//  LA BOÎTE DE RÉCEPTION SE FUSIONNE, ELLE NE SE COMPTE PAS (extension 5.162)
//
//  MESURÉ le 6 octobre sur sa base : `harvest_24602614_inbox` figée sur la
//  PAGE 5 (dernière conversation captée le 27 juillet, dernière vente le
//  2 octobre), `harvest_3156028798_inbox` sur la page 3. `listePlusRiche` ne
//  compare que des NOMBRES : une page profonde rangée en faisant défiler la
//  messagerie (50 conversations) bloquait ensuite toute page 1 fraîche
//  (30 conversations) comme « plus pauvre ».
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`), sur les DEUX voies
//  d'écriture (passive `storeHarvest`, active `storeHarvestRow`), et on lit ce
//  qui est RANGÉ en base :
//   1. une page 1 fraîche passe devant une page 5 ancienne : la plus récente
//      conversation est rangée, et les anciennes sont GARDÉES (fusion par id) ;
//   2. la page 1 fait foi pour le haut (un « non lu » devenu « lu » se lit) ;
//   3. une page profonde COMPLÈTE sans écraser le haut (pagination, version
//      plus fraîche d'une conversation) ;
//   4. bornée à 300, les plus récentes ; même forme `{pagination, conversations}` ;
//   5. lecture de la ligne ratée ⇒ RIEN n'est écrit (une page 1 seule
//      effacerait les conversations gardées) ; réponse vide ⇒ rien.
//  Données inventées. Usage : node scripts/audit-inbox-fusion.cjs [--src f]
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '111', ROW = `harvest_${UID}_inbox`;
const jour = 86400000, T0 = Date.parse('2026-10-05T12:00:00Z');
// `n` conversations d'id `de`…, la plus récente à `fin` (ms), une par heure en reculant.
const convs = (de, n, fin, extra = {}) => Array.from({ length: n }, (_, i) => Object.assign({ id: de + i, description: 'Paire ' + (de + i), unread: false,
  updated_at: new Date(fin - i * 3600000).toISOString(), opposite_user: { id: 50000 + de + i, login: 'acheteur' + (de + i) } }, extra));
const page = (n, conversations, per = conversations.length, total = 300) => ({ pagination: { current_page: n, per_page: per, total_pages: Math.ceil(total / per), total_entries: total }, conversations });
// La ligne rangée par la capture passive en faisant défiler : la PAGE 5, ancienne.
const PAGE5 = page(5, convs(1000, 50, T0 - 70 * jour), 50);
const rangee = (data) => ({ type: 'inbox', uid: UID, capturedAt: '2026-10-03T16:36:28Z', nItems: data.conversations.length, payload: data });
const lu = (f) => (f.lignes[ROW] && f.lignes[ROW].payload) || null;
const maxTs = (p) => Math.max(...((p && p.conversations) || []).map((c) => Date.parse(c.updated_at) || 0));
const voies = {
  passive: (f, data) => f.ctx.storeHarvest('www.vinted.fr', 'inbox', null, JSON.stringify(data)),
  active: (f, data) => f.ctx.storeHarvestRow(UID, 'inbox', data, 'www.vinted.fr'),
};

(async () => {
  for (const [nom, ecrire] of Object.entries(voies)) {
    console.log(`── voie ${nom}`);
    await essaie(`${nom} · page 1 après page 5`, async () => {
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(PAGE5) } });
      const P1 = page(1, convs(2000, 30, T0), 30);
      await ecrire(f, P1);
      const p = lu(f);
      dit(!!p && maxTs(p) === T0, 'la page 1 fraîche passe devant la page 5 ancienne (la conversation d’hier est rangée)', p ? new Date(maxTs(p)).toISOString() : 'rien en base');
      dit(!!p && p.conversations.length === 80, 'et les 50 anciennes sont GARDÉES (fusion par identifiant, pas remplacement)', p ? `${p.conversations.length} conversation(s)` : 'rien');
      dit(!!p && p.pagination && p.pagination.current_page === 1, 'la pagination rangée dit d’où vient le haut : la page 1', JSON.stringify(p && p.pagination));
      dit(!!p && p.conversations.every((c, i, a) => !i || Date.parse(a[i - 1].updated_at) >= Date.parse(c.updated_at)), 'triées de la plus récente à la plus ancienne');
      dit(!!f.lignes[ROW] && f.lignes[ROW].nItems === (p && p.conversations.length), 'le compteur `nItems` suit la liste rangée', `${f.lignes[ROW] && f.lignes[ROW].nItems}`);
    });
    await essaie(`${nom} · page 1 fait foi pour le haut`, async () => {
      const haut = page(1, convs(2000, 30, T0, { unread: true }), 30);
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(haut) } });
      const relue = page(1, convs(2000, 30, T0), 30);          // il les a lues : unread passe à false
      await ecrire(f, relue);
      const p = lu(f);
      const x = p && p.conversations.find((c) => c.id === 2000);
      dit(!!x && x.unread === false, 'une conversation lue entre-temps n’est plus « non lue » (la page 1 remplace)', JSON.stringify(x && x.unread));
    });
    await essaie(`${nom} · une page profonde complète`, async () => {
      const haut = page(1, convs(2000, 30, T0), 30);
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(haut) } });
      // Page 2 : 50 plus anciennes, plus une VIEILLE copie de la conversation 2000.
      const vieille = { id: 2000, unread: true, updated_at: new Date(T0 - 40 * jour).toISOString(), description: 'ancienne copie' };
      await ecrire(f, page(2, [vieille].concat(convs(3000, 50, T0 - 30 * jour)), 50));
      const p = lu(f);
      dit(!!p && p.conversations.length === 80, 'la page 2 ajoute ses conversations absentes', p ? `${p.conversations.length}` : 'rien');
      dit(!!p && p.pagination && p.pagination.current_page === 1, 'sans voler le haut : la pagination reste celle de la page 1', JSON.stringify(p && p.pagination));
      const x = p && p.conversations.find((c) => c.id === 2000);
      dit(!!x && x.unread === false && Date.parse(x.updated_at) === T0, 'et sans remplacer une conversation par une version plus ancienne', JSON.stringify(x));
    });
    await essaie(`${nom} · bornée à 300`, async () => {
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(page(1, convs(1000, 290, T0 - 2 * jour), 50)) } });
      await ecrire(f, page(1, convs(5000, 30, T0), 30));
      const p = lu(f);
      dit(!!p && p.conversations.length === 300 && maxTs(p) === T0, 'au plus 300 conversations rangées, les plus récentes', p ? `${p.conversations.length}` : 'rien');
      dit(!!p && Object.keys(p).sort().join(',') === 'conversations,pagination', 'même forme rangée pour tous les lecteurs : { pagination, conversations }', p && Object.keys(p).join(','));
    });
    await essaie(`${nom} · lecture ratée`, async () => {
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(PAGE5) }, lectureKO: (u) => new RegExp(`id=eq\\.${ROW}`).test(u) });
      await ecrire(f, page(1, convs(2000, 30, T0), 30));
      const p = lu(f);
      dit(!f.j.posts.some((ids) => ids.includes(ROW)) && p && p.conversations.length === 50, 'la ligne n’a pas pu être lue : RIEN n’est écrit (une page 1 seule effacerait les 50 gardées)', `écritures : ${JSON.stringify(f.j.posts)}`);
    });
    await essaie(`${nom} · réponse vide`, async () => {
      const f = faireFond({ src: SRC, lignes: { [ROW]: rangee(PAGE5) } });
      await ecrire(f, page(1, [], 30, 0));
      dit(!f.j.posts.some((ids) => ids.includes(ROW)), 'une page vide n’est jamais une réponse : rien n’est écrit', JSON.stringify(f.j.posts));
    });
  }
  console.log(`\n${ko ? '❌' : '✅'} boîte de réception : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
