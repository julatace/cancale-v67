// VRM Observateur — règle pure (aussi exécutée par le banc).
// Rien de ce qui est rangé n'est une valeur : adresses normalisées, noms de
// champs, types, tailles, heures. Les identifiants deviennent {id}.
const OBS = (() => {
  const VINTED = /(^|\.)vinted\.[a-z.]+$/i;
  function estVinted(host) { return VINTED.test(host || ''); }
  function cheminNormalise(p) {
    return String(p || '')
      .split('/')
      .map((s) => {
        if (!s) return s;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return '{uuid}';
        if (/\d{3,}/.test(s)) return '{id}';
        if (/^[0-9a-f]{16,}$/i.test(s)) return '{x}';
        if (s.length > 40) return '{x}';
        return s;
      })
      .join('/');
  }
  function forme(v, prof = 0) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return v.length ? ['n=' + v.length, prof < 5 ? forme(v[0], prof + 1) : '…'] : '[]';
    const t = typeof v;
    if (t === 'object') {
      if (prof >= 5) return '{…}';
      const o = {};
      let n = 0;
      for (const k of Object.keys(v)) {
        if (n++ >= 60) { o['…'] = 'plus'; break; }
        const cle = /\d{3,}/.test(k) || k.length > 40 ? '{k}' : k;
        o[cle] = forme(v[k], prof + 1);
      }
      return o;
    }
    if (t === 'string') return 'texte';
    return t; // number, boolean
  }
  function formeCorps(details) {
    const rb = details && details.requestBody;
    if (!rb) return null;
    if (rb.formData) {
      const o = {};
      for (const k of Object.keys(rb.formData)) o[/\d{3,}/.test(k) ? '{k}' : k] = 'n=' + (rb.formData[k] || []).length;
      return { formData: o };
    }
    if (Array.isArray(rb.raw)) {
      let octets = 0, fichiers = 0, texte = '';
      for (const r of rb.raw) {
        if (r.file) fichiers++;
        if (r.bytes) {
          octets += r.bytes.byteLength;
          if (texte.length < 200000) {
            try { texte += new TextDecoder('utf-8', { fatal: false }).decode(r.bytes); } catch (_) {}
          }
        }
      }
      let json;
      try { json = texte ? JSON.parse(texte) : undefined; } catch (_) { json = undefined; }
      if (json !== undefined) return { json: forme(json), octets };
      // multipart : on ne garde que les noms des parties
      const noms = [];
      const re = /[;\s]name="([^"]{1,60})"/g;
      let m;
      while ((m = re.exec(texte)) && noms.length < 30) noms.push(/\d{3,}/.test(m[1]) ? '{k}' : m[1]);
      return { octets, fichiers, parties: noms.length ? noms : undefined };
    }
    return null;
  }
  // Une requête « intéressante » : vers Vinted (hors bruit publicitaire), ou
  // partie d'une page Vinted vers un autre hôte (hôte seul).
  const BRUIT = /\/(vendorlist|api\/bid|api\/config\/prebid|a\/api\/fastlane|maps\/api|api\/esp\/increment)/;
  function entree(details) {
    let u;
    try { u = new URL(details.url); } catch (_) { return null; }
    const init = details.initiator || details.documentUrl || '';
    let hInit = '';
    try { hInit = init ? new URL(init).hostname : ''; } catch (_) {}
    const versVinted = estVinted(u.hostname);
    const depuisVinted = estVinted(hInit);
    const depuisExt = /^chrome-extension:\/\//.test(init);
    if (!versVinted && !depuisVinted && !(depuisExt && versVinted)) return null;
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (details.type === 'image' || details.type === 'font' || details.type === 'stylesheet' || details.type === 'media') return null;
    const chemin = cheminNormalise(u.pathname);
    if (versVinted && BRUIT.test(chemin)) return null;
    const e = {
      t: Math.round(details.timeStamp),
      m: details.method,
      h: u.hostname,
      p: versVinted ? chemin : '',
      q: versVinted ? [...u.searchParams.keys()].slice(0, 20) : undefined,
      ty: details.type,
      de: depuisExt ? 'extension:' + init.slice(19, 51) : (hInit || '?'),
      onglet: details.tabId,
    };
    if (versVinted && details.method !== 'GET') {
      const c = formeCorps(details);
      if (c) e.corps = c;
    }
    return e;
  }
  return { cheminNormalise, forme, formeCorps, entree, estVinted };
})();
if (typeof module !== 'undefined') module.exports = OBS;
