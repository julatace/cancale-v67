// ═══════════════════════════════════════════════════════════════════════════
// « PARTAGER UNE FICHE » — la route (11 nov., lot partage-fiche)
// ═══════════════════════════════════════════════════════════════════════════
// vrm.center/p/<jeton> (vercel.json ⇒ /api/compte?mode=partage&p=<jeton>) :
// une page HTML LÉGÈRE, sans connexion, sans script, rendue ici (les aperçus
// d'iMessage et WhatsApp lisent les balises Open Graph sans exécuter de JS).
// AUCUNE fonction api/ neuve (12 au plus) : un mode de /api/compte.
//
// LA DONNÉE
//   · le vendeur : une ligne par lien, `vrm_partage_<16 car.>` (SA ligne,
//     owner = lui) : { jeton, fiche (publique), ident (privée), cree, expire,
//     maj, verifie, vendu, venduPar } ;
//   · l'index : `jeton_partage_<sha256 du jeton>` chez le propriétaire NEUTRE
//     (api/_lib/jeton-index.js : jamais le jeton en clair) ⇒ { owner, ligne }.
//   La page lit l'index (une ligne, `id=eq.`), puis LA ligne du vendeur,
//   PROJETÉE (§4.4 : `fiche`, `expire`, `vendu`, dates — jamais `ident`, jamais
//   `select=data`), et RE-COMPARE le jeton à durée constante. L'index ne fait
//   jamais foi seul.
// LA PAGE
//   · inconnu, arrêté, expiré, abonnement arrêté ⇒ la MÊME page 404 (pas
//     d'énumération) ; base injoignable ⇒ 503 « Réessaie » (jamais « plus actif ») ;
//   · vendu (preuve de l'app, §5) ⇒ « Vendu », ni prix ni lien ;
//   · toujours datée : « Infos du … » — au-delà de 72 h sans confirmation,
//     « À confirmer avec le vendeur » (jamais périmé présenté comme actuel) ;
//   · `no-store`, `noindex`, `Referrer-Policy: no-referrer` (le jeton ne part
//     pas vers Vinted au clic), CSP sans script.
// LES GESTES (session du vendeur, clé de service, owner = l'id du jeton vérifié)
//   GET  ⇒ ses liens actifs (les expirés sont retirés) ;
//   POST { action: 'creer', fiche, ident, duree } · 'actualiser' { ligne, fiche }
//        · 'arreter' { ligne } · 'etat' { maj: [{ ligne, etat, prix? }] }.
// Tenu par scripts/audit-partage-fiche.cjs (EXÉCUTE api/compte.js).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { idIndexJeton, memeJeton, retirerIndexJeton } from './jeton-index.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import {
  LIGNE_PREFIXE, RE_LIGNE, MAX_ACTIFS, nettoyerFiche, nettoyerIdent, dureeValide, jetonDeChemin,
  urlPartage, etatPage, prixPublic, dateCourte, prixTexte, NOM_SITE,
} from '../../src/partageFiche.js';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const nouveauJetonPartage = () => crypto.randomBytes(32).toString('base64url');
const nouvelleLigne = () => LIGNE_PREFIXE + crypto.randomBytes(12).toString('base64url');
// La page publique ne lit QUE ceci (jamais `ident`).
export const SELECT_PAGE = 't:data->>jeton,f:data->fiche,e:data->>expire,v:data->>vendu,m:data->>maj,c:data->>verifie';
export const CSP_PAGE = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const echap = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── LA PAGE ────────────────────────────────────────────────────────────────
const STYLE = `
:root{--fond:#fff;--carte:#f5f5f7;--encre:#1d1d1f;--doux:#6e6e73;--ligne:rgba(0,0,0,.1);--accent:#0071e3;--ambre:#b25000}
@media (prefers-color-scheme:dark){:root{--fond:#000;--carte:#1c1c1e;--encre:#f5f5f7;--doux:#98989d;--ligne:rgba(255,255,255,.14);--accent:#0a84ff;--ambre:#ffb340}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fond);color:var(--encre);font:17px/1.47 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;font-variant-numeric:proportional-nums}
main{max-width:560px;margin:0 auto;padding:16px 16px 40px}
.galerie{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:18px;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.galerie::-webkit-scrollbar{display:none}
.galerie img{flex:0 0 100%;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:18px;background:var(--carte);scroll-snap-align:center}
.galerie.plusieurs img{flex-basis:86%}
@media (min-width:700px){.galerie img{aspect-ratio:1/1}}
.nb{margin:8px 0 0;font-size:13px;color:var(--doux);text-align:center}
h1{font-size:24px;line-height:1.2;letter-spacing:-.02em;font-weight:700;margin:20px 0 6px;overflow-wrap:anywhere}
.details{margin:0;color:var(--doux);font-size:15px}
.prix{font-size:32px;font-weight:700;letter-spacing:-.02em;margin:14px 0 0}
.vendu{display:inline-block;margin:14px 0 0;padding:6px 14px;border-radius:999px;background:var(--carte);font-weight:600;font-size:15px}
.liens{display:flex;flex-direction:column;gap:10px;margin:22px 0 0}
.liens a{display:flex;align-items:center;justify-content:center;min-height:50px;border-radius:14px;text-decoration:none;font-weight:600;font-size:17px;background:var(--carte);color:var(--encre)}
.liens a:first-child{background:var(--accent);color:#fff}
.date{margin:22px 0 0;font-size:13px;color:var(--doux)}
.date.perime{color:var(--ambre)}
.vendeur{margin:4px 0 0;font-size:13px;color:var(--doux)}
.absent{text-align:center;padding:80px 0}
.absent h1{font-size:22px}
footer{margin:32px 0 0;font-size:12px;color:var(--doux);text-align:center}`;

function coque({ titre, og = '', corps }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark"><title>${echap(titre)}</title>${og}
<style>${STYLE}</style></head><body><main>${corps}</main></body></html>`;
}

export function pageAbsente() {
  return coque({ titre: 'Lien plus actif', corps: '<section class="absent" data-partage="absent"><h1>Ce lien n’est plus actif.</h1><p class="details">Demande un nouveau lien au vendeur.</p></section>' });
}
export function pagePanne() {
  return coque({ titre: 'Réessaie', corps: '<section class="absent" data-partage="panne"><h1>Réessaie dans un instant.</h1><p class="details">La page n’a pas pu se charger.</p></section>' });
}

// `e` = sortie d'`etatPage` (actif ou vendu). `url` = l'adresse de la page.
export function pageFiche(e, url) {
  const f = e.fiche;
  const vendu = e.etat === 'vendu';
  const details = [f.marque && !f.titre.toLowerCase().includes(f.marque.toLowerCase()) ? f.marque : '', f.taille ? `Taille ${f.taille}` : '', f.etat].filter(Boolean).join(' · ');
  const titre = f.titre || f.marque || 'Article';
  const prix = !vendu && f.prix != null ? prixTexte(f.prix) : '';
  const ogTitre = vendu ? `Vendu · ${titre}` : prix ? `${titre} · ${prix}` : titre;
  const og = [
    `<meta property="og:type" content="product">`,
    `<meta property="og:title" content="${echap(ogTitre)}">`,
    details ? `<meta property="og:description" content="${echap(details)}">` : '',
    f.photos[0] ? `<meta property="og:image" content="${echap(f.photos[0])}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">',
    url ? `<meta property="og:url" content="${echap(url)}">` : '',
    `<meta property="og:site_name" content="VRM">`,
  ].join('');
  const photos = f.photos.length
    ? `<div class="galerie${f.photos.length > 1 ? ' plusieurs' : ''}" data-partage-photos="${f.photos.length}">${f.photos.map((p, i) => `<img src="${echap(p)}" alt="${i ? '' : echap(titre)}" ${i ? 'loading="lazy" ' : ''}decoding="async" referrerpolicy="no-referrer">`).join('')}</div>${f.photos.length > 1 ? `<p class="nb">${f.photos.length} photos · fais glisser</p>` : ''}`
    : '';
  const liens = !vendu && f.liens.length
    ? `<nav class="liens" data-partage-liens="${f.liens.length}">${f.liens.map((l) => `<a href="${echap(l.url)}" rel="noopener noreferrer nofollow" data-site="${l.site}">Voir sur ${echap(NOM_SITE[l.site] || l.site)}</a>`).join('')}</nav>`
    : '';
  const quand = e.date != null ? dateCourte(e.date) : '';
  const date = vendu ? '' : e.perime
    ? `<p class="date perime" data-partage-perime="">${quand ? `Infos du ${echap(quand)}.` : 'Infos pas datées.'} À confirmer avec le vendeur.</p>`
    : `<p class="date" data-partage-date="">Infos vérifiées le ${echap(quand)}.</p>`;
  const corps = `<article data-partage="${vendu ? 'vendu' : 'actif'}">${photos}<h1>${echap(titre)}</h1>${details ? `<p class="details" data-partage-details="">${echap(details)}</p>` : ''}${vendu ? '<p class="vendu" data-partage-vendu="">Vendu</p>' : prix ? `<p class="prix" data-partage-prix="${f.prix}">${echap(prix)}</p>` : ''}${liens}${date}${f.pseudo ? `<p class="vendeur" data-partage-pseudo="">Vendu par ${echap(f.pseudo)}</p>` : ''}<footer>Fiche partagée par le vendeur</footer></article>`;
  return coque({ titre: ogTitre, og, corps });
}

// ── LA ROUTE ───────────────────────────────────────────────────────────────
// deps : { base, cle (service), fetch, methode, p (jeton public | null), user, corps, acces(owner), origine, maintenant }
// Rend { status, type: 'html'|'json', body }.
export async function traiterPartage(deps) {
  const { base, cle, methode } = deps;
  const f = deps.fetch || fetch;
  const origine = deps.origine || 'https://vrm.center';
  const maintenant = deps.maintenant || Date.now();
  const H = cle ? { apikey: cle, Authorization: `Bearer ${cle}` } : null;
  const lire = async (q) => {
    try { const r = await f(`${base}/rest/v1/app_data?${q}`, { headers: H }); if (!r || !r.ok) return undefined; const j = await r.json(); return Array.isArray(j) ? j : undefined; } catch (_) { return undefined; }
  };

  // 1. LA PAGE PUBLIQUE, par le jeton seul.
  if (deps.p != null) {
    if (methode !== 'GET' && methode !== 'HEAD') return { status: 405, type: 'html', body: pageAbsente() };
    if (!H) return { status: 503, type: 'html', body: pagePanne() };
    const jeton = jetonDeChemin(deps.p);
    if (!jeton) return { status: 404, type: 'html', body: pageAbsente() };
    const idx = await lire(`owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexJeton('partage', jeton)}&select=o:data->>owner,l:data->>ligne&limit=1`);
    if (idx === undefined) return { status: 503, type: 'html', body: pagePanne() };
    const owner = idx[0] ? String(idx[0].o || '') : '', ligne = idx[0] ? String(idx[0].l || '') : '';
    if (!RE_UUID.test(owner) || !RE_LIGNE.test(ligne)) return { status: 404, type: 'html', body: pageAbsente() };
    const rows = await lire(`owner=eq.${owner}&id=eq.${ligne}&select=${SELECT_PAGE}&limit=1`);
    if (rows === undefined) return { status: 503, type: 'html', body: pagePanne() };
    const r = rows[0];
    if (!r || !r.t || !memeJeton(jeton, r.t)) return { status: 404, type: 'html', body: pageAbsente() };
    if (deps.acces) { const a = await deps.acces(owner); if (a === false) return { status: 404, type: 'html', body: pageAbsente() }; }
    const e = etatPage({ fiche: r.f, expire: r.e, vendu: r.v, maj: r.m, verifie: r.c }, maintenant);
    if (e.etat === 'absent') return { status: 404, type: 'html', body: pageAbsente() };
    return { status: 200, type: 'html', body: pageFiche(e, urlPartage(jeton, origine)) };
  }

  // 2. SES GESTES, sur SA session.
  const user = deps.user;
  if (!user || !RE_UUID.test(String(user.id || ''))) return { status: 401, type: 'json', body: { erreur: 'session' } };
  if (!H) return { status: 503, type: 'json', body: { erreur: 'non-configure', message: 'Le partage n’est pas encore branché sur le serveur.' } };
  const uid = String(user.id);
  const KO = { status: 503, type: 'json', body: { erreur: 'base', message: 'Rien n’a changé. Réessaie dans un instant.' } };
  const ecrire = async (lignes) => {
    try {
      const r = await f(`${base}/rest/v1/app_data?on_conflict=owner,id`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lignes) });
      return !!(r && r.ok);
    } catch (_) { return false; }
  };
  const effacer = async (owner, id) => {
    try { const r = await f(`${base}/rest/v1/app_data?owner=eq.${owner}&id=eq.${id}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } }); return !!(r && r.ok); } catch (_) { return false; }
  };
  const iso = (ms) => new Date(ms).toISOString();
  // Ses liens, projetés (une ligne de lien est légère, mais on ne lit que ce qui sert).
  const lister = () => lire(`owner=eq.${uid}&id=like.${LIGNE_PREFIXE}*&select=id,t:data->>jeton,ti:data->fiche->>titre,ph:data->fiche->photos->>0,px:data->fiche->>prix,e:data->>expire,v:data->>vendu,vp:data->>venduPar,c:data->>cree,m:data->>maj,vf:data->>verifie,ident:data->ident&limit=500`);
  const vue = (r) => ({
    ligne: r.id, url: urlPartage(r.t, origine), titre: r.ti || '', photo: r.ph || '', prix: r.px != null && r.px !== '' ? Number(r.px) : null,
    expire: r.e || '', cree: r.c || '', maj: r.m || '', verifie: r.vf || '', vendu: r.v === true || r.v === 'true', venduPar: r.vp || '',
    ident: r.ident && typeof r.ident === 'object' ? r.ident : {},
  });
  const lireUne = async (ligne) => {
    if (!RE_LIGNE.test(String(ligne || ''))) return null;
    const rows = await lire(`owner=eq.${uid}&id=eq.${ligne}&select=data&limit=1`);   // une ligne de lien : < 10 Ko
    if (rows === undefined) return undefined;
    return rows[0] && rows[0].data && typeof rows[0].data === 'object' ? rows[0].data : null;
  };
  const retirer = async (ligne, d) => {
    if (d && d.jeton && !(await retirerIndexJeton({ url: base, headers: H, fetcher: f, genre: 'partage', jeton: d.jeton }))) return false;
    return effacer(uid, ligne);
  };

  if (methode === 'GET') {
    const rows = await lister();
    if (rows === undefined) return { status: 503, type: 'json', body: { erreur: 'base', message: 'Je n’ai pas pu lire tes liens. Réessaie.' } };
    const actifs = [];
    for (const r of rows) {
      if (Date.parse(r.e || '') > maintenant && r.t) { actifs.push(vue(r)); continue; }
      // Expiré : l'index et la ligne partent (le lien ne marche déjà plus).
      await retirer(r.id, { jeton: r.t });
    }
    actifs.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
    return { status: 200, type: 'json', body: { ok: true, partages: actifs } };
  }
  if (methode !== 'POST') return { status: 405, type: 'json', body: { erreur: 'GET ou POST' } };
  const c = deps.corps && typeof deps.corps === 'object' ? deps.corps : {};
  const action = String(c.action || '');

  if (action === 'creer') {
    const fiche = nettoyerFiche(c.fiche);
    if (!fiche) return { status: 400, type: 'json', body: { erreur: 'fiche', message: 'Il faut au moins un titre ou une photo.' } };
    const rows = await lister();
    if (rows === undefined) return KO;
    if (rows.filter((r) => Date.parse(r.e || '') > maintenant && r.t).length >= MAX_ACTIFS) return { status: 409, type: 'json', body: { erreur: 'trop', message: `${MAX_ACTIFS} liens actifs au plus. Arrête un ancien partage.` } };
    const jeton = nouveauJetonPartage(), ligne = nouvelleLigne();
    const duree = dureeValide(c.duree);
    const data = { jeton, fiche, ident: nettoyerIdent(c.ident), cree: iso(maintenant), maj: iso(maintenant), verifie: iso(maintenant), expire: iso(maintenant + duree * 86400000), duree, vendu: false };
    // L'ordre : SA ligne d'abord (elle fait foi), puis l'index. Index raté ⇒ la ligne part.
    if (!(await ecrire([{ owner: uid, id: ligne, data, updated_at: iso(maintenant) }]))) return KO;
    if (!(await ecrire([{ owner: PROPRIETAIRE_NEUTRE, id: idIndexJeton('partage', jeton), data: { owner: uid, genre: 'partage', ligne, at: iso(maintenant) }, updated_at: iso(maintenant) }]))) { await effacer(uid, ligne); return KO; }
    return { status: 200, type: 'json', body: { ok: true, partage: { ligne, url: urlPartage(jeton, origine), expire: data.expire, cree: data.cree, maj: data.maj, verifie: data.verifie, vendu: false, titre: fiche.titre, photo: fiche.photos[0] || '', prix: fiche.prix, ident: data.ident } } };
  }

  if (action === 'arreter') {
    const d = await lireUne(c.ligne);
    if (d === undefined) return KO;
    if (d === null) return { status: 200, type: 'json', body: { ok: true, arrete: true } };   // déjà parti
    if (!(await retirer(String(c.ligne), d))) return KO;
    return { status: 200, type: 'json', body: { ok: true, arrete: true } };
  }

  if (action === 'actualiser') {
    const fiche = nettoyerFiche(c.fiche);
    if (!fiche) return { status: 400, type: 'json', body: { erreur: 'fiche', message: 'Il faut au moins un titre ou une photo.' } };
    const d = await lireUne(c.ligne);
    if (d === undefined) return KO;
    if (!d || !d.jeton || !(Date.parse(d.expire || '') > maintenant)) return { status: 404, type: 'json', body: { erreur: 'absent', message: 'Ce lien n’est plus actif.' } };
    // Un article PROUVÉ vendu le reste : actualiser la fiche ne le remet pas en vente.
    const neuf = { ...d, fiche, maj: iso(maintenant), verifie: iso(maintenant) };
    if (!(await ecrire([{ owner: uid, id: String(c.ligne), data: neuf, updated_at: iso(maintenant) }]))) return KO;
    return { status: 200, type: 'json', body: { ok: true, partage: { ligne: String(c.ligne), url: urlPartage(d.jeton, origine), expire: d.expire, maj: neuf.maj, verifie: neuf.verifie, vendu: !!d.vendu, titre: fiche.titre, photo: fiche.photos[0] || '', prix: fiche.prix, ident: d.ident || {} } } };
  }

  // L'état que l'app a PROUVÉ (src/partageFiche.js `decisionsSynchro`) : vendu ou toujours en ligne.
  if (action === 'etat') {
    const maj = (Array.isArray(c.maj) ? c.maj : []).slice(0, 50).filter((x) => x && RE_LIGNE.test(String(x.ligne || '')) && (x.etat === 'vendu' || x.etat === 'dispo'));
    let faits = 0;
    for (const m of maj) {
      const d = await lireUne(m.ligne);
      if (d === undefined) return { status: 503, type: 'json', body: { erreur: 'base', faits } };
      if (!d || !d.jeton || !(Date.parse(d.expire || '') > maintenant)) continue;
      const neuf = { ...d, verifie: iso(maintenant) };
      if (m.etat === 'vendu') { neuf.vendu = true; neuf.venduPar = 'preuve'; neuf.venduAt = iso(maintenant); }
      else {
        if (d.vendu && d.venduPar !== 'preuve') continue;
        neuf.vendu = false; delete neuf.venduPar; delete neuf.venduAt;
        const p = prixPublic(m.prix, 'EUR');
        if (p != null && d.fiche) neuf.fiche = { ...d.fiche, prix: p };
      }
      if (!(await ecrire([{ owner: uid, id: String(m.ligne), data: neuf, updated_at: iso(maintenant) }]))) return { status: 503, type: 'json', body: { erreur: 'base', faits } };
      faits++;
    }
    return { status: 200, type: 'json', body: { ok: true, faits } };
  }
  return { status: 400, type: 'json', body: { erreur: 'action' } };
}
