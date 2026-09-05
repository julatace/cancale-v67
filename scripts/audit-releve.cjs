// ⚠️ CONTRÔLE PERMANENT — LE RELEVÉ DU PORTE-MONNAIE (§5.91)
// Julien déclare l'argent REÇU ; l'app ne sait dater que la VENTE (7 j d'écart
// en médiane, jusqu'à 25). §5.88 avait nommé « capter l'historique daté du
// porte-monnaie » comme le vrai chantier suivant.
// MESURÉ EN BASE : la réponse de `/api/v2/users/{id}/payouts` — que l'extension
// appelle DÉJÀ à chaque moisson — porte `invoice_lines` (le relevé daté),
// `starting_date` (le mois) et `history` (les mois consultables). Personne ne
// les lisait, et la capture passive du solde (`{main,escrow}`) ÉCRASAIT le tout
// puisqu'il n'y a qu'une ligne `harvest_{uid}_billing`.
// Ce script exécute le VRAI code du service worker dans un `vm`.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

// La VRAIE réponse relevée en base (compte 3170782324, août 2026).
const REEL = {
  code: 0,
  balance: { amount: '0.0', currency_code: 'EUR' },
  history: [{ year: 2026, month: 7, title: 'Juillet' }],
  reference: 'FR-3166370055-5',
  invoice_lines: [{
    id: 27762835874, date: '2026-08-07T18:02:15.000Z', type: 'credit',
    title: 'Transfert vers le compte bancaire',
    amount: { amount: '-54.0', currency_code: 'EUR' },
    pending: true, subtitle: 'FR76 **** 2316', entity_id: '850705781', entity_type: 'payout',
  }],
  starting_date: '2026-08-01',
  pending_balance: { amount: '0.0', currency_code: 'EUR' },
  previous_balance: { amount: '54.0', currency_code: 'EUR' },
  invoice_lines_has_more: false,
};

function banc({ releves = {}, hist = null, profil = '3166370055', reponses = null } = {}) {
  const ecrites = [], demandes = [];
  const store = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (f) => f(), clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: function (k, cb) { const out = {}; const ks = typeof k === 'string' ? [k] : (Array.isArray(k) ? k : Object.keys(k || {})); ks.forEach(x => { if (store[x] !== undefined) out[x] = store[x]; }); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined) } },
    },
    fetch: async (url, opts) => {
      const u = String(url);
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => 'application/json' } });
      // ── VINTED : c'est ce qu'on mesure ──
      const pa = /vinted\.fr\/api\/v2\/users\/(\d+)\/payouts(?:\?(.*))?$/.exec(u);
      if (pa) {
        const p = new URLSearchParams(pa[2] || '');
        const cle = p.get('year') && p.get('month') ? `${p.get('year')}-${String(p.get('month')).padStart(2, '0')}` : null;
        demandes.push({ pid: pa[1], mois: cle });
        if (reponses) return J(reponses(cle));
        return J({ ...REEL, starting_date: cle ? cle + '-01' : '2026-08-01' });
      }
      if (/vinted\.fr\//.test(u)) return J({});
      // ── SUPABASE ──
      if (opts && opts.method === 'POST' && /app_data/.test(u)) {
        try { JSON.parse(opts.body).forEach(r => ecrites.push(r)); } catch (_) {}
        return J([]);
      }
      if (/_profile&select=pid/.test(u) || /_profile\b.*pid/.test(u)) return J(profil ? [{ pid: profil }] : []);
      if (/_releve_/.test(u) && /select=m/.test(u)) return J(Object.keys(releves).map(m => ({ m })));
      if (/_releve_/.test(u) && /nLignes/.test(u)) {
        const m = /releve_(\d{4}-\d{2})/.exec(decodeURIComponent(u));
        const n = m && releves[m[1]];
        return J(n ? [{ n: String(n) }] : []);
      }
      if (/_billing&select=h/.test(u) || /history/.test(u)) return J([{ h: hist === null ? REEL.history : hist }]);
      if (/vinted_accounts/.test(u)) return J([{ vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'x' }]);
      if (/rest\/v1\//.test(u)) return J([]);
      return J({});
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.getStoredAccounts = async () => [{ vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'x' }];
  ctx.compteConnecte = async () => '111';
  ctx.activeAccountId = async () => '111';
  return { ctx, ecrites, demandes, store };
}

let ok = 0, ko = 0;
const T = (nom, cond, det) => { if (cond) { ok++; console.log('  ✅ ' + nom); } else { ko++; console.log('  ❌ ' + nom + (det ? ' — ' + det : '')); } };
const relevesEcrits = (e) => e.filter(r => /_releve_/.test(r.id));

(async () => {
  console.log('\n=== 1. LE RELEVÉ A SA PROPRE LIGNE, PAR MOIS ===');
  {
    const b = banc();
    if (typeof b.ctx.storeReleve !== 'function') {
      T('storeReleve existe', false, 'la fonction est absente : le relevé de `payouts` est jeté avec la ligne billing');
    } else {
      await b.ctx.storeReleve('111', REEL, 'www.vinted.fr');
      const r = relevesEcrits(b.ecrites);
      T('une ligne de relevé est écrite', r.length === 1, `${r.length} ligne(s)`);
      T('la clé porte le mois de starting_date', !!r[0] && r[0].id === 'harvest_111_releve_2026-08', r[0] && r[0].id);
      const d = (r[0] || {}).data || {};
      T('le mois est enregistré tel quel', d.mois === '2026-08', d.mois);
      T('les mouvements sont gardés', Array.isArray(d.lignes) && d.lignes.length === 1, JSON.stringify(d.lignes));
      const l = (d.lignes || [])[0] || {};
      T('le montant est un NOMBRE, pas un objet', l.montant === -54, JSON.stringify(l.montant));
      T('la date du mouvement est gardée', String(l.date || '').startsWith('2026-08-07'), l.date);
      T('le type d\'entité est gardé (payout ≠ vente)', l.quoi === 'payout', l.quoi);
      T('la ligne est allégée (pas de subtitle bancaire)', l.subtitle === undefined && !('currency_code' in l), JSON.stringify(l));
      // ⚠️ Le résumé est calculé À LA CAPTURE (§5.14) : l'app lit trois
      // scalaires au lieu de recharger des dizaines de Ko par compte (§34).
      const r0 = d.resume || {};
      T('le résumé est écrit sur la ligne', typeof r0.n === 'number', JSON.stringify(r0));
      T('un virement vers la banque est compté à part', r0.virements === -54, JSON.stringify(r0.virements));
      T('il n\'est PAS compté comme une entrée', r0.entrees === 0, JSON.stringify(r0.entrees));
    }
  }

  console.log('\n=== 2. CE QUI NE DOIT RIEN ÉCRIRE ===');
  {
    const b = banc();
    if (typeof b.ctx.storeReleve === 'function') {
      await b.ctx.storeReleve('111', { main: { amount: '10' }, escrow: { amount: '5' } }, 'www.vinted.fr');
      T('un solde sans mouvements n\'écrit aucun relevé', relevesEcrits(b.ecrites).length === 0);
      const b2 = banc();
      await b2.ctx.storeReleve('111', { invoice_lines: [] }, 'www.vinted.fr');
      T('une liste de mouvements VIDE n\'écrit rien', relevesEcrits(b2.ecrites).length === 0);
      const b3 = banc();
      await b3.ctx.storeReleve('111', { invoice_lines: [{ id: 1, title: 'sans montant' }], starting_date: '2026-08-01' }, 'www.vinted.fr');
      T('un mouvement sans montant n\'est pas compté', relevesEcrits(b3.ecrites).length === 0);
      // ⚠️ un relevé plus PAUVRE ne remplace pas un relevé plus riche (§5.13)
      const b4 = banc({ releves: { '2026-08': 9 } });
      await b4.ctx.storeReleve('111', REEL, 'www.vinted.fr');
      T('un relevé plus court n\'écrase pas un relevé plus complet', relevesEcrits(b4.ecrites).length === 0);
    } else { ko += 4; console.log('  ❌ (4 contrôles) storeReleve absente'); }
  }

  console.log('\n=== 3. LES MOIS PASSÉS : lecture bornée, et on sait s\'arrêter ===');
  {
    if (typeof banc().ctx.capterReleves !== 'function') {
      T('capterReleves existe', false, 'aucun moyen de remonter au-delà du mois courant');
      ko += 4; console.log('  ❌ (4 contrôles) capterReleves absente');
    } else {
      const b = banc();
      await b.ctx.capterReleves('111');
      T('le mois manquant est demandé', b.demandes.length === 1 && b.demandes[0].mois === '2026-07', JSON.stringify(b.demandes));
      T('la lecture utilise l\'ID DE PROFIL, pas l\'identifiant de compte', b.demandes[0] && b.demandes[0].pid === '3166370055', b.demandes[0] && b.demandes[0].pid);
      T('le relevé du mois passé est rangé', relevesEcrits(b.ecrites).some(r => r.id === 'harvest_111_releve_2026-07'), relevesEcrits(b.ecrites).map(r => r.id).join(','));

      // déjà en base → aucune requête
      const b2 = banc({ releves: { '2026-07': 1 } });
      await b2.ctx.capterReleves('111');
      T('un mois déjà capté n\'est pas redemandé', b2.demandes.length === 0, JSON.stringify(b2.demandes));

      // plafond par visite
      const gros = []; for (let m = 1; m <= 6; m++) gros.push({ year: 2026, month: m, title: 'M' + m });
      const b3 = banc({ hist: gros });
      await b3.ctx.capterReleves('111');
      const cap = Number((/RELEVE_MAX_PAR_VISITE\s*=\s*(\d+)/.exec(src) || [])[1] || 0);
      T(`le plafond par visite est respecté (${cap})`, cap > 0 && b3.demandes.length === cap, `${b3.demandes.length} requêtes pour un plafond de ${cap}`);

      // ⚠️ le paramètre est ignoré → on s'arrête DÉFINITIVEMENT
      const b4 = banc({ hist: gros, reponses: () => ({ ...REEL, starting_date: '2026-08-01' }) });
      await b4.ctx.capterReleves('111');
      T('un paramètre ignoré arrête la boucle tout de suite', b4.demandes.length === 1, `${b4.demandes.length} requêtes`);
      T('et le compte est marqué muet (plus jamais réessayé)', !!(b4.store.vrmReleveMuet && b4.store.vrmReleveMuet['111']), JSON.stringify(b4.store.vrmReleveMuet));
      const avant = b4.demandes.length;
      await b4.ctx.capterReleves('111');
      T('une seconde visite ne redemande rien', b4.demandes.length === avant, `${b4.demandes.length} requêtes`);
    }
  }

  console.log('\n=== 4. LE CÂBLAGE (les deux voies d\'écriture + la visite) ===');
  {
    const passif = /if \(type === 'billing'\) \{ try \{ await storeReleve\(uid, parsed/.test(src);
    const actif = /if \(type === 'billing'\) \{ try \{ await storeReleve\(uid, brut/.test(src);
    T('la capture PASSIVE range le relevé', passif);
    T('la moisson ACTIVE range le relevé (payload brut)', actif);
    T('la visite va chercher les mois passés', /await capterReleves\(uid\);/.test(src));
    // Le relevé ne doit pas dépendre du tri « est-ce un porte-monnaie ? » :
    // une réponse peut porter les mouvements sans porter de solde.
    const iPassif = src.indexOf("await storeReleve(uid, parsed");
    const iTri = src.indexOf("!estPorteMonnaie(parsed)");
    T('le relevé est rangé AVANT le tri du solde', iPassif > 0 && iTri > 0 && iPassif < iTri, `${iPassif} / ${iTri}`);
  }

  console.log(`\n${ko === 0 ? '✅' : '❌'} ${ok} contrôle(s) au vert, ${ko} en échec.`);
  process.exit(ko === 0 ? 0 : 1);
})();
