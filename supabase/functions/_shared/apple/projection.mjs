// Pure preview only. No caller in the existing application or Stripe helpers.
export function resolveEffectivePromotion(listing, entitlements, environment='Production', now=Date.now()) {
  if(listing.status!=='approved') return {visible:false,plan:'free',conflicts:[]};
  const rows=entitlements.filter(e=>e.listing_type===listing.listing_type && e.listing_id===listing.listing_id && e.environment===environment && ['active','active_nonrenewing','grace'].includes(e.status) && Date.parse(e.valid_from)<=now && Date.parse(e.valid_until)>now);
  const paid=rows.filter(e=>['apple','stripe'].includes(e.provider));
  const rank={free:0,featured:1,premium:2};
  const winner=[...rows].sort((a,b)=>(rank[b.plan]??0)-(rank[a.plan]??0)||b.source_priority-a.source_priority)[0];
  return {visible:true,plan:winner?.plan??'free',valid_until:winner?.valid_until??null,conflicts:paid.length>1?['MULTIPLE_PAID_ENTITLEMENTS']:[],providers:[...new Set(rows.map(e=>e.provider))]};
}
