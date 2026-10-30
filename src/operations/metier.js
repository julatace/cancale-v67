// Montants en centimes, quantités entières, aucun appel à une plateforme.
export const VIDE = () => ({version:1,revision:0,missions:[],reservations:[],lots:[],consommables:[],veilles:[],receptions:[],dossiers:[],journal:[],commandes:[]});
export class Refus extends Error { constructor(message,status=400){super(message);this.status=status;} }
const exige=(v,m)=>{if(!v)throw new Refus(m);};
export const texte=(v,max=160,facultatif=false)=>{exige(typeof v==='string','Texte attendu.');const s=v.trim();exige((facultatif||s.length>0)&&s.length<=max,`Texte requis, ${max} caractères maximum.`);return s;};
export const entier=(v,min=0,max=1000000000)=>{exige(Number.isSafeInteger(v)&&v>=min&&v<=max,'Quantité ou montant invalide.');return v;};
export const montantSaisi=v=>{const s=String(v).trim().replace(',','.');exige(/^\d{1,7}(\.\d{1,2})?$/.test(s),'Montant attendu, avec deux décimales au maximum.');const [a,b='']=s.split('.');return entier(Number(a)*100+Number(b.padEnd(2,'0')));};
const date=v=>{exige(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v)),'Date invalide.');const iso=new Date(v).toISOString();exige(v===iso||v===iso.replace('.000Z','Z'),'Date UTC invalide.');return iso;};
const trouve=(xs,id)=>{const x=xs.find(x=>x.id===id);exige(x,'Élément introuvable.');return x;};
const choix=(v,xs)=>{exige(xs.includes(v),'Choix invalide.');return v;};
const ajoute=(xs,x)=>{exige(xs.length<500,'Limite de 500 éléments atteinte.');xs.push(x);return x;};
export function repartir(total,poids){
 entier(total);exige(Array.isArray(poids)&&poids.length>0&&poids.length<=100,'Entre 1 et 100 articles.');poids.forEach(v=>entier(v,1,10000));
 const somme=poids.reduce((a,b)=>a+b,0),parts=poids.map((p,i)=>({i,n:Math.floor(total*p/somme),r:(total*p)%somme}));
 let reste=total-parts.reduce((s,p)=>s+p.n,0);[...parts].sort((a,b)=>b.r-a.r||a.i-b.i).forEach(p=>{if(reste>0){p.n++;reste--;}});return parts.map(p=>p.n);
}
export const etatReservation=(r,now)=>r.etat==='active'&&Date.parse(r.expire)<=Date.parse(now)?'expiree':r.etat;
// La même validation sert à la création et à la modification d’une recherche.
// (29 octobre) Les recherches enregistrées ALIMENTENT le fil eBay (eBay →
// Achats) : trois critères de plus, facultatifs — une recherche d'avant les
// reçoit par défaut (pas de pointure, achat immédiat, livraison en France).
// Et au plus `MAX_VEILLES_ACTIVES` relues : chacune coûte un appel à eBay.
export const MAX_VEILLES_ACTIVES=10;
// (30 octobre, revue) UNE règle pour ce qu'eBay peut chercher (§11) : la route
// `chercher` (api/_lib/ebay-recherche.js) et l'espace Organisation l'appliquent
// toutes les deux. Avant, Organisation acceptait « x » ou une catégorie en
// lettres, que la route refusait ensuite à chaque lecture du fil.
export function erreurCriteresEbay({mots,pointure,categorie}={}){
 const m=typeof mots==='string'?mots.trim().replace(/\s+/g,' '):'';
 if(m.length<2||m.length>200)return 'Mots-clés : au moins deux lettres (200 au plus).';
 const p=pointure==null?'':String(pointure).trim();
 if(p&&!/^\d{2}([.,]5)?$/.test(p))return 'Pointure attendue : deux chiffres, et « ,5 » au besoin (42 ou 42,5).';
 const c=categorie==null?'':String(categorie).trim();
 if(c&&!/^\d{1,10}$/.test(c))return 'Identifiant de catégorie eBay : des chiffres seulement (ex. 15709), ou laisse vide.';
 return '';
}
// Les recherches du FIL d'eBay → Achats : actives, les plus récentes d'abord,
// 10 au plus. Une seule règle pour le fil et pour l'espace Organisation (qui
// dit « Dans le fil » ou « Hors du fil »).
export function veillesDuFil(veilles){
 const actives=(Array.isArray(veilles)?veilles:[]).filter(v=>v&&v.etat==='preparee');
 actives.sort((a,b)=>String(b.cree||'').localeCompare(String(a.cree||'')));
 return {fil:actives.slice(0,MAX_VEILLES_ACTIVES),horsFil:Math.max(0,actives.length-MAX_VEILLES_ACTIVES)};
}
export function criteresVeille(p){
 const minimum=p.minimum===null||p.minimum===undefined?null:entier(p.minimum),maximum=entier(p.maximum,1);
 exige(minimum===null||minimum<=maximum,'Le minimum dépasse le budget.');
 const mots=texte(p.mots,200),categorie=texte(p.categorie||'',80,true),pointure=p.pointure==null||p.pointure===''?'':texte(String(p.pointure),6,true);
 const e=erreurCriteresEbay({mots,pointure,categorie});exige(!e,e);
 return {titre:texte(p.titre),mots,exclus:texte(p.exclus||'',200,true),categorie,etatArticle:choix(p.etatArticle,['tous','neuf','occasion']),minimum,maximum,pays:choix(p.pays,['FR','BE','DE','ES','IT','tous']),pointure,achatImmediat:p.achatImmediat!==false,livraisonFR:p.livraisonFR!==false};
}
const placeVeille=d=>exige(d.veilles.filter(x=>x.etat==='preparee').length<MAX_VEILLES_ACTIVES,`${MAX_VEILLES_ACTIVES} recherches actives au plus (chacune coûte un appel à eBay) : archive-en une d’abord.`);
export function echeanceActive(section,x,maintenant){
 const active=section==='missions'?['attribuee','en_cours','bloquee'].includes(x.etat):section==='reservations'?etatReservation(x,maintenant)==='active':section==='dossiers'?x.etat!=='clos':false;
 const at=active?Date.parse(section==='reservations'?x.expire:x.echeance):NaN,now=Date.parse(maintenant);
 if(!Number.isFinite(at)||!Number.isFinite(now))return null;
 return {at,etat:at<=now?'retard':at-now<=86400000?'proche':'ulterieure'};
}
export function trierOperations(items,section,maintenant,tri='recent'){
 return items.map((x,i)=>({x,i,e:echeanceActive(section,x,maintenant)})).sort((a,b)=>{
  if(tri==='echeance'){const r=(a.e?.at??Infinity)-(b.e?.at??Infinity);if(r&&!Number.isNaN(r))return r;}
  return b.i-a.i;
 }).map(v=>v.x);
}
export function appliquer(source,commande,{acteur,maintenant,equipe=[],membre=null,empreinte=''}){
 exige(source?.version===1&&Number.isSafeInteger(source.revision),'Format de données non reconnu.');
 const deja=source.commandes.find(c=>c.id===commande.id);
 if(deja){exige(deja.empreinte===empreinte&&deja.acteur===acteur,'Cette opération existe avec un contenu différent.');return source;}
 exige(source.commandes.length<5000,'Le journal a atteint sa capacité. Exporte une copie et contacte le support pour l’archivage.');
 const d=structuredClone(source),p=commande.donnees||{},type=commande.type;
 const commun={id:commande.id,cree:maintenant,auteur:acteur};
 if(membre)exige(['mission.etat','mission.etape'].includes(type),'Action réservée au responsable.');
 switch(type){
 case 'mission.creer':{
  const attribution=p.attribution?texte(p.attribution):'';exige(!attribution||equipe.some(e=>e.id===attribution&&e.statut==='actif'),'Choisis un membre actif.');
  exige(Array.isArray(p.etapes)&&p.etapes.length<=30,'30 étapes maximum.');
  ajoute(d.missions,{...commun,titre:texte(p.titre),consigne:texte(p.consigne||'',1500,true),categorie:choix(p.categorie,['retrait','reception','controle','photos','annonce','emballage','depot','retour','autre']),attribution,echeance:p.echeance?date(p.echeance):null,etat:'attribuee',evenements:[],etapes:p.etapes.map(t=>({texte:texte(t),fait:false})),compteRendu:''});break;
 }
 case 'mission.etat':{
  const x=trouve(d.missions,p.cible);exige(!membre||x.attribution===membre,'Cette mission ne t’est pas attribuée.');
  const transitions={attribuee:['en_cours','annulee'],en_cours:['terminee','bloquee','annulee'],bloquee:['en_cours','annulee'],terminee:['validee','en_cours'],validee:['en_cours'],annulee:[]};
  exige((transitions[x.etat]||[]).includes(p.etat),'Ce changement n’est plus possible.');
  if(membre)exige(['en_cours','terminee','bloquee'].includes(p.etat)&&x.etat!=='validee','Validation réservée au responsable.');
  if(p.etat==='terminee')exige(x.etapes.every(e=>e.fait),'Termine toutes les étapes avant de rendre la mission.');
  if(p.etat==='bloquee')exige(typeof p.note==='string'&&p.note.trim(),'Précise la cause du blocage.');
  x.compteRendu=texte(p.note||'',1500,true);(x.evenements??=[]).push({...commun,avant:x.etat,apres:p.etat,note:x.compteRendu});x.etat=p.etat;x.modifie=maintenant;break;
 }
 case 'mission.etape':{
  const x=trouve(d.missions,p.cible);exige(!membre||x.attribution===membre,'Cette mission ne t’est pas attribuée.');exige(x.etat==='en_cours','Commence la mission avant de cocher ses étapes.');
  entier(p.index,0,x.etapes.length-1);exige(typeof p.fait==='boolean','État attendu.');x.etapes[p.index]={...x.etapes[p.index],fait:p.fait,auteur:acteur,le:maintenant};break;
 }
 case 'reservation.creer':{
  const reference=texte(p.reference),quantite=entier(p.quantite,1,10000),stock=entier(p.stock,1,10000),expire=date(p.expire),prix=entier(p.prix),acompte=entier(p.acompte);
  exige(Date.parse(expire)>Date.parse(maintenant),'L’expiration doit être dans le futur.');exige(acompte<=prix,'L’acompte dépasse le prix convenu.');
  const existante=d.reservations.find(r=>r.reference===reference);exige(!existante||existante.stock===stock,'Cette référence utilise déjà un autre stock de départ. Vérifie la référence.');
  const occupe=d.reservations.filter(r=>r.reference===reference&&['active','convertie'].includes(etatReservation(r,maintenant))).reduce((s,r)=>s+r.quantite,0);
  exige(occupe+quantite<=stock,'Quantité insuffisante : vérifie les réservations ou ventes déjà enregistrées.');
  ajoute(d.reservations,{...commun,reference,quantite,stock,acheteur:texte(p.acheteur),expire,prix,acompte,rembourse:0,etat:'active'});break;
 }
 case 'reservation.prolonger':{
  const x=trouve(d.reservations,p.cible);exige(etatReservation(x,maintenant)==='active','Seule une réservation encore active peut être prolongée.');
  const expire=date(p.expire);exige(Date.parse(expire)>Date.parse(x.expire),'Choisis une échéance après celle déjà convenue.');
  const note=texte(p.note,250);(x.evenements??=[]).push({...commun,nature:'prolongation',avant:x.expire,apres:expire,note});x.expire=expire;break;
 }
 case 'reservation.etat':{
  const x=trouve(d.reservations,p.cible);exige(etatReservation(x,maintenant)==='active','Cette réservation n’est plus active.');x.etat=choix(p.etat,['annulee','convertie']);(x.evenements??=[]).push({...commun,nature:x.etat,note:texte(p.note||'',250,true)});break;
 }
 case 'reservation.rembourser':{
  const x=trouve(d.reservations,p.cible);exige(x.etat!=='convertie','Traite le remboursement de cette vente dans son dossier.');const n=entier(p.montant,1);exige(x.rembourse+n<=x.acompte,'Le remboursement dépasse l’acompte restant.');x.rembourse+=n;(x.evenements??=[]).push({...commun,nature:'remboursement_enregistre',montant:n});break;
 }
 case 'lot.creer':{
  exige(Array.isArray(p.articles)&&p.articles.length>0&&p.articles.length<=100,'Entre 1 et 100 articles.');
  const achat=entier(p.achat),frais=p.frais===null?null:entier(p.frais),total=entier(achat+(frais??0)),parts=repartir(total,p.articles.map(x=>x.poids));
  ajoute(d.lots,{...commun,titre:texte(p.titre),achat,frais,total,articles:p.articles.map((x,i)=>({id:`${commande.id}:${i}`,titre:texte(x.titre),poids:x.poids,cout:parts[i]}))});break;
 }
 case 'consommable.creer':{
  ajoute(d.consommables,{...commun,titre:texte(p.titre),unite:choix(p.unite,['piece','rouleau','metre']),seuil:entier(p.seuil,0,100000),stock:p.stock===null?null:entier(p.stock,0,100000),mouvements:[]});break;
 }
 case 'consommable.mouvement':{
  const x=trouve(d.consommables,p.cible);exige(x.mouvements.length<1000,'Journal du consommable plein.');const nature=choix(p.nature,['initialisation','entree','consommation','perte','correction']),n=entier(p.quantite,nature==='initialisation'||nature==='correction'?0:1,100000),motif=texte(p.motif,250);
  if(x.stock===null)exige(nature==='initialisation','Initialise le stock avant tout mouvement.');else exige(nature!=='initialisation','Ce stock est déjà initialisé.');
  const suivant=['initialisation','correction'].includes(nature)?n:x.stock+(['consommation','perte'].includes(nature)?-n:n);exige(suivant>=0&&suivant<=100000,'Stock insuffisant ou quantité excessive.');
  x.mouvements.push({...commun,nature,quantite:n,motif,avant:x.stock,apres:suivant});x.stock=suivant;break;
 }
 case 'veille.creer':{
  placeVeille(d);ajoute(d.veilles,{...commun,...criteresVeille(p),version:1,etat:'preparee',evenements:[]});break;
 }
 case 'veille.modifier':{
  const x=trouve(d.veilles,p.cible);exige(x.etat==='preparee','Restaure cette recherche avant de la modifier.');
  exige((x.evenements||[]).length<100,'Historique de cette recherche plein.');
  exige(p.versionAttendue===(x.version||1),'Cette recherche a changé. Ferme le formulaire et rouvre-la avant de sauvegarder.');
  const avant=criteresVeille(x),apres=criteresVeille(p);(x.evenements??=[]).push({...commun,nature:'modification',avant,apres});Object.assign(x,apres,{version:(x.version||1)+1,modifie:maintenant});break;
 }
 case 'veille.dupliquer':{
  const x=trouve(d.veilles,p.cible);placeVeille(d);ajoute(d.veilles,{...commun,...criteresVeille(x),titre:texte(p.titre),version:1,etat:'preparee',evenements:[],origine:x.id});break;
 }
 case 'veille.archiver':
 case 'veille.restaurer':{
  const x=trouve(d.veilles,p.cible),archiver=type==='veille.archiver';exige(x.etat===(archiver?'preparee':'archivee'),'Cette recherche a déjà changé d’état.');if(!archiver)placeVeille(d);
  exige((x.evenements||[]).length<100,'Historique de cette recherche plein.');
  (x.evenements??=[]).push({...commun,nature:archiver?'archivage':'restauration'});x.etat=archiver?'archivee':'preparee';break;
 }
 case 'dossier.creer':{
  d.dossiers??=[];ajoute(d.dossiers,{...commun,reference:texte(p.reference),titre:texte(p.titre),nature:choix(p.nature,['retour','litige','manquant','autre']),echeance:p.echeance?date(p.echeance):null,note:texte(p.note||'',1500,true),etat:'ouvert',evenements:[]});break;
 }
 case 'dossier.etat':{
  const x=trouve(d.dossiers||[],p.cible),etat=choix(p.etat,['ouvert','retour_attendu','retour_recu','controle','clos']);
  const autorises={ouvert:['retour_attendu','clos'],retour_attendu:['retour_recu','ouvert'],retour_recu:['controle','ouvert'],controle:['clos','ouvert'],clos:['ouvert']};
  exige(autorises[x.etat]?.includes(etat),'Transition de dossier invalide.');exige(x.evenements.length<100,'Historique du dossier plein.');
  const note=texte(p.note,1500);x.evenements.push({...commun,avant:x.etat,apres:etat,note});x.etat=etat;x.note=note;break;
 }
 case 'reception.creer':{
  ajoute(d.receptions,{...commun,reference:texte(p.reference),titre:texte(p.titre),attendu:entier(p.attendu,1,10000),recu:0,controle:0,serie:texte(p.serie||'',100,true),accessoires:texte(p.accessoires||'',1000,true),etat:'attendue',evenements:[]});break;
 }
 case 'reception.constater':{
  const x=trouve(d.receptions,p.cible),recu=entier(p.recu,0,x.attendu),controle=entier(p.controle,0,recu);exige(x.evenements.length<100,'Historique de réception plein.');
  if(recu<x.recu||controle<x.controle)exige(typeof p.note==='string'&&p.note.trim(),'Précise la raison de la correction.');
  x.evenements.push({...commun,recu,controle,note:texte(p.note||'',1000,true)});x.recu=recu;x.controle=controle;x.etat=controle===x.attendu?'controlee':recu===x.attendu?'a_controler':'partielle';break;
 }
 default:throw new Refus('Action inconnue.');
 }
 d.revision++;d.commandes.push({id:commande.id,empreinte,acteur});d.journal.push({id:commande.id,type,acteur,le:maintenant,cible:p.cible||commande.id});return d;
}
// Une inconnue obligatoire n’est jamais assimilée à une bonne affaire.
export function correspondance(regle,annonce){
 const non=[],inconnus=[],titre=typeof annonce.titre==='string'?annonce.titre.toLocaleLowerCase('fr'):null;
 if(titre===null)inconnus.push('Titre');else{
  if(!regle.mots.toLocaleLowerCase('fr').split(/\s+/).filter(Boolean).every(m=>titre.includes(m)))non.push('Mots-clés');
  if(regle.exclus.toLocaleLowerCase('fr').split(',').map(x=>x.trim()).filter(Boolean).some(x=>titre.includes(x)))non.push('Exclusions');
 }
 const chiffres=['prix','port','frais'].every(k=>Number.isSafeInteger(annonce[k])&&annonce[k]>=0);
 if(!chiffres)inconnus.push('Coût livré');else if(!Number.isSafeInteger(annonce.prix+annonce.port+annonce.frais))inconnus.push('Coût livré');
 else {const total=annonce.prix+annonce.port+annonce.frais;if(total>regle.maximum||(regle.minimum!==null&&total<regle.minimum))non.push('Budget livré');}
 if(annonce.devise!=='EUR')inconnus.push('Devise EUR');
 for(const [cle,valeur] of [['categorie',regle.categorie],['etatArticle',regle.etatArticle==='tous'?'':regle.etatArticle],['pays',regle.pays==='tous'?'':regle.pays]])if(valeur){if(!annonce[cle])inconnus.push(cle);else if(annonce[cle]!==valeur)non.push(cle);}
 return {etat:non.length?'non':inconnus.length?'inconnu':'oui',non,inconnus};
}
