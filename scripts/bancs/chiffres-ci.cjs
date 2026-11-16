// Branche de MESURE seulement (jamais fusionnée) : relève les chiffres à 20 000 ventes et les imprime (gzip+base64).
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const zlib = require('zlib');
const out = path.join(require('os').tmpdir(), 'chiffres.json');
try { execFileSync(process.execPath, [path.join(__dirname, 'chiffres-volume.cjs'), path.join(__dirname, '..', '..', 'dist'), out, String(Number(process.env.BANC_PORT) || 9660)], { env: { ...process.env, VENTES: '20000' }, stdio: 'inherit', timeout: 1500000 }); } catch (e) { console.log('KO chiffres-volume a échoué'); process.exit(1); }
const b = zlib.gzipSync(fs.readFileSync(out)).toString('base64');
for (let i = 0; i < b.length; i += 4000) console.log('CHIFFRES_JSON ' + b.slice(i, i + 4000));
console.log('✅ chiffres relevés');
