// ════════════════════════════════════════════════════════════════════════════
//  SUR VINTED : LA LIGNE SOUS SES ANNONCES ET L'ENCART D'ACHAT (11 nov., lot AA, 5.339)
//  Propositions 40 et 41 validées par Julien. Le VRAI background.js dans un `vm`
//  (`_fond-vm.cjs`), une base inventée (le dépôt est public) :
//   I1  50 annonces AU MÊME TITRE : chacune reçoit SON N° (par identifiant
//       d'annonce), aucun N° ne passe à une voisine ;
//   I2  les annonces d'un AUTRE de ses comptes (même titre) : rien ; une fiche
//       sans compte et hors du dressing de ce compte : rien ;
//   I3  le dressing d'un autre profil ⇒ rien du tout (« hors_compte ») ;
//   I4  prix d'achat : brut de la fiche ou de `vinted_buyprice_by_num` ; absent ⇒
//       aucun champ (jamais 0) ; date : « Ajouté il y a » d'abord, puis la date
//       Vinted ; aucune ⇒ aucun champ ;
//   I5  une lecture ratée ⇒ `ok:false`, rien (jamais une ligne inventée) ;
//   I6  « Je numérote moi-même » : sans N° de fiche, le N° ÉCRIT lu dans la
//       description (allumé seulement) ;
//   I7  l'encart d'achat : seulement sur l'annonce d'un AUTRE vendeur, SÛR
//       (profil connecté connu, un profil qui n'est aucun des siens, annonce dans
//       aucune fiche) ; profils pas lus ⇒ rien ;
//   I8  le stock comparé : ses paires EN LIGNE (règle `enligne`), titre/marque/
//       taille seulement ; la comparaison est celle du lot F (`pairesDuModele`,
//       marque différente ⇒ écartée) ;
//   I9  aucune requête Vinted, aucune écriture.
//   I10 la copie des règles (vrm-regles-achat.js) est à jour ; le manifeste
//       charge les deux fichiers sur Vinted, les règles d'abord.
//  `--src <background.js>` : juge une autre copie (preuve sur le code d'avant).
//  `--mutation=<nom>|toutes` : réaffaiblit une règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  compte: ["if (compte !== u) continue;", ''],
  identite: ["const f = d.fiches[id] && typeof d.fiches[id] === 'object' ? d.fiches[id] : null", "const f = Object.values(d.fiches).find((x) => x && x.accountId === u) || null"],
  profil: ["(!membre || !pid || String(pid) !== membre[1])", '(!membre)'],
  lectureKO: ['if (dates === null) return null;', ''],
  zero: ["if (f && f.buyPrice != null && String(f.buyPrice).trim() !== '') o.buyPrice = String(f.buyPrice);", "o.buyPrice = String((f && f.buyPrice) || 0);"],
  autre: ["!profils.has(m));", 'true);'],
  sesFiches: ["if (fiches && Object.prototype.hasOwnProperty.call(fiches, String(id))) return false;", ''],
  enLigne: ['for (const it of (res.enLigne || []))', 'for (const it of [].concat(res.enLigne || [], res.fermees || []))'],
  ecrit: ["else if (d.ecrit && it && it.numEcrit", "else if (it && it.numEcrit"],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  const bg = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'background.js'), 'utf8');
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-infos-'));
  const temoin = spawnSync(process.execPath, [__filename], { encoding: 'utf8', timeout: 120000 });
  console.log(`  ${temoin.status === 0 ? '✅' : '❌'} témoin sans mutation : vert`);
  let fautes = temoin.status === 0 ? 0 : 1;
  for (const nom of noms) {
    const [a, b] = MUTATIONS[nom] || [];
    if (!a || !bg.includes(a)) { console.log(`  ❌ mutation ${nom} : le texte visé n'existe plus`); fautes++; continue; }
    const f = path.join(t, nom + '.js'); fs.writeFileSync(f, bg.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', f], { encoding: 'utf8', timeout: 120000 });
    const rouge = r.status !== 0;
    if (!rouge) fautes++;
    console.log(`  ${rouge ? '✅' : '❌'} mutation « ${nom} » : ${rouge ? 'ROUGE (attrapée)' : 'reste verte — l’audit ne la voit pas'}`);
  }
  process.exit(fautes ? 1 : 0);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const SRC = cheminSource();
const UID = '111', AUTRE = '222', PID = '9001', PID2 = '9002', VENDEUR = '5555';
const TITRE = 'Nike Air Max 95 noir taille 42';
const MAINT = Date.now();
const ids = Array.from({ length: 50 }, (_, k) => String(10400000001 + k));
const idsAutre = Array.from({ length: 5 }, (_, k) => String(10500000001 + k));
const ID_ORPHELINE = '10600000001', ID_DATE_LUE = ids[3], ID_SANS = ids[7], ID_ECRIT = '10700000001';
function base({ ecrit = false } = {}) {
  const fiches = {}, buy = {};
  ids.forEach((id, k) => {
    const f = { numero: String(100 + k), accountId: UID, title: TITRE };
    if (k % 3 === 0) f.buyPrice = String(30 + k) + ',5';
    else if (k % 3 === 1) buy[String(100 + k)] = String(40 + k);
    fiches[id] = f;
  });
  idsAutre.forEach((id, k) => { fiches[id] = { numero: String(900 + k), accountId: AUTRE, buyPrice: '55', title: TITRE }; });
  fiches[ID_ORPHELINE] = { numero: '777', buyPrice: '10', title: TITRE };
  delete buy[String(100 + 7)]; delete fiches[ID_SANS].buyPrice;
  const item = (id, extra = {}) => Object.assign({ id: Number(id), title: TITRE, brand_title: 'Nike', size_title: '42', is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor((MAINT - 23 * 864e5) / 1000) }, extra);
  const items = ids.map((id) => (id === ID_SANS ? item(id, { created_at_ts: null }) : item(id)));
  items.push(item(ID_ECRIT, { numEcrit: { etat: 'lu', cle: '512', brut: 'N°512' } }));
  items.push(item('10400009999', { title: 'Adidas Samba blanche 42', brand_title: 'Adidas', is_closed: true, item_closing_action: 'sold' }));
  return {
    main: { vinted_annonce_numeros: fiches, vinted_buyprice_by_num: buy, vrm_numero_ecrit: ecrit ? { actif: true } : { actif: false } },
    vinted_listing_dates: { [ID_DATE_LUE]: { ts: MAINT - 40 * 864e5, text: 'Ajouté il y a 1 mois' } },
    [`harvest_${UID}_profile`]: { payload: { user: { id: Number(PID) } } },
    [`harvest_${AUTRE}_profile`]: { payload: { user: { id: Number(PID2) } } },
    [`harvest_${UID}_listings`]: { capturedAt: new Date(MAINT - 60000).toISOString(), payload: { items } },
    [`harvest_${AUTRE}_listings`]: { capturedAt: new Date(MAINT - 60000).toISOString(), payload: { items: idsAutre.map((id) => item(id)) } },
  };
}
const onglet = (chemin) => ({ tab: { id: 7, url: 'https://www.vinted.fr' + chemin } });

(async () => {
  try {
    {
      const f = faireFond({ src: SRC, lignes: base(), connecte: UID });
      if (typeof f.ctx.infosVintedPage !== 'function') { dit(false, 'I0 · `infosVintedPage` existe dans le fond'); throw new Error('absent'); }
      const tous = ids.concat(idsAutre, [ID_ORPHELINE, ID_ECRIT]);
      const r = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: tous }, onglet(`/member/${PID}-moi`));
      const inf = (r && r.infos) || {};
      const justes = ids.filter((id, k) => inf[id] && inf[id].numero === String(100 + k)).length;
      dit(r && r.ok && r.portee === 'compte' && justes === 50, 'I1 · 50 annonces au même titre : chacune porte SON N°, par identifiant', `${justes}/50 · ${JSON.stringify(r && { ok: r.ok, portee: r.portee })}`);
      const nums = ids.map((id) => inf[id] && inf[id].numero);
      dit(new Set(nums).size === 50, 'I1 · aucun N° ne se répète d’une annonce à l’autre', String(new Set(nums).size));
      dit(idsAutre.every((id) => !inf[id]) && !inf[ID_ORPHELINE], 'I2 · rien sur les annonces d’un autre compte, ni sur une fiche sans compte hors du dressing', JSON.stringify(Object.keys(inf).filter((k) => !ids.includes(k) && k !== ID_ECRIT)));
      const k0 = inf[ids[0]] || {}, k1 = inf[ids[1]] || {}, ks = inf[ID_SANS] || {};
      dit(k0.buyPrice === '30,5' && !('buyNum' in k0) && k1.buyNum === '41' && !('buyPrice' in k1), 'I4 · prix d’achat brut : la fiche, sinon `vinted_buyprice_by_num` du N°', JSON.stringify({ k0, k1 }));
      dit(!('buyPrice' in ks) && !('buyNum' in ks) && !('depuis' in ks), 'I4 · pas de prix ni de date ⇒ aucun champ (jamais 0)', JSON.stringify(ks));
      const jours = (o) => Math.floor((MAINT - o.depuis) / 864e5);
      dit(jours(inf[ID_DATE_LUE] || {}) === 40 && jours(k0) === 23, 'I4 · « Ajouté il y a » lu sur la page d’abord, puis la date Vinted du dressing', `${jours(inf[ID_DATE_LUE] || {})} j / ${jours(k0)} j`);
      dit(!inf[ID_ECRIT] || !inf[ID_ECRIT].numero, 'I6 · « Je numérote moi-même » éteint : aucun N° écrit repris', JSON.stringify(inf[ID_ECRIT]));
      const autreProfil = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: tous }, onglet(`/member/${PID2}-autre`));
      dit(autreProfil && autreProfil.portee === 'hors_compte' && !autreProfil.infos, 'I3 · le dressing d’un autre profil (même le sien, autre compte) ⇒ rien', JSON.stringify(autreProfil));
      const vendeur = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: tous }, onglet(`/member/${VENDEUR}-x`));
      dit(vendeur && vendeur.portee === 'hors_compte', 'I3 · le dressing d’un vendeur inconnu ⇒ rien', JSON.stringify(vendeur));
      const sienne = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: [ids[5]], membres: [PID] }, onglet(`/items/${ids[5]}-air-max`));
      dit(sienne && sienne.infos && sienne.infos[ids[5]] && sienne.infos[ids[5]].numero === '105' && sienne.achat === false, 'I7 · sa propre annonce : la ligne, jamais l’encart d’achat', JSON.stringify(sienne));
      const achat = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ['20000000001'], membres: [PID, VENDEUR] }, onglet('/items/20000000001-air-max'));
      dit(achat && achat.achat === true && !Object.keys(achat.infos || {}).length, 'I7 · annonce d’un autre vendeur (son profil à lui ≠ les siens) ⇒ l’encart', JSON.stringify(achat));
      const seul = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ['20000000001'], membres: [PID] }, onglet('/items/20000000001-air-max'));
      dit(seul && seul.achat === false, 'I7 · aucun autre profil sur la page (pas su) ⇒ pas d’encart', JSON.stringify(seul));
      const lAutre = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: [idsAutre[0]], membres: [PID, PID2] }, onglet(`/items/${idsAutre[0]}-air-max`));
      dit(lAutre && lAutre.achat === false && !Object.keys(lAutre.infos || {}).length, 'I7 · l’annonce d’un autre de SES comptes : ni ligne ni encart', JSON.stringify(lAutre));
      const fiche = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: [ID_ORPHELINE], membres: [PID, VENDEUR] }, onglet(`/items/${ID_ORPHELINE}-x`));
      dit(fiche && fiche.achat === false, 'I7 · une annonce présente dans ses fiches n’est jamais un achat', JSON.stringify(fiche));
      const st = await f.envoyer({ from: 'cancale-vinfos', action: 'stockModele' }, onglet('/items/20000000001-air-max'));
      const sIds = new Set(((st && st.stock) || []).map((x) => x.id));
      dit(st && st.ok && sIds.size === 50 + 1 + 5 && !sIds.has('10400009999'), 'I8 · stock : ses paires EN LIGNE, tous comptes ; une vendue n’y est pas', `${sIds.size} · vendue ${sIds.has('10400009999')}`);
      dit(((st && st.stock) || []).every((x) => Object.keys(x).sort().join() === 'id,marque,taille,titre'), 'I8 · stock : identifiant, titre, marque, taille — rien d’autre', JSON.stringify((st && st.stock || [])[0]));
      dit(f.j.vinted.length === 0 && f.j.posts.length === 0, 'I9 · aucune requête Vinted, aucune écriture', `${f.j.vinted.length} Vinted · ${f.j.posts.length} écritures`);
      // La comparaison du lot F, exécutée depuis la copie des règles.
      const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'vrm-regles-achat.js'), 'utf8'), c);
      const R = c.__vrmReglesAchat;
      const prop = (cible) => R.pairesDuModele({ cible, stock: (st && st.stock) || [], marqueDe: R.extractBrand, modeleDe: R.extractModel, couleursDe: R.extractColors }).n;
      dit(prop({ titre: 'Air Max 95 blanche', marque: 'Nike', taille: '42' }) === 56 && prop({ titre: 'Air Max 95', marque: 'Adidas', taille: '42' }) === 0 && prop({ titre: 'Nike Pegasus 40', marque: 'Nike', taille: '42' }) === 0,
        'I8 · « peut-être N paires proches » : même marque et même modèle ; marque différente ou autre modèle ⇒ 0');
    }
    {
      const f = faireFond({ src: SRC, lignes: base({ ecrit: true }), connecte: UID });
      const r = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: [ID_ECRIT, ids[0]] }, onglet(`/member/${PID}`));
      const e = r && r.infos && r.infos[ID_ECRIT];
      dit(e && e.numero === '512' && e.ecrit === true && r.infos[ids[0]].numero === '100', 'I6 · « Je numérote moi-même » allumé : le N° écrit lu (sans fiche), la fiche d’abord sinon', JSON.stringify(r && r.infos));
    }
    {
      const f = faireFond({ src: SRC, lignes: base(), connecte: UID, lectureKO: (u) => /id=eq\.main/.test(u) });
      const r = await f.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ids }, onglet(`/member/${PID}`));
      dit(r && r.ok === false && !r.infos, 'I5 · la base ne répond pas ⇒ rien (jamais une ligne inventée)', JSON.stringify(r));
      const d = faireFond({ src: SRC, lignes: base(), connecte: UID, lectureKO: (u) => /vinted_listing_dates/.test(u) });
      const rd = await d.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ids }, onglet(`/member/${PID}`));
      dit(rd && rd.ok === false && !rd.infos, 'I5 · dates « Ajouté il y a » pas lues ⇒ rien (jamais un âge faux)', JSON.stringify(rd && rd.infos && rd.infos[ID_DATE_LUE]));
      const g = faireFond({ src: SRC, lignes: base(), connecte: UID, lectureKO: (u) => /_profile/.test(u) && /like/.test(u) });
      const a = await g.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ['20000000001'], membres: [PID, VENDEUR] }, onglet('/items/20000000001-x'));
      dit(a && a.achat === false, 'I7 · ses profils pas lus ⇒ pas d’encart', JSON.stringify(a));
      const h = faireFond({ src: SRC, lignes: base(), connecte: UID, lectureKO: (u) => /harvest_\*_listings|harvest_%_listings/.test(u) || (/_listings/.test(u) && /like/.test(u)) });
      const s = await h.envoyer({ from: 'cancale-vinfos', action: 'stockModele' }, onglet('/items/20000000001-x'));
      dit(s && s.ok === false, 'I8 · dressings pas lus ⇒ « pas su », jamais « aucune paire »', JSON.stringify(s));
      const k = faireFond({ src: SRC, lignes: base(), connecte: null });
      const n = await k.envoyer({ from: 'cancale-vinfos', action: 'infos', items: ids }, onglet(`/member/${PID}`));
      dit(n && n.portee === 'hors_compte' && !n.infos, 'I3 · aucun compte Vinted connecté dans l’onglet ⇒ rien', JSON.stringify(n));
    }
  } catch (e) { dit(false, 'l’audit a tourné jusqu’au bout', String(e && e.message)); }
  if (!process.argv.includes('--src')) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'regles-achat-extension.cjs')], { encoding: 'utf8' });
    dit(r.status === 0, 'I10 · vrm-regles-achat.js est la copie à jour des règles de l’app', (r.stdout || '').trim());
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const cs = (man.content_scripts || []).find((c) => (c.js || []).includes('vinted-infos.js'));
    dit(!!cs && cs.js.join() === 'vrm-mots.js,vrm-regles-achat.js,vinted-infos.js' && !cs.world && (cs.matches || []).some((m) => /vinted\.fr/.test(m)) && cs.all_frames === false,
      'I10 · le manifeste charge les mots (5.347), les règles puis vinted-infos.js sur Vinted (monde isolé, page principale)', JSON.stringify(cs));
    const ct = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'vinted-infos.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
    dit(/attachShadow\(\{\s*mode:\s*'closed'\s*\}\)/.test(ct) && !/innerHTML/.test(ct) && !/\bfetch\(|XMLHttpRequest/.test(ct) && !/\.click\(\)|dispatchEvent/.test(ct),
      'I10 · vinted-infos.js : ombre fermée, aucun innerHTML, aucune requête, aucun clic');
  }
  console.log(ko ? `\n❌ infos sur Vinted : ${ko} rouge(s)` : '\n✅ infos sur Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
