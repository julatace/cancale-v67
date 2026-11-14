// ════════════════════════════════════════════════════════════════════════════
//  MAINS LIBRES PENDANT L'EMBALLAGE (14 nov., proposition 100 validée par Julien)
//  « suivant », « précédent », « imprimer », « fait », « stop » — à la voix, sans
//  toucher l'écran, dans « Préparer mes colis ».
//
//  ⚠️ LA RECONNAISSANCE EST CELLE DU NAVIGATEUR (Web Speech API) — aucune clé, aucun
//  serveur à nous, aucun son enregistré ni envoyé par VRM (§2.9). Le navigateur peut
//  la faire passer par le service de son éditeur (dit dans le « ? »). Sans elle
//  (Firefox, Safari d'iPhone selon la version) : le bouton dit pourquoi, puis disparaît.
//  ⚠️ COMMANDES FERMÉES : une phrase COURTE (3 mots au plus) qui contient UNE seule des
//  cinq commandes ; deux commandes différentes, ou une phrase longue (« il fait froid
//  ce matin »), ne font RIEN. Jamais une ressemblance : les mots de la liste, entiers.
//  « fait » passe par le geste de l'écran : « Colis fait » différé de 5 s, « Annuler ».
//  Module PUR (sauf `ecouterCommandes`, qui parle au navigateur) : exécuté par
//  scripts/audit-colis-plus.cjs avec une fausse reconnaissance.
// ════════════════════════════════════════════════════════════════════════════
import { voixDisponible, codeErreurVoix, VOIX } from './dicteeNavigateur.js';

export const COMMANDES = ['suivant', 'precedent', 'imprimer', 'fait', 'stop'];
export const MOTS_MAX = 3;
// Les mots de chaque commande, par langue (sans accents, en minuscules).
export const MOTS_COMMANDES = {
  fr: { suivant: ['suivant', 'suivante'], precedent: ['precedent', 'precedente'], imprimer: ['imprimer', 'imprime', 'imprimez'], fait: ['fait', 'c est fait'], stop: ['stop', 'arrete', 'arreter'] },
  en: { suivant: ['next'], precedent: ['previous', 'back'], imprimer: ['print'], fait: ['done'], stop: ['stop'] },
  es: { suivant: ['siguiente'], precedent: ['anterior'], imprimer: ['imprimir', 'imprime'], fait: ['hecho', 'listo'], stop: ['para', 'parar', 'stop'] },
  it: { suivant: ['avanti', 'successivo', 'prossimo'], precedent: ['precedente', 'indietro'], imprimer: ['stampa', 'stampare'], fait: ['fatto'], stop: ['stop', 'basta'] },
  de: { suivant: ['weiter', 'nachster', 'nachste'], precedent: ['zuruck', 'vorheriger'], imprimer: ['drucken'], fait: ['fertig', 'erledigt'], stop: ['stopp', 'stop'] },
};
// Les seuls autres mots admis autour d'une commande (« ok suivant », « colis suivant »,
// « c'est fait ») : tout autre mot ⇒ ce n'est pas une commande.
export const MOTS_LIBRES = {
  fr: ['ok', 'okay', 'colis', 'le', 'la', 'c', 'est', 'euh', 'bon', 'alors', 'vas', 'y'],
  en: ['ok', 'okay', 'parcel', 'the', 'one', 'please'],
  es: ['ok', 'vale', 'el', 'paquete', 'por', 'favor'],
  it: ['ok', 'il', 'pacco', 'per', 'favore'],
  de: ['ok', 'okay', 'das', 'paket', 'bitte'],
};
export const LANGUES_VOIX = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };

export const normaliserParole = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Ce qu'une phrase entendue commande : une des COMMANDES, ou null (rien, trop long, deux à la fois).
export function commandeDe(texte, langue = 'fr') {
  const t = normaliserParole(texte);
  if (!t) return null;
  const mots = t.split(' ');
  if (mots.length > MOTS_MAX) return null;
  const table = MOTS_COMMANDES[langue] || MOTS_COMMANDES.fr;
  const libres = MOTS_LIBRES[langue] || MOTS_LIBRES.fr;
  const trouvees = new Set();
  let reste = ` ${t} `;
  for (const c of COMMANDES) for (const m of (table[c] || []).slice().sort((a, b) => b.length - a.length)) {
    if (reste.includes(` ${m} `)) { trouvees.add(c); reste = reste.split(` ${m} `).join(' '); }
  }
  if (trouvees.size !== 1) return null;
  // Tout ce qui reste doit être un mot admis : « il fait froid » n'est pas « fait ».
  return reste.trim().split(' ').filter(Boolean).every((w) => libres.includes(w)) ? [...trouvees][0] : null;
}

// L'état du bouton : 'absent' (pas de reconnaissance dans ce navigateur) · 'refuse'
// (micro refusé cette session) · 'pret'.
export function etatMainsLibres() {
  if (!voixDisponible()) return 'absent';
  if (VOIX.refus) return 'refuse';
  return 'pret';
}

// Écouter EN CONTINU jusqu'à `arreter()` (ou « stop »). Chaque phrase finale ⇒
// `onEntendu(texte, commande|null)`. La reconnaissance s'arrête d'elle-même après un
// silence : elle est relancée tant que l'écoute est voulue (au plus `relancesMax` de
// suite sans rien entendre). Une erreur qui dit quoi faire ⇒ `onErreur(code)` et fin.
// Rend { arreter } ou null si rien n'a pu démarrer.
export function ecouterCommandes({ langue = 'fr', onEntendu, onErreur, onFin, relancesMax = 20, SR = null } = {}) {
  const Ctor = SR || (typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null);
  if (typeof Ctor !== 'function' || VOIX.refus) return null;
  let voulu = true, rec = null, vides = 0;
  const finir = () => { voulu = false; if (onFin) { try { onFin(); } catch (_) {} } };
  const demarrer = () => {
    try { rec = new Ctor(); } catch (_) { finir(); return false; }
    try { rec.lang = LANGUES_VOIX[langue] || 'fr-FR'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1; } catch (_) {}
    let entendu = false;
    rec.onresult = (e) => {
      const rs = e && e.results; if (!rs) return;
      for (let i = (e.resultIndex || 0); i < rs.length; i++) {
        const r = rs[i]; if (r && r.isFinal === false) continue;
        const t = r && r[0] && r[0].transcript ? String(r[0].transcript).trim() : '';
        if (!t) continue;
        entendu = true;
        const c = commandeDe(t, langue);
        if (onEntendu) { try { onEntendu(t, c); } catch (_) {} }
        if (c === 'stop') { arreter(); return; }
      }
    };
    rec.onerror = (e) => {
      const code = codeErreurVoix(e);
      if (code === 'refus') VOIX.refus = true;
      if (code && code !== 'aucun-son') { voulu = false; if (onErreur) { try { onErreur(code); } catch (_) {} } }
    };
    rec.onend = () => {
      if (!voulu) { finir(); return; }
      vides = entendu ? 0 : vides + 1;
      if (vides > relancesMax) { finir(); return; }
      setTimeout(() => { if (voulu) { if (!demarrer()) finir(); } else finir(); }, 250);
    };
    try { rec.start(); } catch (_) { finir(); return false; }
    return true;
  };
  function arreter() { if (!voulu) return; voulu = false; try { rec && (rec.abort ? rec.abort() : rec.stop()); } catch (_) {} }
  if (!demarrer()) return null;
  return { arreter, get actif() { return voulu; } };
}
