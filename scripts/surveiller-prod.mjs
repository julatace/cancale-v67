#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// vrm.center RÉPOND-IL ? — node scripts/surveiller-prod.mjs (12 nov., agent2-fiabilite-prod)
// ═══════════════════════════════════════════════════════════════════════════
// Lancé toutes les 5 minutes par .github/workflows/surveillance.yml. AUCUN
// secret, AUCUNE session : deux lectures publiques.
//   1. la page d'accueil répond 200 ;
//   2. /api/sante répond 200, `ok: true`, et la base n'est pas « panne »
//      (`etat.base` : « inconnu » = pas su, ce n'est PAS une panne).
// Un essai rouge est REJOUÉ après PAUSE_S secondes (60 par défaut) : seules DEUX
// réponses ratées de suite font une alerte (une seconde de lenteur ne réveille
// personne).
// L'alerte : UNE issue GitHub « vrm.center ne répond pas » (GitHub envoie un
// e-mail à Julien à l'ouverture). Tant que c'est rouge : rien de plus (pas de
// bruit). Revenu au vert : un commentaire « c'est revenu » (second e-mail) et
// l'issue se ferme toute seule. Sans jeton GitHub (essai local) : le code de
// sortie seul (0 vert · 1 rouge).
// Entrées : SITE (défaut https://vrm.center), PAUSE_S, DELAI_S (20),
// GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL, RUN_URL, RESULTAT (fichier JSON).
import fs from 'node:fs';

export const TITRE = 'vrm.center ne répond pas';
const SITE = String(process.env.SITE || 'https://vrm.center').replace(/\/+$/, '');
const PAUSE_S = Number.isFinite(Number(process.env.PAUSE_S)) ? Number(process.env.PAUSE_S) : 60;
const DELAI_S = Number(process.env.DELAI_S) > 0 ? Number(process.env.DELAI_S) : 20;
const API = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const DEPOT = process.env.GITHUB_REPOSITORY || '';
const JETON = process.env.GITHUB_TOKEN || '';
const RUN_URL = process.env.RUN_URL || '';

async function lire(chemin) {
  try {
    const r = await fetch(SITE + chemin, { headers: { accept: chemin.startsWith('/api/') ? 'application/json' : 'text/html', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(DELAI_S * 1000), redirect: 'follow' });
    return { status: r.status, texte: await r.text() };
  } catch (e) { return { status: 0, texte: '', erreur: String((e && e.name === 'TimeoutError') ? `pas de réponse en ${DELAI_S} s` : (e && e.message) || e).slice(0, 160) }; }
}

export async function essai() {
  const raisons = [];
  const page = await lire('/');
  if (page.status !== 200) raisons.push(`page d’accueil : ${page.status ? 'HTTP ' + page.status : page.erreur}`);
  const s = await lire('/api/sante');
  if (s.status !== 200) raisons.push(`/api/sante : ${s.status ? 'HTTP ' + s.status : s.erreur}`);
  else {
    let j = null; try { j = JSON.parse(s.texte); } catch (_) {}
    if (!j || j.ok !== true) raisons.push('/api/sante : « ok » n’est pas vrai');
    else if (j.etat && j.etat.base === 'panne') raisons.push('la base de données ne répond pas (etat.base = panne)');
  }
  return { ok: !raisons.length, raisons, a: new Date().toISOString() };
}

async function gh(methode, chemin, corps) {
  const r = await fetch(API + chemin, { method: methode, headers: { authorization: `Bearer ${JETON}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(corps ? { 'content-type': 'application/json' } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${methode} ${chemin} : HTTP ${r.status} ${t.slice(0, 160)}`);
  try { return JSON.parse(t); } catch (_) { return null; }
}
const quand = () => new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });

export function corpsAlerte(e1, e2) {
  return [
    `**${SITE} ne répond pas correctement, deux fois de suite** (à ${PAUSE_S} s d’écart).`,
    '',
    `Dernier essai : ${quand()}${RUN_URL ? ` — [le détail](${RUN_URL})` : ''}`,
    '',
    '### Ce qui ne va pas',
    ...[...new Set([...e1.raisons, ...e2.raisons])].map((r) => `- ${r}`),
    '',
    '### Quoi faire',
    '- Ouvrir https://vrm.center sur ton téléphone : si ça marche, c’était passager (l’issue se fermera toute seule).',
    '- Si ça ne marche pas depuis la dernière mise en ligne : revenir à la version d’avant (docs/passation/2026-11-12-guide-fiabilite-julien.md, « Revenir à la version d’avant »).',
    '- Si c’est la base : https://status.supabase.com puis ton projet Supabase.',
    '',
    '_Cette issue ne se répète pas tant que c’est rouge ; elle se ferme toute seule quand vrm.center répond de nouveau. Écrite par .github/workflows/surveillance.yml._',
  ].join('\n');
}

export async function tenirIssue(etat, e1, e2) {
  if (!JETON || !/^[^/]+\/[^/]+$/.test(DEPOT)) return 'sans jeton : aucune issue';
  const ouvertes = ((await gh('GET', `/repos/${DEPOT}/issues?state=open&per_page=100`)) || []).filter((i) => i && !i.pull_request && i.title === TITRE).sort((a, b) => a.number - b.number);
  if (etat === 'rouge') {
    if (ouvertes.length) return `issue #${ouvertes[0].number} déjà ouverte : rien de plus (pas de bruit)`;
    const n = await gh('POST', `/repos/${DEPOT}/issues`, { title: TITRE, body: corpsAlerte(e1, e2) });
    return `issue #${n && n.number} ouverte (e-mail de GitHub)`;
  }
  for (const i of ouvertes) {
    await gh('POST', `/repos/${DEPOT}/issues/${i.number}/comments`, { body: `C’est revenu : ${SITE} répond de nouveau (${quand()}). Issue fermée toute seule.` });
    await gh('PATCH', `/repos/${DEPOT}/issues/${i.number}`, { state: 'closed', state_reason: 'completed' });
  }
  return ouvertes.length ? `${ouvertes.length} issue(s) fermée(s) : revenu au vert` : 'vert, rien à faire';
}

async function principal() {
  const e1 = await essai();
  let e2 = null;
  if (!e1.ok) { console.log(`Premier essai rouge : ${e1.raisons.join(' · ')} — rejoué dans ${PAUSE_S} s.`); await new Promise((r) => setTimeout(r, PAUSE_S * 1000)); e2 = await essai(); }
  const etat = e1.ok || (e2 && e2.ok) ? 'vert' : 'rouge';
  let issue = '';
  try { issue = await tenirIssue(etat, e1, e2 || e1); } catch (e) { issue = 'issue pas tenue à jour : ' + String((e && e.message) || e).slice(0, 200); console.log('::warning::' + issue); }
  const bilan = { etat, essais: [e1, e2].filter(Boolean), issue };
  if (process.env.RESULTAT) { try { fs.writeFileSync(process.env.RESULTAT, JSON.stringify(bilan, null, 2)); } catch (_) {} }
  console.log(`${etat === 'vert' ? '✅' : '❌'} ${SITE} : ${etat}${etat === 'rouge' ? ' — ' + [...new Set([...(e1.raisons || []), ...((e2 && e2.raisons) || [])])].join(' · ') : ''} · ${issue}`);
  // Dans le workflow (ECHEC_SI_ROUGE=0) : l'issue EST l'alerte ; le run n'échoue que si
  // elle n'a pas pu être ouverte (alors l'e-mail « run failed » de GitHub prend le relais).
  if (etat === 'vert') return 0;
  if (process.env.ECHEC_SI_ROUGE === '0' && /ouverte|déjà ouverte/.test(issue)) return 0;
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) principal().then((c) => process.exit(c));
