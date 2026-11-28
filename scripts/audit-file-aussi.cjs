#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « PUBLIER PARTOUT » DEPUIS LE DOSSIER : UNE FILE PAR SITE (28 nov., ext. 5.458.0 `aussifile`)
//  Le VRAI background.js (scripts/_fond-vm.cjs) :
//   1. une tâche Leboncoin mise en file SANS onglet Leboncoin : rien ne part, aucun onglet n'est ouvert, elle attend ;
//   2. l'onglet s'ouvre (connecté) : elle part par le chemin de « Publier aussi » (`publierUnAussi`), « faite » sur
//      l'identifiant rendu par le site ;
//   3. jamais deux : le passage suivant ne la relance pas (et une 2e demande pour ce site et ce N° est refusée) ;
//   4. vendue ailleurs (preuve) : la tâche Vestiaire en attente est ANNULÉE, et c'est dit ; rien ne part ;
//   5. un refus passager (plafond) la laisse en attente ; un clic sans réponse claire ⇒ « pas su », jamais relancée ;
//   6. le bloc <file-aussi-regle> est le même dans l'app et l'extension ; les déclencheurs (alarme, onglet) sont posés.
//  Rejoué sous MUTATION (dans une copie du fond) : au moins un rouge par mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');
const R = path.join(__dirname, '..');
const BG = path.join(R, 'vinted-sync-extension/background.js');

async function controles(src, bavard) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, m, d) => { if (c) { ok++; if (bavard) console.log('✅ ' + m); } else { ko++; rouges.push(m); if (bavard) console.log('❌ ' + m + (d ? `\n   ${String(d).slice(0, 300)}` : '')); } };
  const FA = await import('file://' + path.join(R, 'src/aPublier/fileAussi.js'));
  const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
  const bg = fs.readFileSync(src, 'utf8');
  const lirB = (t) => { const i = t.indexOf('// <file-aussi-regle>'), j = t.indexOf('// </file-aussi-regle>'); return i >= 0 && j > i ? t.slice(i, j) : ''; };
  const appT = fs.readFileSync(path.join(R, 'src/aPublier/fileAussi.js'), 'utf8');
  dit(lirB(appT) && lirB(appT) === lirB(bg), 'le bloc <file-aussi-regle> est le même dans l’app et dans background.js');
  dit(/lance\('aussifile', \(\) => aussiFileTick\('alarme'\)\)/.test(bg) && /vestiairecollective\\\.com\)\\\/\/i\.test\(u\)\) return; setTimeout\(\(\) => \{ aussiFileTick\('onglet'\)/.test(bg), 'déclencheurs : l’alarme commune ET un onglet Leboncoin / Vestiaire qui finit de charger');
  // La règle pure : jamais deux, preuves seulement.
  const d1 = FA.faDemande({ site: 'leboncoin', brouillon: 'dabc12345', numero: '217' }, null, 1000, cleNum);
  const L1 = { jobs: { [d1.cle]: d1.job } };
  dit(d1.ok && FA.faDemande({ site: 'leboncoin', brouillon: 'dabc12345', numero: '0217' }, L1, 2000, cleNum).code === 'deja', 'jamais deux tâches pour un site et un N° (« 0217 » = « 217 »)');
  dit(FA.faVendue({ numero: '217' }, { vendusVinted: new Set(['55']), fiches: { 55: { numero: '217' } } }, cleNum) === 'vinted' && FA.faVendue({ numero: '217' }, { vendusVinted: new Set(), fiches: { 55: { numero: '217' } } }, cleNum) === '', 'vendue : seulement sur PREUVE (une vente prouvée d’une annonce de ce N°)');
  dit(FA.faApres({ etat: 'en-cours' }, { etat: 'arrete', code: 'plafond' }, 1).etat === 'attente' && FA.faApres({ etat: 'en-cours' }, { etat: 'pas-su' }, 1).etat === 'pas-su' && FA.faApres({ etat: 'en-cours' }, { etat: 'publiee', id: '' }, 1).etat !== 'fait', 'passager ⇒ attend ; pas su ⇒ jamais relancée ; « faite » seulement avec l’identifiant du site');

  // ── Le vrai fond ──
  const UID = '111', LBC = 'abc-123-def';
  const brouillon = { id: 'dabc12345', numero: '217', titre: 'Nike Air Force 1 blanche', description: 'Très belle paire, portée deux fois.', marque: 'Nike', taille: '42', etat: 'Très bon état', prix: 80, min: '60', minAt: '2026-11-28T10:00:00Z',
    buyFromId: '8888888', dossier: { v: 1, creeAt: '2026-11-28T09:00:00Z', cle: 'ddabc12345', photos: [{ id: 'p1' }] }, depot: { photos: ['p1'], couverture: 'p1' } };
  const img = 'data:image/jpeg;base64,' + Buffer.from('photo-inventee').toString('base64');
  const job = (site) => FA.faDemande({ site, brouillon: 'dabc12345', numero: '217', reponses: { categorie: 'chaussures/baskets/homme' } }, null, Date.now() - 3600e3, cleNum);
  const jl = job('leboncoin'), jv = job('vestiaire');
  const lignes = { main: { vrm_fiches_neuves: { dabc12345: brouillon }, vinted_annonce_numeros: {}, vinted_buyprice_by_num: {} },
    vrm_aussi_file: { v: 1, rev: 1, jobs: { [jl.cle]: jl.job } }, studio_photos_217: { numero: '217', photos: [{ id: 'p1', img }] }, lbc_formulaires: { formulaires: {} } };
  const onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }];
  const F = faireFond({ src, connecte: UID, lignes, onglets });
  const C = F.ctx; C.relaisSessionOwner = async () => 'owner-banc';   // la session VRM du banc (la base cloisonnée n'est pas sondée ici)
  const etatDe = (cle) => { const l = F.lignes.vrm_aussi_file; const d = l && l.data ? l.data : l; return d && d.jobs && d.jobs[cle]; };
  const appels = [];
  C.publierUnAussi = async (jobId, uid, art, site) => { appels.push({ site, art: art.id, num: art.numero, envoi: art.sites[site].envoi, pendant: (etatDe(jl.cle) || {}).etat }); return { etat: 'publiee', id: '2900000001', lien: 'https://www.leboncoin.fr/ad/x/2900000001', relie: true, raison: '' }; };
  if (typeof C.aussiFileTick !== 'function') { dit(false, 'background.js : `aussiFileTick` existe'); return { ok, ko, rouges }; }
  const r0 = await C.aussiFileTick('banc');
  dit(!appels.length && !(F.j.ongletsCrees || []).length && etatDe(jl.cle).etat === 'attente', 'sans onglet Leboncoin : rien ne part, aucun onglet ouvert, la tâche ATTEND (sans limite)', JSON.stringify({ r0, e: etatDe(jl.cle) }));
  // L'onglet Leboncoin s'ouvre, connecté.
  onglets.push({ id: 9, url: 'https://www.leboncoin.fr/mes-annonces', status: 'complete' });
  await F.ctx.chrome.storage.local.set({ vrmLbcTransport: { 9: { source: 'prive', compte: 'lbc-account:' + LBC } } });
  const r1 = await C.aussiFileTick('onglet');
  const e1 = etatDe(jl.cle);
  dit(appels.length === 1 && appels[0].site === 'leboncoin' && appels[0].num === '217', 'l’onglet ouvert : la tâche part par le chemin de « Publier aussi » (une fois)', JSON.stringify({ r1, appels: appels.length, e1 }));
  dit(appels[0] && appels[0].envoi && appels[0].envoi.fiche && Number(appels[0].envoi.fiche.prix) === 80 && (appels[0].envoi.fiche.photos || [])[0] === img, '… avec la fiche du brouillon : son prix, SES photos du studio', JSON.stringify(appels[0] && appels[0].envoi && { prix: appels[0].envoi.fiche.prix, ph: (appels[0].envoi.fiche.photos || []).length }));
  dit(appels[0] && appels[0].pendant === 'en-cours', 'la tâche est notée « en cours » AVANT le dépôt (un autre Chrome ne la relance pas)', JSON.stringify(appels[0] && appels[0].pendant));
  dit(e1 && e1.etat === 'fait' && e1.id === '2900000001', '« faite » sur l’identifiant rendu par le site, reliée par cette identité', JSON.stringify(e1));
  await C.aussiFileTick('onglet');
  dit(appels.length === 1, 'jamais deux : le passage suivant ne la relance pas');
  // Vendue ailleurs : une tâche Vestiaire en attente, la vente Vinted PROUVÉE d'une annonce de ce N°.
  const d = F.lignes.vrm_aussi_file.data || F.lignes.vrm_aussi_file; d.jobs[jv.cle] = jv.job;
  const m = F.lignes.main.data || F.lignes.main; m.vinted_annonce_numeros = { 5551: { numero: '217' } };
  C.lireVentesProuvees = async () => ({ echec: false, vendus: new Set(['5551']) });
  onglets.push({ id: 11, url: 'https://fr.vestiairecollective.com/', status: 'complete' });
  C.compteUniqueOnglets = async (site) => ({ ok: true, compte: site === 'leboncoin' ? LBC : 'vc-1' });
  const r2 = await C.aussiFileTick('onglet');
  const e2 = etatDe(jv.cle);
  dit(e2 && e2.etat === 'annule' && /vendue/.test(e2.raison || '') && appels.length === 1, 'vendue ailleurs (preuve) : la tâche Vestiaire est ANNULÉE et c’est dit ; rien ne part', JSON.stringify({ r2, e2 }));
  dit(F.j.journal.some((t) => /annulée/.test(t)), '… dit au journal de l’activité');
  // Une lecture des preuves ratée : rien n'est annulé, rien ne part.
  const F2 = faireFond({ src, connecte: UID, lignes: JSON.parse(JSON.stringify({ ...lignes, vrm_aussi_file: { v: 1, rev: 1, jobs: { [jv.cle]: jv.job } } })), onglets: [{ id: 11, url: 'https://fr.vestiairecollective.com/', status: 'complete' }] });
  F2.ctx.relaisSessionOwner = async () => 'owner-banc';
  const ap2 = []; F2.ctx.publierUnAussi = async () => { ap2.push(1); return { etat: 'publiee', id: '1' }; }; F2.ctx.lireVentesProuvees = async () => ({ echec: true, vendus: new Set() }); F2.ctx.compteUniqueOnglets = async () => ({ ok: true, compte: 'vc-1' });
  await F2.ctx.aussiFileTick('onglet');
  const l2 = F2.lignes.vrm_aussi_file; const e3 = (l2.data || l2).jobs[jv.cle];
  dit(!ap2.length && e3.etat === 'attente', 'preuves pas lues : rien n’est annulé, rien ne part (pas su ≠ oui)', JSON.stringify(e3));
  // Plafond (refus passager) ⇒ reste en attente ; pas su ⇒ jamais relancée.
  const F3 = faireFond({ src, connecte: UID, lignes: JSON.parse(JSON.stringify({ ...lignes, vrm_aussi_file: { v: 1, rev: 1, jobs: { [jl.cle]: jl.job } } })), onglets: [{ id: 9, url: 'https://www.leboncoin.fr/', status: 'complete' }] });
  F3.ctx.relaisSessionOwner = async () => 'owner-banc';
  const ap3 = []; F3.ctx.compteUniqueOnglets = async () => ({ ok: true, compte: LBC }); F3.ctx.lireVentesProuvees = async () => ({ echec: false, vendus: new Set() });
  F3.ctx.publierUnAussi = async () => { ap3.push(1); return ap3.length === 1 ? { etat: 'arrete', code: 'plafond', raison: 'déjà 50 actions' } : { etat: 'pas-su', code: 'pas-su', raison: 'sans réponse claire' }; };
  await F3.ctx.aussiFileTick('onglet');
  const l3 = () => { const x = F3.lignes.vrm_aussi_file; return (x.data || x).jobs[jl.cle]; };
  dit(l3().etat === 'attente' && /50/.test(l3().raison || ''), 'plafond atteint : la tâche reste en attente, avec sa raison', JSON.stringify(l3()));
  await F3.ctx.aussiFileTick('onglet');
  await F3.ctx.aussiFileTick('onglet');
  dit(l3().etat === 'pas-su' && ap3.length === 2, 'un clic sans réponse claire ⇒ « pas su », jamais relancée', JSON.stringify({ e: l3(), n: ap3.length }));
  // Un brouillon retiré : rien ne part.
  const F4 = faireFond({ src, connecte: UID, lignes: JSON.parse(JSON.stringify({ ...lignes, main: { ...lignes.main, vrm_fiches_neuves: { dabc12345: { ...brouillon, retireeAt: '2026-11-28T11:00:00Z' } } } })), onglets: [{ id: 9, url: 'https://www.leboncoin.fr/', status: 'complete' }] });
  F4.ctx.relaisSessionOwner = async () => 'owner-banc';
  const ap4 = []; F4.ctx.compteUniqueOnglets = async () => ({ ok: true, compte: LBC }); F4.ctx.lireVentesProuvees = async () => ({ echec: false, vendus: new Set() }); F4.ctx.publierUnAussi = async () => { ap4.push(1); return { etat: 'publiee', id: '1' }; };
  await F4.ctx.aussiFileTick('onglet');
  dit(!ap4.length, 'un article retiré du dossier ne part jamais');
  return { ok, ko, rouges };
}

const MUTATIONS = [
  ["if (!c.ok) continue;", "if (false) continue;", 'part sans onglet du site'],
  ["const pris = await faEcrire(p.cle, (x) => (x.etat === 'attente' ? Object.assign(x, { etat: 'en-cours', maj: Date.now() }) : null));", "const pris = true;", 'tâche pas marquée avant le dépôt'],
  ["if (pr.echec) return { saute: 'preuve' };", "", 'preuves ignorées'],
  ["if (!v) continue;\n    const ok = await faEcrire", "if (true) continue;\n    const ok = await faEcrire", 'vente ailleurs ignorée'],
  ["if (e.etat === 'pas-su') return Object.assign(j, { etat: 'pas-su'", "if (e.etat === 'pas-su') return Object.assign(j, { etat: 'attente'", 'pas su relancé'],
];

(async () => {
  const r = await controles(BG, true);
  let mko = 0;
  console.log('\n— Mutations (dans une copie du fond : chacune doit faire passer au moins un contrôle au rouge)');
  const t0 = fs.readFileSync(BG, 'utf8');
  for (const [de, vers, nom] of MUTATIONS) {
    if (!t0.includes(de)) { console.log('❌ mutation introuvable : ' + nom); mko++; continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-fa-')); const f = path.join(dir, 'background.js');
    fs.writeFileSync(f, t0.split(de).join(vers));
    try { const m = await controles(f, false); if (m.ko > 0) console.log(`✅ mutation « ${nom} » ⇒ ${m.ko} rouge(s) (${m.rouges[0].slice(0, 70)}…)`); else { console.log(`❌ mutation « ${nom} » : aucun contrôle ne la voit`); mko++; } }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  const tot = r.ko + mko;
  console.log(`\n${tot ? '❌' : '✅'} audit-file-aussi : ${r.ok} verts, ${r.ko} rouge(s) ; ${MUTATIONS.length - mko}/${MUTATIONS.length} mutations vues`);
  process.exit(tot ? 1 : 0);
})();
