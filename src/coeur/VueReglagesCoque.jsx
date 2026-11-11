// Découpé d'App.jsx par scripts/decouper-app-2.cjs (chargé à la demande par App.jsx).
// Déplacement MÉCANIQUE : le code est celui d'App.jsx, inchangé — docs/passation/2026-11-11-decoupe-app.md.
// ⚠️ Ne pas effacer les balises ⟦…⟧ : scripts/_source-app.cjs recolle par elles le texte d'origine pour les audits.
import { GardeEcran } from '../composants/GardeEcran.jsx';
import { lectureSeuleActive, EXPORT_FERME } from '../abonnement/etatAbonnement.js';
import { ALLEGER_AVANT_CLOUD, SUPABASE_ROW, SUPABASE_URL, SYNC_KEYS, aLaDemande, askConfirm, askNotifPermission, codeRefusNumeros, isCloudReady, poserPoint, pushNotif, save, sbAuth, toast, versionNumerotation } from '../App.jsx';

// La branche {tab==='settings' && …} de AppCoeur, telle quelle. Ce qu'elle lit du composant lui est passé (v).
export function VueReglagesCoque({ v }) {
  const { apparence, choisirApparence, dark, ebayCompteReglage, notifEnabled, platSub, setNotifEnabled, setPlatSub, setTab, subVoulue, toggleDark, vintedAccounts } = v;
  return (/*⟦← App.jsx #v1⟧*/<GardeEcran nom="settings" resetKey={platSub}><SettingsScreen setTab={setTab} onPlateforme={plat=>{subVoulue.current=plat==='plat_leboncoin'?'annonces':'compte';setTab(plat);}} ebayCompte={ebayCompteReglage} ouvrir={platSub==='ebay'?'ebay':null} onOuvert={()=>setPlatSub('reglages')} comptes={vintedAccounts}

          notifEnabled={notifEnabled}
          onToggleNotif={async()=>{
            if(!notifEnabled){
              const res=await askNotifPermission();
              if(res==='granted'){
                setNotifEnabled(true); save('vinted_notif_enabled',true);
                pushNotif('Alertes activées','Une nouvelle vente s’affichera ici quand VRM est ouvert.');
              } else if(res==='denied'){
                toast("Notifications bloquées : autorise le site dans les réglages du navigateur.");
              } else if(res==='unsupported'){
                toast("Pas de notifications ici : le bandeau de l'app reste.");
              }
            } else {
              setNotifEnabled(false); save('vinted_notif_enabled',false);
            }
          }}
          onExport={async()=>{ if(lectureSeuleActive()){ toast(EXPORT_FERME); return; } try{
            // ⚠️⚠️ « TÉLÉCHARGE TOUT : catalogue, ventes, achats… » — C'ÉTAIT FAUX
            // (4 octobre). Le fichier ne portait que les réglages synchronisés
            // (la ligne `main`) : ni les ventes, ni les achats, ni les messages, ni
            // les annonces captées par l'extension, qui vivent dans leurs propres
            // lignes. Un filet de sécurité qui ne contient pas ce qu'il annonce
            // ne sert à rien le jour où on en a besoin.
            // Maintenant : les réglages (restaurables, comme avant) + TOUTES ses
            // lignes captées, en copie. Trois choses restent dehors, et le
            // fichier le DIT (`omis`) : les PDF de bordereau (lourds, se
            // retéléchargent), le détail brut des transactions (24 Mo — on garde
            // ses champs utiles : article, état, dates), et les jetons de
            // connexion Vinted (un fichier téléchargé ne doit jamais pouvoir
            // ouvrir un compte). Une lecture ratée ne donne PAS un fichier qui a
            // l'air complet : `complet:false` et la liste de ce qui manque.
            toast('Sauvegarde en préparation… (quelques secondes)');
            // ⚠️⚠️ LES JETONS PARTAIENT QUAND MÊME (revue adverse, 4 octobre) : le
            //    navigateur garde `vinted_accounts` AVEC access/refresh/csrf, et la
            //    boucle relisait le navigateur sans l'allègement que `cloudPush`
            //    applique. La règle est la MÊME que pour le nuage (§11), plus la clé
            //    du widget (elle suffit à lire ses chiffres). Et un filet : tout
            //    champ de jeton, où qu'il soit, est retiré du fichier.
            const SANS_FICHIER = new Set(['vrm_widget_token', 'vrm_sms_token']);
            const SECRET = /^(access_token|refresh_token|csrf_token|id_token|client_secret|password|p256dh)$/i;
            const sansSecrets = (v, prof = 0) => {
              if (prof > 40 || v === null || typeof v !== 'object') return v;
              if (Array.isArray(v)) return v.map((x) => sansSecrets(x, prof + 1));
              const o = {}; for (const k of Object.keys(v)) { if (!SECRET.test(k)) o[k] = sansSecrets(v[k], prof + 1); } return o;
            };
            const keys={};
            SYNC_KEYS.forEach(k=>{ if(SANS_FICHIER.has(k)) return; const v=localStorage.getItem(k); if(v!=null){ let val; try{ val=JSON.parse(v); }catch{ val=v; } const f=ALLEGER_AVANT_CLOUD[k]; keys[k]=sansSecrets(f?f(val):val); } });
            const toutLire = async (query) => {
              const out = [];
              for (let p = 0; p < 200; p++) {
                const from = p * 500;
                const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: sbAuth({ Range: `${from}-${from + 499}`, 'Range-Unit': 'items' }) });
                if (!r.ok) return null;
                const lot = await r.json();
                if (!Array.isArray(lot)) return null;
                out.push(...lot);
                if (lot.length < 500) break;
              }
              return out;
            };
            // `ebay_tokens*` (les jetons eBay, de chacun de ses comptes) et `push_subs` (les clés de ses téléphones)
            // ne quittent pas la base.
            const EXCLUS = ['harvest_*_txn_*','harvest_*_label_*','email_bord_*','email_html_*','lbc_catalogue','lbc_recon','backup_*','harvest_*_seen_urls','harvest_*_wreq_*','harvest_*_pickup_points','ebay_tokens*','push_subs','vrm_photoroom_cle','photoroom_cle'];
            const [lignes, legeres, comptes] = await Promise.all([
              toutLire(`app_data?select=id,data&and=(${EXCLUS.map(x=>`id.not.like.${x}`).join(',')})&order=id`),
              toutLire(`app_data?select=id,meta&or=(id.like.harvest_*_txn_*,id.like.harvest_*_label_*,id.like.email_bord_*)&order=id`),
              (async()=>{ try{ const r=await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login,domain`,{headers:sbAuth()}); if(!r.ok) return null; const j=await r.json(); return Array.isArray(j)?j:null; }catch(_){ return null; } })(),
            ]);
            const manques=[]; if(!lignes) manques.push('tes données captées (ventes, achats, messages, annonces, e-mails)'); if(!legeres) manques.push('le résumé des transactions et des bordereaux'); if(!comptes) manques.push('la liste de tes comptes Vinted');
            // Réglages lus dans le navigateur AVANT que le nuage soit arrivé : ils
            // peuvent être vides ou périmés — le fichier ne se dit pas complet.
            if(!isCloudReady()) manques.push('tes réglages (pas encore chargés depuis ton compte)');
            const data={ _cancale_backup:3, exportDate:new Date().toISOString(), keys,
              donnees:{ lignes:(lignes||[]).map(l=>({ id:l.id, data:sansSecrets(l.data) })), resumes:legeres||[], comptes:comptes||[] },
              complet: manques.length===0, manques,
              omis:['PDF des bordereaux (ils se retéléchargent depuis Vinted ou ton e-mail)','détail brut des transactions (on garde article, état et dates)','jetons de connexion Vinted et eBay, clé du widget, clé Photoroom, clés de tes téléphones (jamais dans un fichier)'] };
            const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
            const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;
            a.download=`vrm-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
            // Révoquer plus tard : un fichier de 12 Mo révoqué aussitôt peut ne
            // jamais se télécharger (Safari).
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 4000);
            // « Dernière sauvegarde : aujourd'hui ✅ » seulement pour un fichier COMPLET.
            if(!manques.length){ try{ localStorage.setItem('vinted_last_backup', String(Date.now())); }catch(_){} }
            const n=(lignes||[]).length+(legeres||[]).length;
            toast(manques.length ? `⚠ Sauvegarde INCOMPLÈTE : la base n'a pas répondu pour ${manques.join(', ')}. Réessaie dans un instant.` : `✓ Sauvegarde téléchargée : tes réglages + ${n} lignes de données captées.`);
          }catch(err){toast('Erreur export : '+err.message);} }}
          onImport={()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.onchange=async(e)=>{ const file=e.target.files[0]; if(!file) return; try{
            const data=JSON.parse(await file.text());
            // Écrit les clés puis POUSSE tout de suite au cloud (sinon le
            // rechargement rechargerait l'ancienne version depuis Supabase et
            // écraserait la restauration), puis recharge pour tout ré-appliquer.
            // ⚠️⚠️ TROIS DÉFAUTS (revue adverse, 4 octobre) :
            //  1. « ✓ restaurée » s'affichait même quand l'écriture dans le nuage
            //     échouait — et le rechargement relisait l'ANCIENNE ligne : la
            //     restauration disparaissait sans un mot. On vérifie, et sur un
            //     échec on remet les valeurs d'avant et on ne recharge pas.
            //  2. Restaurer une sauvegarde ANCIENNE remplaçait le pool des numéros :
            //     les N° posés depuis redevenaient libres et la numérotation auto
            //     les redonnait — §5, un numéro écrit sur un carton n'est JAMAIS
            //     réattribué. Le pool est désormais l'UNION des deux, et pour les
            //     fiches qui portent un N°, ce qui est en place GAGNE (le fichier ne
            //     comble que les manques).
            //  3. Jamais de `vinted_accounts` (ni de jetons) depuis un fichier : la
            //     table est la source ; ni la clé du widget.
            const NUMEROS_FUSION = ['vinted_annonce_numeros','vinted_sale_overrides'];
            const applyAndReload=async(entriesBrutes)=>{
              const lireLocal=(k)=>{ const raw=localStorage.getItem(k); if(raw==null) return undefined; try{ return JSON.parse(raw); }catch{ return raw; } };
              // ⚠️ (relecture du 11 octobre) Une sauvegarde d'AVANT la remise à
              // zéro des numéros (migration 013) porte les anciens numéros en
              // chiffres : la base la refusait (« vrm_numeros_perimes ») et l'écran
              // disait « la base n'a pas répondu, réessaie » — faux, et réessayer
              // échouait toujours. Et une sauvegarde sans clé « B… » serait PASSÉE :
              // l'union du pool remettait 1…552 en chiffres, et les paires
              // republiées seraient reparties à 553. On compare la VERSION de
              // numérotation du fichier à celle de l'app, avant d'écrire quoi que ce soit.
              const vIci=versionNumerotation();
              if(vIci!=null){
                const brut=(entriesBrutes.find(([k])=>k==='vrm_numerotation')||[])[1];
                let mkF=brut; if(typeof brut==='string'){ try{ mkF=JSON.parse(brut); }catch{ mkF=null; } }
                const vF=mkF&&typeof mkF==='object'?Number(mkF.version):NaN;
                if(vF!==vIci){ toast(SAUVEGARDE_AVANT_REMISE); return; }
              }
              const entries=entriesBrutes.filter(([k])=>k!=='vinted_accounts' && k!=='vrm_widget_token' && k!=='vrm_sms_token').map(([k,v])=>{
                const cur=lireLocal(k);
                if(k==='vinted_used_numeros' && Array.isArray(v)){
                  const vu=new Set(); const out=[];
                  for(const x of [...(Array.isArray(cur)?cur:[]), ...v]){ const c=String(x); if(!vu.has(c)){ vu.add(c); out.push(x); } }
                  return [k,out];
                }
                if(NUMEROS_FUSION.includes(k) && v && typeof v==='object' && !Array.isArray(v) && cur && typeof cur==='object' && !Array.isArray(cur)) return [k,{ ...v, ...cur }];
                return [k,v];
              });
              // (11 nov.) Revenir en arrière : un point AVANT l'import ; sans lui, rien n'est écrit.
              { const pt=await poserPoint('import','Restauration d’une sauvegarde complète'); if(!pt.ok){ toast('⚠ Le point de restauration n’a pas pu être posé : rien n’a changé. Réessaie dans un instant.'); return; } }
              const avant=entries.map(([k])=>[k,localStorage.getItem(k)]);
              entries.forEach(([k,v])=>{ try{ localStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v)); }catch(_){} });
              let enregistre=false, refus=null;
              try{
                const payload={}; SYNC_KEYS.forEach(k=>{ const raw=localStorage.getItem(k); if(raw!=null){ let val; try{ val=JSON.parse(raw); }catch{ val=raw; } const f=ALLEGER_AVANT_CLOUD[k]; payload[k]=f?f(val):val; } });
                if(Object.keys(payload).length){
                  const r=await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}`, { method:'PATCH', headers:sbAuth({ 'Content-Type':'application/json', Prefer:'return=minimal' }), body: JSON.stringify({ data:payload, updated_at:new Date().toISOString() }) });
                  enregistre=r.ok;
                  if(!r.ok){ let t=''; try{ t=await r.text(); }catch(_){} refus=codeRefusNumeros(t)||(r.status>=400&&r.status<500?'refus':null); } // un 5xx (522 de Cloudflare…) : la base n'a PAS répondu, ce n'est pas un refus
                }
              }catch(_){ enregistre=false; }
              if(!enregistre){
                avant.forEach(([k,raw])=>{ try{ if(raw==null) localStorage.removeItem(k); else localStorage.setItem(k,raw); }catch(_){} });
                // La base a REFUSÉ (elle a répondu) ≠ la base n'a pas répondu.
                toast(refus && refus!=='refus' ? SAUVEGARDE_AVANT_REMISE
                  : refus ? '⚠ La base a refusé cette restauration. Rien n\'a changé.'
                  : '⚠ La restauration n\'a pas pu être enregistrée. Rien n\'a changé : réessaie.');
                return;
              }
              toast('✓ Sauvegarde restaurée ! L\'app va se recharger.');
              location.reload();
            };
            // Format complet (nouveau)
            if(data && data._cancale_backup && data.keys && typeof data.keys==='object'){
              const entries=Object.entries(data.keys).filter(([k])=>SYNC_KEYS.includes(k));
              const cat=Array.isArray(data.keys.vinted_catalog)?data.keys.vinted_catalog.length:0;
              const sal=Array.isArray(data.keys.vinted_sales)?data.keys.vinted_sales.length:0;
              const num=data.keys.vinted_annonce_numeros?Object.keys(data.keys.vinted_annonce_numeros).length:0;
              // Les données CAPTÉES (ventes, achats, messages…) ne sont pas réécrites :
              // une copie ancienne écraserait une capture plus fraîche (§4.2), et
              // l'extension les recapte toute seule. On restaure ce que TU as saisi.
              if(!await askConfirm(`Restaurer cette sauvegarde ?\n\n📦 Catalogue : ${cat}\n💸 Ventes saisies : ${sal}\n🔢 Numéros : ${num}\n📁 ${entries.length} rubriques de réglages et de saisies\n\nTes ventes, achats et messages captés sur Vinted ne sont pas remplacés : l'extension les recapte toute seule. Les numéros donnés depuis cette sauvegarde restent réservés (un numéro écrit sur une étiquette ne sert jamais deux fois).\n\n⚠ Tes autres réglages seront REMPLACÉS, puis l'app se rechargera.`)) return;
              await applyAndReload(entries); return;
            }
            // Ancien format (compat) : { catalog, sales, garageGrid }
            if(data && (data.catalog||data.sales||data.garageGrid)){
              let msg='Importer cet ancien fichier ?\n\n'; if(data.catalog)msg+=`📦 Catalogue : ${data.catalog.length} paires\n`; if(data.sales)msg+=`💸 Ventes : ${data.sales.length}\n`; msg+='\n⚠ Tes données actuelles seront REMPLACÉES, puis l\'app se rechargera.';
              if(!await askConfirm(msg)) return;
              const entries=[]; if(data.catalog)entries.push(['vinted_catalog',data.catalog]); if(data.sales)entries.push(['vinted_sales',data.sales]); if(data.garageGrid)entries.push(['vinted_garage_grid',data.garageGrid]);
              await applyAndReload(entries); return;
            }
            toast('⚠ Fichier de sauvegarde invalide.');
          }catch(err){toast('Erreur : '+err.message);} }; inp.click(); }}
          dark={dark} toggleDark={toggleDark} apparence={apparence} onApparence={choisirApparence}/></GardeEcran>/*⟦←/⟧*/);
}

// ⟦← App.jsx #1⟧
const SettingsScreen = aLaDemande(() => import('../ecrans/Reglages.jsx').then((m) => ({ default: m.SettingsScreen })));
// ⟦← App.jsx #2⟧
const SAUVEGARDE_AVANT_REMISE = "⚠ Cette sauvegarde date d'avant la remise à zéro de tes numéros : elle ne peut pas être restaurée telle quelle (ses anciens numéros reviendraient en chiffres). Rien n'a changé.";