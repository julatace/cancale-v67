// ════════════════════════════════════════════════════════════════════════════
//  LES BORDEREAUX EN UN SEUL PDF (ext. 5.420, 21 nov. — `bordereauxunpdf`)
//
//  Julien, 21 nov. : « Imprimer N bordereaux » (Commandes, sélection) doit donner UN fichier, une étiquette par page,
//  ouvert pour l'impression — plus N fichiers téléchargés à la suite.
//  Injecté À LA DEMANDE par le service worker (`bordereauxUnPdf`, `chrome.scripting.executeScript`, monde isolé de
//  l'extension, l'onglet vinted.fr du panneau), juste après `pdf-lib.min.js` (pdf-lib 1.17.1, MIT — voir
//  pdf-lib.LICENSE.txt). Rien n'est chargé sur une page tant qu'il ne touche pas « Imprimer ».
//  ⚠️ LECTURE SEULE : il ne reçoit QUE les PDF que VRM a déjà rangés (`bordereauCarte` : compte de l'onglet, aucune
//     requête vers Vinted, rien d'acheté) ; il ne fabrique aucune page, ne redessine rien, ne touche à aucun code :
//     chaque page du fichier est une page d'un bordereau, copiée telle quelle, dans l'ORDRE de la sélection.
//  ⚠️ AUCUNE COMMANDE SANS BORDEREAU : un PDF illisible (abîmé, chiffré, vide, trop de pages) n'entre pas dans le
//     fichier — il est rendu à part (`illisibles`) et le panneau l'ouvre seul, dit ; jamais une page blanche à sa place.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.__vrmAssemblerPdf && globalThis.__vrmAssemblerPdfV === 1) return;
  const PAGES_MAX = 6;            // un bordereau de Vinted : l'étiquette (+ parfois une page d'instructions)
  const OCTETS_MAX = 6 * 1024 * 1024;
  const versOctets = (b64) => { const bin = atob(String(b64 || '')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
  // liste : [{ tx, b64 }] dans l'ordre de la sélection.
  // → { ok, octets (Uint8Array), pages, inclus: [{ tx, pages }], illisibles: [tx] } · { ok: false, code, illisibles }
  globalThis.__vrmAssemblerPdf = async (liste) => {
    const L = globalThis.PDFLib;
    if (!L || typeof L.PDFDocument !== 'function' && typeof L.PDFDocument !== 'object') return { ok: false, code: 'bibliotheque', illisibles: [] };
    const out = await L.PDFDocument.create();
    const inclus = [], illisibles = [];
    for (const x of Array.isArray(liste) ? liste : []) {
      const tx = String((x && x.tx) || '');
      try {
        const b64 = String((x && x.b64) || '');
        if (!b64.startsWith('JVBERi0') || b64.length * 0.75 > OCTETS_MAX) { illisibles.push(tx); continue; }
        const src = await L.PDFDocument.load(versOctets(b64), { updateMetadata: false });
        const n = src.getPageCount();
        if (n < 1 || n > PAGES_MAX) { illisibles.push(tx); continue; }
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const p of pages) out.addPage(p);
        inclus.push({ tx, pages: pages.length });
      } catch (_) { illisibles.push(tx); }
    }
    if (!inclus.length) return { ok: false, code: 'illisibles', illisibles };
    try { out.setTitle(`Bordereaux VRM (${inclus.length})`); out.setCreator('VRM'); out.setProducer('VRM'); } catch (_) {}
    const octets = await out.save();
    return { ok: true, octets, pages: out.getPageCount(), inclus, illisibles };
  };
  globalThis.__vrmAssemblerPdfV = 1;
})();
