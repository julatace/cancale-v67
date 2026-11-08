#!/usr/bin/env node
// (8 nov.) À quel compte Vinted appartient un e-mail (`compteDeLEmail`,
// api/email-inbound.js). Julien : « je sélectionne le compte Shop, on me met des
// ventes d'un autre compte ». Plusieurs comptes écrivent à la MÊME boîte : la
// première adresse trouvée ne décide plus, ni un pseudo collé dans un autre mot.
// Ordre : pseudo salué (« Bonjour X, ») · adresse d'UN seul compte · pseudo en mot
// entier s'il n'y en a qu'un · sinon AUCUN compte. --prouve : mutations.
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
let rouges = 0; const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) rouges++; };
(async () => {
  const m = await import(path.join(RACINE, 'api/email-inbound.js'));
  const f = m.compteDeLEmail;
  ok(typeof f === 'function', 'la règle existe et se teste seule');
  if (typeof f !== 'function') { console.log(`\n❌ ${rouges} rouge(s)`); process.exit(1); }
  const A = [{ vinted_user_id: 11, login: 'shop_cancale' }, { vinted_user_id: 22, login: 'shop' }, { vinted_user_id: 33, login: 'vanessa5723' }, { vinted_user_id: 44, login: 'vanessa57' }];
  const MEME = 'boite@gmail.com';
  const E = { 11: MEME, 22: MEME, 33: MEME, 44: 'seule@icloud.com' };
  const u = (raw, emails = E) => f(raw, A, emails).uid;
  ok(u(`To: ${MEME}\nBonjour shop,\nradja a acheté Nike`) === '22', 'boîte partagée : le compte SALUÉ gagne (pas le premier de la liste)');
  ok(u(`To: ${MEME}\nBonjour vanessa5723,\nx a acheté`) === '33', 'boîte partagée : un autre compte salué reçoit sa vente');
  ok(u(`To: ${MEME}\nBonjour shop,\nvanessa57 a acheté Nike`) === '22', 'vente entre deux de ses comptes : le vendeur salué, pas l’acheteur');
  ok(u(`To: ${MEME}\nBonjour Shop_Cancale,\n`) === '11', 'le salut se lit sans tenir compte des majuscules');
  ok(u(`To: ${MEME}\nx a acheté un article`) === '', 'boîte partagée sans salut ni pseudo : AUCUN compte (pas le premier)');
  ok(u(`To: ${MEME}\nArticle vendu par shop_cancale`) === '11', 'sans salut : le pseudo cité en mot entier, s’il est seul');
  ok(u(`To: ${MEME}\nCompte vanessa5723 et vanessa57`) === '', 'deux pseudos cités : aucun compte');
  ok(u(`To: ${MEME}\nAcheteur : vanessa5723x`) === '', 'un pseudo collé dans un autre mot ne compte pas');
  ok(u('To: seule@icloud.com\nUn colis arrive') === '44', 'une adresse qui n’appartient qu’à un compte décide');
  ok(u(`To: ${MEME}\nBonjour inconnu42,\nshop_cancale`) === '11', 'un salut à un pseudo inconnu laisse la place aux règles suivantes');
  ok(f('', [], {}).uid === '', 'rien ⇒ aucun compte');
  // 50 comptes au même préfixe : seul le pseudo exact salué est pris.
  const L = Array.from({ length: 50 }, (_, i) => ({ vinted_user_id: 1000 + i, login: 'shop' + (i || '') }));
  ok(f('Bonjour shop7,\n', L, {}).uid === '1007' && f('Bonjour shop,\n', L, {}).uid === '1000', '50 pseudos voisins : le pseudo exact seulement');
  if (process.argv.includes('--prouve')) {
    console.log('\n— Mutations —');
    const p = path.join(RACINE, 'api/email-inbound.js'); const t = fs.readFileSync(p, 'utf8');
    const { execFileSync } = require('child_process');
    for (const [de, vers, nom] of [
      ["if (ok.length === 1) return rendre(ok[0], 'salut');", '', 'sans le salut'],
      ['if (uids.length === 1) viaAdresse.add(uids[0]); else', 'viaAdresse.add(uids[0]); if (0)', 'adresse partagée = premier compte'],
      ["new RegExp('(^|[^a-z0-9_.-])' + echapperRe(String(a.login).toLowerCase()) + '($|[^a-z0-9_.-])').test(low)", 'low.includes(String(a.login).toLowerCase())', 'pseudo dans un autre mot'],
      ['if (cites.length === 1) return', 'if (cites.length >= 1) return', 'premier pseudo cité'],
    ]) {
      if (!t.includes(de)) { ok(false, `mutation introuvable : ${nom}`); continue; }
      fs.writeFileSync(p, t.replace(de, vers));
      let rouge = false; try { execFileSync(process.execPath, [__filename], { stdio: 'pipe' }); } catch (_) { rouge = true; }
      fs.writeFileSync(p, t); ok(rouge, `mutation « ${nom} » ⇒ rouge`);
    }
  }
  console.log(rouges ? `\n❌ ${rouges} rouge(s)` : '\n✅ tout vert'); process.exit(rouges ? 1 : 0);
})();
