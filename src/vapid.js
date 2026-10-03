// La clé PUBLIQUE des notifications, UNE seule fois pour l'app (§11).
// Un abonnement push est scellé à la clé avec laquelle il a été créé : s'il en
// existe deux, la moitié des abonnements est refusée par Apple/Google
// (403, VapidPkHashMismatch) et rien ne le dit — « je ne reçois plus de notif ».
// Elle doit être ÉGALE à `VAPID_PUBLIC` d'api/_lib/push.js (la paire du
// serveur) et à celle de public/sw.js, qui ne peut pas importer ce fichier.
// `scripts/audit-vapid.cjs` le vérifie.
export const VAPID_PUBLIC_KEY = 'BIImaPEF-sZb0ohfXGjjR2eKYVVAyz1I3-fYXNlsSUrTQfGM4le_OxJbUML2YyL5ctFea-LS7NfPD9RotDJ0bbc';
export const cleVapid = (b64 = VAPID_PUBLIC_KEY) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); const a = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
  return a;
};
// L'abonnement a-t-il été créé avec CETTE clé ? Clé illisible ⇒ on ne casse rien.
export const abonnementAJour = (sub) => {
  try {
    const a = new Uint8Array(sub.options.applicationServerKey);
    const b = cleVapid();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  } catch (_) { return true; }
};
