// ── src/sneakers/lectures.js — CE QUE LIT LA FEUILLE SNEAKERS (sorti d'App.jsx le 28 nov., main-vert) ──
// Les ventes (cote VRM) et les annonces (valeur du stock, en masse) : le MÊME code qu'App.jsx posait dans
// `poserSourcesSneakers`, chargé seulement quand la feuille, la fiche « Modèle » ou la calculette le demandent (le
// démarrage ne l'emporte plus — budget-vitesse). `d` : les lecteurs d'App.jsx, passés tels quels (aucune règle copiée).
export async function ventesSneakers(d) {
  const { SUPABASE_URL, sbAuth, lireDressings, uidsLies, comptes, lireEbayTous, SEL_EBAY_COMMANDES, SEL_EBAY_ANNONCES, load, dateMiseEnLigneMs, classifyOrderStatus, montantCommandeLu, tsCommande, numDeSkuEbay, lireLignesEnLigne, prixAchatDe, numEbayLu } = d;
      const sb=async(q)=>{ try{ const r=await fetch(`${SUPABASE_URL}/rest/v1/${q}`,{headers:sbAuth()}); return r.ok?await r.json():null; }catch(_){ return null; } };
      const [so, dress, eb]=await Promise.all([sb('app_data?id=like.harvest_*_orders_sold&select=mo:data->payload->my_orders'), lireDressings(sb,{uids:uidsLies(comptes())}), lireEbayTous('ebay_orders',SEL_EBAY_COMMANDES,'orders').catch(()=>null)]);
      if(so===null) return null;
      const fiches=load('vinted_annonce_numeros',{})||{}; const cree={};
      for(const r of (dress||[])){ for(const it of ((r&&r.data&&r.data.payload&&r.data.payload.items)||[])){ if(!it||it.id==null) continue; const c=dateMiseEnLigneMs({ createdTs: Number.isFinite(it.created_at_ts)?it.created_at_ts:(Number.isFinite(it.createdTs)?it.createdTs:null), id: it.id }, null); if(c!=null) cree[String(it.id)]=c; } }
      const out=[]; const vus=new Set();
      for(const r of so){ for(const o of (Array.isArray(r&&r.mo)?r.mo:[])){
        const tx=String(o&&(o.transaction_id||o.id)||''); if(tx&&vus.has(tx)) continue; if(tx) vus.add(tx);
        if(!o||classifyOrderStatus(o.status)==='cancelled') continue;
        const eur=montantCommandeLu(o), t=tsCommande(o); if(eur==null||!t) continue;
        const item=o.item_id!=null?String(o.item_id):''; const f=item?fiches[item]:null;
        out.push({ site:'vinted', prix:eur, venduMs:t, misEnLigneMs:item?cree[item]??null:null, titre:o.title||'', taille:o.size||o.size_title||'', num:f&&f.numero!=null?String(f.numero):'', itemId:item }); } }
      if(eb&&Array.isArray(eb.items)) for(const o of eb.items){
        if(!o||(o.cancelStatus&&/CANCEL/i.test(String(o.cancelStatus.cancelState||'')))) continue;
        const t=Date.parse(o.creationDate||''); if(!t) continue;
        for(const li of (Array.isArray(o.lineItems)?o.lineItems:[])){ const m=li&&li.lineItemCost; if(!m||String(m.currency||'').toUpperCase()!=='EUR') continue;
          const q=Number(li.quantity)||1; const v=Number(m.value); if(!Number.isFinite(v)||v<=0) continue;
          const n=numDeSkuEbay(li.sku); out.push({ site:'ebay', prix:Math.round(v*100/q)/100, venduMs:t, titre:li.title||'', num:n?String(n):'' }); } }
      return out;
}
export async function annoncesSneakers(d) {
  const { SUPABASE_URL, sbAuth, lireDressings, uidsLies, comptes, lireEbayTous, SEL_EBAY_COMMANDES, SEL_EBAY_ANNONCES, load, dateMiseEnLigneMs, classifyOrderStatus, montantCommandeLu, tsCommande, numDeSkuEbay, lireLignesEnLigne, prixAchatDe, numEbayLu } = d;
      const sb=async(q)=>{ try{ const r=await fetch(`${SUPABASE_URL}/rest/v1/${q}`,{headers:sbAuth()}); return r.ok?await r.json():null; }catch(_){ return null; } };
      const rows=await lireDressings(sb,{uids:uidsLies(comptes())}); if(!rows) return null;
      const lst=(await lireLignesEnLigne(rows)).lignes; const fiches=load('vinted_annonce_numeros',{})||{}; const buy=load('vinted_buyprice_by_num',{})||{};
      const out=[];
      for(const r of lst){ const uid=(String(r&&r.id||'').match(/^harvest_(\d+)_listings$/)||[])[1]||''; for(const it of ((r.data&&r.data.payload&&r.data.payload.items)||[])){
        if(!it||it.id==null||it.is_closed) continue; const f=fiches[String(it.id)]||null;
        out.push({ cle:'vinted:'+it.id, site:'vinted', id:String(it.id), compte:uid, titre:it.title||'', prix:montantCommandeLu(it), devise:'EUR', num:f&&f.numero!=null?String(f.numero):'', mini:f&&f.min!=null?montantCommandeLu({price:f.min}):null, achat:prixAchatDe(f,buy),
          vues:Number.isFinite(it.view_count)?it.view_count:null, favoris:Number.isFinite(it.favourite_count)?it.favourite_count:null, enLigne:!it.is_hidden&&!it.is_draft, taille:it.size_title||it.size||'' }); } }
      const eb=await lireEbayTous('ebay_listings',SEL_EBAY_ANNONCES,'items').catch(()=>null);
      if(eb&&Array.isArray(eb.items)) for(const x of eb.items){ if(!x||x.itemId==null) continue; const n=numEbayLu(x.sku,x.itemId,null,x.depuis);
        out.push({ cle:'ebay:'+x.itemId, site:'ebay', id:String(x.itemId), compte:x._compte||'', titre:x.title||'', prix:x.price!=null?Number(x.price):null, devise:String(x.currency||'EUR').toUpperCase(), num:n?String(n):'', mini:null, achat:n&&buy[n]!=null?Number(String(buy[n]).replace(',','.')):null, vues:null, favoris:null, enLigne:true, taille:x.taille||'' }); }
      return out;
}
