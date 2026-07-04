// api/vinted-refresh.js
// Rafraichit de facon CENTRALISEE les tokens Vinted de tous les comptes lies,
// puis les persiste dans Supabase. But : que Julien puisse consulter ses comptes
// depuis n'importe quel appareil SANS avoir a se reconnecter ni a repasser par
// l'extension - les autres applis Vinted font pareil (elles gardent la session
// vivante via le refresh_token).
//
// Appele :
//  - a l'ouverture de l'app (App.jsx, une fois au demarrage) ;
//  - par un cron Vercel (voir vercel.json) toutes les quelques heures, pour que
//    la session reste vivante meme quand l'app n'est pas ouverte.
//
// Point cle : on ne rafraichit QUE si l'access_token est expire (ou proche de
// l'expiration). Vinted fait tourner le refresh_token a chaque refresh (l'ancien
// est invalide), donc rafraichir inutilement multiplie les rotations et les
// risques de course entre appareils. On decode l'exp du JWT pour l'eviter.

const SUPABASE_URL = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

// Marge : on rafraichit si le token expire dans moins de 15 min.
const REFRESH_MARGIN_S = 15 * 60;

// Decode l'exp (timestamp) d'un JWT sans verifier la signature.
function jwtExp(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).exp || 0;
  } catch { return 0; }
}

function readSetCookie(headers, name) {
  let list = [];
  try { if (typeof headers.getSetCookie === 'function') list = headers.getSetCookie(); } catch { /* ignore */ }
  if (!list.length) { const raw = headers.get('set-cookie'); if (raw) list = [raw]; }
  for (const c of list) {
    const m = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(c);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function refreshOne(acc) {
  const host = (acc.domain && acc.domain.startsWith('www.')) ? acc.domain : 'www.vinted.fr';
  const cookie = [
    `access_token_web=${acc.access_token}`,
    acc.refresh_token ? `refresh_token_web=${acc.refresh_token}` : '',
    acc.anon_id ? `anon_id=${acc.anon_id}` : '',
  ].filter(Boolean).join('; ');
  const res = await fetch(`https://${host}/web/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'x-anon-id': acc.anon_id || '',
      'x-csrf-token': acc.csrf_token || '',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return null;
  let json = {};
  try { json = await res.json(); } catch { json = {}; }
  const newAccess = json.access_token || readSetCookie(res.headers, 'access_token_web');
  const newRefresh = json.refresh_token || readSetCookie(res.headers, 'refresh_token_web') || acc.refresh_token;
  if (!newAccess) return null;
  return { access_token: newAccess, refresh_token: newRefresh };
}

async function persist(acc, tokens) {
  await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${acc.vinted_user_id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() }),
  });
}

export default async function handler(req, res) {
  try {
    const listRes = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!listRes.ok) { res.status(502).json({ error: 'Lecture Supabase impossible' }); return; }
    const accounts = await listRes.json();
    const now = Math.floor(Date.now() / 1000);
    const summary = [];
    for (const acc of accounts) {
      if (!acc.refresh_token) { summary.push({ id: acc.vinted_user_id, action: 'skip_no_refresh' }); continue; }
      const exp = jwtExp(acc.access_token);
      if (exp && exp - now > REFRESH_MARGIN_S) { summary.push({ id: acc.vinted_user_id, action: 'still_valid' }); continue; }
      const tokens = await refreshOne(acc);
      if (tokens) { await persist(acc, tokens); summary.push({ id: acc.vinted_user_id, action: 'refreshed' }); }
      else { summary.push({ id: acc.vinted_user_id, action: 'refresh_failed' }); }
    }
    res.status(200).json({ ok: true, count: accounts.length, summary });
  } catch (err) {
    res.status(500).json({ error: 'Echec du refresh global', detail: String(err) });
  }
}
