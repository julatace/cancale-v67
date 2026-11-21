import test from 'node:test';import assert from 'node:assert/strict';
import {resoudreCiblesFavoris} from '../../api/_lib/favoris-cibles.js';
const uid='123';
const notification=(i=1)=>({id:'n'+i,user_id:700+i,body:'Camille a ajouté ton article à ses favoris.',link:`/items/${100+i}/conversation/new?native_target=${200+i}`});
const capture={uid,type:'notifications',domain:'www.vinted.fr',payload:{notifications:[notification(),notification(2)]}};
const native=(i=1)=>({uid,method:'POST',path:'/api/v2/conversations',body:JSON.stringify({initiator:'native',item_id:100+i,opposite_user_id:200+i}),contexteFavori:`https://www.vinted.fr/items/${100+i}/conversation/new?native_target=${200+i}`});
const opts={uid,capture,trace:native(),selection:['n1','n2']};
test('le paramètre destinataire est prouvé par le lien natif ouvert et la requête produite, jamais par son nom',()=>{
 const unique=resoudreCiblesFavoris({...opts,selection:['n1']});assert.equal(unique[0].recipientId,'201');assert.notEqual(unique[0].recipientId,String(notification().user_id));
 assert.throws(()=>resoudreCiblesFavoris(opts),'un seul exemple ne peut pas généraliser un paramètre inconnu');
 const c=structuredClone(capture);c.payload.notifications.push(notification(3));const r=resoudreCiblesFavoris({...opts,capture:c,traces:[native(2)],selection:['n3']});assert.equal(r[0].recipientId,'203','deux destinataires natifs distincts prouvent le même paramètre');
 assert.throws(()=>resoudreCiblesFavoris({...opts,trace:{...native(),contexteFavori:undefined}}));
 const normalise=structuredClone(capture);normalise.payload.notifications[0].link='https://vinted.fr/items/101/conversation/new/?native_target=201&context=abc#section';
 const t={...native(),contexteFavori:'https://www.vinted.fr/items/101/conversation/new?context=abc&native_target=201'};
 assert.equal(resoudreCiblesFavoris({...opts,capture:normalise,trace:t,selection:['n1']})[0].recipientId,'201','redirection www, barre finale, fragments et ordre des paramètres n’effacent pas une preuve');

});
test('une preuve conservée reste utilisable après une autre création native',()=>{
 const actuel=native(99);delete actuel.contexteFavori;
 const r=resoudreCiblesFavoris({...opts,trace:actuel,traces:[native(),native(2)]});assert.equal(r[1].recipientId,'202');
 for(const faux of [{...native(),uid:'999'},{...native(),path:'/api/v3/conversations'},{...native(),contexteFavori:'https://evil.invalid/items/101/conversation/new?native_target=201'},{...native(),contexteFavori:'https://www.vinted.fr/items/555/conversation/new?native_target=201'}])assert.throws(()=>resoudreCiblesFavoris({...opts,trace:actuel,traces:[faux]}));
});
test('sans paramètre numérique prouvé, seule la notification exacte a un destinataire',()=>{
 const c=structuredClone(capture);c.payload.notifications[0].link='/items/101/conversation/new?context=opaque';
 const t={...native(),contexteFavori:'https://www.vinted.fr/items/101/conversation/new?context=opaque'};
 assert.equal(resoudreCiblesFavoris({...opts,capture:c,trace:t,selection:['n1']})[0].recipientId,'201');
 assert.throws(()=>resoudreCiblesFavoris({...opts,capture:c,trace:t}));
});
test('preuves contradictoires, paramètres multiples, origine étrangère et destinataire propre ne permettent pas un envoi',()=>{
 assert.throws(()=>resoudreCiblesFavoris({...opts,traces:[{...native(),body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:999})}]}));
 assert.throws(()=>resoudreCiblesFavoris({...opts,selection:['n2'],traces:[{...native(),body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:999})}]}),'une preuve contradictoire ne peut pas apprendre un paramètre pour les autres favoris');
 const c=structuredClone(capture);c.payload.notifications[1].link='/items/102/conversation/new?native_target=202&native_target=999';assert.throws(()=>resoudreCiblesFavoris({...opts,capture:c}));
 assert.throws(()=>resoudreCiblesFavoris({...opts,trace:{...native(),body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:123})}}));
 const d=structuredClone(capture);d.payload.notifications.push({...notification(),id:'autre',user_id:999});assert.throws(()=>resoudreCiblesFavoris({...opts,capture:d}));
});

test('une lecture du fil affiché confirme le destinataire sans nouvelle création native',()=>{
 const actuel=native(99);delete actuel.contexteFavori;
 const lecture={uid,method:'GET',path:'/api/v2/conversations/900',conversationId:'900',itemId:'101',recipientId:'201',contexteFavori:native().contexteFavori};
 assert.equal(resoudreCiblesFavoris({...opts,trace:actuel,traces:[],lectures:[lecture],selection:['n1']})[0].recipientId,'201');
 for(const faux of [{...lecture,uid:'456'},{...lecture,method:'POST'},{...lecture,path:'/api/v2/conversations/999'},{...lecture,itemId:'555'},{...lecture,contexteFavori:'https://evil.invalid/items/101/conversation/new?native_target=201'}])assert.throws(()=>resoudreCiblesFavoris({...opts,trace:actuel,lectures:[faux],selection:['n1']}));
});
