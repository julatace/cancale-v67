#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// L'ISSUE GITHUB DU CONTRÔLE QUOTIDIEN — node scripts/controle-prod-issue.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (9 nov.) Appelé par .github/workflows/controle-prod-quotidien.yml APRÈS le
// contrôle (scripts/controle-prod-quotidien.cjs) et son second essai.
// Pour ne pas recréer le bruit des « run failed » (docs/passation/2026-11-08-ci-verte.md) :
//   · ETAT=rouge (deux essais rouges, à 5 min d'écart) ⇒ UNE issue au titre
//     STABLE : ouverte si aucune n'est ouverte, sinon son texte est MIS À JOUR
//     (aucun commentaire ⇒ aucune notification de plus chaque matin) ;
//   · ETAT=vert ⇒ s'il y a une issue ouverte : un commentaire « revenu au vert »
//     puis elle est fermée ; sinon rien du tout ;
//   · jamais une issue par jour, jamais une étiquette à créer.
// Entrées (environnement) : GITHUB_TOKEN, GITHUB_REPOSITORY (owner/nom),
// GITHUB_API_URL (défaut https://api.github.com ; un faux serveur dans l'audit),
// ETAT (rouge|vert), RESULTAT (le bilan JSON du dernier essai), RUN_URL.
// Une panne de l'API GitHub ne change pas la couleur du run : elle est dite.
'use strict';
const fs = require('fs');

const TITRE = 'Contrôle quotidien de vrm.center : en échec';
const API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
const DEPOT = process.env.GITHUB_REPOSITORY || '';
const JETON = process.env.GITHUB_TOKEN || '';
const ETAT = process.env.ETAT || '';
const RUN_URL = process.env.RUN_URL || '';

const lireBilan = () => { try { return JSON.parse(fs.readFileSync(process.env.RESULTAT || '', 'utf8')); } catch (_) { return null; } };
const quand = () => new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });

async function gh(methode, chemin, corps) {
  const r = await fetch(API + chemin, {
    method: methode,
    headers: { authorization: `Bearer ${JETON}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(corps ? { 'content-type': 'application/json' } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  if (!r.ok) throw new Error(`${methode} ${chemin} : HTTP ${r.status} ${texte.slice(0, 200)}`);
  try { return JSON.parse(texte); } catch (_) { return null; }
}

function corpsIssue(bilan) {
  const echecs = (bilan && Array.isArray(bilan.resultats) ? bilan.resultats : []).filter((r) => !r.ok);
  const lignes = echecs.length ? echecs.slice(0, 40).map((e) => `- **${e.nom}** — ${String(e.detail || '').replace(/\r?\n/g, ' ').slice(0, 300)}`) : ['- (le bilan du contrôle est illisible : voir le journal du run)'];
  return [
    `Le contrôle quotidien de https://vrm.center (navigateur, lecture seule) est **rouge deux fois de suite**, à 5 minutes d'écart.`,
    '',
    `**Dernier essai :** ${quand()}${RUN_URL ? ` — [le run et ses captures](${RUN_URL})` : ''}`,
    '',
    `### Ce qui ne va pas (${echecs.length} contrôle${echecs.length > 1 ? 's' : ''})`,
    ...lignes,
    '',
    '### Quoi faire',
    '- Ouvrir le lien du run : chaque contrôle rouge y est nommé, et l’artefact « captures » montre chaque page telle que le navigateur l’a vue.',
    '- Si le site est cassé depuis la dernière mise en ligne : Vercel → projet → Deployments → le déploiement d’avant → « Instant Rollback » (docs/passation/2026-11-06-filets-anti-bug.md). Rien n’est jamais annulé automatiquement.',
    '- Cette issue est **mise à jour** chaque matin tant que c’est rouge (pas de nouvelle issue, pas de commentaire), et **fermée toute seule** quand le contrôle repasse au vert.',
    '',
    '_Écrite par .github/workflows/controle-prod-quotidien.yml (scripts/controle-prod-issue.cjs)._',
  ].join('\n');
}

(async () => {
  if (ETAT !== 'rouge' && ETAT !== 'vert') { console.log(`ETAT « ${ETAT} » inconnu : rien à faire.`); return; }
  if (!JETON || !/^[^/]+\/[^/]+$/.test(DEPOT)) { console.log('::warning::Pas de jeton GitHub ou de dépôt : l’issue n’est ni ouverte ni fermée.'); return; }
  const ouvertes = (await gh('GET', `/repos/${DEPOT}/issues?state=open&per_page=100`) || [])
    .filter((i) => i && !i.pull_request && i.title === TITRE)
    .sort((a, b) => a.number - b.number);
  const issue = ouvertes[0] || null;
  if (ETAT === 'rouge') {
    const body = corpsIssue(lireBilan());
    if (issue) { await gh('PATCH', `/repos/${DEPOT}/issues/${issue.number}`, { body }); console.log(`Issue #${issue.number} mise à jour (aucune nouvelle issue).`); }
    else { const n = await gh('POST', `/repos/${DEPOT}/issues`, { title: TITRE, body }); console.log(`Issue #${n && n.number} ouverte.`); }
    return;
  }
  if (!issue) { console.log('Vert, et aucune issue ouverte : rien à faire.'); return; }
  for (const i of ouvertes) {
    await gh('POST', `/repos/${DEPOT}/issues/${i.number}/comments`, { body: `De nouveau vert le ${quand()}${RUN_URL ? ` ([le run](${RUN_URL}))` : ''}. Issue fermée automatiquement.` });
    await gh('PATCH', `/repos/${DEPOT}/issues/${i.number}`, { state: 'closed', state_reason: 'completed' });
    console.log(`Issue #${i.number} fermée (revenu au vert).`);
  }
})().catch((e) => { console.log(`::warning::L’issue du contrôle n’a pas pu être tenue à jour : ${String((e && e.message) || e).slice(0, 300)}`); });
