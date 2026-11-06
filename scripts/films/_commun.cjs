// ════════════════════════════════════════════════════════════════════════════
//  FILMS DE MOTION DESIGN TOURNÉS DANS LA VRAIE APP (6 nov.)
//  Julien : « tu dois faire de vrai motion design avec les vrais visuels ».
//
//  Le module commun : le plateau (cadre d'iPhone dessiné, caméra, titres mot par
//  mot, indicateur de toucher), la fausse base qui sert la VRAIE forme
//  (`app_data` clé-valeur, `select=` projeté, `meta->>`, `Range`), et le
//  tournage image par image.
//
//  Comment ça tourne :
//   · la vraie app construite (`dist/`) est chargée dans un <iframe> de 390 px
//     posé dans un iPhone dessiné en CSS ; la caméra est une transformation du
//     plateau, rendue par le navigateur à chaque image (texte net à tout zoom) ;
//   · le TEMPS est tenu : l'horloge de la page est figée (Playwright `clock`) et
//     avance de 1/60 s par image ; les animations CSS de l'app (feuilles, cases
//     qui s'allument) sont mises en pause et avancées du même pas (Web
//     Animations). Une image ne dépend donc pas de la vitesse de la machine ;
//   · chaque image est capturée (CDP) et poussée dans ffmpeg (H.264, yuv420p).
//  Les gestes sont de VRAIS touchers dans l'app (les feuilles s'ouvrent pour de
//  vrai) ; le cercle qu'on voit n'est que leur indicateur.
//
//  Données : INVENTÉES (voir `_monde.cjs`), jamais celles de Julien.
//  Les vidéos sortent HORS du dépôt (`FILMS_SORTIE`, défaut : le dossier
//  `films/` du scratchpad de la session, ou /tmp/vrm-films).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { servir } = require(path.join(RACINE, 'scripts', 'bancs', '_minipgrest.cjs'));
const { metaVersData, fichesDePage } = require(path.join(RACINE, 'scripts', 'bancs', '_meta.cjs'));
const { photoSvg } = require('./_photos.cjs');

const DIST = process.env.FILMS_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.FILMS_PORT) || 9811;
const IPS = Number(process.env.IPS) || 60;
const SORTIE = process.env.FILMS_SORTIE || '/tmp/vrm-films';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// ── LES COURBES ─────────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const EASE = {
  lin: (x) => x,
  // ease-in-out « Apple » (cubic-bezier .65,0,.35,1 approché) : départ et arrivée doux.
  doux: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sortie: (x) => 1 - Math.pow(1 - x, 3),
  entree: (x) => x * x * x,
  // ressort sobre (amorti critique, à peine un dépassement de 2 %).
  ressort: (x) => { if (x >= 1) return 1; const w = 9, z = 0.82; return 1 - Math.exp(-z * w * x) * Math.cos(w * Math.sqrt(1 - z * z) * x) * (1 - x * 0.2); },
};
const lerp = (a, b, k) => a + (b - a) * k;

// ── LE PLATEAU ──────────────────────────────────────────────────────────────
// Deux formats. Les mesures sont en px CSS ; l'image sort ×2 (deviceScaleFactor).
const FORMATS = {
  portrait: { w: 540, h: 960, tel: { x: 270, y: 572, s: 0.86 }, titres: 'haut' },
  paysage: { w: 960, h: 540, tel: { x: 690, y: 270, s: 0.565 }, titres: 'gauche' },
};
// L'iPhone dessiné : 414 × 868, écran 390 × 844 posé à (12, 12).
const TEL = { W: 414, H: 868, BORD: 12, EW: 390, EH: 844, BARRE: 47, BAS: 20 };

const SCENE_HTML = (fmt) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=${FORMATS[fmt].w}">
<style>
:root{--encre:#1d1d1f;--fond:#f5f5f7;--bleu:#0071E3;--gris:#6e6e73}
html,body{margin:0;width:${FORMATS[fmt].w}px;height:${FORMATS[fmt].h}px;overflow:hidden;background:var(--fond);
  font-family:'Inter Display','Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;color:var(--encre);
  -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
#fond{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 100%,#e9e9ee 0%,#f5f5f7 55%,#fbfbfd 100%)}
#monde{position:absolute;left:0;top:0;width:${TEL.W}px;height:${TEL.H}px;transform-origin:0 0}
.tel{position:absolute;inset:0;border-radius:68px;background:linear-gradient(145deg,#3a3a3c,#1c1c1e 40%,#2c2c2e);
  box-shadow:0 0 0 1.5px #0b0b0c inset,0 0 0 3px #48484a inset,0 40px 80px -30px rgba(0,0,0,.45),0 18px 36px -18px rgba(0,0,0,.35)}
.tel::before,.tel::after{content:"";position:absolute;width:4px;border-radius:2px;background:#2c2c2e}
.tel::before{left:-3px;top:170px;height:62px;box-shadow:0 80px 0 #2c2c2e}
.tel::after{right:-3px;top:230px;height:96px}
.ecran{position:absolute;left:${TEL.BORD}px;top:${TEL.BORD}px;width:${TEL.EW}px;height:${TEL.EH}px;border-radius:56px;overflow:hidden;background:#fff;isolation:isolate}
.barre{position:absolute;left:0;top:0;width:100%;height:${TEL.BARRE}px;display:flex;align-items:center;justify-content:space-between;padding:0 34px 0 46px;box-sizing:border-box;
  font:600 16px/1 'Inter',-apple-system,sans-serif;letter-spacing:-.01em;z-index:3}
.ile{position:absolute;left:50%;top:11px;width:122px;height:35px;margin-left:-61px;border-radius:20px;background:#000;z-index:4}
.icones{display:flex;gap:6px;align-items:center}
iframe{position:absolute;left:0;top:${TEL.BARRE}px;width:${TEL.EW}px;height:${TEL.EH - TEL.BARRE - TEL.BAS}px;border:0;display:block;background:#fff}
.bas{position:absolute;left:0;bottom:0;width:100%;height:${TEL.BAS}px;z-index:3}
.bas i{position:absolute;left:50%;bottom:7px;width:136px;height:5px;margin-left:-68px;border-radius:3px;background:#111}
#toucher{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;z-index:9;opacity:0;
  background:rgba(29,29,31,.16);box-shadow:0 0 0 2px rgba(255,255,255,.95),0 2px 10px rgba(0,0,0,.18)}
#onde{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;z-index:9;opacity:0;border:2px solid rgba(29,29,31,.35)}
#titres{position:absolute;inset:0;pointer-events:none;z-index:20}
.voile{position:absolute;left:0;right:0;top:0;height:${fmt === 'portrait' ? 300 : 0}px;background:linear-gradient(to bottom,rgba(245,245,247,.98) 0%,rgba(245,245,247,.96) 62%,rgba(245,245,247,0) 100%);opacity:0}
.bloc{position:absolute;${fmt === 'portrait' ? 'left:30px;right:30px;top:58px;text-align:center' : 'left:64px;width:470px;top:50%;transform:translateY(-50%);text-align:left'}}
.bloc.bas{${fmt === 'portrait' ? 'top:auto;bottom:70px' : ''}}
.bloc.centre{${fmt === 'portrait' ? 'top:50%;transform:translateY(-50%)' : 'left:0;width:100%;text-align:center'}}
.t{text-wrap:balance;font-weight:700;letter-spacing:-.025em;line-height:1.08;font-size:${fmt === 'portrait' ? 38 : 48}px;margin:0}
.s{text-wrap:balance;font-family:'Inter',-apple-system,sans-serif;font-weight:500;letter-spacing:-.01em;line-height:1.35;color:var(--gris);font-size:${fmt === 'portrait' ? 18 : 21}px;margin:${fmt === 'portrait' ? 14 : 18}px 0 0}
.m{display:inline-block;white-space:pre}
.bleu{color:var(--bleu)}
#fin{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${fmt === 'portrait' ? 22 : 18}px;opacity:0;z-index:30;pointer-events:none}
#fin img{width:${fmt === 'portrait' ? 112 : 96}px;height:${fmt === 'portrait' ? 112 : 96}px;border-radius:26%;box-shadow:0 18px 40px -16px rgba(0,0,0,.35)}
#fin .url{font-weight:700;letter-spacing:-.03em;font-size:${fmt === 'portrait' ? 52 : 56}px}
#fin .phrase{font-family:'Inter',sans-serif;font-weight:500;color:var(--gris);font-size:${fmt === 'portrait' ? 20 : 21}px;letter-spacing:-.01em;text-align:center;max-width:440px;line-height:1.35}
</style></head><body>
<div id="fond"></div>
<div id="monde"><div class="tel"><div class="ecran" id="ecran">
  <div class="barre" id="barre"><span id="heure">9:41</span><span class="icones">
    <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .9 10.2 10.2 0 0 0 .9 3.8L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.1-1.2A7 7 0 0 0 8 4.3a7 7 0 0 0-4.7 1.9l1.1 1.2C5.4 6.5 6.6 6 8 6Zm0 3.3c.6 0 1.1.2 1.5.6L8 11.5 6.5 9.9c.4-.4.9-.6 1.5-.6Z" fill="currentColor"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><path d="M24.5 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".45"/></svg>
  </span></div>
  <div class="ile"></div>
  <iframe id="app" title="VRM"></iframe>
  <div class="bas" id="basbarre"><i></i></div>
  <div id="toucher"></div><div id="onde"></div>
</div></div></div>
<div id="titres"><div class="voile" id="voile"></div></div>
<div id="fin"><img src="/vrm-logo-v4-192.png" alt=""><div class="url">vrm.center</div><div class="phrase" id="finphrase"></div></div>
<script>
const W=${FORMATS[fmt].w},H=${FORMATS[fmt].h};
const blocs={};
// Un état complet par image : rien ne dépend de l'image d'avant.
window.__appliquer=(e)=>{
  const m=document.getElementById('monde');
  m.style.transform='translate('+e.tx.toFixed(3)+'px,'+e.ty.toFixed(3)+'px) scale('+e.s.toFixed(5)+')';
  m.style.opacity=e.telOpacite;
  document.getElementById('voile').style.opacity=e.voile;
  const tc=document.getElementById('toucher'),on=document.getElementById('onde');
  if(e.toucher){tc.style.left=e.toucher.x+'px';tc.style.top=e.toucher.y+'px';tc.style.opacity=e.toucher.o;tc.style.transform='scale('+e.toucher.k+')';
    on.style.left=e.toucher.x+'px';on.style.top=e.toucher.y+'px';on.style.opacity=e.toucher.oo;on.style.transform='scale('+e.toucher.kk+')';}
  else{tc.style.opacity=0;on.style.opacity=0;}
  const vus=new Set();
  for(const t of e.titres){
    vus.add(t.id);
    let b=blocs[t.id];
    if(!b){
      b=document.createElement('div');b.className='bloc '+(t.pos||'');
      const mots=(txt,cls)=>{const p=document.createElement('p');p.className=cls;
        txt.split(/(\\s+)/).forEach(w=>{if(!w)return;if(/^\\s+$/.test(w)){p.appendChild(document.createTextNode(' '));return;}
          const s=document.createElement('span');s.className='m';
          const mb=/^\\*(.+)\\*([.,;:!?…]*)$/.exec(w);
          if(mb){const b=document.createElement('span');b.className='bleu';b.textContent=mb[1];s.appendChild(b);if(mb[2])s.appendChild(document.createTextNode(mb[2]));}
          else s.textContent=w;p.appendChild(s);});
        return p;};
      b.appendChild(mots(t.texte,'t'));if(t.sous)b.appendChild(mots(t.sous,'s'));
      document.getElementById('titres').appendChild(b);blocs[t.id]=b;
    }
    const spans=[...b.querySelectorAll('.t .m')],sous=[...b.querySelectorAll('.s .m')];
    const ent=(k)=>{const x=Math.max(0,Math.min(1,k));return 1-Math.pow(1-x,3);};
    spans.forEach((s,i)=>{const k=ent((t.age-i*0.06)/0.42);s.style.opacity=k;s.style.transform='translateY('+((1-k)*16).toFixed(2)+'px)';s.style.filter=k<1?'blur('+((1-k)*6).toFixed(2)+'px)':'none';});
    const d0=spans.length*0.06+0.12;
    sous.forEach((s,i)=>{const k=ent((t.age-d0-i*0.025)/0.4);s.style.opacity=k;s.style.transform='translateY('+((1-k)*8).toFixed(2)+'px)';});
    const so=Math.max(0,Math.min(1,t.restant/0.28));
    b.style.opacity=so;
    const base=(t.pos==='centre'&&W<H)||(W>H&&t.pos!=='centre')?'translateY(-50%) ':'';
    b.style.transform=base+'translateY('+((so-1)*10).toFixed(2)+'px)';
  }
  for(const id in blocs) if(!vus.has(id)){blocs[id].remove();delete blocs[id];}
  const f=document.getElementById('fin');f.style.opacity=e.fin;f.style.transform='scale('+(0.96+0.04*e.fin)+')';
  if(e.finPhrase!=null)document.getElementById('finphrase').textContent=e.finPhrase;
};
window.__teinte=(haut,bas,sombre,sombreBas)=>{
  const b=document.getElementById('barre');b.style.background=haut;b.style.color=sombre?'#fff':'#000';
  document.getElementById('basbarre').style.background=bas;
  document.querySelector('.bas i').style.background=sombreBas?'#fff':'#111';
  document.getElementById('ecran').style.background=haut;
};
</script></body></html>`;

// ── LE SERVEUR : dist/ + le plateau ─────────────────────────────────────────
let serveur = null;
function demarrerServeur() {
  if (serveur) return Promise.resolve(serveur);
  return new Promise((ok, ko) => {
    const s = http.createServer((q, r) => {
      const u = q.url.split('?')[0];
      const fm = /^\/__film\/scene-(portrait|paysage)\.html$/.exec(u);
      if (fm) { r.writeHead(200, { 'content-type': MIME['.html'] }); return r.end(SCENE_HTML(fm[1])); }
      if (u === '/__film/pdfjs/pdf.worker.min.js') { const d = pdfjsDossier(); if (d) { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(fs.readFileSync(path.join(d, 'package', 'build', 'pdf.worker.min.js'))); } }
      let f = decodeURIComponent(u); if (f === '/' || !path.extname(f)) f = '/index.html';
      const p = path.join(DIST, f);
      if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
    });
    s.on('error', ko);
    s.listen(PORT, '127.0.0.1', () => { serveur = s; ok(s); });
  });
}

// pdf.js : l'app le charge de cdn.jsdelivr.net (version figée 3.11.174). Le
// tournage n'a pas Internet ; on sert la MÊME version, tirée une fois du
// registre npm dans le dossier de sortie (jamais dans le dépôt).
function pdfjsDossier() {
  const d = path.join(SORTIE, '.pdfjs-3.11.174');
  if (fs.existsSync(path.join(d, 'package', 'build', 'pdf.min.js'))) return d;
  try {
    fs.mkdirSync(d, { recursive: true });
    execFileSync('npm', ['pack', 'pdfjs-dist@3.11.174', '--silent'], { cwd: d, stdio: 'ignore' });
    execFileSync('tar', ['-xzf', 'pdfjs-dist-3.11.174.tgz', 'package/build/pdf.min.js', 'package/build/pdf.worker.min.js'], { cwd: d });
    return d;
  } catch (_) { return null; }
}

const POSE_WORKER = ";(function(){var G=window.pdfjsLib&&window.pdfjsLib.GlobalWorkerOptions;if(!G)return;var v='';"
  + "Object.defineProperty(G,'workerSrc',{configurable:true,get:function(){return v},set:function(x){"
  + "v=String(x).split('/build/').pop();v=location.origin+'/__film/pdfjs/'+v;}});})();";

// ── LA FAUSSE BASE (forme réelle) ───────────────────────────────────────────
// `monde` : { uid, email, lignes:[{id,data}], comptes:[…], api:(url,méthode,corps)=>réponse|undefined }
async function servirBase(ctx, monde) {
  const UID = monde.uid;
  const lignes = () => monde.lignes.map((r) => ({ id: r.id, data: r.data, owner: UID, updated_at: r.updated_at || monde.maintenant }));
  // Rien ne sort vers Internet : seules les photos (servies ici, dessinées) passent.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/i, (route) => {
    const u = route.request().url();
    const pj = /cdn\.jsdelivr\.net\/npm\/pdfjs-dist@3\.11\.174\/build\/(pdf(?:\.worker)?\.min\.js)$/.exec(u);
    if (pj) {
      const d = pdfjsDossier();
      if (d) {
        let corps = fs.readFileSync(path.join(d, 'package', 'build', pj[1]));
        // Un Worker ne peut pas venir d'une autre origine sans réseau : le même
        // fichier est servi par le tournage, à l'origine de l'app.
        if (pj[1] === 'pdf.min.js') corps = Buffer.concat([corps, Buffer.from(POSE_WORKER)]);
        return route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: corps });
      }
    }
    const ph = /images1\.vinted\.net\/t\/(?:[^?#]*\/)?([^/?#]+)$/.exec(u.split(/[?#]/)[0]);
    if (ph) return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*', 'cache-control': 'max-age=3600' }, body: photoSvg(ph[1]) });
    if (/\/auth\/v1\//.test(u)) {
      const user = { id: UID, email: monde.email, aud: 'authenticated', role: 'authenticated', factors: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/\/auth\/v1\/user/.test(u) ? user : { access_token: monde.jeton, refresh_token: 'r', expires_in: 86400, token_type: 'bearer', user }) });
    }
    if (/\/rest\/v1\//.test(u)) {
      const req = route.request(), m = req.method();
      const url = decodeURIComponent(metaVersData(u));
      const json = (d, st = 200, range) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': range || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
      if (m === 'OPTIONS') return json({});
      if (/\/rest\/v1\/rpc\//.test(url)) return json(monde.rpc ? monde.rpc(url) : null);
      if (/\/rest\/v1\/vinted_accounts/.test(url)) return json(m === 'GET' ? monde.comptes.map((c) => ({ ...c, owner: UID })) : []);
      if (/\/rest\/v1\/vinted_account_emails/.test(url)) return json(m === 'GET' ? (monde.comptesEmails || []) : []);
      if (!/\/rest\/v1\/app_data/.test(url)) return json([]);
      if (m === 'POST' || m === 'PATCH') {
        // Les écritures de l'app restent dans la base du tournage (en mémoire).
        try {
          const b = JSON.parse(req.postData() || 'null');
          const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
          const eqm = /[?&]id=eq\.([^&]*)/.exec(url);
          if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
          for (const r of rows) { if (!r || !r.id || r.data === undefined) continue; const i = monde.lignes.findIndex((x) => x.id === r.id); if (i >= 0) monde.lignes[i] = { ...monde.lignes[i], data: r.data }; else monde.lignes.push({ id: r.id, data: r.data }); }
        } catch (_) {}
        return json(m === 'PATCH' ? [{ id: 'main' }] : [], m === 'POST' ? 201 : 200);
      }
      if (m === 'DELETE') return json([]);
      if (/id=eq\.vinted_item_details/.test(url) && /select=/.test(url)) {
        const r = monde.lignes.find((x) => x.id === 'vinted_item_details');
        return json(fichesDePage(url, r ? r.data : {}));
      }
      const hd = req.headers();
      const sansOwner = url.replace(/([?&]select=)owner,/, '$1').replace(/[?&]owner=eq\.[^&]*/, '');
      const { body, range } = servir(lignes(), sansOwner, hd);
      const sel = (/[?&]select=([^&]*)/.exec(url) || [])[1] || '';
      const corps = /(^|,)owner(,|$)/.test(sel) ? body.map((o) => ({ ...o, owner: UID })) : body;
      return json(corps, 200, range);
    }
    return route.abort();
  });
  await ctx.route('**/api/**', (route) => {
    const req = route.request(), u = req.url();
    if (/mode=confidentialite/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: UID }) });
    const r = monde.api ? monde.api(u, req.method(), req.postData()) : undefined;
    if (r !== undefined) return route.fulfill({ status: r.status || 200, contentType: r.type || 'application/json', body: typeof r.body === 'string' || Buffer.isBuffer(r.body) ? r.body : JSON.stringify(r.body == null ? {} : r.body) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

// ── LE TOURNAGE ─────────────────────────────────────────────────────────────
class Film {
  constructor({ nom, format = 'portrait', monde, tab = 'journee', sombre = false, local = {}, finPhrase = '' }) {
    Object.assign(this, { nom, format, monde, tab, sombre, local, finPhrase });
    this.F = FORMATS[format];
    this.t = 0; this.i = 0;
    this.titres = []; this.cles = [];
    const s0 = this.F.tel.s;
    this.repos = { fx: TEL.EW / 2, fy: TEL.EH / 2, s: s0, ax: this.F.tel.x, ay: this.F.tel.y };
    this.camEtat = { ...this.repos };
    this.camTween = null;
    this.toucherEtat = null;
    this.telOpacite = 1; this.telY = 0; this.finK = 0;
    this.anims = [];
    this.erreurs = [];
  }
  async demarrer(nav) {
    await demarrerServeur();
    const { w, h } = this.F;
    this.ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: this.sombre ? 'dark' : 'light', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
    await this.ctx.clock.install({ time: new Date(this.monde.maintenant) });
    await servirBase(this.ctx, this.monde);
    const session = { access_token: this.monde.jeton, refresh_token: 'r', expires_at: Date.parse(this.monde.maintenant) + 864e5, user: { id: this.monde.uid, email: this.monde.email } };
    await this.ctx.addInitScript(([s, sombre, local]) => {
      try {
        if (location.pathname.indexOf('/__film/') === 0) return;
        if (!sessionStorage.getItem('film_init')) {
          localStorage.setItem('vrm_session', JSON.stringify(s));
          localStorage.setItem('vrm_local_owner', s.user.id);
          localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
          localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'film' }));
          localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'film' }));
          for (const k in local) localStorage.setItem(k, typeof local[k] === 'string' ? local[k] : JSON.stringify(local[k]));
          sessionStorage.setItem('film_init', '1');
        }
        // Trouver une cible : un sélecteur CSS, « texte:Mots » (le plus petit élément
        // visible qui porte ces mots) ou « haut:sel » (l'ancêtre « carte » de sel).
        window.__filmQ = (sel) => {
          const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
          if (sel.startsWith('texte:')) { const t = sel.slice(6); let best = null; for (const e of document.querySelectorAll('body *')) { if (!vis(e) || !(e.innerText || '').includes(t)) continue; if (!best || best.contains(e)) best = e; } return best; }
          const m = /^(\d+)@(.+)$/.exec(sel); if (m) return [...document.querySelectorAll(m[2])].filter(vis)[+m[1]] || null;
          return document.querySelector(sel);
        };
        // La police : sur iPhone l'app s'affiche en SF Pro (police système) ;
        // ici, Linux n'a pas SF Pro : Inter, sa plus proche parente, la remplace.
        const st = document.createElement('style');
        st.textContent = "html:root,html:root body{--vrm-police:'Inter',-apple-system,BlinkMacSystemFont,sans-serif !important}*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}";
        (document.head || document.documentElement).appendChild(st);
      } catch (_) {}
    }, [session, this.sombre, this.local]);
    this.pg = await this.ctx.newPage();
    this.pg.on('pageerror', (e) => this.erreurs.push(String(e.message || e).slice(0, 200)));
    this.cdp = await this.ctx.newCDPSession(this.pg);
    await this.pg.goto(`http://127.0.0.1:${PORT}/__film/scene-${this.format}.html`, { waitUntil: 'load' });
    await this.pg.evaluate(() => document.fonts.ready);
    // `tab` peut être une liste : les premiers écrans s'ouvrent avant le tournage
    // (ils publient ce que lit le dernier, comme dans la vraie vie).
    const tabs = Array.isArray(this.tab) ? this.tab : [this.tab];
    for (const t of tabs) await this.ouvrir(t);
    this.tab = tabs[tabs.length - 1];
  }
  get app() { return this._app || this.pg.frames().find((f) => f !== this.pg.mainFrame()); }
  async ouvrir(tab) {
    await this.pg.evaluate((src) => { document.getElementById('app').src = src; }, `/?tab=${tab}`);
    await this.pg.waitForFunction(() => { const f = document.getElementById('app'); const d = f && f.contentDocument; return d && d.querySelector('.vrm-main'); }, null, { timeout: 30000 });
    await this.pg.waitForTimeout(2500);
    this._app = await (await this.pg.$('#app')).contentFrame();
    await this.teinte();
  }
  // UNE COUPE : la base change (le temps a passé dans l'histoire), une seconde app
  // se charge derrière la première, puis le fondu enchaîné. L'horloge avance
  // pendant le chargement sans qu'aucune image ne soit tournée.
  async coupe(modifier, { tab, fondu = 0.5, attente = 2.5, oublier = false } = {}) {
    // 1. L'image de l'app est figée (une capture posée par-dessus, dans l'écran) et
    //    l'ancienne app est ARRÊTÉE : deux apps vivantes sur le même stockage se
    //    réécrivaient l'une l'autre (la case libérée revenait).
    const png = await (await this.pg.$('#app')).screenshot({ type: 'png' });
    await this.pg.evaluate((b64) => {
      const f = document.getElementById('app'); const im = document.createElement('img');
      im.id = 'gel'; im.src = 'data:image/png;base64,' + b64;
      im.style.cssText = `position:absolute;left:${f.offsetLeft}px;top:${f.offsetTop}px;width:${f.offsetWidth}px;height:${f.offsetHeight}px;z-index:2`;
      f.after(im); f.src = 'about:blank';
    }, png.toString('base64'));
    await this.pg.waitForTimeout(200);
    if (modifier) modifier(this.monde);
    // Un autre jour : l'appareil n'a gardé que la session (le reste se relit dans la base).
    if (oublier) await this.pg.evaluate(() => { const garder = ['vrm_session', 'vrm_local_owner', 'vinted_dark', 'vrm_bienvenue_vue', 'vrm_visite_vue']; for (const k of Object.keys(localStorage)) if (!garder.includes(k)) localStorage.removeItem(k); });
    // 2. La nouvelle app se charge dessous (les premiers écrans d'une liste publient).
    const tabs = Array.isArray(tab) ? tab : [tab || this.tab];
    for (const t of tabs) {
      await this.pg.evaluate((src) => { document.getElementById('app').src = src; }, `/?tab=${t}`);
      await this.pg.waitForTimeout(300);
      const fin = Date.now() + 30000;
      for (;;) {
        await this.pg.clock.runFor(100); await this.pg.waitForTimeout(40);
        const ok = await this.pg.evaluate(() => { const d = document.getElementById('app').contentDocument; return !!(d && d.readyState === 'complete' && d.querySelector('.vrm-main')); });
        if (ok || Date.now() > fin) break;
      }
      for (let k = 0; k < attente * 10; k++) { await this.pg.clock.runFor(100); await this.pg.waitForTimeout(60); }
    }
    this._app = await (await this.pg.$('#app')).contentFrame();
    await this.teinte();
    // 3. Le fondu enchaîné.
    const n = Math.max(1, Math.round(fondu * IPS));
    for (let k = 1; k <= n; k++) { await this.pg.evaluate((o) => { document.getElementById('gel').style.opacity = String(o); }, 1 - EASE.doux(k / n)); await this.image(); }
    await this.pg.evaluate(() => document.getElementById('gel').remove());
  }
  async attendreReel(ms) { await this.pg.waitForTimeout(ms); }
  // La couleur de la barre d'état et du bas suit l'app (clair ou sombre).
  async teinte() {
    const c = await this.app.evaluate(() => {
      const fond = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; };
      const h = fond(document.elementFromPoint(195, 2)), bas = fond(document.elementFromPoint(195, innerHeight - 2));
      const lum = (c) => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) : 255; };
      return { h, bas, sombre: lum(h) < 128, sombreBas: lum(bas) < 128 };
    }).catch(() => null);
    if (c) await this.pg.evaluate((c) => window.__teinte(c.h, c.bas, c.sombre, c.sombreBas), c);
  }

  // ── la caméra ──
  // Une position : un point de l'ÉCRAN (fx, fy, en px de l'app) posé à un point
  // du plateau (ax, ay), à l'échelle s.
  async rectDe(sel) {
    const r = await this.app.evaluate((sel) => {
      const el = typeof sel === 'string' ? window.__filmQ(sel) : null;
      if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height };
    }, sel);
    if (!r) return null;
    return { x: r.x, y: r.y + TEL.BARRE, w: r.w, h: r.h };
  }
  async viser(sel, { zoom = null, cadre = 0.86, dur = 1.1, ease = 'doux', dy = 0, dx = 0, ay = null, part = null, zmax: zmaxPlan = null } = {}) {
    let r = sel && typeof sel === 'object' && 'x' in sel ? sel : await this.rectDe(sel);
    if (!r) { console.log(`  (caméra : ${sel} introuvable, plan gardé)`); return; }
    if (part) r = { x: r.x + r.w * part[0], y: r.y + r.h * part[1], w: r.w * (part[2] - part[0]), h: r.h * (part[3] - part[1]) };
    // Le texte reste net jusqu'à ×2 (rastérisé à chaque image, mesuré) ; au-delà, l'écran ne se lit plus.
    // Par défaut, l'écran entier reste dans l'image en largeur (aucun mot coupé au bord) :
    // ×1,38 en portrait. Un plan serré sur un petit objet centré le demande (`zmax`).
    const zmax = zmaxPlan || Number(process.env.ZMAX) || (this.format === 'portrait' ? 1.38 : 1.12);
    const s = Math.min(zmax, zoom != null ? zoom : Math.max(this.repos.s, (this.F.w * cadre) / Math.max(40, r.w)));
    let fx = r.x + r.w / 2 + dx;
    // Le cadre ne montre jamais le fond sur un côté quand l'écran est plus large que l'image.
    const demi = this.F.w / (2 * s);
    if (this.format === 'portrait') fx = demi * 2 < TEL.W ? Math.max(-TEL.BORD + demi, Math.min(TEL.EW + TEL.BORD - demi, fx)) : TEL.EW / 2;
    const cible = { fx, fy: r.y + r.h / 2 + dy, s };
    // Zoomé en portrait : l'ancre descend, pour laisser la place au titre.
    if (ay != null) cible.ay = ay; else if (this.format === 'portrait' && s > this.repos.s * 1.05) cible.ay = 610;
    // Zoomé en paysage : l'écran glisse à droite, la colonne des titres reste libre.
    // Paysage : l'écran garde toute sa largeur (×0,92 au plus) et reste dans la moitié
    // droite, la colonne des titres reste libre ; la caméra ne bouge qu'en hauteur.
    if (this.format === 'paysage') { cible.fx = TEL.EW / 2; cible.s = Math.min(cible.s, 0.92); if (cible.s > this.repos.s * 1.05) cible.ax = 760; }
    this.bouger(cible, dur, ease);
  }
  bouger(cible, dur = 1, ease = 'doux') {
    const de = this.cam();
    const vers = { ...de, ...cible };
    if (cible.ax == null) vers.ax = this.repos.ax;
    if (cible.ay == null) vers.ay = this.repos.ay;
    this.camTween = { de, vers, t0: this.t, dur, ease: EASE[ease] || EASE.doux };
  }
  repos_(dur = 1, ease = 'doux') { this.bouger({ ...this.repos }, dur, ease); }
  cam() {
    const tw = this.camTween; if (!tw) return this.camEtat;
    const k = tw.ease(clamp((this.t - tw.t0) / tw.dur));
    const ls = lerp(Math.log(tw.de.s), Math.log(tw.vers.s), k);
    const e = { fx: lerp(tw.de.fx, tw.vers.fx, k), fy: lerp(tw.de.fy, tw.vers.fy, k), s: Math.exp(ls), ax: lerp(tw.de.ax, tw.vers.ax, k), ay: lerp(tw.de.ay, tw.vers.ay, k) };
    if (k >= 1) { this.camEtat = { ...tw.vers }; this.camTween = null; return this.camEtat; }
    return e;
  }

  // ── titres ── (non bloquant : il vit `duree` secondes à partir de maintenant)
  titre(texte, { sous = '', duree = 2.6, pos = '' } = {}) {
    const id = 't' + this.titres.length + '_' + Math.round(this.t * 1000);
    // Jamais deux titres à l'écran : le précédent sort.
    for (const t of this.titres) if (t.t1 > this.t + 0.28) t.t1 = this.t + 0.28;
    this.titres.push({ id, texte, sous, pos, t0: this.t + (this.titres.some((t) => t.t1 > this.t) ? 0.22 : 0), t1: this.t + duree });
  }

  // ── le toucher ── un VRAI toucher dans l'app, montré par un cercle.
  async toucher(sel, { avant = 0.38, apres = 0.42, viser = false } = {}) {
    if (viser) { await this.viser(sel, viser === true ? {} : viser); await this.jouer((this.camTween && this.camTween.dur) || 0.8); }
    const visible = () => this.app.evaluate((sel) => { const el = window.__filmQ(sel); if (!el) return null; const b = el.getBoundingClientRect(); const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(at && (el === at || el.contains(at) || at.contains(el) || (el.labels && [...el.labels].some((l) => l.contains(at))))); }, sel);
    const v0 = await visible();
    if (v0 === null) throw new Error(`toucher : ${sel} introuvable dans l'app`);
    if (!v0) { await this.defilerVers(sel, { marge: 260, dur: 0.6 }); await this.jouer(0.15); }
    const r = await this.rectDe(sel);
    const x = r.x + r.w / 2 + TEL.BORD, y = r.y + r.h / 2 + TEL.BORD;
    this.toucherEtat = { x, y, t0: this.t, appui: this.t + avant };
    await this.jouer(avant);
    // Le geste réel : un toucher (touchscreen) au point de l'élément, dans le plateau.
    const pt = await this.pg.evaluate(([x, y]) => { const f = document.getElementById('app').getBoundingClientRect(); const k = f.width / 390; return { x: f.left + (x - 12) * k, y: f.top + (y - 12 - 47) * k }; }, [x, y]);
    const cible = await visible();
    if (cible) await this.pg.touchscreen.tap(pt.x, pt.y);
    else await this.app.evaluate((sel) => window.__filmQ(sel).click(), sel);
    await this.jouer(apres);
  }
  // Défiler un conteneur de l'app (ou la page) jusqu'à y, en douceur.
  async defiler(sel, y, dur = 1, ease = 'doux') {
    const y0 = await this.app.evaluate((sel) => { const e = sel ? window.__filmQ(sel) : document.scrollingElement; return e ? e.scrollTop : 0; }, sel);
    const yv = typeof y === 'function' ? await y() : y;
    const n = Math.max(1, Math.round(dur * IPS));
    for (let k = 1; k <= n; k++) {
      const v = lerp(y0, yv, (EASE[ease] || EASE.doux)(k / n));
      await this.app.evaluate(([sel, v]) => { const e = sel ? window.__filmQ(sel) : document.scrollingElement; if (e) e.scrollTo({ top: v, behavior: 'instant' }); }, [sel, v]);
      await this.image();
    }
  }
  // Un conteneur défilant de l'app qui contient sel (pour amener sel à l'écran).
  async defilerVers(sel, { marge = 120, dur = 1 } = {}) {
    const info = await this.app.evaluate(([sel, marge]) => {
      const el = window.__filmQ(sel); if (!el) return null;
      let c = el.parentElement; while (c && c !== document.body) { const s = getComputedStyle(c); if (/(auto|scroll)/.test(s.overflowY) && c.scrollHeight > c.clientHeight + 2) break; c = c.parentElement; }
      const sc = !c || c === document.body ? document.scrollingElement : c;
      if (!sc.id && sc !== document.scrollingElement) sc.setAttribute('data-film-defile', '1');
      const top = el.getBoundingClientRect().top - (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top) + sc.scrollTop - marge;
      return { sel: sc === document.scrollingElement ? null : (sc.id ? '#' + sc.id : '[data-film-defile="1"]'), y: Math.max(0, Math.min(top, sc.scrollHeight - sc.clientHeight)) };
    }, [sel, marge]);
    if (!info) return;
    await this.defiler(info.sel, info.y, dur);
  }
  async attendreQue(sel, max = 4) {
    for (let i = 0; i < max * IPS; i++) {
      const ok = await this.app.evaluate((sel) => !!window.__filmQ(sel), sel).catch(() => false);
      if (ok) return true; await this.image();
    }
    console.log(`  (attendu en vain : ${sel})`); return false;
  }

  // ── le temps ──
  async jouer(sec) { const n = Math.round(sec * IPS); for (let k = 0; k < n; k++) await this.image(); }
  etat() {
    const c = this.cam();
    const tx = c.ax - (TEL.BORD + c.fx) * c.s, ty = c.ay - (TEL.BORD + c.fy) * c.s + this.telY;
    const titres = this.titres.filter((t) => this.t >= t.t0 && this.t < t.t1).map((t) => ({ id: t.id, texte: t.texte, sous: t.sous, pos: t.pos, age: this.t - t.t0, restant: t.t1 - this.t }));
    let toucher = null;
    const te = this.toucherEtat;
    if (te) {
      const a = this.t - te.t0, p = this.t - te.appui;
      if (p < 0.55) {
        const vin = clamp(a / 0.18), apres = clamp(p / 0.4);
        const k = p < 0 ? 0.7 + 0.3 * EASE.sortie(vin) : (p < 0.09 ? 1 - 0.18 * (p / 0.09) : 0.82 + 0.18 * EASE.sortie(clamp((p - 0.09) / 0.2)));
        toucher = { x: te.x, y: te.y, o: (p < 0 ? vin : 1 - clamp((p - 0.25) / 0.3)) * 0.95, k, oo: p < 0 ? 0 : (1 - apres) * 0.9, kk: 1 + 1.4 * EASE.sortie(apres) };
      } else this.toucherEtat = null;
    }
    // Le voile sous les titres (portrait) : seulement quand l'écran monte dessous.
    const haut = ty + TEL.BORD * c.s;
    const voile = this.format === 'portrait' && titres.length ? clamp((250 - haut) / 80) : 0;
    return { tx, ty, s: c.s, telOpacite: this.telOpacite, titres, toucher, voile, fin: this.finK, finPhrase: this.finPhrase };
  }
  async image() {
    for (const a of this.anims) a(this.t);
    // La barre d'état suit l'app (une feuille qui assombrit le haut, un écran sombre).
    if (this.i % 6 === 0) await this.teinte();
    await this.pg.evaluate((e) => window.__appliquer(e), this.etat());
    // L'app avance d'une image : ses animations CSS (pas à pas), puis son horloge.
    const dt = 1000 / IPS;
    await this.app.evaluate((dt) => {
      const vus = window.__filmVus || (window.__filmVus = new WeakSet());
      for (const a of document.getAnimations()) {
        if (!vus.has(a)) { vus.add(a); try { a.pause(); a.currentTime = 0; } catch (_) {} continue; }
        try { a.pause(); a.currentTime = (Number(a.currentTime) || 0) + dt; } catch (_) {}
      }
    }, dt).catch(() => {});
    const avant = Math.round(this.i * dt), apres = Math.round((this.i + 1) * dt);
    await this.pg.clock.runFor(apres - avant);
    if (this.ff) {
      // ⚠️ Sans `clip.scale`, CDP rend l'image en px CSS (540 × 960) : ffmpeg l'agrandissait
      //    et le texte devenait mou. Avec scale 2, Chrome rastérise à 1080 × 1920.
      const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true, clip: { x: 0, y: 0, width: this.F.w, height: this.F.h, scale: 2 } });
      const buf = Buffer.from(data, 'base64');
      this.derniere = buf;
      if (!this.ff.stdin.write(buf)) await new Promise((r) => this.ff.stdin.once('drain', r));
      for (const c of this.cles) if (!c.fait && this.t >= c.t) { c.fait = true; c.buf = buf; }
    }
    this.i++; this.t = this.i / IPS;
  }
  // Une image clé (pour la planche) à l'instant présent.
  cle(nom) { this.cles.push({ nom, t: this.t }); }

  async enregistrer(fichier) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    this.fichier = fichier;
    // L'horloge s'arrête : désormais elle n'avance qu'image par image.
    // (chaque cadre a sa copie de l'horloge : on part de la plus avancée)
    const tp = Math.max(await this.pg.evaluate(() => Date.now()), await this.app.evaluate(() => Date.now()));
    await this.pg.clock.pauseAt(new Date(tp + 400));
    this.i = 0; this.t = 0;
    const { w, h } = this.F;
    this.ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${w * 2}:${h * 2},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '21', '-profile:v', 'high', '-level', '4.2',
      '-maxrate', '4.2M', '-bufsize', '8M', '-g', String(IPS * 2), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(IPS), fichier], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  async finir() {
    await new Promise((r) => { this.ff.on('close', r); this.ff.stdin.end(); });
    const duree = this.t;
    const poids = fs.statSync(this.fichier).size;
    // La planche : les images clés (6), en 3 × 2.
    const dossier = path.dirname(this.fichier), base = path.basename(this.fichier, '.mp4');
    const cles = this.cles.filter((c) => c.buf).slice(0, 6);
    const tmp = fs.mkdtempSync(path.join(dossier, '.cles-'));
    cles.forEach((c, i) => fs.writeFileSync(path.join(tmp, `${i}.jpg`), c.buf));
    for (let i = 0; i < cles.length; i++) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, `${i}.jpg`), path.join(dossier, `${base}-cle${i + 1}.png`)]);
    if (cles.length) {
      const larg = this.format === 'portrait' ? 360 : 640, haut = this.format === 'portrait' ? 640 : 360;
      const entrees = []; cles.forEach((_, i) => entrees.push('-i', path.join(tmp, `${i}.jpg`)));
      const n = cles.length, col = this.format === 'portrait' ? Math.min(n, 6) : Math.min(n, 3), lig = Math.ceil(n / col);
      const f = cles.map((_, i) => `[${i}:v]scale=${larg}:${haut},pad=${larg + 12}:${haut + 12}:6:6:white[v${i}]`).join(';') + ';' + cles.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${n}:layout=${cles.map((_, i) => `${(i % col) * (larg + 12)}_${Math.floor(i / col) * (haut + 12)}`).join('|')}:fill=white`;
      if (n > 1) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...entrees, '-filter_complex', f, path.join(dossier, `${base}-planche.png`)]);
      void lig;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    await this.ctx.close();
    return { fichier: this.fichier, duree, poids, erreurs: this.erreurs };
  }
  // ── l'ouverture et la fin ──
  // Le téléphone monte et se pose (ressort sobre).
  async entree(dur = 1.1) {
    const t0 = this.t; const y0 = this.F.h * 0.9;
    const a = (t) => { const k = EASE.ressort(clamp((t - t0) / dur)); this.telY = (1 - k) * y0; this.telOpacite = clamp((t - t0) / 0.25); };
    this.anims.push(a); await this.jouer(dur); this.anims.splice(this.anims.indexOf(a), 1); this.telY = 0; this.telOpacite = 1;
  }
  async fin(phrase, dur = 2.6) {
    this.finPhrase = phrase;
    const t0 = this.t;
    this.repos_(0.9);
    const a = (t) => { const k = clamp((t - t0 - 0.5) / 0.7); this.telOpacite = 1 - EASE.doux(k); this.finK = EASE.sortie(clamp((t - t0 - 0.85) / 0.6)); };
    this.cles.push({ nom: 'fin', t: this.t + dur - 0.25 });
    this.anims.push(a); await this.jouer(dur);
  }
}

async function lancerNavigateur() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--hide-scrollbars', '--no-proxy-server', '--disable-gpu-compositing', '--font-render-hinting=none'] });
}
function sortie(nom) { fs.mkdirSync(SORTIE, { recursive: true }); return path.join(SORTIE, nom); }
const fermerServeur = () => { if (serveur) { serveur.close(); serveur = null; } };

// Tourner un film dans les formats demandés (FORMATS=portrait,paysage).
async function tourner(nom, scenario, { formats = ['portrait'], monde: fabrique, tab, local, sombre } = {}) {
  const voulus = (process.env.FORMATS || formats.join(',')).split(',').map((x) => x.trim()).filter((f) => formats.includes(f));
  const nav = await lancerNavigateur();
  const res = [];
  try {
    for (const format of voulus) {
      const monde = fabrique();
      const f = new Film({ nom, format, monde, tab, local: local ? local(monde) : {}, sombre });
      const t0 = Date.now();
      await f.demarrer(nav);
      if (process.env.FILMS_ESSAI) { await scenario.essai?.(f); }
      const fichier = sortie(`vrm-${nom}-${format === 'portrait' ? '1080x1920' : '1920x1080'}.mp4`);
      await f.enregistrer(fichier);
      await scenario(f);
      const r = await f.finir();
      console.log(`${nom} ${format} : ${r.duree.toFixed(1)} s, ${(r.poids / 1048576).toFixed(1)} Mo, tourné en ${Math.round((Date.now() - t0) / 1000)} s → ${r.fichier}${r.erreurs.length ? ' — erreurs de page : ' + r.erreurs.join(' | ') : ''}`);
      res.push(r);
    }
  } finally { await nav.close(); fermerServeur(); }
  return res;
}

module.exports = { Film, tourner, lancerNavigateur, demarrerServeur, fermerServeur, servirBase, sortie, FORMATS, TEL, EASE, IPS, PORT };
