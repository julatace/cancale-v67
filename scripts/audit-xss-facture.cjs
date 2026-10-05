// ════════════════════════════════════════════════════════════════════════════
//  UNE FACTURE N'EXÉCUTE RIEN — le nom de l'acheteur est écrit par l'acheteur.
//        node scripts/audit-xss-facture.cjs [--src dossier] [--mutation sanscsp]
//
//  Trouvé par l'audit de sécurité du 5 octobre. Une facture porte le nom,
//  l'adresse et l'email de l'ACHETEUR, que l'acheteur écrit lui-même sur
//  Vinted, et la désignation de l'article. Ces valeurs partaient telles quelles :
//    · côté serveur, dans `buildInvoiceHtml` (le HTML de la facture Pro, rangé en
//      base puis envoyé par email à l'acheteur) ;
//    · côté app, dans `generatePDF`, puis `window.open('')` + `document.write`.
//  Une fenêtre ouverte ainsi a la MÊME ORIGINE que l'app : un nom d'acheteur
//  « <img src=x onerror=…> » y exécutait son code au moment où Julien imprime,
//  et lisait sa session.
//
//  Le banc EXÉCUTE les vraies fonctions :
//    1. `buildInvoiceHtml` du serveur, extrait et lancé dans un vm ;
//    2. `generatePDF` et `ouvrirDocumentImprimable` de l'app, dans un vrai
//       Chromium : il compte ce qui s'exécute dans la fenêtre ouverte.
//    3. Une facture Pro DÉJÀ rangée en base, non échappée (construite avant le
//       correctif) : elle ne doit rien exécuter non plus.
//  L'autre sens : le texte de l'acheteur reste LISIBLE (échappé, pas effacé), et
//  l'impression part toujours.
//  `--mutation sanscsp` retire la politique de la fenêtre : le contrôle 3 doit
//  repasser au rouge (preuve que c'est elle qui protège les factures rangées).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const iMut = process.argv.indexOf('--mutation');
const MUTATION = iMut > 0 ? process.argv[iMut + 1] : '';
const NM = fs.existsSync(path.join(__dirname, '..', 'node_modules')) ? path.join(__dirname, '..', 'node_modules') : '/home/user/cancale-v67/node_modules';
const parser = require(path.join(NM, '@babel', 'parser'));

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 180)); } };

// ⚠️ Le piège ne doit dépendre d'AUCUN réseau : un premier jet utilisait
// `<img src=x>`, dont la requête restait en attente dans le banc — le gestionnaire
// ne se déclenchait jamais, et le contrôle était vert sur une fenêtre SANS
// protection (prouvé par la mutation). `data:,` échoue tout de suite, et
// `<svg onload>` s'exécute sans rien charger.
const FRAPPE = "window.__pwn=(window.__pwn||0)+1;try{window.opener.__pwn=(window.opener.__pwn||0)+1}catch(e){}";
const PIEGE = `<img src="data:," onerror="${FRAPPE}"><svg onload="${FRAPPE}"></svg>Jean<script>${FRAPPE}</script>`;

// Extrait une déclaration de haut niveau (fonction ou const) par son nom.
function extraire(src, noms, jsx) {
  const ast = parser.parse(src, { sourceType: 'module', plugins: jsx ? ['jsx'] : [], errorRecovery: true });
  const out = {};
  for (const n of ast.program.body) {
    const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d) continue;
    if (d.type === 'FunctionDeclaration' && d.id && noms.includes(d.id.name)) out[d.id.name] = src.slice(d.start, d.end);
    if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id && noms.includes(v.id.name)) out[v.id.name] = src.slice(d.start, d.end);
  }
  return out;
}

(async () => {
  // ── 1. Le serveur ───────────────────────────────────────────────────────────
  await essaie('serveur', async () => {
    const src = fs.readFileSync(path.join(RACINE, 'api', 'email-inbound.js'), 'utf8');
    const f = extraire(src, ['buildInvoiceHtml']).buildInvoiceHtml;
    dit(!!f, 'la facture Pro se construit dans buildInvoiceHtml (serveur)');
    if (!f) return;
    const ctx = {}; vm.createContext(ctx); vm.runInContext(f + '\nthis.b = buildInvoiceHtml;', ctx);
    const html = ctx.b({ nom: 'Ma boutique', adresse: '1 rue', tauxTva: '0' },
      { nomComplet: PIEGE, adresse: PIEGE, email: 'a@b.c"><script>1</script>', designation: PIEGE, prix: '42' }, 'FA-1', '05/10/2026');
    const RAW = /<img src="data|<svg|<script|onerror="|onload="/i;
    const brut = RAW.test(html);
    dit(!brut, "le HTML de la facture Pro n'embarque ni balise ni gestionnaire venus de l'acheteur",
      brut ? html.slice(html.search(RAW), html.search(RAW) + 80) : '');
    dit(/&lt;img src=/.test(html) && /Jean/.test(html), "l'autre sens : le texte de l'acheteur reste dans la facture, lisible");
  });

  // ── 2 et 3. L'app, dans un vrai navigateur ───────────────────────────────────
  await essaie('app', async () => {
    const src = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
    const f = extraire(src, ['generatePDF', 'xmlEsc', 'fmtDate', 'ouvrirDocumentImprimable', 'CSP_DOCUMENT'], true);
    dit(!!f.generatePDF, "l'app construit sa facture dans generatePDF");
    let code = ['const LOGO_CANCALE = "data:image/png;base64,iVBORw0KGgo=";', f.xmlEsc || '', f.fmtDate || 'function fmtDate(d){return String(d||"")}',
      f.CSP_DOCUMENT || '', f.ouvrirDocumentImprimable || '', f.generatePDF || ''].join('\n');
    if (MUTATION === 'sanscsp') code = code.replace(/const CSP_DOCUMENT = `[^`]*`;/, 'const CSP_DOCUMENT = "";');
    const { chromium } = require(path.join(NM, 'playwright'));
    const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: ['--no-sandbox'] });
    try {
      const page = await (await nav.newContext()).newPage();
      await page.route('http://vrm.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>app</body></html>' }));
      await page.goto('http://vrm.test/');
      await page.addScriptTag({ content: code });
      // Les impressions sont comptées, pas lancées (le banc n'a pas d'imprimante).
      const essai = async (quoi) => page.evaluate(async ({ quoi, PIEGE }) => {
        window.__pwn = 0; window.__imprime = 0;
        const ouvrir = window.open.bind(window);
        let fenetre = null;
        window.open = (...a) => { fenetre = ouvrir(...a); try { fenetre.print = () => { window.__imprime++; }; } catch (_) {} return fenetre; };
        if (quoi === 'app') {
          generatePDF({ number: 'FA-1', saleDate: '2026-10-05', buyerName: PIEGE, buyerAddress: PIEGE, buyerEmail: 'x@y.z', itemName: PIEGE, sellPrice: 42, vintedNumber: '1', productId: '7' },
            { companyName: 'Ma boutique', companyType: 'EI', companyAddress: '1 rue', siret: '1', footer: 'Merci' });
        } else {
          // Le bouton de la facture Pro : le HTML vient de la base, tel qu'il y est rangé.
          if (typeof ouvrirDocumentImprimable !== 'function') return { absent: true };
          ouvrirDocumentImprimable(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Facture</title></head><body><b>${PIEGE}</b></body></html>`);
        }
        await new Promise((r) => setTimeout(r, 1200));
        let texte = ''; try { texte = fenetre.document.body.innerText; } catch (_) {}
        let pwnFenetre = 0; try { pwnFenetre = fenetre.__pwn || 0; } catch (_) {}
        return { pwn: (window.__pwn || 0) + pwnFenetre, imprime: window.__imprime, texte: texte.slice(0, 400) };
      }, { quoi, PIEGE });

      const a = await essai('app');
      dit(a.pwn === 0, "facture de l'app : un nom d'acheteur piégé n'exécute RIEN dans la fenêtre (même origine que l'app)", `exécutions : ${a.pwn}`);
      dit(/Jean/.test(a.texte) && /onerror/.test(a.texte), "l'autre sens : le nom de l'acheteur reste lisible (échappé, pas effacé)", a.texte.slice(0, 120));
      dit(a.imprime >= 1, "et l'impression part toujours", `impressions : ${a.imprime}`);

      const p = await essai('pro');
      dit(!p.absent && p.pwn === 0, "facture Pro DÉJÀ rangée, non échappée : la fenêtre n'exécute rien non plus (politique de la fenêtre)",
        p.absent ? 'ouvrirDocumentImprimable absent' : `exécutions : ${p.pwn}`);
      dit(!p.absent && p.imprime >= 1, 'et elle s\'imprime', p.absent ? '' : `impressions : ${p.imprime}`);
    } finally { await nav.close(); }
  });

  console.log(ko ? `\n❌ audit-xss-facture : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-xss-facture : ${ok} contrôles — une facture n'exécute rien`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ audit-xss-facture est tombé :', e && e.message); process.exit(1); });
