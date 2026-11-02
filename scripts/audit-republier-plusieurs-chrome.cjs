#!/usr/bin/env node
// Audit (1er nov., X6) : Julien a PLUSIEURS Chrome sur le même compte Vinted.
// Ce que CE Chrome garde dans `chrome.storage.local` ne voit pas les autres.
//
// FAIT (vert exigé) — le vrai `recreerVinted` (background.js dans un vm) :
//   A. le quota du jour (REPUB_PAR_JOUR) se compte AUSSI en base, sur le compte
//      (`coffre_{uid}_*.versBrouillon.supprimeLe`, tous les Chrome) : 50 paires
//      republiées ailleurs, ce Chrome vierge ⇒ refusé, AUCUNE requête chez Vinted ;
//   B. base muette pour ce compte ⇒ refusé (fail-closed), rien chez Vinted ;
//   C. le verrou « republication en cours / incertaine » est AUSSI en base, sur la
//      ligne de l'annonce (`coffre_{uid}_{id}.versBrouillon`, 30 min) : une
//      suppression sans réponse claire dans un AUTRE Chrome bloque la relance ici ;
//   D. le même état, vieux de plus de 30 min, ne bloque plus (pas de verrou éternel).
// À FAIRE (dit, ne fait pas échouer l'audit) — le plafond de 50 ACTIONS/heure
//   (`vrmActions`) reste par navigateur : deux Chrome = 100/h. Le passer en base
//   (ligne par compte, comparer-et-échanger, fail-closed) touche CHAQUE geste
//   (bordereaux, réponses, offres) : une base injoignable les arrêterait tous. À
//   décider avec Julien. Le banc E le MESURE et le rapporte.
// `--src <background.js>` : le code d'avant (§6.1). `--prouve` : mutations.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const nowISO = (dt = 0) => new Date(Date.now() + dt).toISOString();
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Nike Air Max 1', description: 'nickel', price: '60.0', currency: 'EUR', catalog_id: 1234, brand_id: 53, color_ids: [1], item_attributes: [{ code: 'size', ids: [56] }, { code: 'condition', ids: [2] }], package_size_id: 1, assigned_photos: [{ id: 1 }] } });
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_hsUzFGeDP3Vk/f800/1.jpeg', 'https://images1.vinted.net/t/02_02248_Ka3jojtDMin8/f800/2.jpeg'];

const MUTATIONS = {
  quota_local: (s) => s.replace('  const base = await republieesEnBase(uid);\n', '  const base = [];\n'),
  base_muette_ok: (s) => s.replace("  if (base === null) return { code: QUOTA_BASE_PAS_LU,", "  if (false) return { code: QUOTA_BASE_PAS_LU,"),
  verrou_local: (s) => s.replace('  if (!verrou && vbEnVol) return', '  if (false) return'),
  verrou_eternel: (s) => s.replace('Date.now() - tVb < RECREER_VERROU_MS && (vb.etat', 'true && (vb.etat'),
};

function monter(src, { extra = {}, coffreVb = null, lectureKO = null } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } }, vinted_item_details: {},
    coffre_111_9101: { id: '9101', title: 'Nike Air Max 1', price: 60, desc: 'Nickel, boîte d’origine', photos: PHOTOS, ...(coffreVb ? { versBrouillon: coffreVb } : {}) },
    vrm_vinted_modele: { '9101': { corps: MODELE, at: nowISO(), uid: '111' } }, ...extra };
  let n = 500;
  return faireFond({ src, lignes, connecte: '111', lectureKO: lectureKO || (() => false), cdn: () => ({ status: 200 }),
    vinted: (e) => {
      if (e.methode === 'GET' && /\/api\/v2\/item_upload\/items\/\d+$/.test(e.chemin)) return { status: 200, body: { item: { id: Number(e.chemin.split('/').pop()) } } };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: ++n } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/api\/v2\/item_upload\/drafts\/\d+\/completion$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      if (e.methode === 'POST' && /\/api\/v2\/items\/9101\/delete$/.test(e.chemin)) return { status: 200, body: {} };
      return { status: 404, body: {} };
    } });
}
const appel = (f) => f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9101', prix: 54, titre: 'Nike Air Max 1', confirme: true });
const gestes = (f) => f.j.vinted.filter((v) => !/\/item_upload\/(colors|attributes)$/.test(v.chemin)).length;

async function lancer(src) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
  const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e.message); } };
  await essai('A', async () => {
    const autres = {}; for (let i = 0; i < 50; i++) autres[`coffre_111_${7000 + i}`] = { id: String(7000 + i), versBrouillon: { etat: 'fait', supprimeLe: nowISO(-3600e3 * (i % 20 + 1)) } };
    const f = monter(src, { extra: autres }); const r = await appel(f);
    dit(r.accepte === false && r.code === 'quota-jour' && gestes(f) === 0, 'A. 50 paires republiées depuis un AUTRE Chrome (base), ce Chrome vierge : refusé « quota du jour », rien chez Vinted', `${r.code || r.etape} · ${gestes(f)} requête(s)`);
    const f2 = monter(src, { extra: Object.fromEntries(Object.entries(autres).slice(0, 49)) }); const r2 = await appel(f2);
    dit(r2.code !== 'quota-jour' && gestes(f2) > 0, 'A. 49 en base : la 50ᵉ passe', `${r2.code || r2.etape}`);
  });
  await essai('B', async () => {
    const f = monter(src, { lectureKO: (u) => /id=like\.coffre_111_\*/.test(u) }); const r = await appel(f);
    dit(r.accepte === false && gestes(f) === 0, 'B. la base ne répond pas pour compter le jour : refusé, rien chez Vinted (fail-closed)', `${r.code || r.etape} · ${gestes(f)} requête(s)`);
  });
  for (const [quoi, vb] of [
    ['suppression sans réponse claire', { etat: 'a-publier', cause: 'suppression-incertaine', draftId: '88001', majAt: nowISO(-5 * 60e3) }],
    ['brouillon sans réponse claire', { etat: 'fait', cause: 'brouillon-flou', majAt: nowISO(-5 * 60e3) }],
    ['republication EN COURS (brouillon rangé, mise en ligne planifiée)', { etat: 'brouillon-range', draftId: '88001', majAt: nowISO(-60e3) }],
  ]) await essai('C', async () => {
    const f = monter(src, { coffreVb: vb }); const r = await appel(f);
    dit(r.accepte === false && r.code === 'recreer-incertaine' && gestes(f) === 0, `C. ${quoi} dans un AUTRE Chrome il y a peu : ici, refusé sans aucune requête`, `${r.code || r.etape} · ${gestes(f)} requête(s)`);
  });
  await essai('D', async () => {
    const f = monter(src, { coffreVb: { etat: 'a-publier', cause: 'suppression-incertaine', majAt: nowISO(-45 * 60e3) } }); const r = await appel(f);
    dit(r.code !== 'recreer-incertaine' && gestes(f) > 0, 'D. le même état il y a 45 min : plus de verrou', `${r.code || r.etape}`);
    const f2 = monter(src, { coffreVb: { etat: 'fait', supprime: true, majAt: nowISO(-60e3) } }); const r2 = await appel(f2);
    dit(r2.code !== 'recreer-incertaine', 'D. une republication FINIE juste avant ne bloque pas', `${r2.code || r2.etape}`);
  });
  return ko;
}
async function aFaire(src) {
  // E. Le plafond horaire : deux Chrome (deux vm, deux `chrome.storage.local`) sur le même compte.
  const a = monter(src), b = monter(src);
  let n = 0;
  for (const f of [a, b]) for (let i = 0; i < 60; i++) { const g = await f.ctx.gardeStricte('111', { vinted_user_id: '111', domain: 'www.vinted.fr' }, {}); if (g === null) n++; else break; }
  console.log(`  ⏳ À FAIRE (E) : deux Chrome sur le même compte acceptent ${n} actions dans l'heure (plafond 50 par Chrome, pas par compte) — voir l'en-tête.`);
}

(async () => {
  const src = cheminSource();
  if (!process.argv.includes('--prouve')) {
    const ko = await lancer(src); await aFaire(src);
    console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ quota du jour et verrou de republication tenus pour le COMPTE, tous Chrome confondus');
    process.exit(ko ? 1 : 0);
  }
  const s0 = fs.readFileSync(src, 'utf8'); let toutes = true;
  for (const [nom, mut] of Object.entries(MUTATIONS)) {
    const m = mut(s0); console.log(`\n════ mutation « ${nom} »`);
    if (m === s0) { console.log('  ❌ la mutation ne s\'applique plus'); toutes = false; continue; }
    const tmp = path.join(os.tmpdir(), `bg-x6-${process.pid}-${nom}.js`); fs.writeFileSync(tmp, m);
    let k; try { k = await lancer(tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
    console.log(`  → ${k ? `ROUGE (${k})` : 'VERTE — pas attrapée'}`); if (!k) toutes = false;
  }
  console.log(toutes ? '\n✅ chaque réaffaiblissement est attrapé' : '\n❌ une mutation passe au vert');
  process.exit(toutes ? 0 : 1);
})();
