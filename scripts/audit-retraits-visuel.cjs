#!/usr/bin/env node
// AUDIT (20 nov.) — la vue des colis à retirer (src/retraitsVue.js) : tri par urgence, résumé, compte à rebours,
// itinéraire. Données INVENTÉES. `--mutation` : chaque règle réaffaiblie doit rendre ROUGE.
// (20 nov., suite — Julien) + la RÉTENTION : un colis ne quitte sa carte que FINI par une preuve (retiré, reparti,
// annulé : `pickupUnion`), jamais à sa date limite — il reste « à vérifier », code et QR visibles, hors du compte ;
// + la BARRE DU TRAJET (src/retraitTrajet.js) : une étape n'est allumée que par SA date lue, jamais déduite.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const MUTATIONS = {
  'rebours-demain-neutre': ['src/retraitsVue.js', "if (j === 1) return { cle: 'demain', n: 1, heure, ambre: true };", "if (j === 1) return { cle: 'demain', n: 1, heure, ambre: false };"],
  'tri-ignore-limite': ['src/retraitsVue.js', 'return l ? l.jours : (Number.isFinite(p.triPoint)', 'return 0 && l ? l.jours : (Number.isFinite(p.triPoint)'],
  'resume-compte-a-verifier': ['src/retraitsVue.js', "const l = (p.arrives || []).filter((x) => x && !x.aVerifier && !x.horsCompte);", 'const l = (p.arrives || []).filter(Boolean);'],
  'itineraire-invente': ['src/retraitsVue.js', "const cible = r || (p.adresse ? adr : '');", "const cible = r || adr;"],
  // Rétention : masquer un colis à sa date limite — dans la vue, dans `pickupUnion`, dans la liste des codes.
  'masquer-a-la-limite-vue': ['src/retraitsVue.js', "const l = ((p && p.arrives) || []).filter((x) => x && !x.redirige);", "const l = ((p && p.arrives) || []).filter((x) => x && !x.redirige && x.raisonCode !== 'delai_depasse');"],
  'masquer-a-la-limite-carte': ['src/natif/RetraitsPoints.jsx', "arrives: (p.arrives || []).filter((x) => x && !x.redirige)", "arrives: (p.arrives || []).filter((x) => x && !x.redirige && !x.aVerifier)"],
  'masquer-a-la-limite-union': ['src/App.jsx', "if (estAVerifier(e)) { aVerifier.push({ kind: 'email', t, e, o: cmd }); continue; }", "if (estAVerifier(e)) { continue; }"],
  'codes-hors-ligne-perdus': ['src/App.jsx', "if (!x || x.kind !== 'vinted' || !x.o) continue;", "if (!x || x.kind !== 'vinted' || !x.o || true) continue;"],
  // Trajet : une étape allumée sans sa date lue.
  'etape-devinee': ['src/retraitTrajet.js', "const expedie = route.length ? route[0] : null;", "const expedie = route.length ? route[0] : point;"],
  'evenement-pas-mesure': ['src/retraitTrajet.js', "  return null;\n}\n\n// Rend", "  return 'route';\n}\n\n// Rend"],
  'courante-pas-la-plus-loin': ['src/retraitTrajet.js', "let courante = -1; etapes.forEach((e, i) => { if (e.lue) courante = i; });", "let courante = -1; etapes.forEach((e, i) => { if (e.lue && courante < 0) courante = i; });"],
};
if (process.argv.includes('--mutation')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rv-'));
    fs.cpSync(path.join(R, 'src'), path.join(t, 'src'), { recursive: true }); fs.cpSync(path.join(R, 'api'), path.join(t, 'api'), { recursive: true }); fs.cpSync(path.join(R, 'package.json'), path.join(t, 'package.json'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de.replace(/\\n/g, '\n'))) { console.log(`❌ mutation ${nom} : ancre introuvable`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de.replace(/\\n/g, '\n'), vers.replace(/\\n/g, '\n')));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const tombe = r.status !== 0; if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? 'rouge' : 'VERTE'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} non attrapée(s)`); process.exit(ok === n ? 0 : 1);
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
(async () => {
  const V = await import('file://' + path.join(R, 'src/retraitsVue.js'));
  const c = (j, h) => V.compteARebours({ jours: j, heure: h });
  dit(c(1, '10 h').cle === 'demain' && c(1).ambre && c(1, '10 h').heure === '10 h', 'demain ⇒ « demain · 10 h », ambre');
  dit(c(4).cle === 'dans' && c(4).n === 4 && !c(4).ambre, 'dans 4 j ⇒ neutre');
  dit(c(0).cle === 'aujourdhui' && c(-2).cle === 'depasse' && c(-2).ambre, 'aujourd’hui et dépassé ⇒ ambre');
  dit(V.compteARebours(null) === null, 'limite pas lue ⇒ rien (jamais une date inventée)');
  const pts = [
    { nom: 'B', arrives: [{ jours: 5 }, { jours: 6 }] },
    { nom: 'A', arrives: [{ jours: 1 }] },
    { nom: 'C', arrives: [{ aVerifier: true, jours: 0 }, { jours: 3 }] },
  ];
  dit(V.trierPoints(pts).map((p) => p.nom).join('') === 'ACB', 'le plus urgent d’abord (limite lue la plus proche ; un « à vérifier » ne compte pas)', V.trierPoints(pts).map((p) => p.nom).join(''));
  const r = V.resumeRetraits(pts);
  dit(r.colis === 4 && r.points === 3 && r.urgents === 1, 'résumé : 4 colis comptés, 3 points, 1 avant demain', JSON.stringify(r));
  dit(/maps\.apple\.com\/\?daddr=48\.1%2C-1\.6/.test(V.lienItineraire({ repere: { lat: 48.1, lon: -1.6 }, adresse: 'x' }, { apple: true })), 'itinéraire : le repère sûr d’abord (Plans sur Apple)');
  dit(/google\.com\/maps\/dir\/\?api=1&destination=/.test(V.lienItineraire({ nom: 'Tabac', adresse: '3 Rue X, 22100 Dinan' })), 'itinéraire : l’adresse écrite sinon (Google Maps)');
  dit(V.lienItineraire({ nom: 'Tabac' }) === '', 'ni repère ni adresse ⇒ pas de lien (jamais un nom seul cherché)');
  dit(V.heureLimite('2026-11-21T09:00:00.000Z') === '10 h' && V.heureLimite('2026-11-21T00:00:00+01:00') === '', 'heure de la limite (Paris) ; minuit pile = une date sans heure');
  // ── RÉTENTION ──────────────────────────────────────────────────────────────
  const depasse = { cle: 'r:e:1', code: '123456', aVerifier: true, horsCompte: true, raisonCode: 'delai_depasse', jours: null, limite: { jour: '2026-11-10', source: 'lue' } };
  const garde = { cle: 'r:e:2', code: '654321', aVerifier: true, horsCompte: true, raisonCode: 'trop_long', jours: null };
  const compte = { cle: 'r:e:3', code: '111111', jours: 2 };
  const redir = { cle: 'r:rc:4', code: '999999', redirige: true };
  const d = V.colisDuPoint({ arrives: [depasse, garde, compte, redir] });
  dit(d.comptes.length === 1 && d.comptes[0] === compte, 'rétention : seul le colis dans les temps compte');
  dit(d.verif.includes(depasse) && d.verif.includes(garde) && d.verif.every((x) => x.code), 'rétention : date limite (ou garde) dépassée ⇒ le colis RESTE dans sa carte, avec son code', d.verif.map((x) => x.cle).join(','));
  dit(!d.verif.includes(redir) && !d.comptes.includes(redir), 'un colis réacheminé a sa propre ligne (pas deux fois)');
  dit(V.mentionVerif(depasse) === 'depasse' && V.mentionVerif(garde) === 'trop-long' && V.mentionVerif(compte) === '', 'la mention dit pourquoi : « date limite dépassée · à vérifier »');
  const rv = V.resumeRetraits([{ arrives: [depasse, compte] }]);
  dit(rv.colis === 1 && rv.verif === 1 && rv.urgents === 0, 'le résumé ne compte pas un « à vérifier », il le dit à part', JSON.stringify(rv));
  dit(V.trierPoints([{ nom: 'V', arrives: [depasse] }, { nom: 'C', arrives: [{ jours: 9 }] }]).map((p) => p.nom).join('') === 'CV', 'un point « à vérifier » seulement passe après les points à retirer');
  // La règle d'amont (App.jsx, `pickupUnion`) : une limite dépassée envoie « à vérifier », jamais nulle part ;
  // et les fins qui SORTENT un colis sont toutes des preuves (transporteur, e-mail, commande) — lu dans la source.
  const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const i0 = app.indexOf('const pickupUnion = useMemo(() => {'); const i1 = app.indexOf('// Le transporteur ÉCRIT que le colis repart', i0);
  const union = i0 > 0 && i1 > i0 ? app.slice(i0, i1).replace(/\/\/[^\n]*/g, '') : '';
  dit(/if \(estAVerifier\(e\)\) \{ aVerifier\.push\(\{ kind: 'email', t, e, o: cmd \}\); continue; \}/.test(union), 'pickupUnion : date limite dépassée ⇒ « à vérifier » (visible), jamais jeté');
  dit(!/jours\s*<\s*0[^\n]*continue/.test(union) && !/delai_depasse'[^\n]*\)\s*continue/.test(union), 'pickupUnion : aucune sortie sur la date limite seule');
  const lc0 = app.indexOf('const listeCodesRetrait = () => {'); const lc = lc0 > 0 ? app.slice(lc0, app.indexOf('return codes;', lc0)) : '';
  dit(/pickupUnion\.aVerifier\.filter\(x => x\.kind === 'email'\)/.test(lc) && /for \(const x of \(pickupUnion\.aVerifier \|\| \[\]\)\) \{\s*if \(!x \|\| x\.kind !== 'vinted' \|\| !x\.o\) continue;/.test(lc), 'codes gardés (hors ligne) : les « à vérifier » e-mail ET Vinted gardent leur code');
  const rp = fs.readFileSync(path.join(R, 'src/natif/RetraitsPoints.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
  dit(/arrives: \(p\.arrives \|\| \[\]\)\.filter\(\(x\) => x && !x\.redirige\)\s*\}\)\)/.test(rp) && /colisDuPoint\(p\)/.test(rp), 'les cartes gardent les « à vérifier » (colisDuPoint), seul un réacheminé en sort');
  // ── TRAJET ─────────────────────────────────────────────────────────────────
  const T = await import('file://' + path.join(R, 'src/retraitTrajet.js'));
  const N = Date.parse('2026-11-20T12:00:00Z'); const J = 86400000;
  const lues = (r) => r.etapes.filter((e) => e.lue).map((e) => e.cle).join(',');
  const seul = T.etapesTrajet({ arriveesAt: [N - J], maintenant: N });
  dit(lues(seul) === 'point' && seul.etapes[seul.courante].cle === 'point', 'arrivée seule lue ⇒ « Au point » allumé, Payé · Expédié · En transit restent GRIS (jamais déduits)', lues(seul));
  const mr = T.etapesTrajet({ payeAt: new Date(N - 6 * J).toISOString(), transporteur: 'mondialrelay', maintenant: N, evenements: [
    { at: new Date(N - 5 * J).toISOString(), libelle: 'Colis en préparation chez l’expéditeur' },
    { at: new Date(N - 4 * J).toISOString(), libelle: 'Colis remis à Mondial Relay' },
    { at: new Date(N - 3 * J).toISOString(), libelle: 'Colis en route vers le point de livraison' },
    { at: new Date(N - 2 * J).toISOString(), libelle: 'Colis disponible au point de retrait' },
    { at: new Date(N - 1 * J).toISOString(), libelle: 'Colis en route vers le point de livraison' } ] });
  dit(lues(mr) === 'paye,expedie,transit,point' && mr.etapes[mr.courante].cle === 'point', 'Mondial Relay : payé, remis, en route, disponible ⇒ 4 étapes datées, « Retiré » gris', lues(mr));
  dit(mr.etapes[1].at === N - 4 * J && mr.etapes[2].at === N - 3 * J && mr.etapes[3].at === N - 2 * J, 'chaque étape porte la date de SON évènement (un départ après l’arrivée n’est pas l’aller)');
  const inc = T.etapesTrajet({ transporteur: 'dpd', evenements: [{ at: new Date(N - 2 * J).toISOString(), libelle: 'Colis remis à Mondial Relay', code: 'DB' }], maintenant: N });
  dit(inc.courante === -1 && lues(inc) === '', 'transporteur sans table mesurée ⇒ rien n’est allumé', lues(inc));
  const cp = T.etapesTrajet({ transporteur: 'chronopost', evenements: [{ at: new Date(N - 2 * J).toISOString(), code: 'DC' }, { at: new Date(N - J).toISOString(), code: 'ZZ' }], maintenant: N });
  dit(lues(cp) === '', 'Chronopost : « préparé » (DC) n’est pas expédié ; un code inconnu ne prouve rien', lues(cp));
  const fut = T.etapesTrajet({ payeAt: new Date(N + 5 * J).toISOString(), transitAt: [new Date(N + J).toISOString()], maintenant: N });
  dit(lues(fut) === '', 'une date dans le futur ne prouve rien', lues(fut));
  const mail = T.etapesTrajet({ transitAt: [new Date(N - 3 * J).toISOString()], arriveesAt: [N - J], maintenant: N });
  dit(lues(mail) === 'transit,point', 'un e-mail « en route » du même n° allume « En transit » seulement', lues(mail));
  const vg = T.etapesTrajet({ transporteur: 'vinted', maintenant: N, evenements: [{ at: new Date(N - 3 * J).toISOString(), code: 'shipped' }, { at: new Date(N - 2 * J).toISOString(), code: 'ready_for_pickup' }] });
  dit(lues(vg) === 'expedie,point', 'Vinted Go : shipped puis ready_for_pickup', lues(vg));
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ tout est vert'); process.exit(ko ? 1 : 0);
})();
