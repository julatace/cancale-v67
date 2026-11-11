#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « PARTAGER UNE FICHE » (11 nov., lot partage-fiche) — EXÉCUTE la vraie
//  route `api/compte.js` (§4.10) contre une base simulée qui sert la VRAIE forme
//  (projections `select=a:data->b->>c`, `owner=eq.`, `id=eq.`/`like.`, upsert
//  `on_conflict`, DELETE, `rpc/vrm_acces_pour`, `auth/v1/user`).
//   A. créer : jeton imprévisible (43 car.), SA ligne, index par EMPREINTE ;
//   B. la page : HTML sans script, Open Graph, rien de privé (prix d'achat, N°,
//      compte, description, adresse, pseudo non voulu), échappée, en-têtes ;
//   C. pas d'énumération : inconnu / mal formé / arrêté / expiré / abonnement
//      arrêté ⇒ la MÊME réponse ; panne ⇒ 503 (jamais « plus actif ») ;
//   D. vendu (preuve) ⇒ « Vendu », ni prix ni lien ; périmé ⇒ « À confirmer » ;
//   E. la synchro PURE (`decisionsSynchro`) : jamais vendu par absence ;
//   F. la page ne lit que ce qui est partagé (jamais `ident`, jamais `select=data`).
//  `--prouve` : rejoue l'audit sur des copies MUTÉES et exige le ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-banc';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C3 = '33333333-3333-4333-8333-333333333333';

function base() {
  const rows = [], ecrits = [], lus = [];
  const pannes = new Set();   // 'index' · 'ligne' · 'ecriture-index'
  const get = (o, id) => rows.find((r) => r.owner === o && r.id === id);
  const chemin = (data, p) => {
    const m = /^data((?:->>?[A-Za-z0-9_"%-]+)*)$/.exec(p); if (!m) return undefined;
    let v = data; const pas = m[1].match(/->>?[^-]+/g) || [];
    for (const s of pas) { const k = decodeURIComponent(s.replace(/^->>?/, '')).replace(/^"|"$/g, ''); v = v && typeof v === 'object' ? v[k] : undefined; if (s.startsWith('->>') && v != null && typeof v === 'object') v = JSON.stringify(v); if (s.startsWith('->>') && v != null && typeof v !== 'object') v = String(v); }
    return v === undefined ? null : v;
  };
  const projeter = (r, sel) => {
    if (!sel) return r;
    const o = {};
    for (const it of sel.split(',')) {
      const [al, p] = it.includes(':') ? it.split(':') : [it, it];
      if (p === 'data') o[al] = r.data; else if (p === 'owner' || p === 'id') o[al] = r[p]; else o[al] = chemin(r.data, p);
    }
    return o;
  };
  const filtrer = (u) => {
    const f = [];
    for (const [k, v] of u.searchParams) {
      if (['select', 'limit', 'on_conflict', 'order'].includes(k)) continue;
      let m = /^eq\.(.*)$/.exec(v);
      if (m) { const val = m[1]; f.push((r) => String(k === 'owner' || k === 'id' ? r[k] : chemin(r.data, k)) === val); continue; }
      m = /^like\.(.*)$/.exec(v);
      if (m) { const re = new RegExp('^' + m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); f.push((r) => re.test(String(r[k]))); }
    }
    return rows.filter((r) => f.every((g) => g(r)));
  };
  const rep = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps, text: async () => JSON.stringify(corps) });
  const sansAcces = new Set();
  async function fetch(url, init = {}) {
    const u = new URL(String(url)); const meth = (init.method || 'GET').toUpperCase();
    const corps = init.body ? JSON.parse(init.body) : null;
    if (u.pathname === '/auth/v1/user') {
      const t = String((init.headers || {}).Authorization || '').replace(/^Bearer /, '');
      const id = t === 'jwt.a.x' ? A : t === 'jwt.b.x' ? B : t === 'jwt.c.x' ? C3 : null;
      return id ? rep(200, { id, email: 'banc@example.invalid' }) : rep(401, {});
    }
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(200, !sansAcces.has(corps && corps.u));
    if (u.pathname.startsWith('/rest/v1/rpc/')) return rep(404, {});
    if (u.pathname !== '/rest/v1/app_data') return rep(404, {});
    const id = u.searchParams.get('id') || '';
    if (meth === 'GET') {
      lus.push(String(url));
      if (pannes.has('index') && /^eq\.jeton_partage_/.test(id)) return rep(522, '<html>');
      if (pannes.has('ligne') && /^eq\.vrm_partage_/.test(id)) return rep(500, { message: 'panne' });
      return rep(200, filtrer(u).map((r) => projeter(r, u.searchParams.get('select'))));
    }
    ecrits.push({ meth, url: String(url), corps });
    if (meth === 'POST') {
      if (pannes.has('ecriture-index') && corps.some((l) => /^jeton_partage_/.test(l.id))) return rep(503, {});
      const upsert = /merge-duplicates/.test(String((init.headers || {}).Prefer || ''));
      for (const l of corps) {
        const ex = get(l.owner, l.id);
        if (ex && !upsert) return rep(409, { code: '23505' });
        if (ex) ex.data = l.data; else rows.push({ owner: l.owner, id: l.id, data: l.data });
      }
      return rep(201, null);
    }
    if (meth === 'DELETE') { for (const r of filtrer(u)) rows.splice(rows.indexOf(r), 1); return rep(204, null); }
    return rep(405, {});
  }
  return { rows, ecrits, lus, pannes, sansAcces, fetch, get };
}

function appeler(handler, { method = 'GET', query = {}, jwt = null, body = undefined }) {
  return new Promise((ok) => {
    const res = { statusCode: 200, headers: {}, corps: undefined,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; },
      status(c) { this.statusCode = c; return this; }, json(o) { this.corps = o; ok(this); return this; },
      end(t) { this.corps = t; ok(this); return this; }, send(t) { this.corps = t; ok(this); return this; } };
    const req = { method, query, headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body, url: '/api/compte' };
    Promise.resolve(handler(req, res)).catch((e) => { res.statusCode = 599; res.corps = String(e && e.stack); ok(res); });
  });
}

// Le texte VISIBLE d'une page (balises et styles retirés), pour juger ce qui est montré.
const visible = (html) => String(html || '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function audit(racine, bavard) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (bavard) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };
  const db = base();
  globalThis.fetch = db.fetch;
  let handler, regle;
  try { handler = (await import(pathToFileURL(path.join(racine, 'api/compte.js')).href + '?t=' + Date.now())).default; }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); return ko; }
  try { regle = await import(pathToFileURL(path.join(racine, 'src/partageFiche.js')).href + '?t=' + Date.now()); }
  catch (e) { dit(false, 'src/partageFiche.js se charge', e.message); return ko; }

  const FICHE = {
    titre: 'Nike Air Max 90 <script>alert(1)</script>', marque: 'Nike', taille: '42', etat: 'Très bon état', prix: 65, devise: 'EUR',
    photos: ['https://images1.vinted.net/t/01_abc/f800/1.jpeg?s=x', 'https://images1.vinted.net/t/01_abc/f800/2.jpeg', 'https://pistage.example.com/pixel.gif', 'javascript:alert(1)', 'http://images1.vinted.net/t/3.jpeg'],
    liens: [{ site: 'vinted', url: 'https://www.vinted.fr/items/4242424242-nike-air-max?referrer=catalog' }, { site: 'ebay', url: 'https://www.ebay.fr/itm/1234567890' }, { site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/chaussures/2777777777' }, { site: 'vinted', url: 'https://evil.example.com/items/1' }, { site: 'leboncoin', url: 'javascript:alert(1)' }, { site: 'vestiaire', url: 'https://fr.vestiairecollective.com/' }],
    pseudo: '',
    // Ce qui ne doit JAMAIS arriver sur la page, même envoyé par le navigateur :
    buyPrice: 31.5, numero: 'B125', num: '125', description: 'N°125 carton du haut', adresse: '12 rue des Lilas', owner: A, compte: 'shop_julien',
  };
  const IDENT = { itemId: '4242424242', compte: '987654', num: '125', adresse: 'non' };

  // ════ A. CRÉER ═══════════════════════════════════════════════════════════
  dit((await appeler(handler, { query: { mode: 'partage' } })).statusCode === 401, 'A1 ses liens exigent SA session (401 sans)');
  const c1 = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: FICHE, ident: IDENT, duree: 7 } });
  const url1 = (c1.corps && c1.corps.partage && c1.corps.partage.url) || '';
  const j1 = (/^https:\/\/vrm\.center\/p\/([A-Za-z0-9_-]{43})$/.exec(url1) || [])[1] || '';
  dit(c1.statusCode === 200 && !!j1, 'A2 « creer » rend https://vrm.center/p/<jeton de 43 car.>', JSON.stringify(c1.corps));
  const ligne1 = c1.corps && c1.corps.partage && c1.corps.partage.ligne;
  const r1 = db.get(A, ligne1);
  dit(!!r1 && r1.data.jeton === j1, 'A3 le jeton est rangé dans SA ligne `vrm_partage_…`');
  dit(db.rows.some((r) => r.owner === NEUTRE && /^jeton_partage_[0-9a-f]{64}$/.test(r.id) && r.data.owner === A && r.data.ligne === ligne1) && !db.rows.some((r) => r.owner === NEUTRE && (r.id.includes(j1) || JSON.stringify(r.data).includes(j1))), 'A4 indexé par EMPREINTE chez le neutre (jamais le jeton en clair)');
  const exp = r1 ? Date.parse(r1.data.expire) - Date.parse(r1.data.cree) : 0;
  dit(Math.round(exp / 86400000) === 7, 'A5 expiration à 7 jours', exp);
  const stocke = r1 ? JSON.stringify(r1.data.fiche) : '';
  dit(r1 && Object.keys(r1.data.fiche).every((k) => ['titre', 'marque', 'taille', 'etat', 'prix', 'photos', 'liens', 'pseudo'].includes(k)) && !/31\.5|B125|carton|Lilas|shop_julien|pistage|javascript|evil|referrer|11111111/.test(stocke), 'A6 la fiche RANGÉE est nettoyée par le serveur (aucun champ privé, aucun hôte inconnu)', stocke);
  dit(r1 && r1.data.ident && r1.data.ident.itemId === '4242424242' && r1.data.ident.num === '125' && !('adresse' in r1.data.ident), 'A7 l’identité privée garde annonce + N° seulement');
  const c2 = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: { titre: 'Autre', photos: [] }, duree: 99 } });
  const j2 = (/\/p\/([A-Za-z0-9_-]{43})$/.exec((c2.corps && c2.corps.partage && c2.corps.partage.url) || '') || [])[1] || '';
  const r2 = db.get(A, c2.corps && c2.corps.partage && c2.corps.partage.ligne);
  dit(j2 && j2 !== j1 && r2 && Math.round((Date.parse(r2.data.expire) - Date.parse(r2.data.cree)) / 86400000) === 7, 'A8 deux liens, deux jetons ; une durée inconnue ⇒ 7 jours');
  const c30 = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: { titre: 'Trente' }, duree: 30 } });
  const r30 = db.get(A, c30.corps && c30.corps.partage && c30.corps.partage.ligne);
  dit(r30 && Math.round((Date.parse(r30.data.expire) - Date.parse(r30.data.cree)) / 86400000) === 30, 'A9 « 30 jours » choisi ⇒ 30 jours');
  const vide = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: { photos: ['https://pistage.example.com/x.jpg'] } } });
  dit(vide.statusCode === 400, 'A10 une fiche sans titre ni photo montrable ⇒ refusée (400)');

  // ════ B. LA PAGE ═════════════════════════════════════════════════════════
  db.lus.length = 0;
  const pg = await appeler(handler, { query: { mode: 'partage', p: j1 } });
  const html = String(pg.corps || ''), vis = visible(html);
  dit(pg.statusCode === 200 && /^text\/html/.test(pg.headers['content-type'] || ''), 'B1 le jeton seul sert une page HTML (200)', pg.statusCode);
  dit(!/<script/i.test(html.replace(/&lt;script&gt;/g, '')) && /&lt;script&gt;alert\(1\)&lt;\/script&gt;/.test(html), 'B2 aucun script ; le titre est ÉCHAPPÉ');
  dit(/<meta property="og:title" content="Nike Air Max 90 &lt;script&gt;alert\(1\)&lt;\/script&gt; · 65\s€">/.test(html) && /<meta property="og:image" content="https:\/\/images1\.vinted\.net\/t\/01_abc\/f800\/1\.jpeg\?s=x">/.test(html) && /og:description" content="Taille 42 · Très bon état"/.test(html) && /twitter:card" content="summary_large_image"/.test(html), 'B3 Open Graph : titre · prix, 1re photo, taille · état (aperçu iMessage/WhatsApp)', html.slice(0, 900));
  dit(/Taille 42/.test(vis) && /Très bon état/.test(vis) && /65\s€/.test(vis) && (html.match(/<img /g) || []).length === 2, 'B4 la page montre photos (2 connues), taille, état, prix');
  dit(/data-site="vinted"[^>]*>Voir sur Vinted/.test(html) && /https:\/\/www\.vinted\.fr\/items\/4242424242-nike-air-max"/.test(html) && /data-site="ebay"/.test(html) && /data-site="leboncoin"/.test(html) && !/vestiairecollective|referrer=|evil|javascript/i.test(html), 'B5 liens : l’annonce elle-même (Vinted, Leboncoin, eBay), sans paramètre ; jamais une page inconnue');
  dit(!/31[,.]5|B125|125|carton|Lilas|shop_julien|987654|11111111|banc@|Vendu par/.test(vis + html.replace(/4242424242/g, '')), 'B6 rien de privé : ni prix d’achat, ni N°, ni compte, ni description, ni adresse, ni pseudo non voulu');
  const csp = String(pg.headers['content-security-policy'] || '');
  dit(/default-src 'none'/.test(csp) && !/script-src/.test(csp) && /frame-ancestors 'none'/.test(csp), 'B7 CSP : rien par défaut, aucun script', csp);
  dit(pg.headers['referrer-policy'] === 'no-referrer' && /noindex/.test(pg.headers['x-robots-tag'] || '') && /no-store/.test(pg.headers['cache-control'] || '') && /name="robots" content="noindex/.test(html), 'B8 no-referrer (le jeton ne part pas au clic), noindex, no-store');
  dit(/Infos vérifiées le \d{1,2} [a-zéû.]+ à \d{1,2} h \d{2}/.test(vis) && !/À confirmer/.test(vis), 'B9 la page est DATÉE (« Infos vérifiées le … »)', vis);
  dit(Buffer.byteLength(html) < 12000, 'B10 page légère (< 12 Ko)', Buffer.byteLength(html));
  // F. ce que la page a lu
  dit(db.lus.length === 2 && db.lus.every((u) => /select=/.test(u) && !/select=data(&|$)/.test(decodeURIComponent(u)) && !/ident/.test(decodeURIComponent(u))) && db.lus.every((u) => /id=eq\./.test(u)), 'F1 la page lit 2 lignes par leur clé, PROJETÉES, jamais `ident` ni `select=data`', db.lus.map(decodeURIComponent).join(' | '));
  const pseudoFiche = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: { titre: 'Avec pseudo', pseudo: 'julien_shop' } } });
  const jp = (/\/p\/([A-Za-z0-9_-]{43})$/.exec((pseudoFiche.corps && pseudoFiche.corps.partage && pseudoFiche.corps.partage.url) || '') || [])[1];
  dit(/Vendu par julien_shop/.test(visible((await appeler(handler, { query: { mode: 'partage', p: jp } })).corps)), 'B11 le pseudo VOULU est montré');

  // ════ C. PAS D'ÉNUMÉRATION ═══════════════════════════════════════════════
  const inconnu = await appeler(handler, { query: { mode: 'partage', p: 'A'.repeat(43) } });
  const malForme = await appeler(handler, { query: { mode: 'partage', p: '../../etc' } });
  dit(inconnu.statusCode === 404 && malForme.statusCode === 404 && inconnu.corps === malForme.corps && /plus actif/.test(inconnu.corps), 'C1 inconnu ou mal formé ⇒ 404, la même page');
  // Un index qui désigne une ligne dont le jeton diffère (index périmé) : refusé.
  const idxCle = db.rows.find((r) => r.owner === NEUTRE && r.data.ligne === ligne1);
  const faux = 'B'.repeat(43);
  const crypto = require('crypto');
  db.rows.push({ owner: NEUTRE, id: 'jeton_partage_' + crypto.createHash('sha256').update(faux).digest('hex'), data: { owner: A, genre: 'partage', ligne: ligne1 } });
  dit((await appeler(handler, { query: { mode: 'partage', p: faux } })).corps === inconnu.corps, 'C2 l’index ne fait pas foi seul : le jeton est RE-COMPARÉ à la ligne');
  db.pannes.add('index');
  const panne = await appeler(handler, { query: { mode: 'partage', p: j1 } });
  dit(panne.statusCode === 503 && !/plus actif/.test(panne.corps) && /Réessaie/.test(panne.corps), 'C3 index illisible ⇒ 503 « Réessaie », jamais « plus actif »');
  db.pannes.delete('index'); db.pannes.add('ligne');
  dit((await appeler(handler, { query: { mode: 'partage', p: j1 } })).statusCode === 503, 'C4 ligne illisible ⇒ 503');
  db.pannes.delete('ligne');
  db.sansAcces.add(A);
  await new Promise((r) => setTimeout(r, 5));
  // accesVendeur garde une minute de mémoire : un vendeur NEUF (C3) prouve la règle.
  db.sansAcces.delete(A);
  const cC = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.c.x', body: { action: 'creer', fiche: { titre: 'Vendeur C' } } });
  const jC = (/\/p\/([A-Za-z0-9_-]{43})$/.exec((cC.corps && cC.corps.partage && cC.corps.partage.url) || '') || [])[1];
  db.sansAcces.add(C3);
  const sa = await appeler(handler, { query: { mode: 'partage', p: jC } });
  dit(sa.statusCode === 404 && sa.corps === inconnu.corps, 'C5 abonnement arrêté ⇒ la même page 404', sa.statusCode);
  // Cloisonnement : B ne peut ni lister ni arrêter le lien de A.
  const lb = await appeler(handler, { query: { mode: 'partage' }, jwt: 'jwt.b.x' });
  dit(lb.statusCode === 200 && Array.isArray(lb.corps.partages) && lb.corps.partages.length === 0, 'C6 B ne voit aucun lien de A');
  await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.b.x', body: { action: 'arreter', ligne: ligne1 } });
  dit((await appeler(handler, { query: { mode: 'partage', p: j1 } })).statusCode === 200 && !!db.get(A, ligne1), 'C7 « arreter » par B ne touche pas le lien de A');

  // ════ D. VENDU, PÉRIMÉ, ARRÊTÉ, EXPIRÉ ═══════════════════════════════════
  const la = await appeler(handler, { query: { mode: 'partage' }, jwt: 'jwt.a.x' });
  const moi = la.corps && la.corps.partages && la.corps.partages.find((p) => p.ligne === ligne1);
  dit(moi && moi.url === url1 && moi.ident && moi.ident.itemId === '4242424242' && moi.titre.startsWith('Nike'), 'D1 SES liens : url, titre, identité (pour la synchro de l’app)');
  const vend = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'etat', maj: [{ ligne: ligne1, etat: 'vendu' }] } });
  const hv = String((await appeler(handler, { query: { mode: 'partage', p: j1 } })).corps || '');
  dit(vend.corps && vend.corps.faits === 1 && /data-partage-vendu/.test(hv) && /Vendu/.test(visible(hv)) && !/65\s€/.test(visible(hv)) && !/data-site=/.test(hv) && /og:title" content="Vendu · /.test(hv), 'D2 vendu (preuve de l’app) ⇒ « Vendu », ni prix ni lien', visible(hv));
  const act = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'actualiser', ligne: ligne1, fiche: { ...FICHE, prix: 59 } } });
  dit(act.statusCode === 200 && db.get(A, ligne1).data.vendu === true, 'D3 « actualiser » ne remet pas en vente un article prouvé vendu');
  await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'etat', maj: [{ ligne: ligne1, etat: 'dispo', prix: 55 }] } });
  const hd = visible((await appeler(handler, { query: { mode: 'partage', p: j1 } })).corps);
  dit(/55\s€/.test(hd) && !/\bVendu\b/.test(hd.replace(/Fiche partagée par le vendeur/, '')), 'D4 vente annulée, revenue en ligne ⇒ dispo, au prix RELU', hd);
  const rr = db.get(A, ligne1);
  rr.data.maj = new Date(Date.now() - 5 * 86400000).toISOString(); rr.data.verifie = rr.data.maj;
  const hp = visible((await appeler(handler, { query: { mode: 'partage', p: j1 } })).corps);
  dit(/Infos du \d{1,2} [a-zéû.]+ à \d{1,2} h \d{2}\. À confirmer avec le vendeur\./.test(hp) && !/vérifiées/.test(hp), 'D5 pas confirmé depuis 72 h ⇒ « Infos du … À confirmer avec le vendeur. »', hp);
  // Arrêter
  const ar = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'arreter', ligne: ligne1 } });
  const apres = await appeler(handler, { query: { mode: 'partage', p: j1 } });
  dit(ar.corps && ar.corps.arrete === true && apres.statusCode === 404 && apres.corps === inconnu.corps && !db.get(A, ligne1) && !db.rows.some((r) => r === idxCle), 'D6 « Arrêter le partage » : le lien meurt tout de suite (la même page), index et ligne retirés');
  // Expirer
  const l2 = c2.corps.partage.ligne;
  db.get(A, l2).data.expire = new Date(Date.now() - 1000).toISOString();
  const ex = await appeler(handler, { query: { mode: 'partage', p: j2 } });
  dit(ex.statusCode === 404 && ex.corps === inconnu.corps, 'D7 expiré ⇒ la même page 404');
  const la2 = await appeler(handler, { query: { mode: 'partage' }, jwt: 'jwt.a.x' });
  dit(!la2.corps.partages.some((p) => p.ligne === l2) && !db.get(A, l2), 'D8 un lien expiré sort de la liste (index et ligne retirés)');
  // Index raté à la création ⇒ rien de bancal
  db.pannes.add('ecriture-index');
  const n0 = db.rows.filter((r) => r.owner === A).length;
  const ci = await appeler(handler, { method: 'POST', query: { mode: 'partage' }, jwt: 'jwt.a.x', body: { action: 'creer', fiche: { titre: 'X' } } });
  dit(ci.statusCode === 503 && db.rows.filter((r) => r.owner === A).length === n0, 'D9 index pas écrit ⇒ 503 et la ligne repart (aucun lien à moitié)');
  db.pannes.delete('ecriture-index');

  // ════ E. LA SYNCHRO (pure) ═══════════════════════════════════════════════
  const now = Date.now(), fut = new Date(now + 86400000).toISOString(), hier = new Date(now - 2 * 3600000).toISOString();
  const P = (o) => ({ ligne: 'vrm_partage_' + 'a'.repeat(16), ident: { itemId: '1', num: '7' }, expire: fut, verifie: hier, vendu: false, prix: 50, ...o });
  const D = regle.decisionsSynchro;
  dit(D([P()], { vendusIds: new Set(['1']), enLigne: new Map() }, now)[0]?.etat === 'vendu', 'E1 annonce prouvée vendue ⇒ « vendu »');
  dit(D([P({ ident: { num: '7' } })], { vendusNums: new Set(['7']) }, now)[0]?.etat === 'vendu', 'E2 N° prouvé vendu ⇒ « vendu »');
  dit(D([P()], { vendusIds: new Set(), enLigne: new Map() }, now).length === 0, 'E3 absente des annonces en ligne ⇒ RIEN (jamais vendu par absence)');
  dit(D([P()], { vendusIds: null, vendusNums: null, enLigne: new Map([['1', { price: 50 }]]) }, now).length === 0, 'E4 ventes pas lues ⇒ rien');
  dit(D([P()], { vendusIds: new Set(), enLigne: null }, now).length === 0, 'E5 annonces pas lues ⇒ rien');
  const e6 = D([P()], { vendusIds: new Set(), enLigne: new Map([['1', { price: 45, currency: 'EUR' }]]) }, now);
  dit(e6.length === 1 && e6[0].etat === 'dispo' && e6[0].prix === 45, 'E6 toujours en ligne, prix changé ⇒ « dispo » au prix relu');
  dit(D([P({ verifie: new Date(now - 60000).toISOString() })], { vendusIds: new Set(), enLigne: new Map([['1', { price: 50 }]]) }, now).length === 0, 'E7 confirmé il y a 1 min, rien changé ⇒ aucun envoi');
  dit(D([P({ vendu: true, venduPar: 'preuve' })], { vendusIds: new Set(), enLigne: new Map([['1', { price: 50 }]]) }, now)[0]?.etat === 'dispo', 'E8 vente annulée, de nouveau en ligne ⇒ « dispo »');
  dit(D([P({ expire: new Date(now - 1).toISOString() })], { vendusIds: new Set(['1']) }, now).length === 0, 'E9 lien expiré ⇒ ignoré');
  dit(D([P()], { vendusIds: new Set(), enLigne: new Map([['1', { price: 50, currency: 'GBP' }]]) }, now).every((x) => x.prix == null), 'E10 autre devise ⇒ aucun prix (jamais converti)');
  dit(regle.lienPublic('vinted', 'https://www.vinted.fr/member/123-julien') === '' && regle.photoPublique('https://user:pw@images1.vinted.net/a.jpg') === '', 'E11 un profil n’est pas une annonce ; aucun identifiant dans une photo');

  // ════ G. CÂBLAGE ═════════════════════════════════════════════════════════
  const vj = JSON.parse(fs.readFileSync(path.join(racine, 'vercel.json'), 'utf8'));
  dit((vj.rewrites || []).some((x) => x.source === '/p/:jeton' && x.destination === '/api/compte?mode=partage&p=:jeton'), 'G1 vercel.json : /p/<jeton> → la route existante');
  dit(fs.readdirSync(path.join(racine, 'api')).filter((f) => f.endsWith('.js')).length <= 12, 'G2 12 fonctions api/ au plus');
  dit(/url\.pathname\.startsWith\('\/p\/'\)\) return;/.test(fs.readFileSync(path.join(racine, 'public/sw.js'), 'utf8')), 'G3 le service worker laisse /p/ au réseau (jamais rangée sous « / »)');
  const app = fs.readFileSync(path.join(racine, 'src/App.jsx'), 'utf8');
  dit(/data-fiche-partager=/.test(app) && /vrm:partager/.test(fs.readFileSync(path.join(racine, 'src/ecrans/Stock.jsx'), 'utf8')), 'G4 « Partager » depuis Annonces et depuis le Stock');
  return ko;
}

(async () => {
  const bavard = !process.argv.includes('--silence');
  const iR = process.argv.indexOf('--racine');
  const ko = await audit(iR > 0 ? process.argv[iR + 1] : RACINE, bavard);
  if (!process.argv.includes('--prouve')) { console.log(ko ? `\n${ko} échec(s)` : '\nAudit partage de fiche : OK'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log('\nL’audit est rouge sur le vrai code : pas de preuve par mutation.'); process.exit(1); }
  const MUT = [
    ['api/_lib/partage-fiche.js', ".replace(/</g, '&lt;')", '', 'titre non échappé'],
    ['api/_lib/partage-fiche.js', "export const SELECT_PAGE = 't:data->>jeton,", "export const SELECT_PAGE = 'ident:data->ident,t:data->>jeton,", 'la page lit l’identité privée'],
    ['api/_lib/partage-fiche.js', 'if (!r || !r.t || !memeJeton(jeton, r.t))', 'if (!r || !r.t)', 'jeton pas re-comparé'],
    ['api/_lib/partage-fiche.js', "if (idx === undefined) return { status: 503, type: 'html', body: pagePanne() };", "if (idx === undefined) return { status: 404, type: 'html', body: pageAbsente() };", 'panne dite « plus actif »'],
    ['api/_lib/partage-fiche.js', "if (deps.acces) { const a = await deps.acces(owner); if (a === false) return { status: 404, type: 'html', body: pageAbsente() }; }", '', 'abonnement ignoré'],
    ['src/partageFiche.js', "if (!Number.isFinite(exp) || exp <= maintenant) return { etat: 'absent' };", '', 'expiration ignorée'],
    ['src/partageFiche.js', "if (!HOTES_PHOTO.some((re) => re.test(x.hostname))) return '';", '', 'photo d’un hôte inconnu'],
    ['src/partageFiche.js', 'return `https://${x.hostname}${x.pathname}`;', 'return x.href;', 'paramètres de suivi gardés'],
    ['src/partageFiche.js', "perime: date == null || maintenant - date > PERIME_MS", 'perime: false', 'jamais « à confirmer »'],
    ['src/partageFiche.js', 'if (!enL) continue;', "if (!enL) { if (!p.vendu) out.push({ ligne: p.ligne, etat: 'vendu' }); continue; }", 'vendu par absence'],
    ['src/partageFiche.js', "  const pseudo = str(b.pseudo, 40);", "  const pseudo = str(b.pseudo || b.compte, 40);", 'le compte fuit comme pseudo'],
    ['src/partageFiche.js', "const vendu = (id && vendusIds && vendusIds.has(id)) || (num && vendusNums && vendusNums.has(num));", 'const vendu = false;', 'vente prouvée ignorée'],
  ];
  let rouges = 0;
  const { spawnSync } = require('child_process');
  for (const [f, de, vers, nom] of MUT) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-partage-'));
    for (const d of ['api', 'src', 'public']) fs.cpSync(path.join(RACINE, d), path.join(tmp, d), { recursive: true, filter: (s) => !/\.(zip|xpi|png|jpg|gs)$/.test(s) });
    for (const x of ['package.json', 'vercel.json']) fs.copyFileSync(path.join(RACINE, x), path.join(tmp, x));
    fs.symlinkSync(fs.realpathSync(path.join(RACINE, 'node_modules')), path.join(tmp, 'node_modules'));
    let s = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!s.includes(de)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); rouges = -999; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    s = s.replace(de, vers);
    fs.writeFileSync(path.join(tmp, f), s);
    const r = spawnSync(process.execPath, [__filename, '--racine', tmp, '--silence'], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    console.log(`${rouge ? 'OK  ' : 'KO  '}mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste VERT'}`);
    if (rouge) rouges++;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(rouges === MUT.length ? '\nPreuve par mutation : chaque règle affaiblie fait rougir l’audit.' : '\nPreuve par mutation INCOMPLÈTE');
  process.exit(rouges === MUT.length ? 0 : 1);
})();
