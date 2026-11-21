#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  VÉRIFIER UNE RESTAURATION — deux bases comparées EN LECTURE SEULE
//  (9 nov., chantier « charge-sauvegarde » ; procédure : docs/sauvegarde-restauration.md)
//
//  SOURCE = la base de production (ou la sauvegarde d'origine), COPIE = le projet
//  Supabase NEUF où la sauvegarde a été restaurée. Le script compare, vendeur par
//  vendeur :
//    · le nombre de comptes Vinted liés (`vinted_accounts`) ;
//    · le nombre de lignes `app_data`, et par FAMILLE (préfixe d'identifiant :
//      main, harvest_*_orders_sold, email_bord_*…) ;
//    · une empreinte de la LISTE des identifiants (aucune ligne perdue ni en trop) ;
//    · l'empreinte de la ligne `main` ENTIÈRE et, à part, celle des NUMÉROS
//      (`vinted_annonce_numeros`, `vinted_used_nums`, `vrm_numerotation`) — un
//      numéro de carton perdu est le seul dégât irréversible (CLAUDE.md §5).
//  Il n'AFFICHE AUCUN CONTENU : des nombres, des empreintes tronquées (12 hex) et
//  le début de l'identifiant du vendeur (8 caractères). Aucune clé n'est écrite.
//
//  ⚠️ LECTURE SEULE, TENUE PAR LE CODE : `fetch` ne part qu'en GET ; toute autre
//  méthode lève avant le réseau. Pagination `Range` triée (owner, id) : une page
//  ratée ⇒ « pas su » (code 2), jamais une liste tronquée prise pour entière.
//
//  Usage (les clés de SERVICE de chaque projet, dans l'environnement — jamais en
//  argument, jamais dans un fichier du dépôt) :
//    SOURCE_URL=https://xxx.supabase.co SOURCE_CLE=… \
//    COPIE_URL=https://yyy.supabase.co  COPIE_CLE=…  \
//    node scripts/sauvegarde/verifier-restauration.mjs [--json] [--sans-main]
//  Code de sortie : 0 identiques · 1 différences (listées) · 2 pas su (lecture ratée).
//  Coût : chaque base relit ~70 octets par ligne (id) + la ligne `main` de chaque
//  vendeur (~100 Ko) — à 1 000 vendeurs ≈ 0,4 Go d'égress par base.
// ════════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const JSON_SORTIE = args.includes('--json');
const SANS_MAIN = args.includes('--sans-main');
const PAGE = 1000;

class PasSu extends Error {}
const empreinte = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : canon(x)).digest('hex').slice(0, 12);
// JSON canonique : clés triées (deux bases rendent les objets dans des ordres différents).
function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
const famille = (id) => String(id || '').replace(/\d{6,}/g, 'N').replace(/_[A-Z]{2}\d+[A-Z]{2}$/, '_X').replace(/_[0-9a-f]{32,}$/i, '_H');
const court = (o) => String(o || '∅').slice(0, 8);

function base(nom, url, cle) {
  if (!url || !cle) throw new Error(`${nom}_URL et ${nom}_CLE sont à poser dans l'environnement`);
  const racine = String(url).replace(/\/+$/, '');
  const entetes = { apikey: cle, ...(String(cle).startsWith('eyJ') ? { Authorization: `Bearer ${cle}` } : {}) };
  // La seule porte vers le réseau : GET, rien d'autre.
  async function lire(chemin, range) {
    const methode = 'GET';
    if (methode !== 'GET') throw new Error('lecture seule');
    let r;
    try { r = await fetch(`${racine}/rest/v1/${chemin}`, { method: methode, headers: { ...entetes, ...(range ? { 'Range-Unit': 'items', Range: range } : {}) }, signal: AbortSignal.timeout(30000) }); }
    catch (e) { throw new PasSu(`${nom} : réseau (${e && e.name})`); }
    if (r.status === 416) return { lignes: [], plage: r.headers.get('content-range') || '' };
    if (!r.ok) throw new PasSu(`${nom} : HTTP ${r.status} sur ${chemin.split('?')[0]}`);
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) throw new PasSu(`${nom} : réponse illisible`);
    return { lignes: j, plage: r.headers.get('content-range') || '' };
  }
  // Toutes les lignes d'une requête, par pages, l'ordre posé ; total vérifié.
  async function tout(chemin) {
    const out = [];
    for (let debut = 0; ; debut += PAGE) {
      const { lignes, plage } = await lire(chemin, `${debut}-${debut + PAGE - 1}`);
      const m = /^(\d+)-(\d+)\/(\d+|\*)$/.exec(plage);
      if (lignes.length && m && Number(m[1]) !== debut) throw new PasSu(`${nom} : page décalée`);
      out.push(...lignes);
      if (lignes.length < PAGE) {
        const t = /\/(\d+)$/.exec(plage);
        if (t && Number(t[1]) !== out.length) throw new PasSu(`${nom} : total annoncé ${t[1]}, lu ${out.length}`);
        return out;
      }
      if (debut > 50_000_000) throw new PasSu(`${nom} : trop de pages`);
    }
  }
  return { nom, lire, tout };
}

async function releve(b) {
  const comptes = await b.tout('vinted_accounts?select=owner,vinted_user_id&order=owner.asc,vinted_user_id.asc');
  const lignes = await b.tout('app_data?select=owner,id&order=owner.asc,id.asc');
  const parVendeur = new Map();
  const v = (o) => { if (!parVendeur.has(o)) parVendeur.set(o, { comptes: 0, lignes: 0, familles: {}, ids: [], main: null, numeros: null }); return parVendeur.get(o); };
  for (const c of comptes) v(c.owner || '').comptes++;
  for (const l of lignes) { const x = v(l.owner || ''); x.lignes++; const f = famille(l.id); x.familles[f] = (x.familles[f] || 0) + 1; x.ids.push(String(l.id)); }
  if (!SANS_MAIN) {
    const mains = await b.tout('app_data?id=eq.main&select=owner,data&order=owner.asc');
    for (const m of mains) {
      const x = v(m.owner || '');
      const d = m.data && typeof m.data === 'object' ? m.data : {};
      x.main = empreinte(d);
      x.numeros = empreinte({ n: d.vinted_annonce_numeros ?? null, u: d.vinted_used_nums ?? null, k: d.vrm_numerotation ?? null });
    }
  }
  for (const x of parVendeur.values()) { x.ids = empreinte(x.ids.join('\n')); }
  return { comptes: comptes.length, lignes: lignes.length, parVendeur };
}

function comparer(S, C) {
  const ecarts = [];
  if (S.comptes !== C.comptes) ecarts.push({ quoi: 'comptes Vinted (total)', source: S.comptes, copie: C.comptes });
  if (S.lignes !== C.lignes) ecarts.push({ quoi: 'lignes app_data (total)', source: S.lignes, copie: C.lignes });
  const owners = [...new Set([...S.parVendeur.keys(), ...C.parVendeur.keys()])].sort();
  for (const o of owners) {
    const s = S.parVendeur.get(o), c = C.parVendeur.get(o);
    if (!s || !c) { ecarts.push({ vendeur: court(o), quoi: s ? 'vendeur absent de la copie' : 'vendeur absent de la source', source: s ? s.lignes : 0, copie: c ? c.lignes : 0 }); continue; }
    if (s.numeros !== c.numeros) ecarts.push({ vendeur: court(o), quoi: 'NUMÉROS de rangement différents', grave: true, source: s.numeros, copie: c.numeros });
    if (s.main !== c.main) ecarts.push({ vendeur: court(o), quoi: 'ligne main différente', source: s.main, copie: c.main });
    if (s.comptes !== c.comptes) ecarts.push({ vendeur: court(o), quoi: 'comptes Vinted liés', source: s.comptes, copie: c.comptes });
    if (s.ids !== c.ids) {
      for (const f of [...new Set([...Object.keys(s.familles), ...Object.keys(c.familles)])].sort()) {
        if ((s.familles[f] || 0) !== (c.familles[f] || 0)) ecarts.push({ vendeur: court(o), quoi: `lignes ${f}`, source: s.familles[f] || 0, copie: c.familles[f] || 0 });
      }
      if (s.lignes === c.lignes) ecarts.push({ vendeur: court(o), quoi: 'mêmes nombres, identifiants différents', source: s.ids, copie: c.ids });
    }
  }
  return { vendeurs: owners.length, ecarts };
}

try {
  const S = base('SOURCE', process.env.SOURCE_URL, process.env.SOURCE_CLE);
  const C = base('COPIE', process.env.COPIE_URL, process.env.COPIE_CLE);
  if (String(process.env.SOURCE_URL).replace(/\/+$/, '') === String(process.env.COPIE_URL).replace(/\/+$/, '')) throw new Error('SOURCE et COPIE désignent la même base');
  const [rs, rc] = await Promise.all([releve(S), releve(C)]);
  const r = comparer(rs, rc);
  const resume = { vendeurs: r.vendeurs, lignesSource: rs.lignes, lignesCopie: rc.lignes, comptesSource: rs.comptes, comptesCopie: rc.comptes, ecarts: r.ecarts.length, numerosTouches: r.ecarts.filter((e) => e.grave).length };
  if (JSON_SORTIE) console.log(JSON.stringify({ ...resume, detail: r.ecarts }, null, 1));
  else {
    console.log(`Vendeurs : ${r.vendeurs} · lignes ${rs.lignes} / ${rc.lignes} · comptes Vinted ${rs.comptes} / ${rc.comptes} (source / copie)`);
    if (!r.ecarts.length) console.log('✅ Identiques : chaque vendeur a les mêmes lignes, la même ligne main et les mêmes numéros.');
    else { console.log(`❌ ${r.ecarts.length} écart(s)${resume.numerosTouches ? ` — dont ${resume.numerosTouches} sur les NUMÉROS` : ''} :`); for (const e of r.ecarts.slice(0, 200)) console.log(`  ${e.grave ? '⚠️ ' : ''}${e.vendeur ? e.vendeur + ' · ' : ''}${e.quoi} : ${e.source} / ${e.copie}`); }
  }
  process.exit(r.ecarts.length ? 1 : 0);
} catch (e) {
  console.log(`❓ Pas su : ${e instanceof PasSu ? e.message : (e && e.message) || e}`);
  process.exit(2);
}
