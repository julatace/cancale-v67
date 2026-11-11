require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ═══════════════════════════════════════════════════════════════════════════
// LOT DJ6 (11 nov.) — PROFIL ET CONNEXION DISCORD/GOOGLE, EXÉCUTÉS (§4.10)
// ═══════════════════════════════════════════════════════════════════════════
// 1. Les règles pures (src/auth/compteNeuf.js, src/profil/identiteProfil.js) :
//    un compte n'est « créé par CE clic » que s'il a UNE identité Discord/Google,
//    créée il y a < 10 min et jamais reconnectée ; l'intention du clic se lit une
//    fois ; la photo : téléversée > Discord/Google (hôtes de confiance) > initiale ;
//    « Masquer mon nom » ⇒ « Mon compte », jamais le nom ni l'e-mail.
// 2. La VRAIE route `api/compte.js?mode=oauth-sans-compte` sur la fausse base à deux
//    vendeurs (scripts/_faux-compte-rgpd.cjs) : n'annule QUE le compte vide que la
//    connexion vient de créer ; tout autre compte (données, ancien, deux identités,
//    e-mail, reconnecté) ⇒ 409, RIEN touché ; une lecture ratée ⇒ 503, rien touché.
// 3. La coque (App.jsx, lecture du source) : Paramètres n'est plus une entrée de
//    navigation, le menu du profil l'ouvre, « g p » aussi, l'écran reste monté ; le
//    bouton de connexion pose l'intention « connexion », l'inscription « inscription ».
//   node scripts/audit-profil-oauth.cjs
//   node scripts/audit-profil-oauth.cjs --mutation=NOM   (ecart | vide | identites | intention | parametres)
//   node scripts/audit-profil-oauth.cjs --prouve         origin/main ET chaque mutation : ROUGE
// Aucune donnée réelle : tout est inventé.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const ICI = path.join(__dirname, '..');
let RACINE = arg('--src') ? path.resolve(arg('--src')) : ICI;

const MUTATIONS = {
  // Le serveur oublie « jamais reconnecté depuis » : un compte voulu, revenu, serait annulé.
  ecart: ['src/auth/compteNeuf.js', "if (derniere !== null && derniere - cree > ECART_CONNEXION_MS) return '';", ''],
  // Le serveur n'exige plus un compte VIDE.
  vide: ['api/compte.js', "if (Object.values(inv).some((n) => n !== 0)) return REFUS('pas-vide');", ''],
  // Deux identités (un compte relié, déjà vécu) comptent comme « neuf ».
  identites: ['src/auth/compteNeuf.js', "if (ids.length !== 1) return '';", "if (!ids.length) return '';"],
  // L'app annule sans regarder le bouton cliqué (inscription comprise).
  intention: ['src/App.jsx', "nouveauOAuth&&intention?.intention==='connexion'&&intention.fournisseur===nouveauOAuth?nouveauOAuth:''", "nouveauOAuth"],
  // Paramètres revient dans la navigation.
  parametres: ['src/App.jsx', "    {id:'communaute', icon:'pin',  label:'Communauté'},\n  ]},", "    {id:'communaute', icon:'pin',  label:'Communauté'},\n    {id:'settings',   icon:'gear', label:'Paramètres'},\n  ]},"],
};

function copieArbre(depuis) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-profil-oauth-'));
  if (depuis === 'origin/main') cp.execSync(`git -C "${ICI}" archive origin/main api src public | tar -x -C "${tmp}"`);
  else cp.execSync(`git -C "${ICI}" ls-files -z api src public | (cd "${ICI}" && xargs -0 tar -cf -) | tar -x -C "${tmp}"`, { shell: '/bin/bash' });
  // Les fichiers neufs de ce lot (pas encore suivis) : copiés aussi.
  if (depuis !== 'origin/main') for (const f of ['src/auth/compteNeuf.js', 'src/profil/identiteProfil.js']) if (fs.existsSync(path.join(ICI, f))) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(ICI, f), path.join(tmp, f)); }
  let nm = ICI; while (!fs.existsSync(path.join(nm, 'node_modules')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  fs.symlinkSync(path.join(nm, 'node_modules'), path.join(tmp, 'node_modules'));
  return tmp;
}

if (process.argv.includes('--prouve')) {
  const lancer = (racine, mut) => cp.spawnSync(process.execPath, [__filename, '--src', racine, ...(mut ? ['--mutation=' + mut] : [])], { encoding: 'utf8' });
  const ko = (r) => r.status !== 0;
  const n = (r) => ((r.stdout || '').match(/❌/g) || []).length;
  let bon = true;
  const ra = lancer(copieArbre('origin/main'));
  console.log(`${ko(ra) ? '✅' : '❌'} sur origin/main : ROUGE (${n(ra)} en échec)`); bon = bon && ko(ra);
  for (const m of Object.keys(MUTATIONS)) { const r = lancer(ICI, m); console.log(`${ko(r) ? '✅' : '❌'} mutation « ${m} » : ROUGE (${n(r)} en échec)`); bon = bon && ko(r); }
  const ri = lancer(ICI); console.log(`${!ko(ri) ? '✅' : '❌'} sur ce code : VERT`); bon = bon && !ko(ri);
  process.exit(bon ? 0 : 1);
}
if (MUT) {
  const m = MUTATIONS[MUT]; if (!m) { console.log('❌ mutation inconnue'); process.exit(1); }
  const t = copieArbre('ici'); const f = path.join(t, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation sans effet (ancre introuvable)'); process.exit(1); }
  fs.writeFileSync(f, s.replace(m[1], m[2])); RACINE = t;
}

const F = require('./_faux-compte-rgpd.cjs');
const { A, B, etat, reset, session } = F;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + String(d).slice(0, 200) : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

// N : le compte que « Continuer avec Discord » vient de créer (inventé).
const N = '33333333-3333-4333-8333-333333333333';
let ficheN = null, panneFiche = false;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const ficheNeuve = (o = {}) => ({ id: N, email: 'pseudo.discord@exemple.test', created_at: iso(30e3), last_sign_in_at: iso(29e3), identities: [{ provider: 'discord', identity_id: 'i-1', identity_data: { avatar_url: 'https://cdn.discordapp.com/avatars/1/a.png' } }], ...o });
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  if (u.includes('/auth/v1/admin/users/') && (opts.method || 'GET') === 'GET') {
    const id = u.split('/admin/users/')[1];
    if (id === N) return panneFiche ? new Response('<html>522</html>', { status: 522 }) : new Response(JSON.stringify(ficheN), { status: 200, headers: { 'content-type': 'application/json' } });
    if (id === A) return new Response(JSON.stringify({ id: A, created_at: iso(30e3), last_sign_in_at: iso(29e3), identities: [{ provider: 'discord' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return F.faux(url, opts);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = (jeton, method = 'POST') => ({ method, query: { mode: 'oauth-sans-compte' }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, async *[Symbol.asyncIterator]() { yield Buffer.from('{}'); } });
const preparer = (fiche) => { reset(); etat.base.utilisateurs.add(N); ficheN = fiche; panneFiche = false; };
const rienTouche = () => etat.deletes.length === 0 && etat.base.utilisateurs.has(N) && etat.base.utilisateurs.has(A) && etat.base.utilisateurs.has(B);

(async () => {
  // ── 1. Règles pures
  console.log('── Règles (src/auth/compteNeuf.js, src/profil/identiteProfil.js)');
  let R = null, P = null;
  try { R = await import('file://' + path.join(RACINE, 'src/auth/compteNeuf.js')); } catch (e) { dit(false, 'src/auth/compteNeuf.js existe', e.message); }
  try { P = await import('file://' + path.join(RACINE, 'src/profil/identiteProfil.js')); } catch (e) { dit(false, 'src/profil/identiteProfil.js existe', e.message); }
  if (R) {
    const t = Date.parse('2026-11-11T12:00:00Z'), at = (ms) => new Date(t - ms).toISOString();
    const u = (o) => ({ created_at: at(60e3), last_sign_in_at: at(58e3), identities: [{ provider: 'discord' }], ...o });
    dit(R.compteOAuthAnnulable(u({}), t) === 'discord', 'créé il y a 1 min par Discord, une identité : annulable');
    dit(R.compteOAuthAnnulable(u({ identities: [{ provider: 'google' }] }), t) === 'google', 'idem Google');
    dit(R.compteOAuthAnnulable(u({ created_at: at(11 * 60e3), last_sign_in_at: at(11 * 60e3) }), t) === '', 'créé il y a 11 min : jamais');
    dit(R.compteOAuthAnnulable(u({ identities: [{ provider: 'email' }, { provider: 'discord' }] }), t) === '', 'e-mail + Discord (compte relié) : jamais');
    dit(R.compteOAuthAnnulable(u({ identities: [{ provider: 'google' }, { provider: 'discord' }] }), t) === '', 'deux identités : jamais');
    dit(R.compteOAuthAnnulable(u({ identities: [{ provider: 'email' }] }), t) === '', 'e-mail seul : jamais');
    dit(R.compteOAuthAnnulable(u({ created_at: at(8 * 60e3), last_sign_in_at: at(60e3) }), t) === '', 'reconnecté 7 min après sa création (compte voulu, revenu) : jamais');
    dit(R.compteOAuthAnnulable(u({ created_at: 'n/d' }), t) === '' && R.compteOAuthAnnulable(null, t) === '', 'date illisible ou rien : jamais (« pas su »)');
    const st = () => { const m = new Map(); return { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
    const s1 = st(), s2 = st();
    R.poserIntention([s1, s2], 'connexion', 'discord', t);
    const l1 = R.lireIntention([s1, s2], t + 1000), l2 = R.lireIntention([s1, s2], t + 2000);
    dit(l1 && l1.intention === 'connexion' && l1.fournisseur === 'discord' && l2 === null, 'l’intention du clic se lit UNE fois', JSON.stringify([l1, l2]));
    R.poserIntention([s1], 'connexion', 'discord', t);
    dit(R.lireIntention([s1], t + 11 * 60e3) === null, 'une intention de plus de 10 min ne vaut rien');
    R.poserIntention([s1], 'piratage', 'facebook', t);
    dit(R.lireIntention([s1], t) === null, 'une intention ou un fournisseur hors liste ne sont pas rangés');
  }
  if (P) {
    const g = { provider: 'google', last_sign_in_at: '2026-11-01T00:00:00Z', identity_data: { picture: 'https://lh3.googleusercontent.com/a/xyz=s96-c' } };
    const d = { provider: 'discord', last_sign_in_at: '2026-11-10T00:00:00Z', identity_data: { avatar_url: 'https://cdn.discordapp.com/avatars/1/abc.png' } };
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    dit(P.choisirAvatar({ televersee: png, fiche: { identities: [g, d] } }).source === 'televersee', 'la photo téléversée passe AVANT Discord et Google');
    dit(P.choisirAvatar({ televersee: '', fiche: { identities: [g, d] } }).source === 'discord', 'sans photo : l’identité la plus récemment utilisée (ici Discord)');
    dit(P.choisirAvatar({ televersee: '', fiche: { identities: [g] } }).url.startsWith('https://lh3.googleusercontent.com/'), 'Google seul : sa photo');
    dit(P.choisirAvatar({ televersee: '', fiche: { identities: [{ provider: 'email' }] } }).source === 'initiale', 'aucune identité Discord/Google : l’initiale');
    dit(P.choisirAvatar({ televersee: '', fiche: { identities: [{ provider: 'discord', identity_data: { avatar_url: 'https://evil.test/a.png' } }] } }).source === 'initiale', 'une adresse hors Discord/Google n’est jamais affichée');
    dit(P.urlAvatarPermise('http://cdn.discordapp.com/a.png') === '' && P.urlAvatarPermise('https://x.googleusercontent.com.evil.test/a') === '', 'http ou hôte déguisé : refusé');
    dit(P.choisirAvatar({ televersee: 'data:image/svg+xml;base64,PHN2Zz4=', fiche: null }).source === 'initiale', 'une « photo » SVG téléversée n’est pas prise');
    dit(P.nomAffiche({ masque: true, nom: 'Sneakers Julien', email: 'julien@x.fr' }) === 'Mon compte' && P.initialeAffichee({ masque: true, nom: 'Sneakers', email: '' }) === '•', 'masqué : « Mon compte », ni nom ni initiale');
    dit(P.nomAffiche({ masque: false, nom: '', email: 'julien@x.fr' }) === 'julien@x.fr' && P.emailMasque('julien@x.fr') === 'j•••@x.fr', 'visible : le nom, sinon l’e-mail ; e-mail masqué « j•••@x.fr »');
  }

  // ── 2. La route
  console.log('\n── La route `?mode=oauth-sans-compte` (vrai api/compte.js, fausse base)');
  process.env.SUPABASE_SERVICE_KEY = F.SERVICE;
  for (const k of Object.keys(process.env)) if (/^RELANCES_SMTP|^RELANCES_EXPEDITEUR/.test(k)) delete process.env[k];
  let compte;
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); }
  if (compte) {
    const appel = async (jeton, method) => { const r = faireRes(); await compte(req(jeton, method), r); return r; };
    await essaie('neuf', async () => {
      preparer(ficheNeuve()); const r = await appel(session(N, 20e3));
      dit(r.code === 200 && r.corps && r.corps.annule === true && !etat.base.utilisateurs.has(N), 'compte VIDE que Discord vient de créer : annulé (200), le compte de connexion part', `HTTP ${r.code} · ${JSON.stringify(r.corps)}`);
      dit(etat.base.utilisateurs.has(A) && etat.base.utilisateurs.has(B) && etat.base.app_data.filter((l) => l.owner === A).length === 7 && etat.base.app_data.filter((l) => l.owner === B).length === 3, '… et les autres comptes restent INTACTS');
    });
    for (const [nom, fiche, avant] of [
      ['avec une donnée (une ligne `main`)', ficheNeuve(), () => etat.base.app_data.push({ owner: N, id: 'main', data: {} })],
      ['créé il y a 2 h', ficheNeuve({ created_at: iso(2 * 3600e3), last_sign_in_at: iso(2 * 3600e3) })],
      ['reconnecté 5 min après sa création', ficheNeuve({ created_at: iso(8 * 60e3), last_sign_in_at: iso(3 * 60e3) })],
      ['deux identités (Discord relié à un compte e-mail)', ficheNeuve({ identities: [{ provider: 'email' }, { provider: 'discord' }] })],
      ['identité e-mail seule', ficheNeuve({ identities: [{ provider: 'email' }] })],
      ['avec un compte Vinted', ficheNeuve(), () => etat.base.vinted_accounts.push({ owner: N, vinted_user_id: '99' })],
    ]) {
      await essaie(nom, async () => {
        preparer(fiche); if (avant) avant();
        const r = await appel(session(N, 20e3));
        dit(r.code === 409 && rienTouche(), `${nom} : 409, RIEN n’est effacé`, `HTTP ${r.code} · deletes=${etat.deletes.join(' ')}`);
      });
    }
    await essaie('A', async () => { preparer(ficheNeuve()); const r = await appel(session(A, 20e3)); dit(r.code === 409 && rienTouche(), 'un compte avec des données (A) : 409, rien touché', `HTTP ${r.code}`); });
    await essaie('sans session', async () => { preparer(ficheNeuve()); const r = await appel(null); dit(r.code === 401 && rienTouche(), 'sans session : 401', `HTTP ${r.code}`); });
    await essaie('GET', async () => { preparer(ficheNeuve()); const r = await appel(session(N, 20e3), 'GET'); dit(r.code === 405 && rienTouche(), 'GET : 405 (jamais d’un simple lien)', `HTTP ${r.code}`); });
    await essaie('fiche pas sue', async () => { preparer(ficheNeuve()); panneFiche = true; const r = await appel(session(N, 20e3)); dit(r.code === 503 && rienTouche(), 'fiche illisible : 503, rien touché', `HTTP ${r.code}`); });
    await essaie('inventaire pas su', async () => { preparer(ficheNeuve()); etat.pannes.add('lecture-app_data'); const r = await appel(session(N, 20e3)); dit(r.code === 503 && rienTouche(), 'inventaire illisible : 503, rien touché', `HTTP ${r.code}`); });
  }

  // ── 3. La coque
  console.log('\n── La coque (App.jsx)');
  const app = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
  const groupes = (/const GROUPES_PLUS=\[([\s\S]*?)\n\];/.exec(app) || [])[1] || '';
  dit(!!groupes && !/id:'settings'/.test(groupes), 'Paramètres n’est plus une entrée de la navigation (colonne, « Plus »)');
  dit((app.match(/tab==='settings'&&<GardeEcran nom="settings"/g) || []).length === 1, 'l’écran Paramètres reste monté (`tab===\'settings\'`)');
  const menu = fs.existsSync(path.join(RACINE, 'src/profil/MenuProfil.jsx')) ? fs.readFileSync(path.join(RACINE, 'src/profil/MenuProfil.jsx'), 'utf8') : '';
  dit(/data-profil-menu=\{id\}/.test(menu) && /ligne\('parametres','gear','Paramètres',onParametres\)/.test(menu) && /ligne\('appareils'/.test(menu) && /ligne\('deconnexion'/.test(menu), 'le menu du profil porte Paramètres, Appareils connectés, Se déconnecter');
  dit(/<MenuProfilCoque setTab=\{setTab\}/.test(app) && /data-nav-compte-ouvre="profil"/.test(app) && /<BoutonProfilTete\/>/.test(app), 'la carte de la colonne et la photo de l’en-tête du téléphone ouvrent le menu');
  dit(/onParametres=\{\(\) => aller\(''\)\}/.test(app) && /setTab\('settings'\)/.test(app), '« Paramètres » du menu ouvre l’écran');
  const racc = fs.readFileSync(path.join(RACINE, 'src/raccourcisClavier.js'), 'utf8');
  dit(/touche: 'p', tab: 'settings'/.test(racc), '« g p » ouvre toujours Paramètres');
  dit(/oauthStart\(p, intention\|\|\(mode==='up'\?'inscription':'connexion'\)\)/.test(app) && /oauth\(p,'inscription'\)/.test(app), 'connexion ⇒ intention « connexion » ; « Créer un nouveau compte avec … » ⇒ « inscription »');
  dit(/intention\?\.intention==='connexion'&&intention\.fournisseur===nouveauOAuth/.test(app) && /AUTH_REDIRECT\?\.sansCompte\)return <PorteSansCompte/.test(app), 'au retour : seul un compte neuf venu du bouton de CONNEXION part à l’annulation');

  console.log(`\n${ok} vert(s), ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
