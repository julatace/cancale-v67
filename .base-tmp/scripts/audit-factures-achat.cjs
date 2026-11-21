// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « FACTURE D'ACHAT JOINTE » (10 nov., lot AN) — src/factureAchat.js
//
//  Une facture d'achat jointe vit dans SA ligne `app_data`
//  (`achat_facture_{tx|hors}_{identité}`). Cet audit EXÉCUTE :
//   M. le module de l'app (vrai `src/factureAchat.js`, fetch simulé) : l'identité
//      (jamais un titre), les bornes (type, 4 Mo), l'écriture (UNE ligne, owner de
//      la session, contenu valide seulement), la liste SANS contenu (aucun
//      `select=data`, aucun `b64`), le contenu lu par son id seulement ;
//   S. la politique, sur un PostgreSQL JETABLE (jamais Supabase) : la VRAIE
//      migration 021 et la VRAIE liste blanche du mode équipe (016) — un autre
//      vendeur ne lit, ne modifie, n'écrase ni ne vide une facture ; un membre
//      d'équipe non plus ; anonyme non plus ; le vendeur lit et écrit les siennes.
//  `--prouve` rejoue l'audit sous des MUTATIONS (liste qui rapatrie `data`, écriture sans
//  owner, politique 021 absente, liste blanche élargie) : chacune DOIT être rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');

async function verifier({ mutation = '' } = {}) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (c, n, d) => { if (c) ok++; else { ko++; rouges.push(n); } if (!mutation) console.log(`${c ? '✅' : '❌'} ${n}${!c && d ? ' — ' + String(d).slice(0, 200) : ''}`); };

  // ── M. Le module, exécuté ────────────────────────────────────────────────────
  let src = fs.readFileSync(path.join(RACINE, 'src/factureAchat.js'), 'utf8');
  if (mutation === 'liste-data') src = src.replace("export const SELECT_LISTE = 'id,", "export const SELECT_LISTE = 'id,data,b64:data->>b64,");
  if (mutation === 'sans-owner') src = src.replace("body: JSON.stringify([withOwner({ id: idLigneFacture(cle), data })])", "body: JSON.stringify([{ id: idLigneFacture(cle), data }])");
  if (mutation === 'sans-borne') src = src.replace('if (taille > MAX_OCTETS)', 'if (false)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-facture-'));
  const fichier = path.join(tmp, 'factureAchat.mjs'); fs.writeFileSync(fichier, src);
  const F = await import('file://' + fichier);
  fs.rmSync(tmp, { recursive: true, force: true });

  dit(F.cleFacture('tx', 73003) === 'tx_73003' && F.cleFacture('hors', 'ob_x1') === 'hors_ob_x1', 'M1 la clé = l’identité de l’achat (n° de transaction, id saisi)');
  dit(F.cleFacture('tx', '') === '' && F.cleFacture('titre', 'Nike') === '' && F.cleFacture('tx', '../main') === 'tx_main', 'M1 sans identité : pas de clé ; rien ne sort du préfixe');
  dit(F.idLigneFacture('tx_1') === 'achat_facture_tx_1', 'M1 la ligne : achat_facture_<clé>');
  dit(F.verifierFichier({ type: 'application/pdf', taille: 1000 }).ok && F.verifierFichier({ type: 'image/jpeg', taille: 1000 }).ok, 'M2 PDF et photo acceptés');
  dit(!F.verifierFichier({ type: 'text/plain', taille: 10 }).ok && !F.verifierFichier({ type: 'text/html', taille: 10, nom: 'x.pdf' }).ok, 'M2 un autre type est refusé (même nommé .pdf)');
  dit(!F.verifierFichier({ type: 'application/pdf', taille: 6 * 1024 * 1024 }).ok && !F.verifierFichier({ type: 'application/pdf', taille: 0 }).ok, 'M2 trop lourd ou vide : refusé');
  dit(F.contenuValide('data:application/pdf;base64,JVBERi0x', 'pdf') && !F.contenuValide('data:text/html;base64,PGh0bWw+', 'pdf') && !F.contenuValide('data:application/pdf;base64,PGh0bWw+', 'pdf'), 'M2 un PDF doit commencer par %PDF');
  dit(!F.contenuValide('data:image/svg+xml;base64,PHN2Zz4=', 'image'), 'M2 une image SVG (qui peut porter du script) est refusée');

  const appels = [];
  const fakeFetch = (rows) => async (u, o = {}) => { appels.push({ u: decodeURIComponent(u), m: o.method || 'GET', b: o.body }); return { ok: true, json: async () => rows }; };
  const OWNER = '11111111-1111-4111-8111-111111111111';
  const D = (rows = []) => ({ fetch: fakeFetch(rows), url: 'https://base.test', auth: (x) => Object.assign({ apikey: 'k', Authorization: 'Bearer jeton' }, x || {}), withOwner: (r) => ({ ...r, owner: OWNER }), conflit: 'owner,id', owner: OWNER });
  appels.length = 0;
  const e1 = await F.ecrireFacture({ cle: 'tx_73003', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', genre: 'image', nom: 'facture.jpg', taille: 10 }, D());
  const corps = appels[0] ? JSON.parse(appels[0].b) : null;
  dit(e1 && appels.length === 1 && appels[0].m === 'POST' && Array.isArray(corps) && corps.length === 1 && corps[0].id === 'achat_facture_tx_73003' && corps[0].owner === OWNER && corps[0].data.type === 'image', 'M3 UNE ligne écrite, la sienne (id, owner de la session)', JSON.stringify(corps && corps.map((x) => ({ id: x.id, owner: x.owner }))));
  appels.length = 0;
  const e2 = await F.ecrireFacture({ cle: 'tx_1', dataUrl: 'data:text/html;base64,PGh0bWw+', genre: 'pdf', nom: 'x', taille: 1 }, D());
  const e3 = await F.ecrireFacture({ cle: '', dataUrl: 'data:application/pdf;base64,JVBERi0x', genre: 'pdf', nom: 'x', taille: 1 }, D());
  dit(!e2 && !e3 && appels.length === 0, 'M3 contenu invalide ou sans identité : RIEN ne part');
  appels.length = 0;
  const liste = await F.lireFactures(D([{ id: 'achat_facture_tx_1', type: 'pdf', nom: 'a.pdf', taille: '10', at: 'x' }, { id: 'achat_facture_tx_2', type: null, supprime: 'true' }, { id: 'autre', type: 'pdf' }]));
  const ul = appels[0] ? appels[0].u : '';
  const sel = (/[?&]select=([^&]*)/.exec(ul) || [])[1] || '';
  dit(liste && Object.keys(liste).join(',') === 'tx_1', 'M4 la liste : les factures présentes seulement (retirée et étrangère écartées)', JSON.stringify(liste));
  dit(/id=like\.achat_facture_\*/.test(ul) && /owner=eq\./.test(ul) && sel && !/(^|,)(data|\*)(,|$)/.test(sel) && !/b64/.test(sel), 'M4 la liste ne rapatrie JAMAIS le contenu (scalaires projetés, owner filtré)', ul);
  const ko0 = await F.lireFactures({ ...D(), fetch: async () => ({ ok: false }) });
  dit(ko0 === null, 'M4 lecture ratée : « pas su » (null), jamais une liste vide');
  appels.length = 0;
  const c = await F.lireContenuFacture('tx_1', D([{ b64: 'data:application/pdf;base64,JVBERi0x', type: 'pdf' }]));
  dit(c && appels.length === 1 && /id=eq\.achat_facture_tx_1(&|$)/.test(appels[0].u) && /owner=eq\./.test(appels[0].u), 'M5 le contenu : lu par SON id, au toucher');
  dit((await F.lireContenuFacture('tx_1', D([{ b64: 'data:text/html;base64,PGh0bWw+', type: 'pdf' }]))) === null, 'M5 un contenu qui n’est pas une facture n’est jamais rendu');
  dit(F.mentionFacture({ id: 'v', reference: '73003' }, { tx_73003: { nom: 'f.pdf' } }) === 'facture jointe (f.pdf)' && F.mentionFacture({ id: 'hors:ob_1' }, { hors_ob_1: { nom: '' } }) === 'facture jointe' && F.mentionFacture({ id: 'v', reference: '9' }, {}) === '', 'M6 l’export comptable mentionne la facture de la ligne (par identité)');

  // ── S. La politique, sur PostgreSQL jetable ─────────────────────────────────
  const candidats = [process.env.PG_BIN]; try { for (const v of fs.readdirSync('/usr/lib/postgresql')) candidats.push(`/usr/lib/postgresql/${v}/bin`); } catch (_) {}
  const BIN = candidats.find((d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((n) => fs.existsSync(path.join(d, n))));
  if (!BIN) { dit(false, 'S PostgreSQL absent : politique NON exécutée (PG_BIN)'); return { ok, ko, rouges }; }
  let identite = {};
  if (process.getuid && process.getuid() === 0) { try { identite = { uid: Number(execFileSync('id', ['-u', 'postgres'])), gid: Number(execFileSync('id', ['-g', 'postgres'])) }; } catch (_) { dit(false, 'S utilisateur postgres absent'); return { ok, ko, rouges }; } }
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-factures-sql-'));
  if (identite.uid !== undefined) fs.chownSync(DIR, identite.uid, identite.gid);
  const PORT = String(54000 + (process.pid + mutation.length * 7) % 1000);
  const base = ['-h', DIR, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
  const serveur = (n, args) => spawnSync(path.join(BIN, n), args, { encoding: 'utf8', ...identite });
  let demarre = false;
  const run = (sql) => { const r = spawnSync(path.join(BIN, 'psql'), base, { input: sql, encoding: 'utf8' }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: r.stderr || '' }; };
  const Q = (sql) => { const r = run(sql); if (!r.ok) throw Error(r.err); return r.out; };
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  const comme = (u) => `set role authenticated;set "request.jwt.claim.sub"='${u}';`;
  try {
    let r = serveur('initdb', ['-D', DIR + '/data', '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']); if (r.status !== 0) throw Error(r.stderr);
    r = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`, '-l', DIR + '/journal', '-w', 'start']); if (r.status !== 0) throw Error(r.stderr); demarre = true;
    Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create role anon;create role authenticated;grant usage on schema auth,public to anon,authenticated;
      create table app_data(owner uuid not null,id text not null,data jsonb,updated_at timestamptz default now(),primary key(owner,id));
      create table vinted_accounts(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
      grant all on app_data,vinted_accounts to anon,authenticated;
      create policy ancienne_trop_large on app_data for all to authenticated,anon using(true) with check(true);`);
    // La VRAIE liste blanche du mode équipe (016), et un « membre » : B est membre de l'équipe de A.
    const m016 = fs.readFileSync(path.join(RACINE, 'supabase/migrations/016-equipe.sql'), 'utf8');
    let liste016 = (/create or replace function public\.vrm_equipe_id_permis\(p_id text\)[\s\S]*?\$\$;/.exec(m016) || [])[0];
    if (!liste016) throw Error('liste blanche 016 introuvable');
    if (mutation === 'equipe-large') liste016 = liste016.replace('panel_colis_relais|', 'panel_colis_relais|achat_facture_[A-Za-z0-9_-]{1,80}|');
    Q(liste016);
    Q(`create function public.vrm_equipe_vendeur() returns uuid language sql stable as $$ select case when auth.uid()='${B}' then '${A}'::uuid else null end $$;`);
    const m021 = fs.readFileSync(path.join(RACINE, 'supabase/migrations/021-confidentialite-boutiques.sql'), 'utf8');
    if (mutation !== 'sans-021') Q(m021);
    const PDF = 'data:application/pdf;base64,JVBERi0x';
    Q(`insert into app_data(owner,id,data) values
      ('${A}','achat_facture_tx_73003','{"b64":"${PDF}","type":"pdf","nom":"a.pdf"}'),
      ('${A}','achat_facture_hors_ob_1','{"b64":"${PDF}","type":"pdf","nom":"b.pdf"}'),
      ('${A}','email_bord_62000','{"pdf":"x"}'),
      ('${B}','achat_facture_tx_99','{"b64":"${PDF}","type":"pdf","nom":"c.pdf"}');`);
    const nA = Q(comme(A) + `select count(*) from app_data where id like 'achat_facture_%'`);
    dit(nA === '2', 'S1 le vendeur lit SES factures (2), pas celles d’un autre', nA);
    dit(Q(comme(A) + `select count(*) from app_data where id like 'achat_facture_%' and owner='${B}'`) === '0', 'S2 A ne lit pas la facture de B, même en la nommant');
    dit(Q(comme(B) + `select count(*) from app_data where id like 'achat_facture_%' and owner='${A}'`) === '0', 'S2 B (membre de l’équipe de A) ne lit AUCUNE facture de A');
    dit(Q(comme(B) + `select count(*) from app_data where id='email_bord_62000' and owner='${A}'`) === (mutation === 'sans-021' ? '1' : '1'), 'S2 témoin : la liste blanche de l’équipe marche (le bordereau de A se lit)');
    dit(Q(`select public.vrm_equipe_id_permis('achat_facture_tx_73003')::text`) === 'false', 'S2 la liste blanche de l’équipe (016) ne contient pas achat_facture_*');
    dit(Q(comme(B) + `with x as(update app_data set data='{"b64":null,"supprime":true}' where owner='${A}' and id like 'achat_facture_%' returning *) select count(*) from x`) === '0', 'S3 B ne vide ni ne modifie une facture de A');
    dit(!run(comme(B) + `insert into app_data(owner,id,data) values('${A}','achat_facture_tx_666','{"b64":"${PDF}","type":"pdf"}')`).ok, 'S3 B ne pose pas une facture chez A');
    dit(Q(comme(B) + `with x as(insert into app_data(owner,id,data) values('${B}','achat_facture_tx_73003','{"b64":"${PDF}","type":"pdf"}') on conflict (owner,id) do update set data=excluded.data returning owner) select owner::text from x`) === B && Q(`select data->>'nom' from app_data where owner='${A}' and id='achat_facture_tx_73003'`) === 'a.pdf', 'S3 le même id écrit par B reste chez B (celle de A intacte)');
    dit(Q(comme(B) + `with x as(delete from app_data where owner='${A}' returning *) select count(*) from x`) === '0', 'S3 B ne supprime rien chez A');
    dit(Q(`set role anon;select count(*) from app_data where id like 'achat_facture_%'`) === '0', 'S4 anonyme : aucune facture');
    dit(run(comme(A) + `insert into app_data(owner,id,data) values('${A}','achat_facture_tx_1','{"b64":"${PDF}","type":"pdf"}') on conflict(owner,id) do update set data=excluded.data;update app_data set data='{"b64":null,"supprime":true}' where id='achat_facture_tx_1';`).ok, 'S5 le vendeur joint et retire ses factures');
  } catch (e) { dit(false, 'S audit SQL interrompu : ' + String(e.message || e).split('\n')[0]); }
  finally { if (demarre) serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); fs.rmSync(DIR, { recursive: true, force: true }); }
  return { ok, ko, rouges };
}

(async () => {
  const r = await verifier();
  console.log(`\n${r.ok} contrôles verts, ${r.ko} rouge(s).`);
  let ko = r.ko;
  if (PROUVE) {
    for (const m of ['liste-data', 'sans-owner', 'sans-borne', 'sans-021', 'equipe-large']) {
      const x = await verifier({ mutation: m });
      const prouve = x.ko > 0;
      if (!prouve) ko++;
      console.log(`${prouve ? '✅' : '❌'} mutation « ${m} » : ${x.ko} rouge(s)${prouve ? ' — ' + x.rouges.slice(0, 2).join(' / ') : ' — l’audit NE la voit PAS'}`);
    }
  }
  process.exitCode = ko ? 1 : 0;
})();
