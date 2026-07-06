const { chromium } = require('playwright');
const fs = require('fs');
const dir = '/home/user/cancale-v67/public';
// Icône : tuile teal arrondie + monogramme "C" blanc. Padding pour le maskable.
const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0a8f9c"/><stop offset="1" stop-color="#006670"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" fill="#007782"/>
  <rect x="${pad}" y="${pad}" width="${size-2*pad}" height="${size-2*pad}" rx="${size*0.16}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
    font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="${size*0.56}" fill="#ffffff">C</text>
</svg>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  const shots = [
    { name: 'icon-192.png', size: 192, pad: 0 },
    { name: 'icon-512.png', size: 512, pad: 0 },
    { name: 'icon-maskable-512.png', size: 512, pad: 52 },
    { name: 'apple-touch-icon.png', size: 180, pad: 0 },
  ];
  for (const s of shots) {
    await p.setViewportSize({ width: s.size, height: s.size });
    await p.setContent(svg(s.size, s.pad), { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${dir}/${s.name}`, omitBackground: false, clip: { x:0, y:0, width:s.size, height:s.size } });
    console.log('wrote', s.name);
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
