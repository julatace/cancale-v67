// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'AIDE AUX CLIENTS (12 nov., lot agent2-ouverture-clients)
//        node scripts/audit-aide-client.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//   C1 une adresse de contact, la MÊME dans l'app et sur les pages légales, et
//      montrée dans « Signaler un problème » (« Ou écris à … ») ;
//   C2 « Réponds-moi par e-mail » : décoché par défaut ; coché, l'adresse qui
//      part est celle de SA SESSION (jamais un champ du corps) ; décoché, aucune
//      adresse ne part — même si le corps en glisse une ; le propriétaire lit
//      « Répondre par e-mail » seulement quand elle a été demandée (route
//      exécutée sur une fausse base) ;
//   C3 la FAQ : 10 questions de rang 1 à 10, chacune trouvée par la recherche
//      avec les mots d'un client (installer l'extension, relier un compte,
//      e-mails, colis, factures, résilier, données, supprimer, problème, prix),
//      les prix de la FAQ = ceux des CGV (16,99 € / 19,99 €) ; montrée dans
//      chaque « ? ».
// Données inventées (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
if (process.argv.includes('--prouve')) {
  const { prouver } = require('./_mutations-audit.cjs');
  prouver(__filename, path.join(__dirname, '..'), {
    'adresse prise dans le corps': [['api/_lib/signalement.js', "? String(utilisateur.email).trim().toLowerCase() : null);", "? String(corps.email || utilisateur.email).trim().toLowerCase() : null);"]],
    'adresse sans la case': [['api/_lib/signalement.js', "corps && corps.repondreA === true && utilisateur", "corps && utilisateur"]],
    'case cochée par défaut': [['src/composants/SignalerProbleme.jsx', 'const [repondreA, setRepondreA] = React.useState(false);', 'const [repondreA, setRepondreA] = React.useState(true);']],
    'FAQ sans rang': [['src/aideFiches.js', "{ id: 'faq-supprimer', faq: 9,", "{ id: 'faq-supprimer',"]],
    'prix faux dans la FAQ': [['src/aideFiches.js', "'Pro : 19,99 € par mois, comptes vendeurs illimités.'", "'Pro : 24,99 € par mois, comptes vendeurs illimités.'"]],
  }, ['public']);
  return;
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };
const { sansCommentaires } = require('./_mutations-audit.cjs');
const lireSrc = (f) => sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8'));

(async () => {
  await essaie('C1', async () => {
    const c = await import('file://' + path.join(R, 'src', 'contact.js'));
    await import('file://' + path.join(R, 'public', 'legal', 'editeur.js'));
    const a = c.contactEmail();
    dit(!!a && globalThis.VRM_EDITEUR && globalThis.VRM_EDITEUR.email === a, 'C1 · une adresse de contact, la même dans l’app et sur les pages légales', a || '(vide)');
    const s = lireSrc('src/composants/SignalerProbleme.jsx');
    dit(/contactEmail\(\)/.test(s) && /data-signaler-contact/.test(s) && /Ou écris à/.test(s), '  « Signaler un problème » montre « Ou écris à … »');
  });

  await essaie('C2', async () => {
    const PROPRIO = '99999999-9999-4999-8999-999999999999', A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const base = [];
    const fetcher = async (u, o = {}) => {
      u = String(u);
      if (o.method === 'POST' && /app_data/.test(u)) { const l = JSON.parse(o.body); const nouv = l.filter((x) => !base.some((y) => y.id === x.id)); base.push(...nouv); return new Response(JSON.stringify(nouv), { status: 201 }); }
      if (/app_data/.test(u)) {
        const sel = (new URL(u).searchParams.get('select') || '').split(',');
        const rows = base.filter((x) => x.owner === PROPRIO && x.id.startsWith('signalement_'));
        const proj = rows.map((x) => Object.fromEntries(sel.map((s) => { const [n, c] = s.includes(':') ? s.split(':') : [s, s]; const m = /^data->>(\w+)$/.exec(c); const m2 = /^data->(\w+)$/.exec(c); return [n, m ? (x.data[m[1]] == null ? null : String(x.data[m[1]])) : m2 ? x.data[m2[1]] : x[c]]; })));
        return new Response(JSON.stringify(sel.length > 1 ? proj : rows), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    };
    const env = { SUPABASE_SERVICE_KEY: 'sb_secret_aide', VRM_OWNER_UID: PROPRIO };
    const lib = await import('file://' + path.join(R, 'api', '_lib', 'signalement.js'));
    const u = { id: A, email: 'Cliente@Exemple.test' };
    const corps = { texte: 'L’écran Colis reste vide', ecran: 'cat_bord', version: '1', navigateur: 'chrome' };
    const r1 = await lib.envoyerSignalement({ utilisateur: u, corps: { ...corps, email: 'pirate@exemple.test', repondre: 'pirate@exemple.test' }, env, fetcher, maintenant: Date.parse('2026-11-12T10:00:00Z') });
    const d1 = base[0] && base[0].data;
    dit(r1.code === 200 && d1 && !('repondre' in d1) && !JSON.stringify(d1).includes('@'), 'C2 · case décochée : AUCUNE adresse ne part (même glissée dans le corps)', JSON.stringify(d1 && d1.repondre));
    const r2 = await lib.envoyerSignalement({ utilisateur: u, corps: { ...corps, repondreA: true, email: 'pirate@exemple.test' }, env, fetcher, maintenant: Date.parse('2026-11-12T10:05:00Z') });
    const d2 = base[1] && base[1].data;
    dit(r2.code === 200 && d2 && d2.repondre === 'cliente@exemple.test', '  case cochée : l’adresse de SA SESSION part (jamais celle du corps)', d2 && d2.repondre);
    const l = await lib.listerSignalements({ utilisateur: { id: PROPRIO }, env, fetcher });
    const rep = (l.corps.signalements || []).map((s) => s.repondre);
    dit(l.code === 200 && rep.filter(Boolean).length === 1 && rep.includes('cliente@exemple.test'), '  le propriétaire voit l’adresse seulement quand elle a été demandée', JSON.stringify(rep));
    let envoye = null;
    await lib.posterSignalement({ texte: 'x' }, { fetcher: async (u2, o) => { envoye = JSON.parse(o.body); return new Response('{}', { status: 500 }); } });
    dit(envoye && !('repondreA' in envoye), '  l’app n’envoie pas la demande de réponse sans la case');
    await lib.posterSignalement({ texte: 'x' }, { repondreA: true, fetcher: async (u2, o) => { envoye = JSON.parse(o.body); return new Response('{}', { status: 500 }); } });
    dit(envoye && envoye.repondreA === true && !('email' in envoye), '  avec la case : seulement le drapeau, jamais l’adresse');
    const s = lireSrc('src/composants/SignalerProbleme.jsx');
    dit(/React\.useState\(false\);[^\n]*\n?/.test(s) && /const \[repondreA, setRepondreA\] = React\.useState\(false\)/.test(s) && /Réponds-moi par e-mail/.test(s) && /data-signalement-repondre/.test(s), '  la case est décochée au départ ; « Répondre par e-mail » chez le propriétaire');
  });

  await essaie('C3', async () => {
    const A = await import('file://' + path.join(R, 'src', 'aideFiches.js'));
    const fiches = A.fichesPour({ vend: 'sneakers', mode: 'simple' });
    const faq = A.faqAide(fiches);
    dit(faq.length === 10 && faq.map((f) => f.faq).join(',') === '1,2,3,4,5,6,7,8,9,10', 'C3 · 10 questions les plus posées, rangées 1 à 10 (visibles même en Simple)', faq.map((f) => f.id).join(' · '));
    const besoins = [
      ['combien ça coute', 'faq-prix'], ['installer extension', 'reglages-extension'], ['relier compte vinted', 'faq-vinted'], ['mes emails', 'reglages-email'],
      ['imprimer bordereau', 'colis-bordereau'], ['facture abonnement', 'faq-factures'], ['resilier', 'reglages-abonnement'], ['telecharger mes donnees', 'faq-donnees'],
      ['supprimer mon compte', 'faq-supprimer'], ['contacter support', 'faq-probleme'],
    ];
    const rates = besoins.filter(([q, id]) => !A.chercherAide(fiches, q).slice(0, 3).some((f) => f.id === id)).map(([q]) => q);
    dit(!rates.length, '  chaque question se trouve avec les mots d’un client (dans les 3 premiers)', rates.join(' | '));
    const src = fs.readFileSync(path.join(R, 'api', 'compte.js'), 'utf8');
    const cent = (n) => (n / 100).toFixed(2).replace('.', ',');
    const solo = cent(Number(/PRIX_CGV = \{ centimes: (\d+)/.exec(src)[1])), pro = cent(Number(/PRIX_PRO_CGV = \{ centimes: (\d+)/.exec(src)[1]));
    const prix = faq.find((f) => f.id === 'faq-prix').etapes.join(' ');
    dit(prix.includes(solo + ' €') && prix.includes(pro + ' €'), `  les prix de la FAQ sont ceux des CGV (${solo} € / ${pro} €)`, prix);
    const feuille = lireSrc('src/composants/AideEcran.jsx');
    dit(/faqAide\(fiches\)/.test(feuille) && /Les questions les plus posées/.test(feuille), '  la FAQ est dans chaque « ? »');
  });
  console.log(ko ? `\n❌ audit-aide-client : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-aide-client : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
