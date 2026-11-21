// Exporte le logo complet VRM dans toutes les tailles sans déformer ses lettres.
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const root = path.join(__dirname, '..');
(async () => {
  const { data, info } = await sharp(path.join(root, 'public/vrm-wordmark-v3.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  const blanc = await sharp(data, { raw: info }).png().toBuffer();
  const formats = [['vrm-logo-v4-96.png',96,.88],['vrm-logo-v4-192.png',192,.88],['vrm-icon-v4-192.png',192,.88],['vrm-icon-v4-512.png',512,.88],['vrm-apple-touch-icon-v4.png',180,.88],['vrm-maskable-v4-512.png',512,.76]];
  for (const [file, size, largeur] of formats) {
    const logo = await sharp(blanc).resize({width:Math.round(size*largeur)}).png().toBuffer();
    await sharp({create:{width:size,height:size,channels:4,background:'#21343e'}}).composite([{input:logo,gravity:'centre'}]).png().toFile(path.join(root,'public',file));
  }
  // Les anciennes adresses restent valides, mais servent toutes les trois lettres.
  for (const f of fs.readdirSync(path.join(root,'public'))) {
    if (!/^(?:vrm-(?:logo|icon|maskable|apple-touch-icon)|logo-vrm|icon(?:-maskable)?|apple-touch-icon).*\.png$/.test(f) || /-v4(?:-|\.png$)/.test(f)) continue;
    const source = f.includes('maskable') ? 'vrm-maskable-v4-512.png' : f.includes('apple') ? 'vrm-apple-touch-icon-v4.png' : f.includes('512') ? 'vrm-icon-v4-512.png' : f.includes('96') ? 'vrm-logo-v4-96.png' : 'vrm-logo-v4-192.png';
    fs.copyFileSync(path.join(root,'public',source),path.join(root,'public',f));
  }
  for (const size of [16,32,48,128]) await sharp(path.join(root,'public/vrm-icon-v4-512.png')).resize(size,size).toFile(path.join(root,`vinted-sync-extension/icon-${size}.png`));
  for (const f of ['logo-vrm.png','logo-vrm-96.png']) fs.copyFileSync(path.join(root,'public',f.includes('96')?'vrm-logo-v4-96.png':'vrm-logo-v4-192.png'),path.join(root,'vinted-sync-extension',f));
})().catch(e=>{console.error(e);process.exitCode=1;});
