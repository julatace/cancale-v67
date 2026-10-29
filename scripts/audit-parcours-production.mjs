// Contrôles locaux uniquement : aucune écriture dans une base de production.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=[
 'bilan-synchronisation','bilan-synchronisation-adaptateur','outils-articles-vinted','isolation-comptes','confidentialite','securite-reception-push','capacite-securite',
 'inscription-parcours','recuperation-auth','liaison-oauth','collecte-email',
 'reception-email','suivi-donnees','parcours-vendeur','favoris-progression','favoris-automatisation','gmail-facture-retour','lbc-photos','lbc-identite-transaction',
 'lbc-attribution-historique','favoris-preuves','favoris-historique','favoris-contexte','offres-vinted','messages-offres-historique','reponse-vinted','vinted-suivi-interface','recherche-messages-vinted',
];
const controles=[
 ['Téléchargements Gmail','python3',['scripts/pack-reception-gmail.py','--check']],
 ['Comptes, emails, synchronisation et favoris',process.execPath,['--test',...tests.map(n=>`scripts/tests/${n}.test.mjs`)]],
 ...['routes-revue','budget-lectures','photos-vinted','lbc-ventes','email-cle','preuve-adresse','fonctions-api'].map(n=>[n,process.execPath,[`scripts/audit-${n}.cjs`]]),
];
let echecs=0;
for(const [nom,commande,args] of controles){
 console.log(`\n── ${nom}`);
 const r=spawnSync(commande,args,{cwd:root,stdio:'inherit',timeout:180000});
 if(r.error||r.status!==0){echecs++;console.error(`ÉCHEC : ${nom}`,r.error?.message||`code ${r.status}`);}
}
console.log(`\n${controles.length-echecs}/${controles.length} groupes conformes. Tests synthétiques ; ne certifie ni SMTP, ni RLS de production, ni comptes connectés, ni scan physique.`);
process.exitCode=echecs?1:0;
