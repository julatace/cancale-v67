// Branche de MESURE seulement (jamais fusionnée) : relève les chiffres à 20 000 ventes, imprime une empreinte par relevé.
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const out = path.join(require('os').tmpdir(), 'chiffres.json');
try { execFileSync(process.execPath, [path.join(__dirname, 'chiffres-volume.cjs'), path.join(__dirname, '..', '..', 'dist'), out, String(Number(process.env.BANC_PORT) || 9660)], { env: { ...process.env, VENTES: '20000' }, stdio: 'inherit', timeout: 1500000 }); } catch (e) { console.log('KO chiffres-volume a échoué'); process.exit(1); }
const R = JSON.parse(fs.readFileSync(out, 'utf8'));
const h = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
for (const [t, e] of Object.entries(R.ecrans)) for (const k of ['montants', 'comptes', 'attrs']) { const v = (e[k] || []).filter((x) => !/^data-photos-perdues=/.test(x)).map((x) => { const n = Number(String(x).split('=')[1]); return n > 1.6e12 && n < 2.2e12 ? String(x).split('=')[0] + '=·ms·' : x; }); console.log(`EMPREINTE ${t}.${k} ${v.length} ${h(v)}${k !== 'attrs' ? ' ' + JSON.stringify(v).slice(0, 300) : ''}`); }
for (const [k, v] of Object.entries(R.publie)) console.log(`EMPREINTE publie.${k} ${h(v)}`);
console.log(`EMPREINTE erreurs ${(R.erreurs || []).length}`);
console.log('✅ chiffres relevés');
