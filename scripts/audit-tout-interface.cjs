// ════════════════════════════════════════════════════════════════════════════
//  « ON NE FAIT PLUS LES REQUÊTES » (Julien, 21 nov., ext. 5.414 — `toutinterface`)
//
//  « Tout doit être parfait et irréprochable, surtout l'extension quand elle republie et envoie des messages
//  aux favoris : elle ne doit pas se tromper, elle a le contrôle du clavier et de la souris. Comme on a dit,
//  on ne fait plus les requêtes. » ⇒ une ÉCRITURE chez Vinted (méthode ≠ GET) ne part plus JAMAIS d'une
//  requête fabriquée par VRM : elle part de la PAGE de vinted.fr, quand VRM clique et tape dans l'onglet de
//  travail (`interfaceVinted`, `vrm-formulaire.js`). Les LECTURES (GET) restent permises.
//
//   T1  statique : chaque appel `vintedPage(` / `vintedSend(` du fond porte la méthode littérale 'GET'
//   T2  statique : aucun `fetch(` du fond vers Vinted (son domaine, une adresse relative de la page) avec une
//       méthode ≠ GET ; aucun `XMLHttpRequest` fabriqué dans le fond ; plus de `vintedPagePhoto`
//   T3  statique : le script de page `vrm-formulaire.js` n'envoie RIEN lui-même (ni fetch, ni XHR, ni beacon) :
//       il clique et tape, la page envoie
//   T4  statique : aucun script de contenu Vinted (inject, content, bridge, vrm-*.js) n'envoie d'écriture
//   T5  exécuté : le VRAI background.js — `vintedPage` et `vintedSend` en POST/PUT/DELETE ⇒ AUCUNE requête
//       chez faux Vinted, « rien n'est parti » dit ; un GET part, lui
//   T6  exécuté : la méthode « directe » enregistrée est ignorée (formulaire seul, et dit) ; la reposer est refusé
//   T7  exécuté : une commande d'écriture de l'app (répondre) passe par l'INTERFACE (l'étape de page `message`
//       dans l'onglet de travail, sur la bonne conversation) — le fond n'envoie rien lui-même
//   T8  exécuté : sans onglet vinted.fr connecté sur ce compte, rien ne part (ni page, ni repli du fond)
//  `--src chemin` : un autre background.js (preuve sur le code d'avant) ; `--mutation` : chaque mutation
//  doit rendre l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const SRC = cheminSource();
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 600) : '')); } };
// Les commentaires retirés (§6.4 : juger la règle, pas son orthographe) ; les chaînes gardées.
function sansCommentaires(s) {
  let out = '', i = 0, q = null;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (q) { out += c; if (c === '\\') { out += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}
const ligneDe = (s, k) => s.slice(0, k).split('\n').length;
// L'appel complet (parenthèses équilibrées) à partir de `(`.
function appel(s, k) { let p = 0; for (let i = k; i < s.length; i++) { if (s[i] === '(') p++; else if (s[i] === ')') { p--; if (!p) return s.slice(k, i + 1); } } return s.slice(k); }

const BG = sansCommentaires(fs.readFileSync(SRC, 'utf8'));
// ── T1
{ const faux = []; const re = /\b(vintedPage|vintedSend)\s*\(/g; let m;
  while ((m = re.exec(BG))) {
    const avant = BG.slice(Math.max(0, m.index - 20), m.index);
    if (/function\s+$/.test(avant)) continue;   // la définition
    const a = appel(BG, m.index + m[0].length - 1);
    const args = a.slice(1).split(',');
    if (!/^\s*'GET'\s*$/.test(args[1] || '')) faux.push(`${m[1]} l.${ligneDe(BG, m.index)} : ${a.slice(0, 110)}`);
  }
  dit(!faux.length, `T1 — chaque appel vintedPage / vintedSend du fond est une LECTURE ('GET' écrit en toutes lettres)`, faux.join(' | ')); }
// ── T2
{ const faux = []; const re = /\bfetch\s*\(/g; let m;
  while ((m = re.exec(BG))) {
    const a = appel(BG, m.index + m[0].length - 1);
    const url = a.slice(1, 200);
    const versVinted = /vinted\.|\$\{\s*(domain|domaine|dom|d)\s*\}|\$\{\s*acc\.domain|^\s*chemin\b|^\s*`\/api\//.test(url);
    if (!versVinted) continue;
    const meth = /\bmethod\s*:\s*([^,}\n]+)/.exec(a);
    if (meth && !/^\s*'GET'\s*$/.test(meth[1])) faux.push(`l.${ligneDe(BG, m.index)} : ${a.slice(0, 140)}`);
  }
  const xhr = (BG.match(/new\s+XMLHttpRequest\s*\(/g) || []).length;
  dit(!faux.length && !xhr && !/\bvintedPagePhoto\s*\(/.test(BG), 'T2 — aucun fetch du fond vers Vinted avec une méthode ≠ GET, aucun XMLHttpRequest fabriqué, plus de téléversement de photo par requête', JSON.stringify({ faux, xhr })); }
// ── T3
{ const F = sansCommentaires(fs.readFileSync(path.join(EXT, 'vrm-formulaire.js'), 'utf8'));
  // Le seul `fetch` / `open` / `send` permis : l'ÉCOUTE (le relais de la page, `f0.apply` / `o0.apply` / `s0.apply`).
  const appels = (F.match(/\bfetch\s*\(|new\s+XMLHttpRequest|sendBeacon|\.open\s*\(|\.send\s*\(/g) || []);
  const ecoute = (F.match(/\b(f0|o0|s0)\.apply\(/g) || []).length;
  dit(!appels.length && ecoute === 3, 'T3 — vrm-formulaire.js n’envoie rien lui-même (aucun fetch / XHR / beacon) : il écoute la page, clique et tape', JSON.stringify({ appels, ecoute })); }
// ── T4
{ const faux = [];
  for (const f of fs.readdirSync(EXT).filter((x) => /\.js$/.test(x) && !/^(background|lbc|vc|ebay|oauth|popup|parcours|transp)/.test(x))) {
    const s = sansCommentaires(fs.readFileSync(path.join(EXT, f), 'utf8'));
    const re = /\bmethod\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]|\.open\s*\(\s*['"](POST|PUT|PATCH|DELETE)['"]/g; let m;
    while ((m = re.exec(s))) faux.push(`${f} l.${ligneDe(s, m.index)}`);
  }
  dit(!faux.length, 'T4 — aucun script de contenu de vinted.fr (inject, content, bridge, vrm-*.js) n’envoie d’écriture', faux.join(', ')); }

(async () => {
  // ── T5
  { const f = faireFond({ src: SRC, vinted: () => ({ status: 200, body: { code: 0 } }) });
    const acc = { vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'x' };
    const r1 = await f.ctx.vintedPage(acc, 'POST', '/api/v2/conversations/123/replies', { reply: { body: 'x' } }, { timeoutMs: 1000 });
    const r2 = await f.ctx.vintedPage(acc, 'PUT', '/api/v2/items/4400101/is_hidden', { is_hidden: true });
    const r3 = await f.ctx.vintedSend(acc, 'PUT', '/api/v2/transactions/1/shipment/order', {});
    const r4 = await f.ctx.vintedSend(acc, 'DELETE', '/api/v2/items/4400101', null);
    const ecritures = f.j.vinted.filter((x) => x.methode !== 'GET');
    dit(!ecritures.length && [r1, r2, r3, r4].every((r) => r && r.ok === false && r.rienParti === true && /rien n'est parti/.test(String(r.raison || ''))), 'T5 — vintedPage / vintedSend en POST, PUT, DELETE : AUCUNE requête chez Vinted, « rien n’est parti » dit', JSON.stringify({ ecritures, r1 }));
    const r5 = await f.ctx.vintedSend(acc, 'GET', '/api/v2/users/111', null);
    dit(r5 && f.j.vinted.some((x) => x.methode === 'GET' && x.chemin === '/api/v2/users/111'), 'T5b — une LECTURE (GET) part, elle', JSON.stringify(f.j.vinted.slice(-1))); }
  // ── T6
  { const f = faireFond({ src: SRC, store: { vrmCommeBleam: { methode: 'directe', favoris: true } } });
    const r = await f.ctx.reglagesCommeBleam();
    const p = await f.ctx.poserReglagesCommeBleam({ methode: 'directe' });
    dit(r.methode === 'formulaire' && r.methodeAvant === 'directe' && p.ok === false && f.store.vrmCommeBleam.methode === 'directe', 'T6 — une ancienne méthode « directe » enregistrée est IGNORÉE (formulaire, et dit) ; la reposer est refusé', JSON.stringify({ r, p })); }
  // ── T7 / T8
  const CONV = '5000121', UID = '111';
  const vintedConv = (e) => (e.methode === 'GET' && /\/api\/v2\/conversations\/5000121$/.test(e.chemin) ? { status: 200, body: { conversation: { id: 5000121, opposite_user: { id: 9 }, messages: [] } } } : e.methode !== 'GET' ? { status: 200, body: { code: 0 } } : { status: 404, body: {} });
  { const f = faireFond({ src: SRC, vinted: vintedConv, onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete', active: true, windowId: 1 }] });
    f.ctx.pageVintedPour = async () => ({ tabId: 7 });
    f.ctx.compteConnecte = async () => UID;
    const r = await f.ctx.gesteAppParInterface({ vinted_user_id: UID, domain: 'www.vinted.fr' }, UID, 'POST', `/api/v2/conversations/${CONV}/replies`, { body: { reply: { body: 'Bonjour, toujours dispo ?' } } });
    const etapes = (f.j.etapesPage || []).map((x) => `${x.etape}@${x.chemin}`);
    const parPage = f.j.vinted.filter((x) => x.methode !== 'GET');
    dit(r && r.ok && etapes.includes(`message@/inbox/${CONV}`) && parPage.length === 1 && parPage.every((x) => x.origine === 'page'), 'T7 — répondre depuis l’app : l’étape de page « message » dans l’onglet de travail, sur CETTE conversation ; la seule écriture vient de la page', JSON.stringify({ r: r && { ok: r.ok, rienParti: r.rienParti, raison: r.raison }, etapes, parPage })); }
  { const f = faireFond({ src: SRC, vinted: vintedConv, onglets: [] });
    f.ctx.pageVintedPour = async () => ({ refus: 'onglet' });
    const r = await f.ctx.gesteAppParInterface({ vinted_user_id: UID, domain: 'www.vinted.fr' }, UID, 'POST', `/api/v2/conversations/${CONV}/replies`, { body: { reply: { body: 'Bonjour' } } });
    dit(r && r.ok === false && r.rienParti === true && !f.j.vinted.length && !(f.j.etapesPage || []).length, 'T8 — sans onglet vinted.fr sur ce compte : rien ne part (ni la page, ni un repli du fond)', JSON.stringify({ r, v: f.j.vinted })); }

  if (process.argv.includes('--mutation')) {
    const src = fs.readFileSync(SRC, 'utf8');
    const MUT = [
      ['porte-page', "  if (String(method || 'POST').toUpperCase() !== 'GET') { noterDiag('ecriture_requete_refusee'); return { status: 0, ok: false, json: null, rienParti: true, sansPage: 'ecriture', ecritureRefusee: true, raison: RAISON_ECRITURE_REQUETE }; }\n  const domain = acc.domain || 'www.vinted.fr';\n  // 5.410.5", "  const domain = acc.domain || 'www.vinted.fr';\n  // 5.410.5"],
      ['porte-send', "async function vintedSend(acc, method, endpoint, body, options = {}) {\n  // 5.414 (`toutinterface`) : plus aucune écriture par requête — seulement les lectures (GET).\n  if (String(method || 'POST').toUpperCase() !== 'GET')", "async function vintedSend(acc, method, endpoint, body, options = {}) {\n  if (false)"],
      ['appel-ecriture', "  const r = await interfaceVinted(acc, 'message', { conv: String(convId), texte });", "  const r = await vintedPage(acc, 'POST', `/api/v2/conversations/${convId}/replies`, { reply: { body: texte } });"],
      ['directe-revenue', "  return { methode: 'formulaire', ...(o.methode === 'directe' ? { methodeAvant: 'directe' } : {}),", "  return { methode: o.methode === 'directe' ? 'directe' : 'formulaire', ...(o.methode === 'directe' ? { methodeAvant: 'directe' } : {}),"],
      ['repli-fond', "    const rp = await gesteAppParInterface(acc, String(msg.uid), methode, String(msg.endpoint || ''), msg);", "    const rp = await vintedSend(acc, methode, msg.endpoint, msg.body);"],
    ];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tout-interface-'));
    let bien = true;
    for (const [nom, de, vers] of MUT) {
      if (!src.includes(de)) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); fs.writeFileSync(p, src.replace(de, vers));
      const r = cp.spawnSync(process.execPath, [__filename, '--src', p], { env: { ...process.env, SILENCE: '1' }, encoding: 'utf8', timeout: 300000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    if (!bien) ko++;
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-tout-interface : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
