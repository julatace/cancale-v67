#!/usr/bin/env node
/**
 * L'INSTRUMENTATION NE DOIT NI DÉTRUIRE NI PERDRE SES PREUVES
 *
 * `panel_diag_capture` porte deux choses : `n` (les compteurs, écrits par
 * `noterDiag`) et `rates` (un échantillon de réponse ratée par type, écrit par
 * `echantillonRate`). C'est ce couple qui a fini par expliquer la fiche article
 * (§5.24 → §5.26) : le compteur dit COMBIEN, l'échantillon dit POURQUOI.
 *
 * Deux façons de tout perdre, toutes deux constatées EN BASE :
 *  1. §5.52 — `noterDiag` réécrivait la ligne avec `{ n, majAt }` seulement,
 *     donc il EFFAÇAIT `rates`.
 *  2. 2 septembre — le tampon vivait en variable de MODULE avec un throttle
 *     d'une minute, alors que Chrome tue un service worker MV3 après ~30 s
 *     d'inactivité. `recupererLabel` pose TROIS échantillons dans la même
 *     boucle : le premier écrivait et consommait le quota, les deux suivants
 *     mouraient avec le worker. En base, `rates` ne contenait QUE
 *     `label_label_url` — jamais `label` ni `label_label_options`.
 *
 * Ce contrôle exécute le VRAI bloc découpé du fichier, dans un `vm`, avec un
 * faux `chrome.storage.local` partagé entre deux « vies » de worker.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'background.js'), 'utf8');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

// Le bloc de diagnostic, quelle que soit sa forme (avant/après le correctif).
function blocDiag() {
  const deb = Math.min(...['const DIAG_BUF', 'const _diag = {']
    .map((s) => { const i = SRC.indexOf(s); return i < 0 ? Infinity : i; }));
  const fin = SRC.indexOf('// Le dressing qui arrive est-il au moins aussi riche');
  return (deb === Infinity || fin < 0) ? null : SRC.slice(deb, fin);
}

// Une « vie » de service worker : contexte neuf, MÊME chrome.storage.local.
function demarrerWorker(bloc, magasin, journal) {
  const chrome = {
    storage: {
      local: {
        get: async (k) => (k in magasin ? { [k]: JSON.parse(JSON.stringify(magasin[k])) } : {}),
        set: async (o) => { for (const k in o) magasin[k] = JSON.parse(JSON.stringify(o[k])); },
      },
    },
  };
  const ctx = {
    chrome, console, Date, JSON, Promise, Object, Math, setTimeout,
    sbGet: async () => [{ data: JSON.parse(JSON.stringify(journal.base)) }],
    supabaseUpsert: async (_t, rows) => {
      if (journal.casse) throw new Error('réseau coupé');
      journal.base = JSON.parse(JSON.stringify(rows[0].data));
      journal.ecritures++;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(bloc, ctx);
  return ctx;
}
const attendre = () => new Promise((r) => setTimeout(r, 30));

(async () => {
  const bloc = blocDiag();
  if (!bloc) { nok('le bloc de diagnostic est lisible', 'marqueurs introuvables'); }
  else {
    // ── 1. On n'efface pas les preuves voisines (§5.52) ─────────────────────
    {
      const journal = { base: { n: { deja: 5 }, rates: { item: { tete: '<!DOCTYPE html>' } }, autre: 'à garder' }, ecritures: 0 };
      const c = demarrerWorker(bloc, {}, journal);
      await c.noterDiag('label_url_introuvable'); await attendre();
      const e = journal.base;
      (e.rates && e.rates.item && e.rates.item.tete === '<!DOCTYPE html>')
        ? ok("noterDiag n'efface pas les échantillons (`rates`)")
        : nok("noterDiag n'efface pas les échantillons", '`rates` a disparu');
      e.autre === 'à garder'
        ? ok('noterDiag garde les autres champs de la ligne')
        : nok('noterDiag garde les autres champs', 'un champ voisin a été effacé');
      (e.n && e.n.deja === 5 && e.n.label_url_introuvable === 1)
        ? ok('noterDiag cumule bien les compteurs')
        : nok('noterDiag cumule bien les compteurs', JSON.stringify(e.n));
    }

    // ── 2. LES TROIS ÉCHANTILLONS DE recupererLabel ARRIVENT ────────────────
    // Le cas réel : trois chemins essayés dans la même boucle, à quelques
    // centaines de ms. Le throttle en jetait deux, et le worker mourait avec.
    {
      const magasin = {}; const journal = { base: {}, ecritures: 0 };
      const c1 = demarrerWorker(bloc, magasin, journal);
      await c1.echantillonRate('label_label_url', '511', '{"label_url":null,"code":0}');
      await c1.echantillonRate('label', '511', '{"shipment":{}}');
      await c1.echantillonRate('label_label_options', '511', '{"options":[]}');
      await attendre();
      const c2 = demarrerWorker(bloc, magasin, journal);   // le worker est mort, il repart
      await c2.noterDiag('label_url_introuvable'); await attendre();
      const r = journal.base.rates || {};
      const manquants = ['label_label_url', 'label', 'label_label_options'].filter((k) => !r[k]);
      manquants.length
        ? nok('les 3 échantillons de la chaîne bordereau arrivent en base', 'manquent : ' + manquants.join(', '))
        : ok('les 3 échantillons de la chaîne bordereau arrivent en base');
    }

    // ── 3. UN COMPTEUR SURVIT À LA MORT DU WORKER ──────────────────────────
    {
      const magasin = {}; const journal = { base: {}, ecritures: 0 };
      const c1 = demarrerWorker(bloc, magasin, journal);
      await c1.noterDiag('label_url_trouve');   // 1er appel : il part
      await c1.noterDiag('label_envoye');       // throttlé : il attend dans le tampon
      await attendre();
      const c2 = demarrerWorker(bloc, magasin, journal);   // Chrome tue le worker
      await c2.noterDiag('label_envoye'); await attendre();
      const n = journal.base.n || {};
      n.label_envoye === 2
        ? ok('un compteur en attente survit à la mort du service worker')
        : nok('un compteur en attente survit à la mort du service worker', 'label_envoye = ' + n.label_envoye + ' au lieu de 2');
    }

    // ── 4. Le tampon n'est vidé QUE si l'écriture a abouti ─────────────────
    {
      const magasin = {}; const journal = { base: {}, ecritures: 0, casse: true };
      const c1 = demarrerWorker(bloc, magasin, journal);
      await c1.noterDiag('label_envoye'); await attendre();
      journal.casse = false;
      const c2 = demarrerWorker(bloc, magasin, journal);
      await c2.noterDiag('label_envoye'); await attendre();
      ((journal.base.n || {}).label_envoye === 2)
        ? ok("une écriture ratée ne perd pas le compteur (il repart au tour d'après)")
        : nok("une écriture ratée ne perd pas le compteur", 'label_envoye = ' + (journal.base.n || {}).label_envoye);
    }

    // ── 5. Le tampon est bien DURABLE, pas une variable de module ──────────
    /chrome\.storage\.local\.set\(\{\s*\[DIAG_BUF\]/.test(SRC)
      ? ok('le tampon de diagnostic vit dans chrome.storage.local')
      : nok('le tampon de diagnostic vit dans chrome.storage.local', 'il est encore en variable de module');
    /majTampon\(\(\) => \{\}\)/.test(SRC)
      ? ok("une alarme réveille le tampon (il ne peut pas dormir indéfiniment)")
      : nok("une alarme réveille le tampon", 'aucun flush périodique');
  }

  // ── L'endpoint mort n'est plus appelé en boucle ────────────────────────────
  const INJ = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'inject.js'), 'utf8');
  /apiGet\(`\/api\/v2\/items\/\$\{id\}`\)/.test(INJ)
    ? nok('aucune requête automatique vers la fiche article', '`inject.js` en tire encore par lots à chaque visite')
    : ok('aucune requête automatique vers la fiche article (73 échecs sur 73)');
  /wardrobeIds/.test(INJ)
    ? nok('aucune variable morte laissée derrière', '`wardrobeIds` ne sert plus à rien')
    : ok('aucune variable morte laissée derrière');

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : "\nL'instrumentation garde ses preuves, et rien ne tape dans le vide.");
  process.exit(ko ? 1 : 0);
})();
