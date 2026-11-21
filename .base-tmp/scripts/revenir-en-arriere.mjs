#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REVENIR À LA VERSION D'AVANT — node scripts/revenir-en-arriere.mjs (12 nov., agent2-fiabilite-prod)
// ═══════════════════════════════════════════════════════════════════════════
// Lancé À LA MAIN par Julien : GitHub → Actions → « Revenir à la version d'avant »
// → Run workflow (.github/workflows/revenir-en-arriere.yml). Pas-à-pas :
// docs/passation/2026-11-12-guide-fiabilite-julien.md.
//
// Deux façons, choisies par MODE :
//   · `vercel` (instantané, quelques secondes) : remet en ligne le déploiement de
//     PRODUCTION d'avant celui qui sert aujourd'hui (Vercel « Instant Rollback » ;
//     sur le plan Hobby, seul le précédent est permis). Il faut le secret
//     VERCEL_TOKEN. ⚠️ Ensuite Vercel ne met PLUS en ligne les nouvelles fusions
//     tout seul tant qu'on n'a pas « promu » un déploiement (le guide le dit).
//   · `git` (sans aucun secret) : prépare l'annulation de la DERNIÈRE fusion sur
//     main (`git revert -m 1`) sur une branche `retour/…`, et ouvre une demande de
//     fusion « Revenir à la version d'avant » : Julien la fusionne (un clic), Vercel
//     remet en ligne comme d'habitude. Si GitHub refuse d'ouvrir la demande, le
//     lien pour l'ouvrir est donné.
// Sans CONFIRMER=OUI : on DIT ce qui serait fait, rien n'est touché.
// L'EXTENSION a ses propres versions (zip) : un retour arrière de l'app ne la
// change pas (le guide dit quoi faire si c'est elle).
// Codes : 0 fait (ou aperçu) · 1 refusé / pas possible · 2 mauvaise utilisation.
import { spawnSync } from 'node:child_process';

const MODE = String(process.env.MODE || '').toLowerCase();
const CONFIRMER = String(process.env.CONFIRMER || '').trim().toUpperCase() === 'OUI';
const dire = (t) => console.log(t);

// ── Vercel ───────────────────────────────────────────────────────────────────
const VAPI = String(process.env.VERCEL_API || 'https://api.vercel.com').replace(/\/+$/, '');
const VJETON = process.env.VERCEL_TOKEN || '';
const PROJET = process.env.VERCEL_PROJET || 'cancale-v67';
async function v(methode, chemin) {
  const r = await fetch(VAPI + chemin, { method: methode, headers: { authorization: `Bearer ${VJETON}`, 'content-type': 'application/json' } });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
  if (!r.ok) throw new Error(`${methode} ${chemin.split('?')[0]} : HTTP ${r.status} ${(j && j.error && j.error.message) || t.slice(0, 120)}`);
  return j;
}
export async function choisirVercel() {
  let equipe = process.env.VERCEL_EQUIPE || '';
  if (!equipe) { const t = await v('GET', '/v2/teams?limit=20'); const ts = (t && t.teams) || []; if (ts.length === 1) equipe = ts[0].id; }
  const q = equipe ? `teamId=${encodeURIComponent(equipe)}` : '';
  const projet = await v('GET', `/v9/projects/${encodeURIComponent(PROJET)}${q ? '?' + q : ''}`);
  const actuel = projet && projet.targets && projet.targets.production && projet.targets.production.id;
  if (!actuel) return { refus: 'déploiement de production actuel introuvable' };
  const liste = await v('GET', `/v6/deployments?projectId=${encodeURIComponent(projet.id)}&target=production&state=READY&limit=20${q ? '&' + q : ''}`);
  const deps = ((liste && liste.deployments) || []).filter((d) => d && d.uid && (d.target === 'production' || d.target == null) && (d.state || d.readyState) === 'READY');
  deps.sort((a, b) => (b.created || b.createdAt || 0) - (a.created || a.createdAt || 0));
  const iActuel = deps.findIndex((d) => d.uid === actuel);
  const tActuel = iActuel >= 0 ? (deps[iActuel].created || deps[iActuel].createdAt) : Infinity;
  const precedent = deps.find((d) => d.uid !== actuel && (d.created || d.createdAt || 0) < tActuel);
  if (!precedent) return { refus: 'aucun déploiement de production prêt AVANT celui d’aujourd’hui' };
  return { projetId: projet.id, q, actuel, precedent };
}
async function vercel() {
  if (!VJETON) { dire('✗ Le secret VERCEL_TOKEN n’est pas posé : prends le mode « git » (sans secret), ou pose le secret (le guide dit comment).'); return 1; }
  const c = await choisirVercel();
  if (c.refus) { dire('✗ ' + c.refus); return 1; }
  const quand = new Date(c.precedent.created || c.precedent.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' });
  const msg = (c.precedent.meta && (c.precedent.meta.githubCommitMessage || '')).split('\n')[0].slice(0, 90);
  dire(`En ligne aujourd’hui : ${c.actuel}`);
  dire(`Version d’avant : ${c.precedent.uid} (mise en ligne le ${quand}${msg ? ` · « ${msg} »` : ''})`);
  if (!CONFIRMER) { dire('Aperçu seulement : rien n’a changé. Relance avec « OUI » dans la case pour revenir à cette version.'); return 0; }
  await v('POST', `/v1/projects/${encodeURIComponent(c.projetId)}/rollback/${encodeURIComponent(c.precedent.uid)}?description=${encodeURIComponent('Retour arrière demandé par Julien (workflow)')}${c.q ? '&' + c.q : ''}`);
  dire(`✓ vrm.center sert de nouveau la version du ${quand}. ⚠️ Les prochaines fusions ne partiront plus en ligne toutes seules : quand c’est réparé, Vercel → Deployments → le nouveau → « Promote ».`);
  return 0;
}

// ── git ──────────────────────────────────────────────────────────────────────
const GAPI = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const GJETON = process.env.GITHUB_TOKEN || '';
const DEPOT = process.env.GITHUB_REPOSITORY || '';
const POUSSER = process.env.POUSSER !== '0';
const g = (...a) => { const r = spawnSync('git', a, { encoding: 'utf8' }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
export function derniereFusion(branche = 'HEAD') {
  const r = g('log', '--merges', '--first-parent', '-1', '--format=%H%x09%s', branche);
  if (!r.ok || !r.out) return null;
  const [sha, ...s] = r.out.split('\t');
  return { sha, sujet: s.join('\t') };
}
async function gitRetour() {
  const f = derniereFusion();
  if (!f) { dire('✗ Aucune fusion trouvée sur main : rien à annuler.'); return 1; }
  const tete = g('rev-parse', 'HEAD').out;
  if (f.sha !== tete) dire(`⚠️ La dernière fusion n’est pas le dernier commit de main (il y a des commits après) : c’est bien elle qui sera annulée.`);
  const court = f.sha.slice(0, 9);
  dire(`Dernière fusion sur main : ${court} « ${f.sujet} »`);
  if (!CONFIRMER) { dire('Aperçu seulement : rien n’a changé. Relance avec « OUI » dans la case pour préparer l’annulation.'); return 0; }
  const branche = `retour/${court}`;
  if (!g('checkout', '-B', branche).ok) { dire('✗ branche impossible'); return 1; }
  g('config', 'user.name', 'VRM retour arrière'); g('config', 'user.email', 'retour-arriere@users.noreply.github.com');
  const rv = g('revert', '-m', '1', '--no-edit', f.sha);
  if (!rv.ok) { g('revert', '--abort'); dire('✗ L’annulation ne s’applique pas toute seule (conflit avec des changements plus récents) : prends le mode « vercel », ou demande à une session Claude.'); return 1; }
  if (!POUSSER) { dire(`✓ Annulation prête sur ${branche} (non poussée : essai local).`); return 0; }
  const p = g('push', '-f', 'origin', `HEAD:refs/heads/${branche}`);
  if (!p.ok) { dire('✗ Envoi refusé : ' + p.err.slice(0, 200)); return 1; }
  const lien = `https://github.com/${DEPOT}/compare/main...${branche}?expand=1`;
  try {
    const r = await fetch(`${GAPI}/repos/${DEPOT}/pulls`, { method: 'POST', headers: { authorization: `Bearer ${GJETON}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ title: `Revenir à la version d’avant (annule ${court})`, head: branche, base: 'main', body: `Annule la fusion ${f.sha} « ${f.sujet} ».\n\nFusionner cette demande remet en ligne la version d’avant (Vercel, ~2 min). L’extension n’est pas concernée.\n\n_Préparée par .github/workflows/revenir-en-arriere.yml._` }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.html_url) { dire(`✓ Demande ouverte : ${j.html_url} — clique « Merge pull request » pour revenir à la version d’avant.`); return 0; }
    dire(`GitHub n’a pas ouvert la demande (HTTP ${r.status}). Ouvre-la toi-même ici, puis « Create pull request » et « Merge » : ${lien}`);
    return 0;
  } catch (_) { dire(`Ouvre la demande ici, puis « Create pull request » et « Merge » : ${lien}`); return 0; }
}

async function principal() {
  if (MODE === 'vercel') return vercel();
  if (MODE === 'git') return gitRetour();
  dire('MODE doit valoir « vercel » ou « git ».'); return 2;
}
if (import.meta.url === `file://${process.argv[1]}`) principal().then((c) => process.exit(c)).catch((e) => { dire('✗ ' + String((e && e.message) || e).slice(0, 300)); process.exit(1); });
