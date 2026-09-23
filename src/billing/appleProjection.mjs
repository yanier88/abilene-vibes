// Display only. Authority is the restricted server projection, never this overlay.
export async function withApplePromotions(client,kind,result){
 if(result.error||!Array.isArray(result.data))return result;
 const projection=await client.rpc('apple_public_promotions');
 if(projection.error||!Array.isArray(projection.data))return result;
 const byID=new Map(projection.data.filter(p=>p.listing_type===kind&&['featured','premium'].includes(p.plan)&&Date.parse(p.valid_until)>Date.now()).map(p=>[p.listing_id,p]));
 return {...result,data:result.data.map(row=>{const p=byID.get(row.id);if(!p||row.placement_source==='stripe'||row.stripe_subscription_id)return row;return {...row,plan:kind==='business'?p.plan[0].toUpperCase()+p.plan.slice(1):p.plan,payment_status:'paid',placement_source:'apple',placement_expires_at:p.valid_until};})};
}
