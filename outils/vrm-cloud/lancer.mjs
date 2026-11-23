import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dossierExtension = fileURLToPath(new URL('../../vinted-sync-extension', import.meta.url));

export async function ouvrirProfil(profil, { graphique = false, horsLigne = false } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(profil || '')) throw new Error('Nom de profil invalide.');
  const repertoireEtat = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  if (!isAbsolute(repertoireEtat)) throw new Error('XDG_STATE_HOME doit être un chemin absolu.');
  const dossierProfil = join(repertoireEtat, 'vrm-cloud', profil);
  await mkdir(dossierProfil, { recursive: true, mode: 0o700 });

  const contexte = await chromium.launchPersistentContext(dossierProfil, {
    channel: 'chromium',
    chromiumSandbox: true,
    headless: !graphique,
    handleSIGINT: false,
    handleSIGTERM: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${dossierExtension}`,
      `--load-extension=${dossierExtension}`,
      ...(horsLigne ? ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND'] : []),
    ],
  });
  try {
    const estExtensionVrm = (worker) => /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(worker.url());
    const extension = contexte.serviceWorkers().find(estExtensionVrm)
      || await contexte.waitForEvent('serviceworker', { predicate: estExtensionVrm, timeout: 20_000 });
    const manifeste = await extension.evaluate(() => chrome.runtime.getManifest());
    if (!manifeste.name.startsWith('VRM')) throw new Error('Extension VRM introuvable.');
    return { contexte, extension, version: manifeste.version };
  } catch (erreur) {
    await contexte.close().catch(() => {});
    throw erreur;
  }
}

async function lancerProfil(profil, mode) {
  const connecter = mode === '--connecter';
  const { contexte, extension, version } = await ouvrirProfil(profil, { graphique: connecter, horsLigne: mode === '--verifier' });
  const fermeture = new Promise((resolve) => contexte.once('close', resolve));
  const arreter = () => { void contexte.close().catch(() => {}); };
  process.once('SIGINT', arreter);
  process.once('SIGTERM', arreter);

  try {
    console.log(`Extension VRM ${version} chargée pour le profil ${profil}.`);
    if (mode === '--verifier') return;

    const vinted = contexte.pages()[0] || await contexte.newPage();
    await vinted.goto('https://www.vinted.fr/', { waitUntil: 'domcontentloaded' });
    if (connecter) {
      const panneau = await contexte.newPage();
      await panneau.goto(new URL('popup.html?mode=onglet', extension.url()).href);
      await panneau.bringToFront();
    }
    await fermeture;
  } finally {
    process.removeListener('SIGINT', arreter);
    process.removeListener('SIGTERM', arreter);
    await contexte.close().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [profil, mode, ...autres] = process.argv.slice(2);
  if (!profil || ![undefined, '--connecter', '--verifier'].includes(mode) || autres.length) {
    console.error('Utilisation : node outils/vrm-cloud/lancer.mjs <profil> [--connecter | --verifier]');
    process.exitCode = 1;
  } else {
    try {
      await lancerProfil(profil, mode);
    } catch (erreur) {
      console.error(`Le profil Cloud n’a pas démarré ou a été interrompu : ${erreur.message}`);
      process.exitCode = 1;
    }
  }
}
