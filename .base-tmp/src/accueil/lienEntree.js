// ── LES LIENS D'ENTRÉE DE LA PAGE PUBLIQUE GARDENT LEUR SUITE (15 nov., lot site-public) ──
// Un visiteur arrive sur vrm.center avec une suite d'adresse (`?utm_source=…`, le code d'un
// partenaire, `?ref=…`) : « Essayer gratuitement » et « Se connecter » la PORTENT telle quelle
// jusqu'au formulaire (`/?inscription&code=…`). Cette page ne la lit pas, ne la change pas et
// ne la range nulle part : celui qui la rattache (le programme partenaire) la trouve intacte
// dans l'adresse de l'inscription.
// Seuls nos propres mots d'entrée (inscription, connexion, exemple) sont retirés, pour ne
// jamais en écrire deux. Module PUR, sans dépendance (fichier d'entrée au budget compté) ;
// exécuté par scripts/bancs/site-public.cjs.
const NOS_MOTS = new Set(['inscription', 'connexion', 'exemple']);
const nomDe = (p) => { const n = String(p).split('=')[0] || ''; try { return decodeURIComponent(n); } catch (_) { return n; } };

export function suiteAdresse(search) {
  const s = String(search == null ? '' : search).replace(/^\?/, '');
  if (!s) return '';
  return s.split('&').filter((p) => p && !NOS_MOTS.has(nomDe(p))).join('&');
}

// `lienEntree('inscription', '?code=ABC')` ⇒ `/?inscription&code=ABC`.
export function lienEntree(mot, search) {
  let s = search;
  if (s === undefined) { try { s = window.location.search || ''; } catch (_) { s = ''; } }
  const suite = suiteAdresse(s);
  return `/?${mot}${suite ? '&' + suite : ''}`;
}
