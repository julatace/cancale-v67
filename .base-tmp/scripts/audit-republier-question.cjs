// ════════════════════════════════════════════════════════════════════════════
//  REPUBLIER QUI RÈGLE SES PROBLÈMES (2 novembre, extension 5.310.0)
//  Julien : « s'il manque une catégorie, ça tape indéfiniment sur Publier ; il
//  faut qu'elle puisse remplir elle-même ou demander ».
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`). Exige :
//   1. un champ vide est rempli UNE fois depuis l'IDENTITÉ de l'annonce (sa
//      recette acceptée par Vinted) — jamais d'une autre annonce ;
//   2. sans source, VRM s'arrête et DEMANDE (la question nomme le champ et
//      porte les valeurs de Vinted déjà connues), sans aucune requête Vinted ;
//   3. sa réponse n'est posée que si elle est l'une de ces valeurs ;
//   4. un refus de Vinted qui NOMME le champ est retenu : le même corps n'est
//      jamais renvoyé ; un refus muet ne bloque pas un nouveau clic ;
//   5. (P10) stockage de l'extension muet ⇒ le plafond d'actions SE FERME ;
//   6. (P11) le message joint à un refus d'offre compte comme une action.
//  `--src chemin` : la preuve sur le code d'AVANT (§6.1).
//  Aucune donnée réelle : identifiants inventés (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const UID = '111';
const ID = '900000001', AUTRE = '900000002';
const CAT = 1242;
// Le cache de la grille (24 h) : tailles et états de la catégorie, comme l'extension le range.
const grilleCache = () => ({ vrmTaillesVinted: { [String(CAT)]: { options: [{ id: 776, t: '42' }, { id: 777, t: '43' }], requis: [], sansTaille: false, codes: ['size', 'condition'], etats: [{ id: 6, t: 'Neuf avec étiquette' }, { id: 2, t: 'Très bon état' }], at: Date.now() } } });
// Un corps d'annonce complet SAUF ce qu'on retire.
const corps = (sans = []) => {
  const c = { title: 'Paire de banc', price: { amount: '40.0', currency_code: 'EUR' }, assigned_photos: [{ id: 1 }], description: 'Une description de banc.', catalog_id: CAT, color_ids: [1], package_size_id: 2, brand_id: 53,
    item_attributes: [{ code: 'size', ids: [776] }, { code: 'condition', ids: [2] }] };
  for (const k of sans) {
    if (k === 'size' || k === 'condition') c.item_attributes = c.item_attributes.filter((a) => a.code !== k);
    else delete c[k];
  }
  return c;
};
const recette = (id, d) => ({ [id]: { uid: UID, corps: JSON.stringify({ item: d }) } });

(async () => {
  console.log('── 1. Remplir depuis l\'IDENTITÉ de l\'annonce');
  await essaie('identite', async () => {
    const f = faireFond({ src: SRC, connecte: UID, store: grilleCache(), lignes: { vrm_vinted_modele: recette(ID, corps()) } });
    if (typeof f.ctx.reglerAvant !== 'function') { dit(false, '`reglerAvant` existe dans l\'extension'); return; }
    const it = corps(['catalog_id', 'condition']);
    const r = await f.ctx.reglerAvant(UID, null, it, [ID], null, { id: ID });
    dit(r.manque.length === 0 && !r.question, 'la catégorie et l\'état manquants sont repris de la recette de CETTE annonce ⇒ plus rien ne manque', JSON.stringify(r));
    dit(it.catalog_id === CAT && it.item_attributes.some((a) => a.code === 'condition' && a.ids[0] === 2), '… et posés sur le corps à envoyer', JSON.stringify(it));
    dit(f.j.vinted.length === 0, 'aucune requête chez Vinted pour ça', String(f.j.vinted.length));
    // Une AUTRE annonce porte une catégorie : elle n'est jamais prise.
    const f2 = faireFond({ src: SRC, connecte: UID, store: grilleCache(), lignes: { vrm_vinted_modele: recette(AUTRE, corps()) } });
    const it2 = corps(['condition']);
    const r2 = await f2.ctx.reglerAvant(UID, null, it2, [ID], null, { id: ID, num: '12' });
    dit(r2.manque.length === 1 && !it2.item_attributes.some((a) => a.code === 'condition'), 'la recette d\'une AUTRE annonce n\'est jamais prise (identité, pas ressemblance)', JSON.stringify(r2.manque));
    console.log('── 2. Sinon : UNE question, avec les valeurs de Vinted');
    dit(r2.question && r2.question.champ === 'condition' && Array.isArray(r2.question.options) && r2.question.options.some(([i]) => i === '6'), 'la question nomme l\'état et propose les états de la grille connue', JSON.stringify(r2.question));
    dit(f2.j.vinted.length === 0, 'la question est posée sans aucune requête chez Vinted', String(f2.j.vinted.length));
    console.log('── 3. Sa réponse : seulement une valeur proposée');
    const it3 = corps(['condition']);
    const r3 = await f2.ctx.reglerAvant(UID, null, it3, [ID], { condition: '6' }, { id: ID });
    dit(r3.manque.length === 0 && r3.reponses.includes('condition') && it3.item_attributes.some((a) => a.code === 'condition' && a.ids[0] === 6), 'sa réponse (une valeur de Vinted) est posée, plus rien ne manque', JSON.stringify(r3));
    const it4 = corps(['condition']);
    const r4 = await f2.ctx.reglerAvant(UID, null, it4, [ID], { condition: '999' }, { id: ID });
    dit(r4.manque.length === 1 && !r4.reponses.length, 'une valeur que Vinted ne propose pas est refusée (rien de posé)', JSON.stringify(r4));
  });

  console.log('── 4. Un refus de Vinted n\'est jamais renvoyé tel quel');
  await essaie('refus', async () => {
    const f = faireFond({ src: SRC, connecte: UID, store: grilleCache() });
    if (typeof f.ctx.retenirRefus !== 'function' || typeof f.ctx.refusDejaVu !== 'function') { dit(false, '`retenirRefus` / `refusDejaVu` existent'); return; }
    const d = corps();
    await f.ctx.retenirRefus('r' + ID, d, { status: 422, json: { errors: [{ field: 'catalog_id', value: 'La catégorie doit être renseignée' }] } });
    const vu = await f.ctx.refusDejaVu('r' + ID, corps());
    dit(!!vu && Array.isArray(vu.champs) && vu.champs.includes('catalog_id'), 'le même corps, déjà refusé en nommant la catégorie ⇒ reconnu (pas renvoyé)', JSON.stringify(vu));
    const autre = await f.ctx.refusDejaVu('r' + ID, { ...corps(), catalog_id: 1243 });
    dit(!autre, 'un corps CORRIGÉ (autre catégorie) repart', JSON.stringify(autre));
    const f2 = faireFond({ src: SRC, connecte: UID, store: {} });
    await f2.ctx.retenirRefus('r' + ID, d, { status: 400, json: { message: 'Erreur' } });
    dit(!(await f2.ctx.refusDejaVu('r' + ID, corps())), 'un refus MUET (aucun champ nommé) n\'est pas retenu : un nouveau clic reste possible', '');
  });

  console.log('── 5. (P10) Stockage de l\'extension muet ⇒ le plafond se ferme');
  await essaie('stockage', async () => {
    const f = faireFond({ src: SRC, connecte: UID, store: {}, vinted: () => ({ status: 200, body: { ok: true } }) });
    f.ctx.chrome.storage.local.set = () => Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
    const c = await f.ctx.compterAction(UID, 45);
    dit(c && c.ok === false && c.code === 'stockage', 'compterAction : stockage en panne ⇒ refusé, code « stockage »', JSON.stringify(c));
    const g = await f.ctx.garde(UID, { domain: 'www.vinted.fr' });
    dit(g && g.ok === false && g.code === 'stockage' && /Recharge l'extension/.test(g.error || ''), 'garde : refusée, et la phrase dit le geste', JSON.stringify(g));
    const l = await f.ctx.compterLecture(UID, 20);
    dit(l && l.ok === false, 'compterLecture : fermé aussi', JSON.stringify(l));
    dit(f.j.vinted.length === 0, 'rien n\'est parti chez Vinted', String(f.j.vinted.length));
  });

  console.log('── 6. (P11) Le message joint à un refus d\'offre compte comme une action');
  await essaie('message refus', async () => {
    const src = require('fs').readFileSync(SRC, 'utf8');
    // (5.369) le message est l'une de SES versions (`versionsRefus`) : même règle, autre nom.
    const m = src.match(/if \(quoi === 'reject' && r && r\.ok && conv && (?:msg|versionsRefus\.length)\) \{([\s\S]{0,400})/);
    dit(!!m && /compterAction\(/.test(m[1]) && /messagePasParti/.test(m[1]), 'repondreOffre compte le message (une seconde requête) avant de l\'envoyer, et le dit s\'il ne part pas', m ? m[1].slice(0, 160) : 'bloc introuvable');
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  process.exit(ko ? 1 : 0);
})();
