// BANC : la route eBay, 5 novembre — l'action `photo` (une photo du téléphone
// confiée à l'hébergement d'images d'eBay) et la publication « par l'agent »
// refusée (l'agent est arrêté). EXÉCUTE la vraie route `api/ebay.js` (§4.10)
// contre un faux eBay (Trading) et une fausse base. Données inventées.
//   node scripts/bancs/ebay-photo-route.cjs
// On exige :
//   1. une photo JPEG ⇒ UN appel UploadSiteHostedPictures, en multipart (la
//      requête XML d'abord, puis les OCTETS exacts de la photo), et la route
//      rend l'adresse i.ebayimg.com lue dans <FullURL> ;
//   2. des octets qui ne sont pas une image ⇒ 400, eBay n'est PAS appelé ;
//   3. pas de photo, ou une photo trop lourde ⇒ 400, eBay pas appelé ;
//   4. eBay refuse (Ack Failure) ⇒ ok:false avec SON message, jamais d'adresse ;
//   5. eBay répond une adresse qui n'est pas chez eBay ⇒ ok:false (« pas su »
//      ne vaut pas « oui ») ;
//   6. `publish` avec `agent:true` (un ancien onglet) ⇒ 410, rien n'est créé
//      (aucun AddFixedPriceItem), même confirmé ;
//   7. la publication ordinaire, elle, part toujours (AddFixedPriceItem) avec
//      les adresses de photos dans l'ordre reçu ;
//   8. les règles pures (src/photosEbayAjout.js) : places (12 ajoutées, 24 en
//      tout), déplacement, photos ajoutées gardées au changement de paire.
// `--prouve` : réaffaiblit chaque règle (copie des modules) et exige le rouge.
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0banc-photo-inventee-octets'), Buffer.from([0xff, 0xd9])]);
let mode = 'ok';
const appels = [];
global.fetch = async (url, opts = {}) => {
  const u = String(url); const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: PROPRIO, email: 'p@exemple.test' }), { status: 200 });
  if (u.includes('identity/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 7200 }), { status: 200 });
  if (u.includes('/rest/v1/app_data')) {
    if (opts.method === 'POST') return new Response('', { status: 201 });
    return new Response(JSON.stringify([{ refresh_token: 'RT' }]), { status: 200 });
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '';
    appels.push({ nom, ct: h['Content-Type'] || '', corps: Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(String(opts.body || '')) });
    if (nom === 'UploadSiteHostedPictures') {
      if (mode === 'refus') return new Response('<?xml version="1.0"?><UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Image</ShortMessage><LongMessage>L\'image est trop petite (message inventé).</LongMessage><SeverityCode>Error</SeverityCode><ErrorClassification>RequestError</ErrorClassification></Errors></UploadSiteHostedPicturesResponse>', { status: 200 });
      const adr = mode === 'ailleurs' ? 'https://exemple.test/photo.jpg' : 'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/bancAAA/$_1.JPG?set_id=880000500F';
      return new Response(`<?xml version="1.0"?><UploadSiteHostedPicturesResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><SiteHostedPictureDetails><PictureName>VRM</PictureName><PictureSet>Supersize</PictureSet><FullURL>${adr}</FullURL></SiteHostedPictureDetails></UploadSiteHostedPicturesResponse>`, { status: 200 });
    }
    if (/^AddFixedPriceItem/.test(nom)) return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>110555000222</ItemID></r>', { status: 200 });
    return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></r>', { status: 200 });
  }
  return new Response('{}', { status: 200 });
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };

async function verifier(fRoute, fPur) {
  let ko = 0; const out = [];
  const dit = (c, m, d) => { if (!c) ko++; out.push((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const essaie = async (q, f) => { try { await f(); } catch (e) { dit(false, q + ' (a levé)', String((e && e.message) || e).slice(0, 160)); } };
  let mod = { default: async () => { throw new Error('route absente'); } }, P = {};
  try { mod = await import('file://' + fRoute + '?t=' + Math.random()); } catch (e) { dit(false, 'api/ebay.js se charge', String((e && e.message) || e).slice(0, 160)); }
  try { P = await import('file://' + fPur + '?t=' + Math.random()); } catch (e) { dit(false, 'src/photosEbayAjout.js se charge', String((e && e.message) || e).slice(0, 160)); }
  const handler = (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
  const nUpload = () => appels.filter((a) => a.nom === 'UploadSiteHostedPictures').length;

  await essaie('1', async () => {
    mode = 'ok'; appels.length = 0;
    const r = await handler({ action: 'photo', image: JPEG.toString('base64') });
    const a = appels.find((x) => x.nom === 'UploadSiteHostedPictures');
    dit(r.code === 200 && r.corps && r.corps.ok === true && /^https:\/\/i\.ebayimg\.com\//.test(r.corps.url || ''), '1. une photo JPEG ⇒ l\'adresse i.ebayimg.com lue dans <FullURL>', `HTTP ${r.code} ${r.corps && (r.corps.url || r.corps.error)}`);
    dit(nUpload() === 1 && /^multipart\/form-data; boundary=/.test(a && a.ct), '   UN appel UploadSiteHostedPictures, en multipart', a ? a.ct : 'aucun');
    const c = a ? a.corps : Buffer.alloc(0), iX = c.indexOf('<UploadSiteHostedPicturesRequest'), iO = c.indexOf(JPEG);
    dit(iX > 0 && iO > iX, '   la requête XML d\'abord, puis les octets EXACTS de la photo', `xml@${iX} octets@${iO}`);
  });
  await essaie('2', async () => {
    appels.length = 0;
    const r = await handler({ action: 'photo', image: Buffer.from('<html>pas une image</html>').toString('base64') });
    dit(r.code === 400 && r.corps && r.corps.ok === false && nUpload() === 0, '2. des octets qui ne sont pas une image ⇒ 400, eBay pas appelé', `HTTP ${r.code} appels=${nUpload()}`);
  });
  await essaie('3', async () => {
    appels.length = 0;
    const r1 = await handler({ action: 'photo' });
    const r2 = await handler({ action: 'photo', image: 'A'.repeat(3000004) });
    dit(r1.code === 400 && r2.code === 400 && nUpload() === 0, '3. sans photo, ou trop lourde ⇒ 400, eBay pas appelé', `HTTP ${r1.code}/${r2.code} appels=${nUpload()}`);
  });
  await essaie('4', async () => {
    mode = 'refus'; appels.length = 0;
    const r = await handler({ action: 'photo', image: JPEG.toString('base64') });
    dit(r.code >= 400 && r.corps && r.corps.ok === false && !r.corps.url && /trop petite/.test(r.corps.error || ''), '4. eBay refuse ⇒ ok:false avec SON message, aucune adresse', `HTTP ${r.code} ${r.corps && r.corps.error}`);
  });
  await essaie('5', async () => {
    mode = 'ailleurs'; appels.length = 0;
    const r = await handler({ action: 'photo', image: JPEG.toString('base64') });
    dit(r.code >= 400 && r.corps && r.corps.ok === false && !r.corps.url, '5. une adresse qui n\'est pas chez eBay n\'est jamais rendue comme un succès', `HTTP ${r.code} ${JSON.stringify(r.corps).slice(0, 120)}`);
  });
  const item = { title: 'Nike Air Max 1 bleu taille 44', categoryId: '15709', price: '68', quantity: 1, conditionId: '3000', photos: ['https://i.ebayimg.com/a/2.JPG', 'https://images1.vinted.net/t/1.jpg', 'https://i.ebayimg.com/a/3.JPG'], aspects: { Marque: 'Nike' } };
  await essaie('6', async () => {
    mode = 'ok'; appels.length = 0;
    const r = await handler({ action: 'publish', confirme: true, agent: true, item });
    dit(r.code === 410 && r.corps && r.corps.ok === false && r.corps.reason === 'agent-arrete' && !appels.some((a) => /AddFixedPriceItem/.test(a.nom)), '6. `publish` « par l\'agent » ⇒ 410, aucune annonce créée', `HTTP ${r.code} ${r.corps && r.corps.reason} appels=${appels.map((a) => a.nom).join(',')}`);
  });
  await essaie('7', async () => {
    mode = 'ok'; appels.length = 0;
    const r = await handler({ action: 'publish', confirme: true, item });
    const a = appels.find((x) => x.nom === 'AddFixedPriceItem');
    const pics = a ? [...a.corps.toString('utf8').matchAll(/<PictureURL>([^<]*)<\/PictureURL>/g)].map((m) => m[1]) : [];
    dit(r.code === 200 && r.corps && r.corps.ok === true, '7. la publication ordinaire part toujours', `HTTP ${r.code}`);
    dit(JSON.stringify(pics) === JSON.stringify(item.photos), '   avec les photos dans l\'ordre reçu, ajoutées comprises', pics.join(' '));
  });
  await essaie('8', async () => {
    const e = (n) => Array.from({ length: n }, (_, i) => `https://i.ebayimg.com/x/${i}.JPG`), v = (n) => Array.from({ length: n }, (_, i) => `https://images1.vinted.net/t/${i}.jpg`);
    dit(P.placesPhotos(v(3), 0) === 12 && P.placesPhotos([...v(3), ...e(10)], 2) === 0 && P.placesPhotos([...v(3), ...e(10)], 1) === 1, '8. 12 photos ajoutées au plus (en comptant celles en envoi)', `${P.placesPhotos(v(3), 0)} ${P.placesPhotos([...v(3), ...e(10)], 2)} ${P.placesPhotos([...v(3), ...e(10)], 1)}`);
    dit(P.placesPhotos(v(20), 0) === 4 && P.placesPhotos([...v(20), ...e(4)], 0) === 0, '   24 en tout (la borne d\'eBay)', `${P.placesPhotos(v(20), 0)} ${P.placesPhotos([...v(20), ...e(4)], 0)}`);
    dit(JSON.stringify(P.deplacerPhoto(['a', 'b', 'c'], 2, -1)) === '["a","c","b"]' && JSON.stringify(P.deplacerPhoto(['a', 'b', 'c'], 0, -1)) === '["a","b","c"]' && JSON.stringify(P.deplacerPhoto(['a', 'b', 'c'], 0, 1)) === '["b","a","c"]', '   ‹ › déplace d\'un cran, jamais hors de la liste');
    const g = P.avecPhotosAjoutees(['https://images1.vinted.net/t/9.jpg'], ['https://images1.vinted.net/t/1.jpg', 'https://i.ebayimg.com/x/1.JPG', 'https://i.ebayimg.com/x/1.JPG']);
    dit(JSON.stringify(g) === '["https://images1.vinted.net/t/9.jpg","https://i.ebayimg.com/x/1.JPG"]', '   choisir une autre paire garde les photos ajoutées (une fois), pas les photos Vinted d\'avant', JSON.stringify(g));
    dit(P.estPhotoAjoutee('https://i.ebayimg.com/x/1.JPG') && !P.estPhotoAjoutee('https://i.ebayimg.com.exemple.test/x.jpg') && !P.estPhotoAjoutee('http://i.ebayimg.com/x.jpg'), '   une photo hébergée chez eBay se reconnaît à son adresse https://i.ebayimg.com/ seulement');
  });
  return { ko, out };
}

const MUTATIONS = {
  'pas-une-image': ['api/_lib/ebay-photo.js', "  if (!estUneImage(buf)) return { err:", "  if (false) return { err:"],
  'adresse-ailleurs': ['api/_lib/ebay-photo.js', '  return URL_PHOTO_EBAY.test(u) ? u : \'\';', '  return u;'],
  'xml-apres': ['api/_lib/ebay-photo.js', 'return Buffer.concat([Buffer.from(avant, \'utf8\'), octets, Buffer.from(apres, \'utf8\')]);', 'return Buffer.concat([Buffer.from(avant.split(\'<?xml\')[0], \'utf8\'), octets, Buffer.from(apres, \'utf8\')]);'],
  'agent-publie': ['api/ebay.js', "    if (action === 'publish' && b.agent === true) {", "    if (action === 'publish' && b.agent === 'jamais') {"],
  'places-12': ['src/photosEbayAjout.js', 'PHOTOS_AJOUT_MAX - ajoutees', 'PHOTOS_AJOUT_MAX + 99 - ajoutees'],
  'places-24': ['src/photosEbayAjout.js', 'PHOTOS_EBAY_MAX - total', '99 - total'],
  'deplacer-hors': ['src/photosEbayAjout.js', ' || j < 0 || j >= l.length) return l;', ') return l;'],
  'ajoutees-perdues': ['src/photosEbayAjout.js', "...(anciennes || []).filter(estPhotoAjoutee)", '...[]'],
};

(async () => {
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(path.join(RACINE, 'api', 'ebay.js'), path.join(RACINE, 'src', 'photosEbayAjout.js'));
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  // Une copie de api/ et src/ par mutation (les imports relatifs restent vrais).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-photo-'));
  let rates = 0;
  for (const [nom, [rel, de, vers]] of Object.entries(MUTATIONS)) {
    const d = path.join(tmp, nom);
    fs.cpSync(path.join(RACINE, 'api'), path.join(d, 'api'), { recursive: true });
    fs.cpSync(path.join(RACINE, 'src'), path.join(d, 'src'), { recursive: true });
    fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules'));
    fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
    const f = path.join(d, rel), src = fs.readFileSync(f, 'utf8');
    if (!src.includes(de)) { console.log(`?? ${nom} : ancre introuvable`); rates++; continue; }
    fs.writeFileSync(f, src.replace(de, vers));
    const { ko } = await verifier(path.join(d, 'api', 'ebay.js'), path.join(d, 'src', 'photosEbayAjout.js'));
    console.log(`${ko ? 'ROUGE' : 'VERT (mutation non attrapée)'}  ${nom} — ${ko} contrôle(s) au rouge`);
    if (!ko) rates++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${Object.keys(MUTATIONS).length - rates}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
