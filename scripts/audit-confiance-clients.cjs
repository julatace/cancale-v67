// ── audit-confiance-clients — LA CONFIANCE DES VENDEURS (16 nov.) ────────────────────────────
// Récit : docs/passation/2026-11-16-confiance-clients.md. Trois points validés par Julien :
//   A  alerte de connexion inhabituelle : un appareil jamais vu ⇒ notification ET e-mail au titulaire
//      (voie des relances SEULEMENT si configurée, sinon notification seule, dit dans « Appareils
//      connectés ») ; jamais au premier appareil ; jamais d'IP ni de lieu ; l'adresse de SA session ;
//   B  « État de VRM » : la page /statut (sondes existantes) liée depuis le centre d'aide et Paramètres ;
//   C  calendrier fiscal selon SON régime (jamais deviné), dates officielles citées, veille rappelée.
//   node scripts/audit-confiance-clients.cjs | --mutation=NOM | --prouve
// Aucune donnée réelle : tout est inventé ici.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const lireF = (f) => fs.readFileSync(path.join(R, f), 'utf8');

const MUTATIONS = [
  ['mail-au-premier', 'api/_lib/appareil-nouveau.js', "  if (calc.init) return { status: 200, body: { ok: true, init: true, nouveaux: 0 } };\n", ''],
  ['mail-sans-config', 'api/compte.js', 'const envoyerMail = cm.pret ? (m) =>', 'const envoyerMail = true ? (m) =>'],
  ['mail-adresse-du-corps', 'api/_lib/appareil-nouveau.js', "const adresse = String(user.email || '').trim();", "const adresse = String((deps.corps && deps.corps.email) || user.email || '').trim();"],
  ['regime-devine', 'src/calendrierFiscal.js', "  if (!regime) return { etat: 'aChoisir', echeances: [], manque: ['regime'] };", "  if (!regime) regime = 'micro';"],
  ['rythme-devine', 'src/calendrierFiscal.js', "  if (freq !== 'mensuel' && freq !== 'trimestriel') manque.push('rythme');\n  else {", "  { if (freq !== 'mensuel') freq = 'trimestriel';"],
  ['exoneration-devinee', 'src/calendrierFiscal.js', 'const exoneree = anneeDebut === annee;', 'const exoneree = anneeDebut === null || anneeDebut === annee;'],
  ['dates-impot-devinees', 'src/calendrierFiscal.js', '  const D = DATES_IMPOT[annee];', '  const D = DATES_IMPOT[annee] || DATES_IMPOT[2026];'],
  ['tva-toujours', 'src/calendrierFiscal.js', 'Number(ca.ca) > S.tvaBase', 'Number(ca.ca) >= 0'],
  ['veille-sans-dedup', 'api/ship-reminders.js', "if (res.reserve) await sendPushToAll({ cat: 'urssaf', title: n.titre, body: n.corps, tag: 'fiscal-veille-'", "if (true) await sendPushToAll({ cat: 'urssaf', title: n.titre, body: n.corps, tag: 'fiscal-veille-'"],
  ['aide-vers-etat', 'scripts/aide-generer.cjs', '<a href="/statut">État de VRM</a>', '<a href="/etat">État de VRM</a>'],
];
const arg = process.argv.find((a) => a.startsWith('--mutation='));
if (process.argv.includes('--prouve')) {
  let rates = 0;
  for (const [nom] of MUTATIONS) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8' });
    if (r.status === 0) rates++;
    console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ${r.status !== 0 ? 'rougit' : 'NE ROUGIT PAS'}`);
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) passent inaperçues` : `\n✅ les ${MUTATIONS.length} mutations rougissent`);
  process.exit(rates ? 1 : 0);
}
if (arg) {
  const m = MUTATIONS.find((x) => x[0] === arg.slice(11));
  if (!m) { console.log('❌ mutation inconnue'); process.exit(2); }
  const f = path.join(R, m[1]), avant = fs.readFileSync(f, 'utf8');
  if (!avant.includes(m[2])) { console.log(`❌ mutation « ${m[0]} » : le texte visé n'existe plus`); process.exit(3); }
  fs.writeFileSync(f, avant.replace(m[2], m[3]));
  const remettre = () => fs.writeFileSync(f, avant);
  process.on('exit', remettre);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { remettre(); process.exit(130); });
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' (plantage)', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };

(async () => {
  console.log('── A. une connexion depuis un appareil jamais vu');
  await essaie('A', async () => {
    const A = await import(path.join(R, 'api', '_lib', 'appareil-nouveau.js'));
    const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const S1 = { id: '11111111-1111-4111-8111-111111111111', user_id: U, user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Chrome/130.0 Safari/537.36', ip: '203.0.113.9' };
    const S2 = { id: '22222222-2222-4222-8222-222222222222', user_id: U, user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', ip: '198.51.100.7' };
    const banc = (sessions, registre) => {
      const rows = registre ? [{ data: registre }] : [];
      return async (url, o = {}) => {
        const json = (j, s = 200) => ({ ok: s < 400, status: s, json: async () => j });
        if (/rpc\/vrm_sessions_de/.test(url)) return json(sessions);
        if ((o.method || 'GET') === 'GET') return json(rows);
        if (o.method === 'PATCH') { const b = JSON.parse(o.body); rows[0] = { data: b.data }; return json([rows[0]]); }
        if (o.method === 'POST') { const b = JSON.parse(o.body); rows[0] = { data: b[0].data }; return json(null, 201); }
        return json(null, 500);
      };
    };
    const pousses = [], mails = [];
    const pousser = async (n) => { pousses.push(n); return { sent: 1 }; };
    const envoyerMail = async (m) => { mails.push(m); return { issue: 'envoye' }; };
    const user = { id: U, email: 'titulaire@exemple.invalid' };
    const r0 = await A.verifierNouvelAppareil({ base: 'https://banc.invalid', cle: 'k', user, fetch: banc([S1], null), pousser, envoyerMail });
    dit(r0.body.init === true && !pousses.length && !mails.length, 'premier appareil d’un compte : ni notification, ni e-mail', r0.body);
    const reg = { v: 1, rev: 1, signatures: { [A.nomEnClair ? 'Mac · Chrome' : 'Mac · Chrome']: '2026-11-01T00:00:00Z' } };
    const r1 = await A.verifierNouvelAppareil({ base: 'https://banc.invalid', cle: 'k', user, fetch: banc([S1, S2], reg), pousser, envoyerMail, maintenant: Date.parse('2026-11-16T08:12:00Z'), corps: { email: 'autre@exemple.invalid' } });
    dit(r1.body.nouveaux === 1 && pousses.length === 1 && mails.length === 1 && r1.body.email === 'envoye', 'appareil jamais vu : UNE notification et UN e-mail', r1.body);
    const m = mails[0] || {};
    dit(m.a === 'titulaire@exemple.invalid', 'l’e-mail part à l’adresse de SA session', m.a);
    dit(/^Nouvelle connexion à VRM — iPhone · Safari — le 16\/11 à 9 h 12$/.test(m.sujet || ''), 'le sujet : appareil, navigateur, jour et heure de Paris', m.sujet);
    const tout = JSON.stringify(m);
    dit(!/203\.0\.113|198\.51\.100|Mozilla|AppleWebKit/.test(tout), 'jamais d’IP ni d’agent brut dans l’e-mail');
    dit(/Change ton mot de passe/.test(m.texte || '') && /reglage=appareils/.test(tout), 'il dit « Ce n’est pas toi ? Change ton mot de passe » et mène aux appareils');
    pousses.length = 0; mails.length = 0;
    const r2 = await A.verifierNouvelAppareil({ base: 'https://banc.invalid', cle: 'k', user, fetch: banc([S1, S2], reg), pousser, envoyerMail: null });
    dit(r2.body.email === 'non-configure' && pousses.length === 1 && !mails.length, 'e-mail pas configuré : notification seule, et le serveur le dit', r2.body);
    const route = lireF('api/compte.js');
    dit(/const envoyerMail = cm\.pret \? \(m\) => envoyerSmtp\(/.test(route) && /r\.body\.alerteEmail = configurationRelances\(process\.env\)\.pret/.test(route), 'la route : la voie des relances seulement si configurée ; la liste dit si l’e-mail part');
    const ui = lireF('src/ecrans/Reglages.jsx');
    dit(/data-appareils-alerte=\{etat\.alerteEmail \? 'email' : 'notification'\}/.test(ui) && /alerteEmail: typeof j\.alerteEmail === 'boolean'/.test(ui), 'Paramètres → Appareils connectés le dit (e-mail ou notification seule)');
    const npm = JSON.parse(lireF('package.json'));
    dit(fs.readdirSync(path.join(R, 'api')).filter((f) => f.endsWith('.js')).length <= 12, 'toujours 12 fonctions api/ au plus', npm.name);
  });

  console.log('\n── B. État de VRM');
  await essaie('B', async () => {
    const gen = lireF('scripts/aide-generer.cjs'), aide = lireF('scripts/aide-contenu.cjs');
    dit(/<a href="\/statut">État de VRM<\/a>/.test(gen) && /\[vrm\.center\/statut\]\(\/statut\)/.test(aide), 'le centre d’aide mène à /statut (la page complète, sondes et historique)');
    const pages = fs.readdirSync(path.join(R, 'public', 'aide')).filter((f) => f.endsWith('.html'));
    dit(pages.length > 5 && pages.every((f) => lireF(path.join('public', 'aide', f)).includes('href="/statut"')), `chaque page générée porte le lien (${pages.length})`);
    dit(/id:'statut', type:'nav'[^\n]*window\.open\('\/statut'/.test(lireF('src/ecrans/Reglages.jsx')), 'Paramètres → Aide → État de VRM ouvre /statut');
    dit(/"source": "\/statut"/.test(lireF('vercel.json')) && fs.existsSync(path.join(R, 'public', 'statut.html')), 'vrm.center/statut est servie');
  });

  console.log('\n── C. le calendrier fiscal');
  await essaie('C', async () => {
    const C = await import(path.join(R, 'src', 'calendrierFiscal.js'));
    const now = new Date(2026, 10, 16, 12);
    dit(C.calendrierFiscal({ regime: undefined, now }).etat === 'encours', 'statut pas encore lu : rien');
    const a = C.calendrierFiscal({ regime: null, freq: 'mensuel', now });
    dit(a.etat === 'aChoisir' && !a.echeances.length, 'statut pas choisi : aucune échéance, dit (jamais deviné)', a);
    dit(C.calendrierFiscal({ regime: 'particulier', now }).etat === 'horsMicro', 'particulier : pas de calendrier micro');
    const sansR = C.calendrierFiscal({ regime: 'micro', freq: null, annee: 2026, now });
    dit(sansR.manque.includes('rythme') && !sansR.echeances.some((e) => e.type === 'urssaf'), 'rythme pas choisi : aucune date URSSAF, dit');
    const decl = { '2026-01': { ids: [] }, '2026-02': { ids: [] }, '2026-03': { ids: [] } };
    const t = C.calendrierFiscal({ regime: 'micro', freq: 'trimestriel', declare: decl, annee: 2026, now });
    const u = t.echeances.filter((e) => e.type === 'urssaf').map((e) => e.jour + (e.fait ? '✓' : ''));
    dit(JSON.stringify(u) === JSON.stringify(['2026-01-31', '2026-04-30✓', '2026-07-31', '2026-10-31']), 'trimestriel : 31 janv., 30 avril (déclaré, SON registre), 31 juil., 31 oct.', u);
    dit(C.calendrierFiscal({ regime: 'micro', freq: 'mensuel', annee: 2026, now }).echeances.filter((e) => e.type === 'urssaf').length === 12, 'mensuel : douze échéances');
    const cfe = t.echeances.find((e) => e.type === 'cfe');
    dit(cfe && cfe.jour === '2026-12-15' && cfe.exoneree === false && t.manque.includes('debut'), 'CFE le 15 décembre ; date de début inconnue ⇒ aucune exonération dite');
    dit(C.calendrierFiscal({ regime: 'micro', freq: 'mensuel', debut: '2026-03', annee: 2026, now }).echeances.find((e) => e.type === 'cfe').exoneree === true, 'début connu cette année ⇒ « exonérée l’année de création »');
    const imp = t.echeances.find((e) => e.type === 'impot');
    dit(imp && imp.debutJour === '2026-04-09' && imp.zones.map((z) => z.limite).join(',') === '2026-05-21,2026-05-28,2026-06-04' && /impots\.gouv\.fr/.test(imp.source), 'déclaration de revenus 2026 : dates officielles (9 avril ; 21, 28 mai, 4 juin) et leur source', imp);
    const n27 = C.calendrierFiscal({ regime: 'micro', freq: 'mensuel', annee: 2027, now: new Date(2027, 0, 5) });
    dit(!n27.echeances.some((e) => e.type === 'impot') && n27.manque.includes('dates-impot'), '2027 : dates pas encore publiées ⇒ rien de deviné, dit');
    const ligne = (ca) => ({ mois: [{ ym: '2026-03', recu: ca, n: 10 }], at: Date.now() });
    const sans = C.calendrierFiscal({ regime: 'micro', freq: 'mensuel', annee: 2026, now, ligne: ligne(1000) });
    dit(!sans.echeances.some((e) => e.type === 'tva'), 'TVA : rien tant que le seuil n’est pas atteint');
    dit(C.veilleFiscale(t, '2026-12-14') && C.veilleFiscale(t, '2026-12-14').echeance.type === 'cfe' && C.veilleFiscale(t, '2026-05-20').zone.zone === 1 && C.veilleFiscale(t, '2026-05-19') === null, 'la veille : CFE le 14 déc., zone 1 le 20 mai, rien d’autre');
    const F = await import(path.join(R, 'api', '_lib', 'rappel-fiscal.js'));
    const main = { vinted_regime: 'micro', vinted_urssaf_freq: 'trimestriel' };
    const v1 = F.rappelVeilleFiscal({ today: '2026-12-14', main });
    dit(v1.envoyer && /Demain : CFE/.test(v1.titre), 'la notification de la veille (CFE)', v1);
    dit(!F.rappelVeilleFiscal({ today: '2026-12-14', main: { vinted_regime: null } }).envoyer && !F.rappelVeilleFiscal({ today: '2026-12-14', main: undefined }).envoyer, 'statut pas choisi ou réglages illisibles : rien');
    const cron = lireF('api/ship-reminders.js');
    dit(/rappelVeilleFiscal\(\{ today, main: await getRowProjete\('main', MAIN_FISCAL\) \}\)/.test(cron) && /reserverDedup\('urssaf_reminder_dedup', \(d\) => !!d && d\.veilleFiscale === n\.cle/.test(cron) && /if \(res\.reserve\) await sendPushToAll\(\{ cat: 'urssaf', title: n\.titre, body: n\.corps, tag: 'fiscal-veille-'/.test(cron) && /pushCategorieActive\('urssaf'\)/.test(cron), 'le cron : réglages projetés, une fois par échéance (réservée avant), famille « Rappels » coupable');
    const textes = ['src/calendrierFiscal.js', 'api/_lib/rappel-fiscal.js', 'src/composants/CalendrierFiscal.jsx', 'src/i18n/langues/fr/confiance.js'].map(lireF).join('\n').replace(/\/\/.*$/gm, '');
    dit(!/encaiss/i.test(textes), 'jamais le mot « encaissé »');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-confiance-clients : ${ok}/${ok + ko}`);
  process.exit(ko ? 1 : 0);
})();
