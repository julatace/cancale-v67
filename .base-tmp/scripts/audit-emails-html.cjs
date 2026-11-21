// ════════════════════════════════════════════════════════════════════════════
//  LE HTML D'ORIGINE DES E-MAILS « À GESTE » (6 nov., décision de Julien) — les
//  règles EXÉCUTÉES. « Garder 30 jours le HTML d'origine ASSAINI des seuls e-mails
//  à geste, pour que l'e-mail ouvert dans VRM s'affiche comme dans Mail. »
//
//  H1. L'assainissement (api/_lib/email-html.js) : chaque vecteur XSS connu
//      (scripts/bancs/_fx-email-html.cjs : script, onerror, svg onload, javascript:
//      sous entités / tabulations / majuscules, expression() échappée ou commentée,
//      url(javascript:), iframe et srcdoc, meta refresh, base href, form action,
//      formaction, object/embed, math, noscript/textarea/title, commentaires…) est
//      jugé par un LECTEUR INDÉPENDANT de la sortie : balises de la liste blanche
//      seulement, aucun attribut `on…`, aucune adresse hors http(s)/mailto/tel,
//      aucune image chargée d'avance, aucun CSS qui charge ou exécute, aucun « < »
//      brut dans le texte ; et la sortie est stable (ré-assainie, identique).
//  H2. Images : distantes ⇒ `data-vrm-src` (jamais `src`), pixels de suivi
//      supprimés, `data:image/*` gardé ; le cadre ne les remet en `src` que sur le
//      geste (https seulement) et sa CSP n'ouvre `https:` qu'à ce moment.
//  H3. Plafond 150 Ko : au-delà, rien que le poids (« trop lourd ») ; et « à geste »
//      seulement (colis à retirer, vente, bordereau, achat, offre).
//  H4. La VRAIE route `api/email-inbound.js` : la ligne `email_html_{empreinte}` est
//      écrite APRÈS le rangement, sous le même vendeur ; une écriture ratée du HTML
//      ne fait PAS répondre 503 (l'e-mail est rangé) ; une écriture ratée du
//      rangement ⇒ 503 et aucun HTML ; un e-mail sans geste n'en écrit pas.
//  H5. La lecture d'UN e-mail (`lireEmailBoite`, base servie dans sa forme) :
//      HTML relu et RÉ-ASSAINI ; > 30 jours ⇒ absent (purge ratée = rien de plus) ;
//      lecture du HTML ratée ⇒ `origine:null`, l'e-mail s'ouvre ; sans `html` ⇒
//      la ligne HTML n'est même pas lue.
//  H6. Les LISTES ne lisent jamais les lignes HTML (journal, non-lus, compteurs,
//      réception), et aucune lecture `like.email_*` du code ne demande `data` ;
//      l'export complet écarte `email_html_*`.
//  H7. La purge à 30 jours : ne vise QUE `email_html_*` (servie sur une base
//      mêlée), date de `meta` sinon de création ; une purge ratée ne lève rien ;
//      branchée sur le cron du matin.
//  H8. Le cadre : `sandbox` sans `allow-scripts` (ni forms, ni top-navigation, ni
//      modals), `srcDoc`, sa propre CSP ; aucun HTML injecté dans l'écran ; le HTML
//      n'est jamais demandé en mode stream.
//  Données inventées (dépôt public). `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-emails-html.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';   // (7 nov.) sans elle, les routes serveur répondent 503 (api/_lib/cle-service.js)
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const { servir } = require('./bancs/_minipgrest.cjs');
const { VENTE_HTML, RETRAIT_HTML, VECTEURS } = require('./bancs/_fx-email-html.cjs');

const MUTATIONS = {
  'attributs on… gardés': [['api/_lib/email-html.js', "if (!(ATTR_COMMUNS.has(an) || (permis && permis.has(an)))) { compte.attributs++; continue; }", 'if (false) { continue; }']],
  'lien javascript: gardé': [['api/_lib/email-html.js', "if (/^https?:\\/\\/[^/\\\\]/i.test(u) || /^mailto:[^:]/i.test(u) || /^tel:[+\\d(]/i.test(u)) return u.slice(0, 2000);", 'return u;']],
  'script gardé': [['api/_lib/email-html.js', "const BRUT = new Set(['script', ", "const BRUT = new Set(["]],
  'images distantes chargées d’avance': [['api/_lib/email-html.js', "else { out.unshift(['data-vrm-src', im.distante]); compte.images++; }", "else { out.unshift(['src', im.distante]); compte.images++; }"]],
  'pixel de suivi gardé': [['api/_lib/email-html.js', "if ((lw != null && lw <= 2) || (lh != null && lh <= 2) || estCache(style) || (im.distante && ADRESSE_PIXEL.test(im.distante))) return { retirer: 'pixel' };", "if (false) return { retirer: 'pixel' };"]],
  'url() du CSS gardée': [['api/_lib/email-html.js', ".replace(/\\b(?:url|image-set", ".replace(/\\b(?:urlXX|image-set"]],
  'plafond oublié': [['api/_lib/email-html.js', 'if (octets > HTML_MAX) return { ok: false, trop: true, octets };', '']],
  'HTML de tous les e-mails': [['api/_lib/email-html.js', "  const t = String(type || '');\n  if (TYPES_GESTE.has(t)) return true;", '  return true;']],
  '30 jours oubliés à la lecture': [['api/_lib/email-html.js', 'return Number.isFinite(t) && maintenant - t <= HTML_JOURS * 864e5', 'return true || Number.isFinite(t) && maintenant - t <= HTML_JOURS * 864e5']],
  'relu sans ré-assainir': [['api/_lib/email-html.js', "  const r = assainirHtml(ligne.html);\n  if (!r.ok) return r.trop", "  const r = { ok: true, html: ligne.html, images: 0 };\n  if (!r.ok) return r.trop"]],
  'purge trop large': [['api/_lib/email-html.js', 'return `app_data?id=like.${PREFIXE_HTML}*&', 'return `app_data?id=like.email_*&']],
  'HTML raté ⇒ 503': [['api/email-inbound.js', "if (range && !incident) await garderHtmlOrigine(cle, String(corps.type || 'information'), resume, contexte.html);", "if (range && !incident && !(await garderHtmlOrigine(cle, String(corps.type || 'information'), resume, contexte.html))) marquerEcritureRatee();"]],
  'HTML écrit malgré un rangement raté': [['api/email-inbound.js', 'if (range && !incident) await garderHtmlOrigine(', 'if (!incident) await garderHtmlOrigine(']],
  'HTML lu sans qu’on le demande': [['api/_lib/reception-email.js', 'if(html){try{const h=await lire(', 'if(true){try{const h=await lire(']],
  'sandbox avec scripts': [['src/CadreEmail.jsx', "export const SANDBOX_CADRE = 'allow-same-origin allow-popups", "export const SANDBOX_CADRE = 'allow-scripts allow-same-origin allow-popups"]],
  'images du cadre avant le geste': [['src/cadreEmail.js', "`img-src data:${images ? ' https:' : ''}`", "'img-src data: https:'"]],
  'geste qui remet n’importe quelle adresse': [['src/cadreEmail.js', '/ data-vrm-src="(https:\\/\\/[^"\\s<>]{1,2000})"/g', '/ data-vrm-src="([^"]*)"/g']],
  'HTML demandé en mode stream': [['src/BoiteEmails.jsx', "${stream ? '' : '&html=1'}", '&html=1']],
  'export qui emporte le HTML': [['src/App.jsx', "'email_bord_*','email_html_*',", "'email_bord_*',"]],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };

// ── LE LECTEUR INDÉPENDANT DE LA SORTIE ─────────────────────────────────────
// Il ne réutilise RIEN du module jugé : il lit la sortie comme le ferait un
// navigateur prudent et rend la liste des fautes.
const PERMISES = new Set('a abbr address article aside b bdi bdo big blockquote br caption center cite code col colgroup dd del dfn div dl dt em figcaption figure font footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li main mark nav ol p pre q s samp section small span strike strong sub summary details sup table tbody td tfoot th thead time tr tt u ul var wbr style'.split(' '));
const desEntites = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const CSS_INTERDIT = /url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|behaviou?r\s*:|binding\s*:|@import|@font-face|image-set\s*\(|\\|</i;
function fautes(html) {
  const f = [];
  const s = String(html);
  const blocs = [];
  const sansStyle = s.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => { blocs.push(css); return ''; });
  for (const css of blocs) if (CSS_INTERDIT.test(css)) f.push('bloc style : ' + css.slice(0, 80));
  const re = /<(\/?)([a-zA-Z][^\s/>]*)([^>]*)>/g; let m;
  while ((m = re.exec(sansStyle))) {
    const nom = m[2].toLowerCase();
    if (!PERMISES.has(nom) || nom === 'style') { f.push('balise ' + nom); continue; }
    if (m[1]) { if (m[3].trim()) f.push('fin de balise avec attributs'); continue; }
    let reste = m[3];
    const attrs = {};
    reste = reste.replace(/\s([a-z][a-z0-9-]*)="([^"]*)"/g, (x, n, v) => { attrs[n] = desEntites(v); return ''; });
    if (reste.trim()) f.push(`attribut hors guillemets sur ${nom} : ${reste.trim().slice(0, 60)}`);
    for (const [n, v] of Object.entries(attrs)) {
      if (/^on/i.test(n) || ['srcset', 'background', 'action', 'formaction', 'srcdoc', 'id', 'name', 'xmlns', 'poster', 'dynsrc', 'lowsrc'].includes(n)) f.push(`attribut ${n} sur ${nom}`);
      if (n === 'href' && !/^(https?:\/\/[^/\\]|mailto:|tel:)/i.test(v)) f.push('href ' + v.slice(0, 60));
      if (n === 'href' && /[\s\u0000-\u001f]/.test(v)) f.push('href avec blancs');
      if (n === 'src' && !/^data:image\/(png|gif|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(v)) f.push('src chargée d’avance ' + v.slice(0, 60));
      if (n === 'data-vrm-src' && !/^https:\/\/[^\s"<>]+$/.test(v)) f.push('data-vrm-src ' + v.slice(0, 60));
      if (n === 'target' && v !== '_blank') f.push('target ' + v);
      if (n === 'style' && CSS_INTERDIT.test(v)) f.push('style ' + v.slice(0, 80));
    }
    if (nom === 'a' && attrs.href && !(attrs.target === '_blank' && /\bnoopener\b/.test(attrs.rel || '') && /\bnoreferrer\b/.test(attrs.rel || ''))) f.push('lien sans _blank noopener noreferrer');
    if (nom === 'img' && attrs.src && attrs['data-vrm-src']) f.push('image à double source');
  }
  const texte = sansStyle.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  if (/</.test(texte)) f.push('« < » brut dans le texte : ' + texte.slice(texte.indexOf('<'), texte.indexOf('<') + 40));
  return f;
}

const J = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const MAINT = Date.UTC(2026, 10, 6, 15, 0);
const iso = (jours) => new Date(MAINT - jours * 864e5).toISOString();

(async () => {
  // Un module absent (arbre d'avant) est un ROUGE par règle, jamais un audit qui s'arrête.
  const charger = async (f) => { try { return await import(path.join(R, f)); } catch (e) { dit(false, `module ${f}`, String(e && e.message || e).slice(0, 120)); return {}; } };
  const H = await charger('api/_lib/email-html.js');
  const C = await charger('src/cadreEmail.js');

  // ── H0. Le lecteur de l'audit sait voir une faute (sinon il ne prouve rien) ──
  await essaie('H0', async () => {
    const pieges = ['<script>x</script>', '<img src="https://a.test/x.png">', '<a href="javascript:x">a</a>', '<p onclick="x">a</p>', '<div style="background:url(x)">a</div>', '<iframe></iframe>', 'a <b', '<a href="https://a.test/" target="_top">a</a>'];
    dit(pieges.every((p) => fautes(p).length > 0), 'H0 le lecteur de l’audit voit chaque piège brut', pieges.filter((p) => !fautes(p).length).join(' | '));
  });

  // ── H1. Les vecteurs connus ─────────────────────────────────────────────
  await essaie('H1', async () => {
    const restes = [];
    for (const [nom, html] of VECTEURS) {
      const r = H.assainirHtml(html);
      const sortie = r.ok ? r.html : '';
      const f = fautes(sortie);
      if (f.length) restes.push(`${nom} : ${f.join(', ')}`);
      if (r.ok && H.assainirHtml(sortie).html !== sortie) restes.push(`${nom} : pas stable`);
    }
    // Ce qui vit DANS un élément supprimé avec son contenu (script, iframe, title…)
    // ne ressort pas non plus en texte.
    const ENFOUIS = ['script', 'script majuscules', 'svg script', 'svg onload', 'math', 'iframe', 'frame', 'object', 'title', 'template', 'plaintext', 'nul', 'commentaire', 'textarea'];
    for (const [nom, html] of VECTEURS) {
      if (!ENFOUIS.includes(nom)) continue;
      const r = H.assainirHtml(html);
      if (r.ok && /__xss/.test(r.html)) restes.push(`${nom} : son contenu ressort en texte`);
    }
    dit(VECTEURS.length >= 40 && restes.length === 0, `H1 aucun des ${VECTEURS.length} vecteurs connus ne survit (lecteur indépendant, sortie stable)`, restes.slice(0, 6).join(' | '));
    const v = H.assainirHtml(VENTE_HTML);
    dit(v.ok && fautes(v.html).length === 0 && H.assainirHtml(v.html).html === v.html, 'H1 l’e-mail de vente inventé : sortie propre et stable', v.ok ? fautes(v.html).join(', ') : JSON.stringify(v));
    dit(v.ok && /Ton article est vendu/.test(v.html) && /<table[^>]*width="600"/.test(v.html) && /55,00/.test(v.html) && /@media only screen/.test(v.html), 'H1 la mise en page reste (tableaux, largeurs, styles, requête média)');
    dit(v.ok && /href="https:\/\/plateforme\.exemple\.test\/transactions\/12345678901\?utm_source=mail" target="_blank" rel="noopener noreferrer"/.test(v.html), 'H1 les liens http(s) restent, ouverts ailleurs (target _blank, noopener noreferrer)');
    dit(v.ok && !/cdn\.exemple\.test/.test(v.html) && !/<link|<meta|<title|<head/i.test(v.html), 'H1 ni feuille distante, ni police distante, ni meta, ni title');
  });

  // ── H2. Les images ──────────────────────────────────────────────────────
  await essaie('H2', async () => {
    const v = H.assainirHtml(VENTE_HTML);
    dit(v.images === 2 && (v.html.match(/data-vrm-src="https:\/\/images\.exemple\.test\//g) || []).length === 2 && !/\ssrc="https?:/.test(v.html), 'H2 images distantes en attente (data-vrm-src), aucune chargée d’avance', `images=${v.images}`);
    dit(v.pixels === 2 && !/suivi\.exemple\.test/.test(v.html), 'H2 les deux pixels de suivi sont supprimés', `pixels=${v.pixels}`);
    dit(!/fond\.png/.test(v.html), 'H2 une image de fond CSS ne part pas (url neutralisée)');
    const r = H.assainirHtml(RETRAIT_HTML);
    dit(r.ok && r.sombre === true && r.pixels === 1 && r.images === 1, 'H2 retrait : thème sombre reconnu, 1 image en attente, 1 pixel retiré', JSON.stringify({ sombre: r.sombre, images: r.images, pixels: r.pixels }));
    const enLigne = H.assainirHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">');
    dit(enLigne.ok && /src="data:image\/png;base64,iVBORw0KGgo="/.test(enLigne.html) && enLigne.images === 0, 'H2 une image en ligne (data:image/png) reste');
    const cid = H.assainirHtml('<p>a</p><img src="cid:image001@x">');
    dit(cid.ok && !/cid:/.test(cid.html), 'H2 une image cid: est retirée');
    // Le cadre
    const avant = C.documentCadre(v.html, { images: false });
    const apres = C.documentCadre(v.html, { images: true });
    dit(/img-src data:;/.test(C.politiqueCadre(false)) && !/https:/.test(C.politiqueCadre(false)) && /img-src data: https:/.test(C.politiqueCadre(true)), 'H2 la CSP du cadre n’ouvre https: aux images qu’après le geste', C.politiqueCadre(false));
    dit(/script-src 'none'/.test(C.politiqueCadre(true)) && /default-src 'none'/.test(C.politiqueCadre(true)) && /form-action 'none'/.test(C.politiqueCadre(true)) && /base-uri 'none'/.test(C.politiqueCadre(true)), 'H2 la CSP du cadre : aucun script, rien par défaut, aucun formulaire, aucune base');
    dit(!/\ssrc="https:/.test(avant) && (apres.match(/\ssrc="https:\/\/images\.exemple\.test\//g) || []).length === 2, 'H2 le geste remet en src les 2 images (et rien avant)');
    const pieges = '<img data-vrm-src="javascript:alert(1)"><img data-vrm-src="http://a.test/x.png"><img data-vrm-src="https://a.test/x.png&quot; onerror=&quot;x">';
    const piege = C.avecImages(pieges);
    dit(piege === pieges && C.avecImages('<img data-vrm-src="https://a.test/x.png">') === '<img src="https://a.test/x.png">', 'H2 le geste ne remet QUE des adresses https sans guillemet ni blanc', piege);
    dit(/<meta name="referrer" content="no-referrer">/.test(apres) && /http-equiv="Content-Security-Policy"/.test(apres), 'H2 le cadre n’envoie aucun référent et porte sa CSP');
    dit(/background:#ffffff/.test(C.documentCadre('<p>x</p>', { sombre: false })) && /color-scheme:light dark/.test(C.documentCadre('<p>x</p>', { sombre: true })), 'H2 fond clair si l’e-mail n’a pas de thème sombre ; sinon il suit');
  });

  // ── H3. Plafond et choix des e-mails ───────────────────────────────────
  await essaie('H3', async () => {
    const gros = '<table>' + '<tr><td style="padding:4px">Ligne de commande inventée numéro x</td></tr>'.repeat(4000) + '</table>';
    const r = H.assainirHtml(gros);
    dit(!r.ok && r.trop === true && r.octets > H.HTML_MAX, 'H3 plus de 150 Ko assainis : « trop lourd », rien gardé', JSON.stringify({ ok: r.ok, octets: r.octets }));
    const l = H.ligneHtml({ type: 'vente', resume: {}, html: gros, at: iso(0) });
    dit(l && l.trop === 1 && !('html' in l) && l.octets > H.HTML_MAX, 'H3 la ligne d’un e-mail trop lourd ne garde que son poids', JSON.stringify(l).slice(0, 120));
    dit(H.HTML_MAX === 150 * 1024 && H.HTML_JOURS === 30, 'H3 plafond 150 Ko, 30 jours');
    const geste = [['vente', {}], ['vente-vestiaire', {}], ['bordereau', {}], ['achat', {}], ['offre', {}], ['suivi', { code: '418205' }], ['suivi', { st: 'available' }]];
    const sans = [['connu-sans-action', {}], ['information', {}], ['ignoré', {}], ['message', {}], ['favori', {}], ['finalisation', {}], ['suivi', { st: 'transit' }], ['suivi', { st: 'available', sens: 'sortant' }], ['action', {}]];
    dit(geste.every(([t, r]) => H.emailAGeste(t, r)) && sans.every(([t, r]) => !H.emailAGeste(t, r)), 'H3 seuls les e-mails à geste gardent leur HTML (colis à retirer, vente, bordereau, achat, offre)', sans.filter(([t, r]) => H.emailAGeste(t, r)).map(([t]) => t).join(','));
    dit(H.ligneHtml({ type: 'information', resume: {}, html: VENTE_HTML, at: iso(0) }) === null, 'H3 un e-mail sans geste n’a pas de ligne HTML');
  });

  // ── H4. La VRAIE route de réception ─────────────────────────────────────
  await essaie('H4', async () => {
    process.env.VRM_OWNER_UID = J;
    process.env.EMAIL_INBOUND_SECRET = 'cle-banc-html';
    const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } };
    const ecrites = [], tentatives = [];
    let etat = {};
    const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
    global.fetch = async (url, opts = {}) => {
      const u = decodeURIComponent(String(url));
      if (!u.includes('/rest/v1/')) return rep({});
      // (7 nov.) Avec la clé de service, l'accès du vendeur se demande à la base (rpc) : oui.
      if (/\/rest\/v1\/rpc\//.test(u)) return rep(true);
      if ((opts.method || 'GET') === 'POST') {
        let lot = []; try { lot = JSON.parse(opts.body || '[]'); } catch (_) {}
        lot = Array.isArray(lot) ? lot : [lot];
        tentatives.push(lot.map((x) => x.id));
        if (etat.ecritureKO) return rep('<html>503</html>', 503);
        if (etat.htmlKO && lot.some((x) => String(x.id).startsWith('email_html_'))) return rep('<html>503</html>', 503);
        if (etat.receptionKO && lot.some((x) => String(x.id).startsWith('email_reception_'))) return rep('<html>503</html>', 503);
        lot.forEach((x) => ecrites.push({ id: x.id, owner: x.owner || '', data: x.data }));
        return rep('', 201);
      }
      if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
      if (/id=eq\.vrm_email_owners/.test(u)) return rep([LIGNE_J]);
      if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
      return rep([]);
    };
    const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
    const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?html');
    let n = 0;
    const envoyer = async (mail, e = {}) => {
      etat = e; ecrites.length = 0; tentatives.length = 0; n++;
      const res = faireRes();
      await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-html' }, body: { messageId: `<html-${n}@banc>`, to: 'recu@vrm.center', attachments: [], ...mail } }, res);
      const iSuivi = ecrites.findIndex((x) => x.id.startsWith('email_reception_'));
      const iHtml = ecrites.findIndex((x) => x.id.startsWith('email_html_'));
      return { code: res.code, suivi: ecrites[iSuivi], html: ecrites[iHtml], iSuivi, iHtml, tentatives: tentatives.slice() };
    };
    const VENTE = { from: 'no-reply@vinted.fr', subject: 'Ton article est vendu !', text: 'acheteur-de-banc a acheté [Nike Air Max 90] 42,00 €\nPrépare ton colis.', html: VENTE_HTML };
    const o = await envoyer(VENTE);
    dit(o.code === 200 && o.suivi && o.suivi.data.type === 'vente', 'H4 la vente est rangée (200)', String(o.code));
    dit(o.html && o.html.owner === J && o.html.id === o.suivi.id.replace('email_reception_', 'email_html_') && o.iHtml > o.iSuivi, 'H4 son HTML vit dans SA ligne (même empreinte, même vendeur), écrite APRÈS le rangement', o.html && o.html.id);
    dit(o.html && typeof o.html.data.html === 'string' && fautes(o.html.data.html).length === 0 && o.html.data.images === 2 && o.html.data.pixels === 2 && Number.isFinite(Date.parse(o.html.data.at)), 'H4 le HTML rangé est ASSAINI (images en attente, pixels retirés, daté)', o.html ? fautes(o.html.data.html).join(', ') : '');
    dit(o.suivi && !JSON.stringify(o.suivi.data).includes('data-vrm-src') && !JSON.stringify(o.suivi.data).includes('<table'), 'H4 la ligne de suivi (lue par les listes) ne porte aucun HTML');
    const k = await envoyer(VENTE, { htmlKO: true });
    dit(k.code === 200 && k.suivi && !k.html && k.tentatives.some((l) => l.some((id) => String(id).startsWith('email_html_'))), 'H4 HTML pas écrit (panne) : l’e-mail reste rangé, 200 — jamais 503 pour un confort d’affichage', String(k.code));
    const p = await envoyer(VENTE, { ecritureKO: true });
    dit(p.code === 503 && !p.tentatives.some((l) => l.some((id) => String(id).startsWith('email_html_'))), 'H4 rangement raté : 503 et aucun HTML tenté', `${p.code} ${JSON.stringify(p.tentatives)}`);
    const q = await envoyer(VENTE, { receptionKO: true });
    dit(q.code === 503 && !q.tentatives.some((l) => l.some((id) => String(id).startsWith('email_html_'))), 'H4 seule la ligne de rangement ratée : 503, et le HTML n’est pas écrit à côté d’un e-mail pas rangé', `${q.code} ${JSON.stringify(q.tentatives).slice(0, 200)}`);
    const i = await envoyer({ from: 'inconnu@exemple.test', subject: 'Une forme jamais vue', text: 'Rien de connu ici.', html: VENTE_HTML });
    dit(i.code === 200 && i.suivi && !i.html && !i.tentatives.some((l) => l.some((id) => String(id).startsWith('email_html_'))), 'H4 un e-mail sans geste (incompris) n’écrit pas de HTML', String(i.code));
    const g = await envoyer({ ...VENTE, html: '<table>' + '<tr><td>Ligne inventée de commande</td></tr>'.repeat(9000) + '</table>' });
    dit(g.code === 200 && g.html && g.html.data.trop === 1 && !('html' in g.html.data), 'H4 trop lourd : la ligne ne garde que le poids', g.html && JSON.stringify(g.html.data).slice(0, 100));
    const c = await envoyer({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 12345678 est disponible', text: 'Bonjour,\nVotre colis est disponible.\nVotre code de retrait est 418205\nPoint Relais\nRelais Tabac du Port\n17 Rue du Port\n56000 Vannes', html: RETRAIT_HTML });
    dit(c.code === 200 && c.suivi && c.suivi.data.resume && c.suivi.data.resume.code === '418205' && c.html && c.html.data.sombre === 1, 'H4 colis à retirer (code lu) : HTML gardé, thème sombre noté', c.suivi && JSON.stringify(c.suivi.data.resume));
  });

  // ── H5 / H6. Lecture d'UN e-mail et listes, base servie dans sa forme ─────
  const RE = await import(path.join(R, 'api/_lib/reception-email.js'));
  const cle = (i) => (String(i).padStart(4, '0') + 'ab'.repeat(30)).slice(0, 64);
  const lignes = [];
  const recu = (i, jours, type, resume) => lignes.push({ owner: J, id: 'email_reception_' + cle(i), meta: { at: iso(jours) }, data: { at: iso(jours), etat: 'integre', type, subject: 'Sujet inventé ' + i, from: 'Vinted <no-reply@vinted.fr>', adresses: ['recu@vrm.center'], resume } });
  const htmlPiege = '<p>Vente inventée</p><img data-vrm-src="https://images.exemple.test/a.png"><img data-vrm-src="https://images.exemple.test/b.png">' + '<script>parent.__xss(1)</script><img src="https://a.test/x.png" onerror="x">';
  recu(1, 1, 'vente', { v: 1, t: 'vente', a: 'Paire inventée' });
  lignes.push({ owner: J, id: 'email_texte_' + cle(1), data: { texte: 'Texte inventé', at: iso(1) } });
  lignes.push({ owner: J, id: 'email_html_' + cle(1), meta: { at: iso(1) }, data: { v: 1, at: iso(1), html: htmlPiege, octets: 3000, images: 2, pixels: 2, sombre: 0 } });
  recu(2, 40, 'vente', { v: 1, t: 'vente' });
  lignes.push({ owner: J, id: 'email_html_' + cle(2), meta: { at: iso(40) }, data: { v: 1, at: iso(40), html: '<p>vieux</p>' } });
  recu(3, 2, 'bordereau', { v: 1, t: 'bordereau', tx: '12345678901' });
  lignes.push({ owner: J, id: 'email_html_' + cle(3), meta: { at: iso(2) }, data: { v: 1, at: iso(2), trop: 1, octets: 250000 } });
  recu(4, 1, 'connu-sans-action', { v: 1, t: 'connu-sans-action' });
  lignes.push({ owner: B, id: 'email_html_' + cle(1), meta: { at: iso(1) }, data: { v: 1, at: iso(1), html: '<p>SECRET DE B</p>' } });
  for (let i = 10; i < 40; i++) { recu(i, i / 10, 'offre', { v: 1, t: 'offre', mt: '30' }); lignes.push({ owner: J, id: 'email_html_' + cle(i), meta: { at: iso(i / 10) }, data: { v: 1, at: iso(i / 10), html: '<p>MARQUEUR-HTML ' + 'x'.repeat(2000) + '</p>' } }); }
  const urls = [];
  const fetcherDe = (panne) => async (u) => {
    urls.push(decodeURIComponent(u));
    if (panne && panne.test(decodeURIComponent(u))) return { ok: false, status: 503, json: async () => ({}) };
    const url = new URL(u);
    if (url.pathname.endsWith('/vinted_accounts')) return { ok: true, status: 200, json: async () => [] };
    return { ok: true, status: 200, json: async () => servir(lignes, u, {}).body };
  };
  const base = { owner: J, url: 'http://base.test', headers: {}, maintenant: MAINT };

  await essaie('H5', async () => {
    urls.length = 0;
    const a = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(), id: 'email_reception_' + cle(1), html: true });
    const o = a.email && a.email.origine;
    dit(o && o.etat === 'garde' && typeof o.html === 'string' && fautes(o.html).length === 0 && !/<script|onerror|\ssrc="https:/.test(o.html), 'H5 le HTML relu est RÉ-ASSAINI (une ligne trafiquée ne passe pas)', o ? fautes(o.html || '').join(', ') : JSON.stringify(a.email));
    dit(o && o.images === 3 && a.email.texte === 'Texte inventé', 'H5 le texte reste, les images en attente sont comptées', o && String(o.images));
    const lus = urls.filter((x) => /email_html_/.test(x));
    dit(lus.length === 1 && /owner=eq\.1111/.test(lus[0]) && /select=html:data->>html,/.test(lus[0]) && !/select=(?:[^&]*,)?data(?:[,&]|$)/.test(lus[0]), 'H5 une lecture, sa ligne, sous SON vendeur, projetée', lus.join(' | '));
    dit(!(o && /SECRET DE B/.test(o.html)), 'H5 jamais le HTML d’un autre vendeur');
    const v = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(), id: 'email_reception_' + cle(2), html: true });
    dit(v.email && v.email.origine && v.email.origine.etat === 'absent' && v.email.origine.raison === 'trop-vieux', 'H5 plus de 30 jours (purge ratée) : absent, le texte prend le relais', JSON.stringify(v.email && v.email.origine));
    const t = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(), id: 'email_reception_' + cle(3), html: true });
    dit(t.email && t.email.origine && t.email.origine.etat === 'trop' && t.email.origine.octets === 250000, 'H5 trop lourd : dit, avec son poids', JSON.stringify(t.email && t.email.origine));
    const s = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(), id: 'email_reception_' + cle(4), html: true });
    dit(s.email && s.email.origine && s.email.origine.etat === 'absent' && s.email.origine.raison === 'pas-a-geste', 'H5 e-mail sans geste : « pas gardé » dit comme tel', JSON.stringify(s.email && s.email.origine));
    const pn = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(/email_html_/), id: 'email_reception_' + cle(1), html: true });
    dit(pn.ok && pn.email && pn.email.origine === null && pn.email.texte === 'Texte inventé', 'H5 lecture du HTML ratée : `origine:null` (pas su), l’e-mail s’ouvre avec son texte', JSON.stringify(pn.email && pn.email.origine));
    urls.length = 0;
    const sansH = await RE.lireEmailBoite({ ...base, fetcher: fetcherDe(), id: 'email_reception_' + cle(1) });
    dit(sansH.email && !('origine' in sansH.email) && !urls.some((x) => /email_html_/.test(x)), 'H5 sans `html` (mode stream) : la ligne HTML n’est même pas lue', urls.filter((x) => /email_html_/.test(x)).join(' | '));
  });

  await essaie('H6', async () => {
    urls.length = 0;
    const j1 = await RE.lireJournalEmail({ ...base, fetcher: fetcherDe() });
    const j2 = await RE.lireJournalEmail({ ...base, fetcher: fetcherDe(), boite: 'offres', parPage: 50 });
    const j3 = await RE.lireJournalEmail({ ...base, fetcher: fetcherDe(), compteSeul: true });
    const j4 = await RE.lireReceptionEmail({ ...base, fetcher: fetcherDe() });
    const tout = JSON.stringify([j1, j2, j3, j4]);
    dit(j1.ok && j2.ok && j1.emails.length > 0 && j2.emails.length === 30, 'H6 les listes répondent (journal, rubrique, compteurs, réception)', `${j1.emails.length} ${j2.emails.length}`);
    dit(!urls.some((x) => /email_html_/.test(x)) && !/MARQUEUR-HTML|data-vrm-src|<table/.test(tout), 'H6 aucune liste ne lit (ni ne rend) une ligne HTML', urls.filter((x) => /email_html_/.test(x)).join(' | '));
    // Le code : aucune lecture `like.email_*` (qui emporterait les lignes HTML) ne demande `data`.
    const fichiers = [];
    const marche = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = path.join(d, e.name); if (e.isDirectory()) marche(p); else if (/\.(jsx?|mjs|cjs)$/.test(e.name)) fichiers.push(p); } };
    marche(path.join(R, 'src')); marche(path.join(R, 'api'));
    const fautesCode = [];
    for (const f of fichiers) {
      const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
      for (const l of t.split('\n')) {
        if (!/like\.email_(?:\*|%|\$\{|h)|like\.email\*/.test(l)) continue;
        for (const m of l.matchAll(/select=([^&'"`\s)]*)/g)) if (m[1].split(',').some((x) => /^(?:\w+:)?data$|^\*$/.test(x.trim()))) fautesCode.push(path.relative(R, f) + ' : ' + l.trim().slice(0, 100));
      }
    }
    dit(fautesCode.length === 0, 'H6 aucune lecture `like.email_*` du code ne demande la ligne entière', fautesCode.slice(0, 3).join(' | '));
    const app = sansCommentaires(fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8'));
    const exclus = /const EXCLUS = \[([^\]]*)\]/.exec(app);
    dit(exclus && /'email_html_\*'/.test(exclus[1]) && /select=id,data&and=\(\$\{EXCLUS/.test(app), 'H6 l’export complet (select=id,data) écarte `email_html_*`', exclus && exclus[1].slice(0, 120));
  });

  // ── H7. La purge ────────────────────────────────────────────────────────
  await essaie('H7', async () => {
    const avant = H.limitePurge(MAINT);
    const q = H.requetePurgeHtml(avant);
    dit(/^app_data\?id=like\.email_html_\*&/.test(q) && /&select=id$/.test(q), 'H7 la purge ne vise que `email_html_*` et ne rend que des identifiants', q);
    const rows = [
      { owner: J, id: 'email_html_a', meta: { at: iso(31) }, updated_at: iso(31), data: {} },
      { owner: J, id: 'email_html_b', meta: { at: iso(2) }, updated_at: iso(2), data: {} },
      { owner: J, id: 'email_html_c', meta: null, updated_at: iso(45), data: {} },
      { owner: J, id: 'email_html_d', meta: null, updated_at: iso(1), data: {} },
      { owner: B, id: 'email_html_e', meta: { at: iso(60) }, updated_at: iso(60), data: {} },
      { owner: J, id: 'email_html_f', meta: { at: iso(29.9) }, updated_at: iso(29.9), data: {} },
      { owner: J, id: 'email_texte_g', meta: { at: iso(90) }, updated_at: iso(90), data: {} },
      { owner: J, id: 'email_reception_h', meta: { at: iso(90) }, updated_at: iso(90), data: {} },
      { owner: J, id: 'email_bord_i', meta: { at: iso(90) }, updated_at: iso(90), data: {} },
      { owner: J, id: 'main', meta: { at: iso(400) }, updated_at: iso(400), data: {} },
    ];
    const vises = [];
    const r = await H.purgerHtml({ url: 'http://base.test', headers: { apikey: 'x' }, maintenant: MAINT, fetcher: async (u, o) => { vises.push(o && o.method); return { ok: true, status: 200, json: async () => servir(rows, u, {}).body }; } });
    const ids = servir(rows, 'http://base.test/rest/v1/' + q, {}).body.map((x) => x.id).sort();
    dit(JSON.stringify(ids) === JSON.stringify(['email_html_a', 'email_html_c', 'email_html_e']), 'H7 sur une base mêlée : seules les lignes HTML de plus de 30 jours partent (tous vendeurs ; date de meta, sinon de création)', ids.join(','));
    dit(r.fait === true && r.retirees === 3 && vises[0] === 'DELETE', 'H7 la purge dit combien elle a retiré', JSON.stringify(r));
    const k = await H.purgerHtml({ url: 'http://base.test', headers: {}, maintenant: MAINT, fetcher: async () => ({ ok: false, status: 503 }) });
    const t = await H.purgerHtml({ url: 'http://base.test', headers: {}, maintenant: MAINT, fetcher: async () => { throw new Error('réseau coupé'); } });
    dit(k.fait === false && k.statut === 503 && t.fait === false && /réseau/.test(t.erreur || ''), 'H7 une purge ratée ne lève rien (et le dit)', JSON.stringify([k, t]));
    const cron = sansCommentaires(fs.readFileSync(path.join(R, 'api/ship-reminders.js'), 'utf8'));
    dit(/import \{ purgerHtml \} from '\.\/_lib\/email-html\.js'/.test(cron) && /if \(!soir && !reveil\) purgeHtml = await purgerHtml\(/.test(cron) && /purgeHtml \? \{ purgeHtml \}/.test(cron), 'H7 branchée sur le cron du MATIN (pas de fonction de plus), dite dans sa réponse');
  });

  // ── H8. Le cadre et l'écran ─────────────────────────────────────────────
  await essaie('H8', async () => {
    const cadre = sansCommentaires(fs.readFileSync(path.join(R, 'src/CadreEmail.jsx'), 'utf8'));
    const sb = /export const SANDBOX_CADRE = '([^']*)'/.exec(cadre);
    const jetons = sb ? sb[1].split(/\s+/) : ['?'];
    dit(sb && !jetons.some((x) => /^allow-(scripts|forms|top-navigation|top-navigation-by-user-activation|top-navigation-to-custom-protocols|modals|pointer-lock|presentation|downloads|storage-access-by-user-activation)$/.test(x)), 'H8 sandbox SANS allow-scripts (ni forms, ni top-navigation, ni modals)', sb && sb[1]);
    dit((cadre.match(/<iframe\b/g) || []).length === 1 && /<iframe[^>]*sandbox=\{SANDBOX_CADRE\}/.test(cadre) && /<iframe[^>]*srcDoc=\{doc\}/.test(cadre) && /documentCadre\(/.test(cadre), 'H8 un seul cadre, sandboxé, en srcDoc, document fabriqué par documentCadre');
    const ecran = sansCommentaires(fs.readFileSync(path.join(R, 'src/BoiteEmails.jsx'), 'utf8'));
    dit(!/dangerouslySetInnerHTML|innerHTML|srcdoc|<iframe/i.test(ecran) && !/dangerouslySetInnerHTML|innerHTML/.test(cadre), 'H8 aucun HTML injecté dans l’écran (le HTML ne vit que dans le cadre)');
    const demandes = ecran.match(/html=1/g) || [];
    dit(demandes.length >= 1 && (ecran.match(/\$\{stream \? '' : '&html=1'\}/g) || []).length === demandes.length, 'H8 le HTML n’est demandé que hors mode stream');
  });

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
}
