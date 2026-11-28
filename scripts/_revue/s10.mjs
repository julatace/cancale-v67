// Worker tué entre l'offre et le message : quand VRM laisse-t-il partir le favori suivant, et jusqu'à quand la reprise
// (reprendreMessagesFavoris) peut-elle encore écrire le message du premier ?
import * as F from '../../api/_lib/favoris-file.js';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../../vinted-sync-extension/background.js',import.meta.url),'utf8');
const trop=eval(/const FAVORI_ATTENTE_TROP_TARD_MS = ([^;]+);/.exec(src)[1]);
const EH=eval('('+/const ECRITURE_HUMAINE = (\{[^}]+\})/.exec(src)[1]+')');
const o='own',T=Date.parse('2026-11-28T11:00:00Z');
let d=F.initialiserFile(null);
d=F.lancerFile(d,{owner:o,targets:[{itemId:'701',recipientId:'301',notificationId:'a',initiator:'x'},{itemId:'702',recipientId:'302',notificationId:'b',initiator:'x'}],message:'m',intervalleMinutes:0,maintenant:T}).data;
const J='00000000-0000-4000-8000-0000000000a1';
d=F.reserverFile(d,{owner:o,maintenant:T,jeton:J}).data;
d=F.prolongerFile(d,{owner:o,jeton:J,maintenant:T+30000}).data;     // dernier renouvellement
const offreA=T+58000, mort=T+59000, s=20;                            // l'offre part, le worker meurt avant le renouvellement de T+60
const jusqua=offreA+s*1000;
let libre=null;for(let t=mort;t<T+600000;t+=1000){const r=F.reserverFile(d,{owner:o,maintenant:t,jeton:'00000000-0000-4000-8000-0000000000b'+(t%10)});d=r.data||d;if(r.valeur&&r.valeur.travail){libre=t;break;}}
const finReprise=jusqua+trop;     // dernier départ de la reprise (vérifié AVANT l'écriture tapée)
console.log('favori suivant réservé à T+'+(libre-T)/1000+' s');
console.log('la reprise peut démarrer jusqu’à T+'+(finReprise-T)/1000+' s, puis tape '+EH.minMs/1000+' à '+EH.maxMs/1000+' s avant d’écrire ⇒ écriture jusqu’à T+'+(finReprise+EH.maxMs-T)/1000+' s');
console.log('chevauchement possible :', finReprise+EH.maxMs>libre ? 'OUI : un message de plus de '+Math.ceil((libre-finReprise)/1000*EH.cps)+' caractères (frappe '+EH.cps+' car/s) part après la réservation du suivant, jusqu’à '+(finReprise+EH.maxMs-libre)/1000+' s après' : 'non');
