#!/usr/bin/env node
// ── audit-plateformes-2nov — quatre défauts de l'audit « plateformes » (2 nov.) ──
// Exécute ce qui s'exécute, juge le reste sur le code retiré de ses commentaires.
//   P13 : un « ]]> » dans une description eBay ne casse plus le XML (`cdataSur`).
//   P3  : un refus eBay `invalid_grant` rend `reconnecter` et DIT le geste (vrai
//         `accessToken` d'api/_lib/ebay.js, fetch simulé).
//   P1  : une commande eBay `PARTIALLY_REFUNDED` est NOMMÉE (CA déclaré et vendu),
//         jamais retirée en silence.
//   P6/P7 : CFE au conditionnel (sous 5 000 €) ; « eBay : daté au jour de la commande ».
//   node scripts/audit-plateformes-2nov.cjs
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  console.log('P13 — la description eBay');
  const ebay = fs.readFileSync(path.join(R, 'api', 'ebay.js'), 'utf8');
  const m = ebay.match(/export const cdataSur = \(s\) => [^\n]+/);
  dit(!!m, 'api/ebay.js porte `cdataSur`');
  if (m) {
    const cdataSur = eval('(' + m[0].replace('export const cdataSur = ', '').replace(/;\s*$/, '') + ')');
    const sortie = '<![CDATA[' + cdataSur('Taille 42 ]]> état neuf') + ']]>';
    const texte = sortie.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    dit(texte === 'Taille 42 ]]> état neuf', 'le texte relu du XML est exactement celui saisi', texte);
    const fins = []; for (let k = sortie.indexOf(']]>'); k >= 0; k = sortie.indexOf(']]>', k + 1)) fins.push(k);
    dit(fins.slice(0, -1).every((k) => sortie.startsWith('<![CDATA[', k + 3)) && fins[fins.length - 1] === sortie.length - 3, 'chaque « ]]> » ferme une section aussitôt rouverte (aucun texte hors CDATA)', sortie);
  }
  dit(/<Description><!\[CDATA\[\$\{cdataSur\(/.test(sansCommentaires(ebay)), 'la publication passe la description par `cdataSur`');

  console.log('\nP3 — connexion eBay refusée');
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'cle-de-banc';
  process.env.EBAY_APP_ID = process.env.EBAY_APP_ID || 'app'; process.env.EBAY_CERT_ID = process.env.EBAY_CERT_ID || 'cert';
  const vrai = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (/oauth2\/token/.test(u)) return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'the provided authorization refresh token is invalid or was issued to another client' }) };
    if (/refresh_token/.test(u)) return { ok: true, status: 200, json: async () => ([{ refresh_token: 'v^1.1#jeton-de-banc' }]) };
    return { ok: true, status: 200, json: async () => ([]) };
  };
  try {
    const lib = await import(path.join(R, 'api', '_lib', 'ebay.js'));
    const r = await lib.accessToken('00000000-0000-0000-0000-000000000001');
    dit(r && r.ok === false && r.reason === 'reconnecter', '`invalid_grant` ⇒ raison `reconnecter` (plus « refresh-failed »)', r);
    dit(r && /Reconnecte/.test(r.error || '') && /Paramètres/.test(r.error || ''), 'le message dit le geste et où le faire', r && r.error);
  } catch (e) { dit(false, 'api/_lib/ebay.js se charge et s\'exécute', e.message); }
  finally { global.fetch = vrai; }

  console.log('\nP1, P6, P7 — l\'app');
  const app = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
  const nPartiel = (app.match(/=== 'PARTIALLY_REFUNDED'/g) || []).length;
  dit(nPartiel >= 2, 'CA déclaré ET vendu traitent `PARTIALLY_REFUNDED`', nPartiel);
  dit(/ecartees\.push\(\{ id: idp, plateforme: 'eBay', raison: 'remboursement partiel/.test(app), 'CA déclaré : remboursée en partie ⇒ mise à part et nommée (« au moins »)');
  dit(/nonComptees\.push\(\{ plateforme: 'eBay', raison: 'remboursement partiel/.test(app), 'vendu : remboursée en partie ⇒ nommée dans les ventes non comptées');
  dit(/si tu as reçu un avis/.test(app) && /sous 5 000 €/.test(app), 'CFE : au conditionnel, et rien sous 5 000 € de CA');
  dit(/data-ca-ebay-date=""/.test(app), 'CA déclaré : « eBay : daté au jour de la commande » est dit');

  console.log('\nP5 — ACRE (décret n° 2026-69)');
  const mt = app.match(/const TAUX_MICRO = [^\n]+\n(const tauxMicroVente = [^\n]+\n[^\n]+)/);
  if (mt) {
    const TAUX_MICRO = eval('(' + app.match(/const TAUX_MICRO = ([^;]+);/)[1] + ')');
    const tauxMicroVente = eval('(' + mt[1].replace('const tauxMicroVente = ', '').replace(/;\s*$/, '') + ')');
    dit(tauxMicroVente({}) === 12.4, 'sans ACRE : 12,4 %', tauxMicroVente({}));
    dit(tauxMicroVente({ acre: true }) === 6.3 && tauxMicroVente({ acre: 'avant' }) === 6.3, 'ACRE, début avant le 1er juillet 2026 : 6,3 %');
    dit(tauxMicroVente({ acre: 'apres' }) === 9.3, 'ACRE, début depuis le 1er juillet 2026 : 9,3 %', tauxMicroVente({ acre: 'apres' }));
    dit(tauxMicroVente({ acre: 'apres', liberatoire: true }) === 10.3, 'avec versement libératoire : 10,3 %');
  } else dit(false, 'TAUX_MICRO et tauxMicroVente lisibles dans App.jsx');

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
