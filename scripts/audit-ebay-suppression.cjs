const assert=require('node:assert/strict');
(async()=>{
  process.env.SUPABASE_SERVICE_KEY='FAUX_SERVICE';
  const {cleCompteDe}=await import('../api/_lib/ebay.js');
  const {anonymiserCompteEbay}=await import('../api/_lib/ebay-suppression.js');
  const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
  const eias='EIAS-factice-compte-supprime', cle=cleCompteDe(eias), autre='a'.repeat(16);
  const initial=[
    {owner:A,id:'ebay_comptes',data:{comptes:[{cle,pseudo:'ancien',principal:true},{cle:autre,pseudo:'autre',principal:false}]}},
    {owner:B,id:'ebay_comptes',data:{comptes:[{cle:autre,pseudo:'vendeurB',principal:true}]}},
    {owner:A,id:'ebay_tokens',data:{refresh_token:'FAUX_TOKEN_A'}},
    {owner:A,id:'ebay_tokens_'+autre,data:{refresh_token:'FAUX_TOKEN_AUTRE'}},
    {owner:B,id:'ebay_tokens',data:{refresh_token:'FAUX_TOKEN_B'}},
    {owner:A,id:'ebay_orders',data:{orders:[{orderId:'1',buyer:{username:'client'},lineItems:[{sku:'VRM-1'}]},{orderId:'2',buyer:{username:'autre-client'}}]}},
    {owner:B,id:'ebay_orders',data:{orders:[{orderId:'3',buyer:{username:'autre-client'}}]}},
  ];
  let rows=structuredClone(initial), panne=false, ecritures=[];
  global.fetch=async(url,o={})=>{
    const q=new URL(url);assert(q.pathname==='/rest/v1/app_data');
    const id=q.searchParams.get('id'),owner=q.searchParams.get('owner'),sel=q.searchParams.get('select');
    if(panne && sel==='owner,id') return new Response('{}',{status:503});
    let r=rows.filter(x=>(!id || id==='like.ebay_orders*' ? (!id || x.id.startsWith('ebay_orders')) : x.id===id.slice(3)) && (!owner || x.owner===owner.slice(3)));
    for(const [champ,f] of [['comptes','data->comptes'],['orders','data->orders']]) if(q.searchParams.has(f)) {
      const cible=JSON.parse(q.searchParams.get(f).slice(3))[0];
      r=r.filter(x=>Array.isArray(x.data[champ]) && x.data[champ].some(c=>champ==='comptes' ? c.cle===cible.cle : c.buyer?.username===cible.buyer.username));
    }
    if(o.method==='PATCH') {
      assert(owner && owner.startsWith('eq.'));assert(id && id.startsWith('eq.')); // jamais d'écriture globale
      const condition=q.searchParams.get('data->>rev');
      r=r.filter(x=>condition==='is.null' ? x.data.rev==null : String(x.data.rev)===condition.slice(3));
      for(const x of r){x.data=JSON.parse(o.body).data;ecritures.push({owner:x.owner,id:x.id});}
      return Response.json(r.map(x=>({id:x.id})));
    }
    assert(!o.method || o.method==='GET');
    return Response.json(r.map(x=>sel==='owner,id'?{owner:x.owner,id:x.id}:sel==='owner'?{owner:x.owner}:{data:x.data}));
  };
  const p={metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION'},notification:{data:{username:'client',eiasToken:eias}}};
  assert(await anonymiserCompteEbay(p));
  assert.equal(rows.find(x=>x.owner===A && x.id==='ebay_tokens').data.refresh_token,'');
  assert.equal(rows.find(x=>x.owner===A && x.id==='ebay_tokens_'+autre).data.refresh_token,'FAUX_TOKEN_AUTRE');
  assert.equal(rows.find(x=>x.owner===B && x.id==='ebay_tokens').data.refresh_token,'FAUX_TOKEN_B');
  const commandes=rows.find(x=>x.owner===A && x.id==='ebay_orders').data.orders;
  assert.equal(commandes[0].buyer,undefined);assert.equal(commandes[0].lineItems[0].sku,'VRM-1');assert.equal(commandes[1].buyer.username,'autre-client');
  assert.deepEqual(rows.filter(x=>x.owner===B),initial.filter(x=>x.owner===B));
  assert(ecritures.every(x=>x.owner===A));
  rows=structuredClone(initial);ecritures=[];panne=true;
  assert.equal(await anonymiserCompteEbay(p),false);assert.equal(ecritures.length,0);assert.deepEqual(rows,initial);
  console.log('✅ Suppression eBay : identité EIAS, seul compte concerné déconnecté, pseudo acheteur anonymisé, autres comptes et vendeur intacts ; lecture ratée sans écriture.');
})().catch(e=>{console.error(e);process.exitCode=1;});
