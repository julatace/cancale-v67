// ── /api/email-rattacher ──────────────────────────────────────────────────────
// Rejoue un email mis en QUARANTAINE (adresse de réception inconnue, ou
// plusieurs vendeurs destinataires) au profit du vendeur qui le réclame.
//
// Pourquoi ça existe : la règle d'attribution refuse de deviner (voir
// api/_lib/proprietaire-email.js). Sans ce bouton, un email non reconnu serait
// conservé mais inexploitable — donc perdu en pratique.
//
// ⚠️ QUI PEUT RÉCLAMER : seulement quelqu'un qui prouve son identité, en
// présentant le jeton de sa session (celui de l'app). On le vérifie auprès de
// Supabase avant toute chose — sinon n'importe qui pourrait s'attribuer les
// emails d'un autre vendeur, ce qui serait pire que le problème d'origine.
import { traiterEmail } from './email-inbound.js';
import { contexteVendeur } from './_lib/owner.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const ANON = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const SERVICE = process.env.SUPABASE_SERVICE_KEY || ANON;
const HEADERS = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

// Le jeton présenté appartient-il vraiment à quelqu'un ? Supabase répond.
async function vendeurDuJeton(jeton) {
  if (!jeton) return '';
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${jeton}` },
    });
    if (!r.ok) return '';
    const j = await r.json();
    return String((j && j.id) || '');
  } catch (_) { return ''; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const jeton = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const owner = await vendeurDuJeton(jeton);
  // Tant que la base n'est pas cloisonnée, il n'y a qu'un jeu de données et
  // personne n'est connecté : on accepte alors le rattachement sans jeton, mais
  // SANS propriétaire (comportement identique à aujourd'hui). Dès qu'une session
  // existe, elle fait foi.
  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const id = String(corps.id || '');
  if (!/^email_quarantaine_[A-Za-z0-9_-]+$/.test(id)) { res.status(400).json({ error: 'identifiant invalide' }); return; }

  // On relit l'email conservé.
  let ligne = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=data`, { headers: HEADERS });
    if (r.ok) { const j = await r.json(); ligne = (j[0] && j[0].data) || null; }
  } catch (_) {}
  if (!ligne) { res.status(404).json({ error: 'email introuvable (déjà rattaché ?)' }); return; }

  // Rejeu : exactement le même traitement que si l'email venait d'arriver, mais
  // avec le propriétaire imposé. `__ownerForce` est posé ici, côté serveur.
  const faux = {
    method: 'POST', query: { key: process.env.EMAIL_INBOUND_SECRET || '' }, headers: {},
    body: { from: ligne.from, to: ligne.to, subject: ligne.subject, text: ligne.text, html: ligne.html },
    __ownerForce: owner || '',
  };
  let resultat = null;
  const capture = { setHeader() {}, status() { return this; }, json(o) { resultat = o; return this; } };
  // `silencieux` : rejeu en lot → on ne renotifie pas. Isolé par requête.
  await contexteVendeur.run({ owner: owner || '', silence: !!corps.silencieux }, () => traiterEmail(faux, capture));

  // Rattaché avec succès → la ligne de quarantaine n'a plus lieu d'être.
  // ⚠️ On ne supprime QUE si le traitement a réellement abouti : sinon on
  // détruirait le seul exemplaire de l'email.
  if (resultat && resultat.ok && !resultat.quarantaine) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: HEADERS });
    } catch (_) {}
  }
  res.status(200).json({ ok: !!(resultat && resultat.ok), owner: owner || null, resultat });
}
