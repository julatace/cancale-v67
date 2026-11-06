#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ATTENDRE LA MISE EN LIGNE D'UN COMMIT — node scripts/attendre-deploiement.mjs
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 5) /api/sante ne dit pas QUELLE version tourne (des oui/non
// seulement, route publique). Ce qui le dit : le « déploiement » que Vercel pose
// sur GitHub pour chaque commit de `main` (environnement « Production »,
// créé par vercel[bot] — mesuré le 6 nov. sur a45e7636). On attend que CELUI DE
// CE COMMIT passe à « success », puis, si l'adresse du déploiement se lit sans
// compte, que https://vrm.center serve le même fichier d'app (index-<empreinte>.js).
// Lecture seule : l'API GitHub avec le jeton du job (`deployments: read`) et
// deux pages publiques. Rien n'est écrit, rien n'est promu, rien n'est annulé.
//   0  déployé (ou : aucun déploiement pour ce commit → `deploye=false`, dit)
//   1  Vercel dit « failure » / « error » pour ce commit, ou délai dépassé
// Variables : GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA (posées par Actions),
// ATTENTE_MAX_S (défaut 1200), VRM_ORIGINE (défaut https://vrm.center).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'julatace/cancale-v67';
const SHA = process.env.GITHUB_SHA || '';
const JETON = process.env.GITHUB_TOKEN || '';
const ORIGINE = (process.env.VRM_ORIGINE || 'https://vrm.center').replace(/\/+$/, '');
const MAX_MS = (Number(process.env.ATTENTE_MAX_S) || 1200) * 1000;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const sortie = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const gh = async (chemin) => {
  const r = await fetch(`https://api.github.com/repos/${REPO}${chemin}`, { headers: { accept: 'application/vnd.github+json', ...(JETON ? { authorization: `Bearer ${JETON}` } : {}), 'x-github-api-version': '2022-11-28' } });
  if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
  return r.json();
};
const empreinte = async (url) => {
  try {
    const r = await fetch(url + '/?_controle=' + Date.now(), { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return null;
    const m = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(await r.text());
    return m ? m[0] : null;
  } catch (_) { return null; }
};

if (!SHA) { console.log('GITHUB_SHA absent : rien à attendre.'); sortie('deploye', 'false'); process.exit(0); }
console.log(`Attente du déploiement Vercel « Production » du commit ${SHA.slice(0, 10)} (au plus ${MAX_MS / 60000} min).`);
const debut = Date.now();
let dep = null, etat = null, url = null;
while (Date.now() - debut < MAX_MS) {
  try {
    if (!dep) {
      const liste = await gh(`/deployments?sha=${SHA}&environment=Production&per_page=5`);
      dep = Array.isArray(liste) && liste[0] ? liste[0] : null;
    }
    if (dep) {
      const st = await gh(`/deployments/${dep.id}/statuses?per_page=5`);
      const dernier = Array.isArray(st) && st[0] ? st[0] : null;
      etat = dernier ? dernier.state : 'pending';
      url = (dernier && (dernier.environment_url || dernier.target_url)) || null;
      if (etat === 'success') break;
      if (etat === 'failure' || etat === 'error') {
        console.log(`::error title=Mise en ligne::Vercel n'a pas pu déployer ${SHA.slice(0, 10)} (${etat}). La production n'a PAS changé.`);
        process.exit(1);
      }
    }
  } catch (e) { console.log('(lecture GitHub ratée, on réessaie) ' + String(e && e.message)); }
  await pause(20000);
}
if (!dep) {
  console.log(`::warning title=Mise en ligne::Aucun déploiement Vercel pour ${SHA.slice(0, 10)} en ${Math.round((Date.now() - debut) / 60000)} min (quota de 100 déploiements par jour atteint, ou déploiement sauté) : la production n'a pas changé, rien à contrôler.`);
  sortie('deploye', 'false');
  process.exit(0);
}
if (etat !== 'success') { console.log(`::error title=Mise en ligne::Le déploiement de ${SHA.slice(0, 10)} n'a pas fini à temps (état : ${etat}).`); process.exit(1); }
console.log(`Déployé : ${SHA.slice(0, 10)} (${url || 'adresse non dite'}).`);
// L'adresse propre du déploiement est souvent protégée (compte Vercel) : si elle
// se lit, on attend que vrm.center serve LE MÊME fichier d'app (l'alias suit en
// quelques secondes) ; sinon on attend 30 s et on contrôle vrm.center tel quel.
const attendu = url ? await empreinte(url.replace(/\/+$/, '')) : null;
if (attendu) {
  for (let i = 0; i < 18; i++) {
    const prod = await empreinte(ORIGINE);
    if (prod === attendu) { console.log(`${ORIGINE} sert ce déploiement (${attendu}).`); break; }
    if (i === 17) console.log(`::warning title=Mise en ligne::${ORIGINE} sert ${prod}, le déploiement ${attendu} (un commit plus récent est peut-être passé devant).`);
    await pause(10000);
  }
} else { console.log('Adresse du déploiement protégée ou illisible : 30 s pour que l’alias suive.'); await pause(30000); }
sortie('deploye', 'true');
