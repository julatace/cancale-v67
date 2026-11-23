// « Relier mes annonces » — les LECTURES dont le calcul a besoin (19 nov.), déplacées TELLES QUELLES d'App.jsx pour
// tenir le budget du démarrage : chargées avec le parcours (src/liaisonActions.js), jamais au démarrage. Elles ne
// lisent que ce que l'app leur passe (`d`). Seule écriture : `donnerNumero` ajoute le N° donné au pool (append-only), comme avant.
export function creerDonneesLiaison(d) {
  const { load, lireAnnoncesVintedEnLigne, chezMoiProposables, chezMoiEntrees, placesAnnonces, ouDansMeubles, lireBaseRelue, SUPABASE_URL } = d;
  // Pour `donnerNumero` (la règle des numéros, §5) : tout vient d'App.jsx, rien n'est recopié ici.
  const { numeroEcritActif, numerotationPermise, isCloudReady, lireEnVol, CLES_ECRITURE_NUMEROS, saveTimers, cleNum, numerosReserves, ajouterNumerosHorsEcran, prochainLibre, prefixeNumeros, entreePool, save, triPool, emettreClesRelues } = d;
  // Ses paires Vinted PRÉSENTES qui portent un N° : en ligne (la lecture de `lireAnnoncesVintedEnLigne`, celle de
  // l'écran eBay et de la coque, §11) ou « toujours chez moi ». `paires: null` = pas su (aucun compte lisible).
  async function pairesVintedLiaison() {
    let comptes = []; try { comptes = load('vinted_accounts', []) || []; } catch (_) { comptes = []; }
    if (!Array.isArray(comptes)) return { paires: null, toutesLues: false, sansNumero: 0 };
    // Aucun compte Vinted relié : c'est SU (pas « pas su ») — ses annonces des autres sites se relient entre elles.
    if (!comptes.length) return { paires: [], toutesLues: true, sansNumero: 0 };
    const lu = await lireAnnoncesVintedEnLigne(comptes);
    if (!lu.enLigne) return { paires: null, toutesLues: false, sansNumero: 0 };
    const fiches = load('vinted_annonce_numeros', {}) || {};
    let chezMoi = new Set(); try { chezMoi = chezMoiProposables(fiches, chezMoiEntrees(fiches, lu.enLigne)); } catch (_) { chezMoi = new Set(); }
    const login = (uid) => { const a = comptes.find((x) => String(x && x.vinted_user_id) === String(uid)); return (a && a.login) || ''; };
    const pl = placesAnnonces();
    const out = [], vus = new Set(); let sansNumero = 0;
    for (const id0 of [...lu.enLigne, ...chezMoi]) {
      const id = String(id0); if (vus.has(id)) continue; vus.add(id);
      const f = fiches[id] || {};
      const numero = f.numero != null ? String(f.numero).trim() : '';
      if (!numero) { sansNumero++; continue; }
      const uid = lu.compte[id] || String(f.accountId || '');
      const ou = ouDansMeubles(numero, pl.meubles, pl.slots);
      const pf = Number(f.price);
      out.push({ id, numero, titre: f.title || lu.titre[id] || '', photo: (typeof f.photo === 'string' ? f.photo : (f.photo && f.photo.url)) || lu.couv[id] || null,
        taille: lu.taille[id] || f.size || '', prix: lu.prix[id] != null ? lu.prix[id] : (pf > 0 ? pf : null), marque: lu.marque[id] || '', compte: uid, compteNom: login(uid),
        place: ou ? [ou.meuble && ou.meuble.name, ou.libelle].filter(Boolean).join(' · ') : '', enLigne: lu.enLigne.has(id) });
    }
    return { paires: out, toutesLues: lu.toutesLues === true, sansNumero };
  }
  // Les paires que VRM a PUBLIÉES sur un site (marque de publication), dont l'annonce créée n'a pas été gardée par
  // son identifiant : un fait (jamais une ressemblance), montré « à vérifier » quand aucune annonce lue ne porte
  // leur N° (la règle `construireLiaison` filtre celles qui en ont une). Lecture ratée ⇒ null (aucune piste).
  async function pistesLiaison() {
    try {
      const r = await lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=in.(vinted_lbc_posted,vc_listings)&select=id,ids:data->ids,liens:data->liens`);
      if (!Array.isArray(r)) return null;
      const fiches = load('vinted_annonce_numeros', {}) || {};
      const out = { Leboncoin: [], Vestiaire: [], eBay: [] };
      for (const l of r) {
        if (l && l.id === 'vinted_lbc_posted') for (const id of (Array.isArray(l.ids) ? l.ids : [])) { const f = fiches[String(id)]; if (f && f.numero != null && String(f.numero).trim()) out.Leboncoin.push(String(f.numero)); }
        if (l && l.id === 'vc_listings' && l.liens && typeof l.liens === 'object') for (const n of Object.values(l.liens)) if (n != null && String(n).trim()) out.Vestiaire.push(String(n));
      }
      return out;
    } catch (_) { return null; }
  }
  // « Elle n'est pas sur Vinted » (Leboncoin) : SON N°, par LA règle des numéros — `prochainLibre` sur TOUS les
  // numéros déjà servis (la même récolte que `numeroterVestiaire`), après le plus haut, jamais un trou, jamais un
  // N° d'archive ; le pool d'abord (append-only : un N° donné reste servi, même si le geste est annulé).
  // Il numérote lui-même ⇒ aucun N° neuf (`sans-numero`). Une lecture qui manque ⇒ `pas-su`, rien n'est donné.
  async function donnerNumeroLiaison() {
    if (numeroEcritActif()) return { refus: 'sans-numero' };
    if (!numerotationPermise() || !isCloudReady()) return { refus: 'pas-su' };
    const [jl, jv, jr] = await Promise.all([
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_listings&select=items:data->items,liens:data->liens`),
      lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vc_ventes&select=ventes:data->ventes`),
      lireEnVol('panel_num_reserves', () => lireBaseRelue(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_num_reserves&select=data`)),
    ]);
    if (!Array.isArray(jl) || !Array.isArray(jv) || !Array.isArray(jr) || !numerotationPermise() || !isCloudReady()) return { refus: 'pas-su' };
    if (CLES_ECRITURE_NUMEROS.some((k) => saveTimers[k])) return { refus: 'pas-su' };
    const pris = new Set(), prisK = new Set();
    const add = (v) => { const c = cleNum(v); if (!c) return; prisK.add(c); if (/^\d+$/.test(c)) pris.add(Number(c)); };
    const L0 = jl[0] || {}, V0 = jv[0] || {};
    Object.values(load('vinted_annonce_numeros', {}) || {}).forEach((e) => add(e && e.numero));
    Object.values(load('vinted_sale_overrides', {}) || {}).forEach((e) => add(e && e.numero));
    Object.values(load('vrm_lbc_liens', {}) || {}).forEach(add);
    Object.values((L0.liens && typeof L0.liens === 'object') ? L0.liens : {}).forEach(add);
    numerosReserves(jr[0] ? jr[0].data : null).cles.forEach(add);
    for (const it of Object.values((L0.items && typeof L0.items === 'object') ? L0.items : {})) if (it && it.ref) add(it.ref);
    for (const v of Object.values((V0.ventes && typeof V0.ventes === 'object') ? V0.ventes : {})) if (v && v.ref) add(v.ref);
    ajouterNumerosHorsEcran(pris, prisK);
    const servis = new Set(prisK);
    const numero = prochainLibre(pris, prisK, prefixeNumeros());
    const ep = entreePool(numero);
    if (ep == null || servis.has(cleNum(numero))) return { refus: 'pas-su' };
    const pool = (load('vinted_used_numeros', []) || []).slice();
    if (!pool.map(cleNum).includes(cleNum(ep))) { pool.push(ep); save('vinted_used_numeros', pool.sort(triPool)); emettreClesRelues(['vinted_used_numeros']); }
    return { numero, servis };
  }
  return { pairesVinted: pairesVintedLiaison, pistes: pistesLiaison, donnerNumero: donnerNumeroLiaison };
}
