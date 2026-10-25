import test from 'node:test';import assert from 'node:assert/strict';
import {controleOuvertureFavori as lire,echecVerificationFavori} from '../../src/favorisOuverture.js';
test('un refus sans version dans le retour conserve la version mesurée',()=>{
 const d=lire({ok:false,error:'Ouvre les notifications sur Vinted dans ce profil Chrome, puis réessaie.',controleOuverture:{version:'5.221.0',etape:'commande'}});
 assert.equal(d.extension,'5.221.0');assert.equal(d.code,'notifications_non_affichees');assert.equal(d.ouvert,false);assert.equal(d.etape,'commande');
});
test('connexion et version se distinguent avant toute ouverture',()=>{
 assert.equal(lire({error:'L’extension doit être connectée au même compte VRM que cette page.',controleOuverture:{etape:'connexion'}}).code,'compte_vrm_different');
 assert.equal(lire({error:'L’ouverture avec vérification nécessite l’extension 5.221.',controleOuverture:{version:'5.220.0',etape:'version'}}).code,'extension_a_actualiser');
});
test('une erreur libre et ses champs privés ne sont jamais copiés',()=>{
 const secret='https://secret.invalid/?token=prive';const d=lire({error:secret,code:secret,data:{version:secret,raison:secret},controleOuverture:{version:secret,etape:secret},owner:secret});
 assert.equal(d.extension,'non_confirmee');assert.equal(d.code,'refus_non_classe');assert.ok(!JSON.stringify(d).includes(secret));
});
test('seul un reçu positif permet la confirmation',()=>{
 assert.equal(lire({ok:true,data:{ouvert:true,preuve:'confirmee',version:'5.221.0'}}).preuve,'confirmee');
 assert.equal(lire({ok:false,data:{ouvert:true,preuve:'confirmee'}}).preuve,'ouverture_non_confirmee');
 assert.equal(lire({ok:false,error:'Aucune réponse dans ce profil Chrome.'}).code,'extension_sans_reponse');
});

test('le refus distingue la cloche introuvable du favori absent après ouverture',()=>{
 for(const code of ['cloche_introuvable','cloche_indisponible','favori_non_trouve']){const d=lire({ok:false,data:{version:'5.222.0',code},controleOuverture:{etape:'commande'}});assert.equal(d.code,code);assert.equal(d.extension,'5.222.0');assert.equal(d.ouvert,false);}
});

test('le refus de capture distingue le format natif et la sauvegarde',()=>{
 assert.match(echecVerificationFavori({ok:true,data:{preuve:'non_confirmee',raison:'contexte_ou_format_incompatible'}}),/destinataire/);
 assert.match(echecVerificationFavori({ok:true,data:{preuve:'non_confirmee',raison:'enregistrement_non_confirme'}}),/enregistré dans VRM/);
 assert.equal(echecVerificationFavori({ok:true,data:{preuve:'confirmee'}}),'');
 assert.ok(!echecVerificationFavori({ok:true,data:{preuve:'non_confirmee',raison:'https://secret.invalid/token'}}).includes('secret'));
});
