// ═══════════════════════════════════════════════════════════
// VRM — Porte-monnaie Vinted
// Quand tu navigues sur Vinted, ce script lit le solde de ton
// porte-monnaie et l'envoie dans VRM (Firebase). Zéro action requise.
// ═══════════════════════════════════════════════════════════

const FIREBASE = 'https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale';
// Même clé que dans VRM → Paramètres → Clé secrète Firebase (laisser '' si base non verrouillée)
const FIREBASE_SECRET = '';

const authUrl = (path) => {
  let url = FIREBASE + path + '.json';
  if (FIREBASE_SECRET) url += '?auth=' + encodeURIComponent(FIREBASE_SECRET);
  return url;
};

// ── Détecte le pseudo du compte connecté (lien vers /member/123-pseudo) ──
function detectPseudo() {
  const links = document.querySelectorAll('a[href*="/member/"]');
  for (const a of links) {
    const m = (a.getAttribute('href') || '').match(/\/member\/\d+-([a-z0-9._-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// ── Lit le solde du porte-monnaie sur la page ──
function detectBalance() {
  const text = document.body ? document.body.innerText : '';
  // Cherche un montant € à moins de 80 caractères de "Porte-monnaie" ou "Solde"
  const m = text.match(/(?:porte-monnaie|solde(?:\s+actuel|\s+disponible)?)[^€]{0,80}?(\d{1,3}(?:[  .]\d{3})*(?:[,.]\d{1,2})?)\s*€/i);
  if (!m) return null;
  const raw = m[1].replace(/[  ]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const solde = parseFloat(raw);
  return isNaN(solde) ? null : solde;
}

// ── Associe le pseudo Vinted au compte VRM correspondant ──
async function walletKey(pseudo) {
  try {
    const res = await fetch(authUrl('/vinted_accounts'));
    const accounts = await res.json();
    if (Array.isArray(accounts)) {
      const match = accounts.find(a =>
        (a.pseudo && a.pseudo.toLowerCase() === pseudo) ||
        (a.name && a.name.toLowerCase() === pseudo) ||
        (a.email && a.email.split('@')[0].toLowerCase() === pseudo)
      );
      if (match) return match.id;
    }
  } catch (_) {}
  return pseudo; // à défaut, la clé est le pseudo lui-même
}

// ── Envoie le solde (seulement s'il a changé depuis le dernier envoi) ──
async function syncBalance() {
  const solde = detectBalance();
  if (solde === null) return;
  const pseudo = detectPseudo() || 'principal';

  const cacheKey = 'vrm_last_wallet_' + pseudo;
  if (sessionStorage.getItem(cacheKey) === String(solde)) return; // déjà envoyé

  const key = await walletKey(pseudo);
  try {
    await fetch(authUrl('/vrm_wallets/' + encodeURIComponent(key)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        solde: solde,
        updatedAt: new Date().toISOString(),
        source: 'vinted',
        pseudo: pseudo,
      }),
    });
    sessionStorage.setItem(cacheKey, String(solde));
    console.log('[VRM] Porte-monnaie synchronisé :', pseudo, solde + ' €');
  } catch (e) {
    console.warn('[VRM] Échec synchro porte-monnaie', e);
  }
}

// ═══════════════════════════════════════════════════════════
// ANNONCES — quand tu es sur TON profil, l'extension lit tes
// annonces en ligne (titre, prix, n° d'article) et les envoie à VRM.
// Le scan s'accumule pendant que tu fais défiler la page.
// ═══════════════════════════════════════════════════════════

const seenItems = {}; // par pseudo : { itemId: {id,title,price,url} }

// Sommes-nous sur la page du profil du compte connecté ?
function ownProfilePseudo() {
  const m = location.pathname.match(/\/member\/\d+-([a-z0-9._-]+)/i);
  if (!m) return null;
  const pseudo = detectPseudo();
  return (pseudo && m[1].toLowerCase() === pseudo) ? pseudo : null;
}

function scanAnnonces(pseudo) {
  if (!seenItems[pseudo]) seenItems[pseudo] = {};
  const bucket = seenItems[pseudo];
  document.querySelectorAll('a[href*="/items/"]').forEach(a => {
    const m = (a.getAttribute('href') || '').match(/\/items\/(\d+)/);
    if (!m) return;
    const id = m[1];
    const img = a.querySelector('img');
    const title = (a.getAttribute('title') || (img && img.alt) || '').trim();
    const tile = a.closest('div[class],li') || a.parentElement || a;
    const pm = (tile.innerText || '').match(/(\d{1,4}(?:[,.]\d{2})?)\s*€/);
    const price = pm ? parseFloat(pm[1].replace(',', '.')) : null;
    if (!bucket[id] || (price !== null && bucket[id].price === null) || (title && !bucket[id].title)) {
      bucket[id] = { id, title, price, url: 'https://www.vinted.fr/items/' + id };
    }
  });
}

async function syncAnnonces() {
  const pseudo = ownProfilePseudo();
  if (!pseudo) return;
  scanAnnonces(pseudo);
  const items = Object.values(seenItems[pseudo] || {});
  if (items.length === 0) return;

  const sig = items.map(i => i.id).sort().join(',');
  const cacheKey = 'vrm_last_annonces_' + pseudo;
  if (sessionStorage.getItem(cacheKey) === sig) return; // rien de nouveau

  const key = await walletKey(pseudo);
  try {
    await fetch(authUrl('/vrm_annonces/' + encodeURIComponent(key)), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pseudo: pseudo,
        count: items.length,
        items: items,
        updatedAt: new Date().toISOString(),
      }),
    });
    sessionStorage.setItem(cacheKey, sig);
    console.log('[VRM] Annonces synchronisées :', pseudo, items.length);
  } catch (e) {
    console.warn('[VRM] Échec synchro annonces', e);
  }
}

// Vinted est une SPA : on re-scanne à chaque navigation + toutes les 20 s
syncBalance();
syncAnnonces();
setInterval(() => { syncBalance(); syncAnnonces(); }, 20000);
