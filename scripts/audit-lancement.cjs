// ⚠️⚠️ OUVRIR VRM À D'AUTRES REVENDEURS — CE QU'UNE NOUVELLE PERSONNE RENCONTRE EN PREMIER
//
// Mesuré le 5 octobre, avant d'ouvrir l'app à d'autres revendeurs :
//  (a) les emails de compte (confirmation, mot de passe oublié, lien de
//      connexion, changement d'adresse) partaient SANS `redirect_to` : Supabase
//      renvoyait vers son « Site URL », resté sur `http://localhost:3000` (vu
//      dans ses journaux : une vraie inscription, le 5 octobre, renvoyée là) ;
//      et l'écran d'inscription disait à TOUT inscrit « Décoche Confirm email
//      (Authentication → Providers → Email) » — un réglage du tableau de bord
//      Supabase auquel un revendeur n'a, et ne doit avoir, aucun accès ;
//  (b) le paiement Stripe ne faisait pas accepter les CGV — des conditions
//      jamais acceptées ne sont pas opposables ;
//  (d) aucun moyen de contacter VRM, ni sur la page d'accueil, ni dans l'app.
// Ce contrôle EXÉCUTE le vrai code (§4.10) :
//   · les fonctions d'authentification d'App.jsx, extraites par Babel, dans un
//     `vm` avec un faux `fetch` : chaque email de compte porte `redirect_to` ;
//   · le texte RENDU par l'écran de connexion (nœuds JSX et chaînes, jamais les
//     commentaires) ne donne aucune consigne Supabase ;
//   · le vrai api/compte.js avec un faux Stripe : la case CGV est OBLIGATOIRE,
//     son lien mène à nos CGV, et un refus de Stripe faute d'adresse des CGV
//     est dit (jamais contourné en retirant la case) ;
//   · l'adresse de contact a UNE valeur (src/contact.js = public/legal/editeur.js),
//     et le vrai editeur.js, exécuté, écrit « à compléter » pour ce qui manque —
//     jamais « null », jamais une valeur inventée.
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return null; } };
let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ analyseur Babel introuvable — ' + e.message); process.exit(1); }
const app = lire('src/App.jsx') || '';
const ast = parser.parse(app, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });

(async () => {
  console.log('── (a) Les emails de compte ramènent sur l’app');
  await essaie('redirect_to', async () => {
    const noms = ['retourEmail', 'avecRetour', 'authCall', 'MAIL_QUOTA', 'mapMailError', 'authResendConfirm', 'authMagicLink', 'authSignUp', 'authReset', 'authSetEmail'];
    const appels = [];
    const ctx = vm.createContext({
      SUPABASE_URL: 'https://base.test', SUPABASE_KEY: 'cle-publique', AUTH: { session: { access_token: 'a.b.c' } },
      writeSession: () => {}, sessionFrom: (x) => x, encodeURIComponent, JSON, String, Promise,
      window: { location: { origin: 'https://vrm.center', pathname: '/' } },
      fetch: async (url, o) => { appels.push({ url: String(url), methode: (o && o.method) || 'GET' }); return { ok: true, status: 200, json: async () => ({}) }; },
    });
    for (const n of ast.program.body) {
      if (n.type !== 'VariableDeclaration') continue;
      for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) {
        try { vm.runInContext('var ' + app.slice(d.start, d.end) + ';', ctx); } catch (_) {}
      }
    }
    const cas = [['authSignUp', ['x@exemple.test', 'motdepasse1'], '/auth/v1/signup'], ['authReset', ['x@exemple.test'], '/auth/v1/recover'],
      ['authMagicLink', ['x@exemple.test'], '/auth/v1/otp'], ['authResendConfirm', ['x@exemple.test'], '/auth/v1/resend'], ['authSetEmail', ['y@exemple.test'], '/auth/v1/user']];
    for (const [f, args, chemin] of cas) {
      appels.length = 0;
      if (typeof ctx[f] !== 'function') { dit(false, `${f} existe`); continue; }
      await ctx[f](...args);
      const a = appels.find((x) => x.url.includes(chemin));
      dit(!!a && /[?&]redirect_to=https%3A%2F%2Fvrm\.center(&|$)/.test(a.url), `${f} : le lien de l’email ramène sur l’app (redirect_to = l’adresse ouverte)`, a ? a.url.replace('https://base.test', '') : 'aucun appel');
    }
    // L'autre sens : la connexion par mot de passe n'envoie aucun email — rien à ajouter.
    dit(!/authCall\(avecRetour\('token/.test(app), 'la connexion par mot de passe n’en a pas besoin (aucun email ne part)');
  });
  await essaie('écran de connexion', async () => {
    let fn = null;
    for (const n of ast.program.body) if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'AuthScreen') fn = n;
    dit(!!fn, 'l’écran de connexion se retrouve (AuthScreen)');
    const textes = [];
    const visite = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(visite); return; }
      if (n.type === 'JSXText' || n.type === 'StringLiteral') textes.push(String(n.value));
      if (n.type === 'TemplateElement') textes.push(String(n.value && n.value.cooked));
      for (const k of Object.keys(n)) { if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue; const v = n[k]; if (v && typeof v === 'object') visite(v); }
    };
    visite(fn);
    const fautifs = textes.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => /Supabase|Authentication\s*→|Providers\s*→|D[ée]coche|Confirm email/i.test(t));
    dit(textes.length > 20 && fautifs.length === 0, 'aucun texte de l’écran de connexion n’envoie un inscrit régler Supabase', fautifs.slice(0, 2).join(' · '));
    const adresseTest = textes.some((t) => /adresse de test/i.test(t));
    dit(!adresseTest, 'plus de « c’est normal : il renvoie vers une adresse de test » (faux dès que Supabase est réglé)');
  });

  console.log('\n── (b) Payer, c’est accepter les CGV');
  await essaie('checkout CGV', async () => {
    const appelsStripe = []; let refusCgv = false;
    const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
    global.fetch = async (url, o = {}) => {
      const u = String(url), h = o.headers || {};
      if (u.includes('/auth/v1/user')) return /aa\.bb\.A/.test(h.Authorization || '') ? rep({ id: '11111111-1111-4111-8111-111111111111', email: 'a@exemple.test' }) : rep({}, 401);
      if (u.includes('/rest/v1/rpc/vrm_acces')) return rep({ obligatoire: false, proprietaire: false, acces: true });
      if (u.includes('/rest/v1/abonnements')) return rep([]);
      if (u.startsWith('https://api.stripe.com/v1/')) {
        const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
        appelsStripe.push({ chemin, corps: decodeURIComponent(String(o.body || '')) });
        if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 999, currency: 'eur', recurring: { interval: 'month' } }] });
        if (chemin === 'checkout/sessions') return refusCgv
          ? rep({ error: { message: 'You cannot collect consent to your terms of service unless a URL is set in the Stripe Dashboard.' } }, 400)
          : rep({ id: 'cs_banc', url: 'https://checkout.stripe.com/c/pay/cs_banc' });
      }
      return rep({}, 404);
    };
    process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
    const compte = (await import('file://' + path.join(R, 'api', 'compte.js'))).default;
    const faire = async () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (x) => { r.corps = x; return r; }; r.setHeader = () => {}; await compte({ method: 'POST', query: { mode: 'checkout' }, headers: { authorization: 'Bearer aa.bb.A' }, async *[Symbol.asyncIterator]() {} }, r); return r; };
    const r1 = await faire();
    const s = appelsStripe.find((x) => x.chemin === 'checkout/sessions');
    const corps = (s && s.corps) || '';
    dit(r1.code === 200 && /consent_collection\[terms_of_service\]=required/.test(corps), 'la session de paiement exige la case « j’accepte les CGV » (required)', `HTTP ${r1.code}`);
    dit(/custom_text\[terms_of_service_acceptance\]\[message\]=[^&]*https:\/\/vrm\.center\/legal\/cgv\.html/.test(corps), '… et son lien mène à NOS CGV (vrm.center/legal/cgv.html)');
    dit(fs.existsSync(path.join(R, 'public', 'legal', 'cgv.html')), '… qui existent bien');
    refusCgv = true; appelsStripe.length = 0;
    const r2 = await faire();
    const re = appelsStripe.filter((x) => x.chemin === 'checkout/sessions');
    dit(r2.code === 503 && r2.corps && r2.corps.erreur === 'cgv-stripe' && !r2.corps.url && re.length === 1 && /required/.test(re[0].corps),
      'Stripe refuse faute d’adresse des CGV : on le DIT (503), sans réessayer en retirant la case', `HTTP ${r2.code} · ${r2.corps && r2.corps.erreur}`);
  });

  console.log('\n── (d) Une adresse de contact, une seule valeur, jamais inventée');
  await essaie('contact', async () => {
    const c = lire('src/contact.js');
    dit(c != null, 'src/contact.js existe (la source unique de l’app)');
    const constante = c ? ((/CONTACT_EMAIL\s*=\s*'([^']*)'/.exec(c) || [])[1]) : undefined;
    dit(constante !== undefined, 'CONTACT_EMAIL est une chaîne écrite en clair (vide tant qu’il n’y en a pas)');
    const ed = lire('public/legal/editeur.js') || '';
    const m = /\bemail:\s*(null|'([^']*)'|"([^"]*)")/.exec(ed);
    const valEd = m ? (m[1] === 'null' ? '' : (m[2] || m[3] || '')) : undefined;
    dit(valEd !== undefined && String(constante || '').trim() === String(valEd || '').trim(), 'la même adresse dans l’app (src/contact.js) et sur les pages légales (editeur.js)', `app « ${constante} » · pages « ${valEd} »`);
    const acc = lire('src/Accueil.jsx') || '';
    dit(/from '\.\/contact\.js'/.test(acc) && /contactEmail\(\)/.test(acc), 'la page d’accueil lit l’adresse dans src/contact.js');
    dit(/from "\.\/contact\.js"/.test(app) && /contactEmail\(\)/.test(app), 'Réglages → Mon compte la lit au même endroit');
    const enDur = [...acc.matchAll(/mailto:([^`'"${}\s]+@[^`'"${}\s]+)/g)].map((x) => x[1]);
    dit(enDur.length === 0, 'aucune adresse écrite en dur dans la page d’accueil', enDur.join(', '));
  });
  await essaie('pages légales', async () => {
    const src = lire('public/legal/editeur.js');
    const cles = ['nom', 'forme', 'adresse', 'siret', 'rcs', 'tva', 'email', 'telephone', 'directeur', 'mediateur'];
    const executer = (remplace) => {
      const els = cles.map((k) => ({ k, textContent: '', className: '', innerHTML: '', enfants: [], getAttribute: (a) => (a === 'data-e' ? k : null), appendChild(x) { this.enfants.push(x); } }));
      const ctx = vm.createContext({ window: {}, document: { querySelectorAll: () => els, createElement: (t) => ({ tag: t, href: '', textContent: '' }) } });
      vm.runInContext(remplace ? remplace(src) : src, ctx);
      return els;
    };
    const els = executer();
    const mauvais = els.filter((e) => !(e.className === 'todo' && /^à compléter : /.test(e.textContent)) || /null|undefined/.test(e.textContent));
    dit(mauvais.length === 0, `editeur.js exécuté : les ${els.length} champs vides s’affichent « à compléter … », surlignés — jamais « null », jamais inventés`, mauvais.map((e) => `${e.k}=${e.textContent}`).join(', '));
    const rempli = executer((s) => s.replace(/\bemail:\s*null/, "email: 'contact@exemple.test'"));
    const e = rempli.find((x) => x.k === 'email');
    dit(e && e.enfants[0] && e.enfants[0].href === 'mailto:contact@exemple.test' && e.className !== 'todo', '… et le jour où l’adresse est posée, elle devient un lien mailto');
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
