#!/usr/bin/env node
// (8 nov.) La photo de l'article lue dans l'e-mail de vente Vinted s'affiche sur la
// ligne « Vue par e-mail » tant que la liste Vinted n'a pas la vente.
//  · le serveur (`photoVenteEmail`) prend la PREMIÈRE image d'annonce Vinted
//    (`https://images<n>.vinted.net/t|tc/…`), jamais un logo, une icône, un pixel,
//    une adresse http, ni une image d'un autre domaine ;
//  · la requête de l'app la projette (`photo:meta->>photo`, jamais `select=data`) ;
//  · `ventesEmailFraiches` la pose (`photo`) après le même contrôle ; une valeur
//    étrangère n'entre pas ; `photoArticle` la lit.
// --prouve : mutations (règle affaiblie ⇒ rouge).
const path = require('path');
const RACINE = path.join(__dirname, '..');
const fs = require('fs');
let rouges = 0; const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) rouges++; };
(async () => {
  const src = fs.readFileSync(path.join(RACINE, 'src/venteEmailFraiche.js'), 'utf8');
  const srv = await import(path.join(RACINE, 'api/email-inbound.js'));
  const v = await import(path.join(RACINE, 'src/venteEmailFraiche.js'));
  const pa = await import(path.join(RACINE, 'src/photosArticles.js'));
  const P = 'https://images1.vinted.net/t/02_00abc_XYZabc/f800/1762601234.jpeg?s=0123abcd';
  const f = srv.photoVenteEmail;
  ok(typeof f === 'function', 'le serveur sait lire la photo d’un e-mail de vente');
  if (typeof f !== 'function') { console.log(`\n❌ ${rouges} rouge(s)`); process.exit(1); }
  ok(f(`<img src="https://static.vinted.com/logo.png"><img alt="" src="${P.replace('&', '&amp;')}">`) === P, 'la photo d’annonce est prise, le logo d’avant ignoré');
  ok(f('<img src="https://images1.vinted.net/assets/pixel.gif">') === '', 'un pixel ou une icône des serveurs Vinted n’est pas une photo d’annonce');
  ok(f('<img src="http://images1.vinted.net/t/02_00abc_XYZ/f800/1.jpeg">') === '', 'jamais une adresse http');
  ok(f('<img src="https://images1.vinted.net.evil.example/t/02_00abc_XYZ/1.jpeg">') === '', 'jamais un autre domaine');
  ok(f('') === '' && f(null) === '', 'pas de HTML ⇒ pas de photo');
  ok(f(`<img src='https://images7.vinted.net/tc/01_abc_DEF/f800/9.webp?s=x'>`) === 'https://images7.vinted.net/tc/01_abc_DEF/f800/9.webp?s=x', 'les deux formes de Vinted (/t/, /tc/) sont prises');
  ok(/photo:meta->>photo/.test(v.requeteVentesEmail(Date.parse('2026-11-08T12:00:00Z'))) && !/select=data/.test(v.requeteVentesEmail()), 'l’app lit la photo projetée (meta), jamais `select=data`');
  const lu = Date.parse('2026-11-06T10:22:00Z');
  const comptes = [{ vinted_user_id: '42', login: 'shop' }];
  const mail = (tx, photo) => ({ type: 'vente', tx, uid: '42', at: '2026-11-08T11:18:00Z', titre: 'Nike air Max 1', prix: '66.00', photo });
  const L = v.ventesEmailFraiches({ mails: [mail('1111111', P), mail('2222222', 'https://pirate.example/x.jpg'), mail('3333333', undefined)], comptes, ventes: [], ko: [], lectures: { 42: lu } });
  const par = Object.fromEntries(L.map((o) => [o.transaction_id, o]));
  ok(par['1111111'] && par['1111111'].photo === P && pa.photoArticle(par['1111111']) === P, 'la ligne « Vue par e-mail » montre la photo de l’e-mail');
  ok(par['2222222'] && !par['2222222'].photo, 'une adresse étrangère n’entre pas');
  ok(par['3333333'] && !par['3333333'].photo, 'pas de photo ⇒ pas de champ (la ligne garde son image vide)');
  if (process.argv.includes('--prouve')) {
    console.log('\n— Mutations —');
    const muter = (fichier, de, vers) => { const p = path.join(RACINE, fichier); const t = fs.readFileSync(p, 'utf8'); if (!t.includes(de)) { console.log('  (mutation introuvable)', fichier); return null; } fs.writeFileSync(p, t.replace(de, vers)); return () => fs.writeFileSync(p, t); };
    const { execFileSync } = require('child_process');
    for (const [fichier, de, vers, nom] of [
      ['src/venteEmailFraiche.js', "RE_PHOTO_EMAIL.test(String(m.photo || '')) ? String(m.photo) : null", "(m.photo ? String(m.photo) : null)", 'l’app sans contrôle'],
      ['api/email-inbound.js', 'if (RE_PHOTO_VINTED.test(u)) return u;', 'if (u) return u;', 'le serveur prend la première image venue'],
      ['src/venteEmailFraiche.js', ',photo:meta->>photo', '', 'requête sans la photo'],
    ]) {
      const remettre = muter(fichier, de, vers); if (!remettre) { rouges++; continue; }
      let rouge = false; try { execFileSync(process.execPath, [__filename], { stdio: 'pipe' }); } catch (_) { rouge = true; }
      remettre(); ok(rouge, `mutation « ${nom} » ⇒ rouge`);
    }
  }
  console.log(rouges ? `\n❌ ${rouges} rouge(s)` : '\n✅ tout vert'); process.exit(rouges ? 1 : 0);
})();
