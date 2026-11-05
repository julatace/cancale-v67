#!/usr/bin/env node
// Audit du 5 nov. — le relais `/api/vinted-proxy` tient la réserve du COMPTE
// Vinted côté serveur, tous appareils confondus (le frein de l'app est compté
// par appareil). EXÉCUTE la vraie route avec une fausse base qui sert la vraie
// forme (projection `select=rev:data->>rev,t:data->t`, filtres `id=eq.`,
// `owner=eq.`, garde `data->>rev=eq.`/`is.null`, POST 201/409, PATCH qui rend
// les lignes touchées). On compte les requêtes parties vers vinted.fr.
// Données inventées (le dépôt est public).
// Mutations : `--muter=sans-frein` (la route ne demande plus de place) et
// `--muter=sans-garde` (l'écriture ne compare plus `rev`) doivent finir en rouge.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const R = path.join(__dirname, '..');
const MUTER = (process.argv.find((a) => a.startsWith('--muter=')) || '').slice(8);
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };

const VENDEUR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUTRE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rep = (corps, status = 200) => new Response(corps == null ? null : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const attente = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4)));

let lignes, vinted, panne;
const reinit = () => { lignes = new Map(); vinted = 0; panne = { lire: false, ecrire: false }; };
const qui = (o) => { const j = String((o.headers || {}).Authorization || '').replace(/^Bearer /, ''); return j === 'x.y.vendeur' ? VENDEUR : j === 'x.y.autre' ? AUTRE : null; };

global.fetch = async (url, o = {}) => {
  await attente();
  const u = new URL(String(url)), q = u.searchParams, m = (o.method || 'GET').toUpperCase();
  if (/vinted\.(fr|com)$/.test(u.hostname)) { vinted++; return new Response('{"ok":true}', { status: 200 }); }
  if (u.pathname.endsWith('/auth/v1/user')) { const id = qui(o); return id ? rep({ id, email: 'banc@exemple.test' }) : rep({ msg: 'jwt' }, 401); }
  const moi = qui(o);
  if (u.pathname.endsWith('/rest/v1/vinted_accounts')) {
    const uid = (q.get('vinted_user_id') || '').replace(/^eq\./, '');
    return rep(moi && ['111', '222'].includes(uid) ? [{ owner: moi, access_token: 'jeton', refresh_token: 'r', anon_id: 'a', csrf_token: 'c', domain: 'www.vinted.fr' }] : []);
  }
  if (u.pathname.endsWith('/rest/v1/app_data')) {
    if (!moi) return rep({ message: 'jwt' }, 401);
    if (m === 'POST') {
      if (panne.ecrire) return rep({ message: 'panne' }, 503);
      const l = JSON.parse(o.body);
      if (l.owner !== moi) return rep({ message: 'rls' }, 403);
      const k = moi + '|' + l.id;
      if (lignes.has(k)) return rep({ code: '23505' }, 409);
      lignes.set(k, JSON.parse(JSON.stringify(l.data)));
      return rep(null, 201);
    }
    const id = (q.get('id') || '').replace(/^eq\./, ''), owner = (q.get('owner') || '').replace(/^eq\./, '');
    if (owner !== moi) return rep([]);
    const k = moi + '|' + id;
    if (m === 'GET') {
      if (panne.lire) return rep({ message: 'panne' }, 522);
      if (q.get('select') !== 'rev:data->>rev,t:data->t') return rep({ message: 'select=data interdit ici' }, 400);
      const d = lignes.get(k);
      return rep(d ? [{ rev: d.rev == null ? null : String(d.rev), t: d.t }] : []);
    }
    if (m === 'PATCH') {
      if (panne.ecrire) return rep({ message: 'panne' }, 503);
      const d = lignes.get(k);
      const g = q.get('data->>rev');
      if (!d) return rep([]);
      if (g != null) {
        const attendu = g === 'is.null' ? null : g.replace(/^eq\./, '');
        if ((d.rev == null ? null : String(d.rev)) !== attendu) return rep([]);
      }
      lignes.set(k, JSON.parse(o.body).data);
      return rep([{ id }]);
    }
  }
  return rep({ message: 'route inconnue du banc : ' + u.pathname }, 404);
};

const faireRes = () => { const r = { code: 0, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.corps = b; return r; } }; return r; };

(async () => {
  // L'arbre à exécuter : le vrai, ou une copie mutée.
  let racine = R;
  if (MUTER) {
    racine = fs.mkdtempSync(path.join(os.tmpdir(), 'frein-serveur-'));
    for (const f of ['api/vinted-proxy.js', 'api/_lib/frein-relais-serveur.js', 'api/_lib/session.js', 'api/_lib/sans-bruit.js', 'src/freinRelaisVinted.js']) {
      fs.mkdirSync(path.dirname(path.join(racine, f)), { recursive: true });
      let t = fs.readFileSync(path.join(R, f), 'utf8');
      if (MUTER === 'sans-frein' && f === 'api/vinted-proxy.js') t = t.replace('const place = await prendrePlaceServeur(', 'const place = { ok: true } || await prendrePlaceServeur(');
      if (MUTER === 'sans-garde' && f === 'api/_lib/frein-relais-serveur.js') t = t.replace('`app_data?${filtre}&${garde}&select=id`', '`app_data?${filtre}&select=id`');
      fs.writeFileSync(path.join(racine, f), t);
    }
    fs.writeFileSync(path.join(racine, 'package.json'), '{"type":"module"}');
  }
  const route = (await import('file://' + path.join(racine, 'api', 'vinted-proxy.js'))).default;
  const appel = async (uid, jeton = 'x.y.vendeur') => { const r = faireRes(); await route({ method: 'POST', headers: { authorization: 'Bearer ' + jeton }, body: { uid, endpoint: '/api/v2/inbox?page=1' } }, r); return r; };

  console.log('1. Trois appareils, 10 appuis chacun sur le même compte');
  {
    reinit();
    const r = [];
    for (let i = 0; i < 10; i++) for (let a = 0; a < 3; a++) r.push(await appel('111'));
    dit(vinted === 24, `au plus 24 requêtes vers Vinted pour le compte, tous appareils (${vinted})`);
    const derniere = r[r.length - 1];
    dit(derniere.code === 429 && derniere.corps && derniere.corps.erreur === 'frein', 'au-delà : 429 « frein », rien ne part', JSON.stringify(derniere.corps));
  }

  console.log('2. Cinq appuis en même temps quand il reste UNE place');
  {
    reinit();
    for (let i = 0; i < 23; i++) await appel('111');
    vinted = 0;
    await Promise.all(Array.from({ length: 5 }, () => appel('111')));
    dit(vinted === 1, `une seule requête prend la dernière place (${vinted})`);
  }

  console.log('3. Un autre compte a sa propre réserve ; un autre vendeur ne lit pas la vôtre');
  {
    reinit();
    for (let i = 0; i < 30; i++) await appel('111');
    vinted = 0;
    const r = await appel('222');
    dit(r.code === 200 && vinted === 1, 'le compte 222 passe encore');
    const r2 = await appel('111', 'x.y.autre');
    dit(r2.code === 200, 'la réserve du vendeur ne bloque pas un autre vendeur (sa propre ligne)');
  }

  console.log('4. « Pas su » ne vaut pas « oui »');
  {
    reinit(); panne.lire = true;
    const r = await appel('111');
    dit(r.code === 503 && vinted === 0, `réserve illisible ⇒ 503, rien vers Vinted (${r.code}, ${vinted})`);
    reinit(); panne.ecrire = true;
    const r2 = await appel('111');
    dit(r2.code === 503 && vinted === 0, `réserve pas écrite ⇒ 503, rien vers Vinted (${r2.code}, ${vinted})`);
  }

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
