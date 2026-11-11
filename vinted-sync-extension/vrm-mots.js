// ── « PAIRE » OU « ARTICLE » DANS LES PAGES (11 nov., lot vocabulaire-article, 5.347.0) ──
// Le vocabulaire de l'app (src/profilVendeur.js, `motsArticle`) recopié TEL QUEL entre
// les marques par `node scripts/audit-vocabulaire-article.cjs --recopie`. Ce que le
// vendeur vend est rangé par le fond (background.js `rafraichirVendExt`) dans
// `chrome.storage.local.vrm_vend_ext` ({ vend, owner, at }) : « sneakers » ⇒ « paire »
// (Julien, les textes d'avant mot pour mot) ; sinon « article ». Rien de rangé ⇒ les
// textes d'avant. Aucune lecture réseau ici, aucune écriture.
(() => {
  if (globalThis.VRM_MOTS) return;
  const MOTS_ARTICLE = (() => {
// <mots-article> (copie, ne pas modifier ici)
const MOTS = {
  sneakers: { nom: 'paire', noms: 'paires', un: 'une paire', Un: 'Une paire', le: 'la paire', Le: 'La paire', ce: 'cette paire', tes: 'tes paires', e: 'e', es: 'es', chaque: 'Chaque paire', elle: 'elle', Elle: 'Elle', une: 'une',
    // (11 nov., lot vocabulaire-article) les formes des écrans secondaires, des notifications et de l'extension.
    Nom: 'Paire', Noms: 'Paires', sa: 'sa paire', la: 'la', La: 'La', de: 'de la paire', a: 'à la paire', Ce: 'Cette paire', aucune: 'aucune paire', Aucune: 'Aucune paire',
    celle: 'celle', celles: 'celles', toutes: 'toutes', Toutes: 'Toutes', laquelle: 'laquelle', autre: 'une autre paire', meme: 'la même paire', Meme: 'La même paire', lui: 'elle', eux: 'elles', deNom: 'de paire', deNoms: 'de paires', Tes: 'Tes paires', quelle: 'quelle paire', bonne: 'la bonne paire', AucuneDe: 'Aucune de ces paires', mes: 'mes paires', deMeme: 'de la même paire', quelles: 'quelles paires', ancienne: 'ANCIENNE paire', nouvelle: 'la nouvelle', ta: 'ta paire', deCe: 'de cette paire', deLa: 'de la' },
  autre:    { nom: 'article', noms: 'articles', un: 'un article', Un: 'Un article', le: 'l’article', Le: 'L’article', ce: 'cet article', tes: 'tes articles', e: '', es: 's', chaque: 'Chaque article', elle: 'il', Elle: 'Il', une: 'un',
    Nom: 'Article', Noms: 'Articles', sa: 'son article', la: 'le', La: 'Le', de: 'de l’article', a: 'à l’article', Ce: 'Cet article', aucune: 'aucun article', Aucune: 'Aucun article',
    celle: 'celui', celles: 'ceux', toutes: 'tous', Toutes: 'Tous', laquelle: 'lequel', autre: 'un autre article', meme: 'le même article', Meme: 'Le même article', lui: 'lui', eux: 'eux', deNom: 'd’article', deNoms: 'd’articles', Tes: 'Tes articles', quelle: 'quel article', bonne: 'le bon article', AucuneDe: 'Aucun de ces articles', mes: 'mes articles', deMeme: 'du même article', quelles: 'quels articles', ancienne: 'ANCIEN article', nouvelle: 'le nouvel article', ta: 'ton article', deCe: 'de cet article', deLa: 'du' },
};
// </mots-article>
    return MOTS;
  })();
  let vend = 'sneakers';
  const lire = (v) => { vend = v && typeof v === 'object' && v.vend === 'autre' ? 'autre' : 'sneakers'; };
  try {
    chrome.storage.local.get('vrm_vend_ext').then((o) => lire(o && o.vrm_vend_ext)).catch(() => {});
    chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.vrm_vend_ext) lire(ch.vrm_vend_ext.newValue); });
  } catch (_) {}
  globalThis.VRM_MOTS = { mots: () => MOTS_ARTICLE[vend], vend: () => vend, MOTS_ARTICLE };
})();
