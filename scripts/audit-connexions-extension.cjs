#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « CONNEXIONS DE L'EXTENSION » (24 nov.) — node scripts/audit-connexions-extension.cjs
//  EXÉCUTE la règle pure src/connexions/connexions.js sur des lignes à la FORME de la vraie base (mesurée le 24 nov. :
//  `ext_appareil_{16 hex}` avec ver, atMs, appareil.nav/systeme, vus.vinted {uid: ms}, flux.{site} {okAt, koAt, koStatut,
//  refus[]} ; les champs de la 5.448 `sante`, `arret`, `servie`, `depassee` seulement présents).
//  `--prouve` : chaque mutation de la règle (copie dans un dossier temporaire) doit rougir.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const SRC = process.env.CNX_SRC || path.join(RACINE, 'src');

const MUTATIONS = {
  // une version illisible passe pour « à jour »
  'passu-ok': ["if (!ver) return { etat: 'passu', ver: '', installer: cible };", "if (!ver) return { etat: 'a-jour', ver: '', installer: cible };"],
  // une installation sans `sante` (avant 5.448) se dit « ok »
  'sante-ok': ["if (!s) return ver && cmpVersion(ver, depuis) < 0 ? undefined : null;", "if (!s) return [];"],
  // les installations ne sont plus dédoublonnées
  'doublon': ["if (!n || vus.has(n.id)) continue;", "if (!n) continue;"],
  // les vieilles installations restent mêlées aux navigateurs
  'anciens': ["if (!n.ici && (n.atMs == null || maintenant - n.atMs >= ANCIEN_MS)) anciens.push(n); else navigateurs.push(n);", "navigateurs.push(n);"],
  // la ligne d'Aujourd'hui part d'une installation plus vue
  'alerte-absent': ["n.version.etat === 'ancienne' && n.vu !== 'absent' && n.vu !== 'passu'", "n.version.etat === 'ancienne'"],
  // la lecture redevient `select=data`
  'select-data': ["&select=id,ver:data->>ver,", "&select=data,id,ver:data->>ver,"],
  // le code d'arrêt brut (texte de page) est montré tel quel
  'arret-brut': ["code: ARRETS.includes(str(a.code)) ? str(a.code) : 'autre'", "code: str(a.code)"],
  // un compte jamais lu est dit « relu » (pas su = 0)
  'connecte-vieux': ['const recent = maintenant - best.at < CONNECTE_MS', 'const recent = true || maintenant - best.at < CONNECTE_MS', 'etatConnexionCompte.js'],
  'jamais-frais': ["const relu = at == null ? (Array.isArray(navigateurs) ? 'jamais' : 'passu')", "const relu = at == null ? 'frais'"],
};
if (process.argv.includes('--prouve')) {
  const base = spawnSync(process.execPath, [__filename], { encoding: 'utf8' });
  let rate = base.status === 0 ? 0 : 1;
  console.log(`${base.status === 0 ? '✅' : '❌'} code tel quel : ${base.status === 0 ? 'vert' : 'ROUGE'}`);
  for (const [nom, [a, b, fic = 'connexions.js']] of Object.entries(MUTATIONS)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cnx-mut-'));
    fs.cpSync(path.join(RACINE, 'src', 'connexions'), path.join(tmp, 'connexions'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'src', 'extension'), path.join(tmp, 'extension'), { recursive: true });
    const f = path.join(tmp, 'connexions', fic); const s = fs.readFileSync(f, 'utf8');
    if (!s.includes(a)) { console.log(`❌ mutation ${nom} : texte introuvable`); rate++; continue; }
    fs.writeFileSync(f, s.replace(a, b));
    const r = spawnSync(process.execPath, [__filename], { encoding: 'utf8', env: { ...process.env, CNX_SRC: tmp } });
    const rouges = String(r.stdout).split('\n').filter((l) => l.includes('❌'));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » : ${bon ? 'rouge — ' + rouges[0].trim() : 'RESTE VERTE'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(rate ? 1 : 0);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };

(async () => {
  const R = await import(path.join(SRC, 'connexions', 'connexions.js'));
  const T = 1795507142468;   // un « maintenant » fixe
  const H = 3600000, J = 24 * H;
  const A = '41000001', B = '41000002', C = '41000003', D = '41000004';
  // 3 navigateurs vivants (un à jour, un ancien, un pas vu depuis 2 j), une ligne aux champs manquants, une vieille installation, un doublon.
  const rows = [
    { id: 'ext_appareil_aaaaaaaaaaaaaaaa', ver: '5.448.0', atMs: String(T - 3 * 60000), nav: 'chrome', sys: 'mac', vus: { vinted: { [A]: T - 3 * 60000, [B]: T - 40 * 60000 } },
      flux: { vinted: { okAt: T - 3 * 60000, koAt: null, refus: [], koStatut: null }, leboncoin: { okAt: T - 2 * H, koAt: null, refus: [], koStatut: null } },
      servie: '5.448.0', depassee: 'false', sante: { vinted: { k: 'ok', nom: '' }, lbc: { k: 'ok', nom: '' } }, arret: null },
    { id: 'ext_appareil_bbbbbbbbbbbbbbbb', ver: '5.418.0', atMs: String(T - 5 * H), nav: 'chrome', sys: 'mac', vus: { vinted: { [C]: T - 5 * H } },
      flux: { vinted: { okAt: T - 5 * H, koAt: null, refus: [], koStatut: null } } },
    { id: 'ext_appareil_cccccccccccccccc', ver: '5.440.0', atMs: String(T - 2 * J), nav: 'orion', sys: 'mac', vus: { vinted: { [D]: T - 2 * J } },
      flux: { vinted: { okAt: T - 2 * J - H, koAt: T - 2 * J, refus: [{ at: T - 2 * J, statut: 'reseau', famille: 'harvest_inbox', octets: 1 }], koStatut: null } } },
    { id: 'ext_appareil_dddddddddddddddd', ver: null, atMs: String(T - 30 * 60000), nav: null, sys: null, vus: null, flux: null },
    { id: 'ext_appareil_eeeeeeeeeeeeeeee', ver: '5.329.0', atMs: String(T - 9 * J), nav: 'chrome', sys: 'mac', vus: { vinted: {} }, flux: {} },
    { id: 'ext_appareil_aaaaaaaaaaaaaaaa', ver: '5.448.0', atMs: String(T - 3 * 60000), nav: 'chrome', sys: 'mac' },
  ];
  const comptes = { vinted: [{ id: A, nom: 'boutique_a' }, { id: B, nom: 'atelier_b' }, { id: C, nom: 'shop_c' }, { id: D, nom: 'vieux_d' }],
    leboncoin: [{ id: 'lbc1', nom: 'Julien LBC', lu: T - 3 * H }], vestiaire: [] };
  const jaugeA = { n: 12, max: 50, pourApp: 45, repartA: T + 20 * 60000 };
  const v = R.vueConnexions({ rows, attendue: '5.448.0', maintenant: T, ici: 'aaaaaaaaaaaaaaaa', comptes, lus: { vinted: { [A]: T - 60000 } }, jauges: { [A]: jaugeA, [B]: null, [C]: undefined, [D]: null } });
  const N = v.navigateurs;
  const ids = N.map((n) => n.id);

  // 1. Lecture : projection, ses lignes seulement.
  const q = R.requeteConnexions('aaaaaaaa-0000-4000-8000-000000000001');
  dit(q && /owner=eq\./.test(q) && !/select=data\b|select=\*/.test(q) && /sante:data->sante/.test(q) && /arret:data->arret/.test(q), 'lecture : owner=eq, projection (jamais select=data), champs 5.448 projetés', q);
  dit(R.requeteConnexions('') === null, 'lecture : sans propriétaire, rien n’est demandé');

  // 2. Chaque navigateur une fois ; les vieilles installations à part.
  dit(new Set(ids).size === ids.length && ids.filter((x) => x === 'aaaaaaaaaaaaaaaa').length === 1, 'chaque navigateur listé une fois (le doublon d’id est retiré)', ids.join(','));
  dit(N.length === 4 && v.anciens.length === 1 && v.anciens[0].id === 'eeeeeeeeeeeeeeee', 'une installation plus vue depuis 3 j est rangée à part (pas mêlée)', JSON.stringify({ n: ids, a: v.anciens.map((x) => x.id) }));
  dit(N[0].id === 'aaaaaaaaaaaaaaaa' && N[0].ici, 'ce navigateur en tête');

  // 3. Les versions.
  const a = N.find((n) => n.id === 'aaaaaaaaaaaaaaaa'), b = N.find((n) => n.id === 'bbbbbbbbbbbbbbbb'), c = N.find((n) => n.id === 'cccccccccccccccc'), d = N.find((n) => n.id === 'dddddddddddddddd');
  dit(a.version.etat === 'a-jour', 'à jour : 5.448 servie 5.448');
  dit(b.version.etat === 'ancienne' && b.version.ver === '5.418.0' && b.version.installer === '5.448.0', 'l’ancienne est nommée avec la version à installer (5.418 → 5.448)', JSON.stringify(b.version));
  dit(b.probleme && b.probleme.code === 'version' && b.probleme.geste === 'mettre-a-jour', 'l’ancienne porte le geste « Mettre à jour »', JSON.stringify(b.probleme));
  dit(d.version.etat === 'passu' && d.version.etat !== 'a-jour', 'version absente : « pas su », jamais « à jour »', JSON.stringify(d.version));
  const dep = R.etatVersion({ ver: '5.448.0', servie: '5.450.0', depassee: 'true' }, '5.448.0');
  dit(dep.etat === 'ancienne' && dep.installer === '5.450.0', 'la version servie lue par le navigateur (5.448 `servie`) compte : 5.448 → 5.450', JSON.stringify(dep));
  dit(R.etatVersion({ ver: '5.440.0' }, '').etat === 'passu', 'rien pour comparer : « pas su »');

  // 4. Vu quand.
  dit(a.vu === 'direct' && b.vu === 'recent' && c.vu === 'absent' && R.etatVu(null, T) === 'passu', 'vu : direct · récent · absent (2 j) · pas su', [a.vu, b.vu, c.vu].join(','));

  // 5. Santé 5.448 : « — » avec la raison avant 5.448, jamais « ok ».
  dit(Array.isArray(a.sante) && a.sante.every((s) => s.k === 'ok'), '5.448 : la santé par site est lue');
  dit(b.sante === undefined && c.sante === undefined, 'avant 5.448 : santé « trop ancienne pour le dire » (undefined), jamais ok', JSON.stringify([b.sante, c.sante]));
  dit(d.sante === null, 'version inconnue et pas de santé : « pas dit » (null), jamais ok', JSON.stringify(d.sante));
  const ar = R.navigateurDe({ id: 'ext_appareil_ffffffffffffffff', ver: '5.448.0', atMs: T - 60000, arret: { site: 'vinted', geste: 'supprimer', code: '<b>Clique ici</b>', at: T - 60000 } }, { attendue: '5.448.0', maintenant: T });
  dit(ar.probleme && ar.probleme.code === 'arret-autre', 'un code d’arrêt inconnu devient « autre » (aucun texte de page)', JSON.stringify(ar.probleme));
  const ar2 = R.navigateurDe({ id: 'ext_appareil_ffffffffffffffff', ver: '5.448.0', atMs: T - 60000, arret: { site: 'vinted', geste: 'supprimer', code: 'version-depassee', at: T - 60000 } }, { attendue: '5.448.0', maintenant: T });
  dit(ar2.probleme && ar2.probleme.geste === 'mettre-a-jour', 'arrêt « version dépassée » ⇒ geste « Mettre à jour »');
  const so = R.navigateurDe({ id: 'ext_appareil_ffffffffffffffff', ver: '5.448.0', atMs: T - 60000, sante: { vinted: { k: 'onglet', nom: 'onglet' } } }, { attendue: '5.448.0', maintenant: T });
  dit(so.probleme && so.probleme.code === 'sante-onglet' && so.probleme.geste === 'ouvrir-site', 'santé « onglet » ⇒ « Ouvrir Vinted »', JSON.stringify(so.probleme));

  // 6. Envoi raté (flux) : dit, sans inventer.
  dit(c.probleme && c.probleme.code === 'envoi-reseau', 'le dernier envoi vers VRM raté (réseau) est dit', JSON.stringify(c.probleme));
  dit(a.probleme === null, 'tout va bien : aucun problème inventé', JSON.stringify(a.probleme));

  // 7. Ce qu'il lit.
  dit(a.sites.vinted.comptes.map((x) => x.nom).join(',') === 'boutique_a,atelier_b' && a.sites.leboncoin.at === T - 2 * H, 'ce navigateur lit boutique_a, atelier_b (Vinted) et Leboncoin');

  // 8. Les comptes.
  const cp = (id) => v.comptes.find((x) => x.id === id);
  dit(cp(A).relu === 'frais' && cp(A).par && cp(A).par.id === 'aaaaaaaaaaaaaaaa', 'boutique_a : relu, par ce navigateur', JSON.stringify(cp(A)));
  dit(cp(D).relu === 'vieux' && cp(D).par && cp(D).par.id === 'cccccccccccccccc', 'vieux_d : pas relu depuis 24 h, lu en dernier par Orion', JSON.stringify(cp(D)));
  dit(cp(A).jauge && cp(A).jauge.n === 12 && cp(A).jauge.max === 50, 'jauge du compte : 12/50');
  dit(cp(B).jauge === null && cp(C).jauge === undefined, 'jauge pas sue : null (« — »), jamais 0 ; en lecture : undefined');
  dit(cp('lbc1') && cp('lbc1').site === 'leboncoin' && cp('lbc1').relu === 'frais', 'Leboncoin : le compte et sa fraîcheur');
  const sansLecture = R.vueConnexions({ rows: null, attendue: '5.448.0', maintenant: T, comptes: { vinted: [{ id: A, nom: 'boutique_a' }] }, lus: {}, jauges: {} });
  dit(sansLecture.navigateurs === null && sansLecture.comptes[0].relu === 'passu' && sansLecture.alerte === null, 'lecture ratée : navigateurs null, compte « pas su », aucune alerte', JSON.stringify(sansLecture));
  dit(R.vueConnexions({ rows: undefined, comptes: {} }).navigateurs === undefined, 'en cours de lecture : undefined');

  // 9. La ligne d'Aujourd'hui.
  dit(v.alerte && v.alerte.code === 'version' && v.alerte.navigateur === 'bbbbbbbbbbbbbbbb' && v.alerte.vars.installer === '5.448.0', 'Aujourd’hui : l’extension ancienne VUE aujourd’hui (5.418 → 5.448)', JSON.stringify(v.alerte));
  const sansVieux = R.vueConnexions({ rows: rows.filter((r) => r.id !== 'ext_appareil_bbbbbbbbbbbbbbbb'), attendue: '5.448.0', maintenant: T, comptes, lus: {}, jauges: {} });
  dit(sansVieux.alerte && sansVieux.alerte.code === 'relu' && sansVieux.alerte.compte === D, 'Aujourd’hui : sinon le compte pas relu depuis 24 h est nommé', JSON.stringify(sansVieux.alerte));
  const absentVieux = R.vueConnexions({ rows: [{ id: 'ext_appareil_bbbbbbbbbbbbbbbb', ver: '5.418.0', atMs: String(T - 3 * J), nav: 'chrome', sys: 'mac' }], attendue: '5.448.0', maintenant: T, comptes: { vinted: [] }, lus: {}, jauges: {} });
  dit(absentVieux.alerte === null, 'Aujourd’hui : une ancienne version PAS vue depuis 24 h ne déclenche rien', JSON.stringify(absentVieux.alerte));
  const capt = R.vueConnexions({ rows: [], attendue: '5.448.0', maintenant: T, comptes: { vinted: [{ id: A, nom: 'boutique_a' }] }, lus: { vinted: { [A]: T } }, jauges: { [A]: { n: 3, max: 50, captcha: T - H, arret: 'captcha' } } });
  dit(capt.alerte && capt.alerte.code === 'arret' && capt.alerte.cle === 'cnx.alerte.verification', 'Aujourd’hui : une vérification demandée par Vinted passe en premier', JSON.stringify(capt.alerte));
  const rien = R.vueConnexions({ rows: [rows[0]], attendue: '5.448.0', maintenant: T, comptes: { vinted: [{ id: A, nom: 'boutique_a' }] }, lus: { vinted: { [A]: T } }, jauges: {} });
  dit(rien.alerte === null, 'Aujourd’hui : tout va bien ⇒ rien');

  // 10. La règle par compte (porte `peutAgir`, branche claude/agir-si-connecte).
  const E = await import(path.join(SRC, 'connexions', 'etatConnexionCompte.js'));
  const ec = (o) => E.etatConnexionCompte({ rows, attendue: '5.448.0', maintenant: T, ...o });
  dit(ec({ compte: A }).connecte === true && ec({ compte: A }).par.id === 'aaaaaaaaaaaaaaaa' && ec({ compte: A }).aJour === true, 'compte vu il y a 3 min par un Chrome à jour : connecté', JSON.stringify(ec({ compte: A })));
  dit(ec({ compte: B }).connecte === false && ec({ compte: B }).raison === 'pas-vu', 'compte vu il y a 40 min : PAS connecté (30 min)', JSON.stringify(ec({ compte: B })));
  dit(ec({ compte: '49999999' }).connecte === false && ec({ compte: '49999999' }).raison === 'jamais', 'compte jamais vu : pas connecté');
  dit(E.etatConnexionCompte({ compte: A, rows: null }).connecte === null && E.etatConnexionCompte({ compte: A, rows: undefined }).raison === 'lecture', 'lecture ratée / en cours : null (pas su), jamais true');
  dit(ec({ site: 'leboncoin', compte: 'lbc1' }).connecte === null && ec({ site: 'leboncoin', compte: 'lbc1' }).siteVuAt === T - 2 * H, 'Leboncoin : le compte n’est pas publié ⇒ null (pas su), le site vu il y a 2 h');
  const vieux = E.etatConnexionCompte({ compte: C, rows: [{ ...rows[1], vus: { vinted: { [C]: T - 60000 } } }], attendue: '5.448.0', maintenant: T });
  dit(vieux.connecte === true && vieux.aJour === false && vieux.installer === '5.448.0' && vieux.raison === 'ancienne', 'connecté par une extension ancienne : aJour false, version à installer', JSON.stringify(vieux));

  console.log(`\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
