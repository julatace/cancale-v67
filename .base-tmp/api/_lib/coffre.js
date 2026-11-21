// ── LE COFFRE DU SERVEUR (chiffrement des secrets d'un vendeur) ──────────────
// Une seule règle pour tout secret qu'un vendeur colle dans VRM (identifiants
// Super PDP, clé Photoroom…) : AES-256-GCM, avec une clé qui n'existe QUE sur
// le serveur — dérivée (HKDF) de VRM_COFFRE_CLE, sinon de SUPABASE_SERVICE_KEY —
// et l'identifiant du vendeur comme donnée associée. Un navigateur qui lit SA
// ligne (RLS le lui permet) n'y voit qu'un chiffré ; un chiffré recopié chez un
// autre vendeur ne se déchiffre pas. Chaque usage a SA clé dérivée (`usage` est
// l'« info » de HKDF) : un chiffré Super PDP ne se déchiffre pas comme une clé
// Photoroom. Sans clé de coffre : `null` partout — l'appelant ne range RIEN
// (jamais en clair).
import crypto from 'crypto';

const base = () => process.env.VRM_COFFRE_CLE || process.env.SUPABASE_SERVICE_KEY || '';

export function cleCoffre(usage) {
  const b = base();
  if (!b) return null;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(b, 'utf8'), Buffer.from('vrm-coffre'), Buffer.from(String(usage)), 32));
}
export const coffrePret = () => !!base();

export function chiffrerCoffre(usage, owner, obj) {
  const k = cleCoffre(usage); if (!k) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from(String(owner)));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}
export function dechiffrerCoffre(usage, owner, s) {
  const k = cleCoffre(usage); if (!k) return null;
  const p = String(s || '').split('.');
  if (p.length !== 4 || p[0] !== 'v1') return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(p[1], 'base64'));
    d.setAAD(Buffer.from(String(owner)));
    d.setAuthTag(Buffer.from(p[2], 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8'));
  } catch (_) { return null; }
}
