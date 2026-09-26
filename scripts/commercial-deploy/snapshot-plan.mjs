// Query generator ONLY. No connections, mutations, remote execution or PII output.
// The orchestrator keeps keyset cursors solely in memory; manifests contain only
// counts, SHA-256s, schema signatures, coverage and observation timestamps.
const ident=x=>{if(!/^[a-z_][a-z0-9_]*$/.test(x))throw Error('IDENTIFIER_REJECTED');return '"'+x+'"';};
export const groups=Object.freeze({
 commercial:['business_submissions','job_listings','rental_listings','marketplace_listings','gallery_submissions','event_submissions'],
 stripe:['payment_records','stripe_promotion_authority','stripe_authority_receipts'],
 apple:'DISCOVER public tables matching apple_% plus listing_promotion_entitlements',
 ownership:['advertiser_profiles','business_ownership_claims','business_ownership_audit','admin_comp_authority','admin_comp_audit'],
 schema:['supabase_migrations.schema_migrations','pg_catalog signatures per object'],
});
export function pageQuery(schema,table,keys,after=null,limit=1000){
 if(!keys.length||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('BOUNDED_PRIMARY_KEY_REQUIRED');
 const relation=ident(schema)+'.'+ident(table),columns=keys.map(k=>ident(k)).join(',');
 // Parameterized $1 JSON cursor must never be interpolated or logged. The ROW
 // expansion uses the table's native column types to preserve indexed ordering.
 const where=after===null?'':`where (${columns}) > (select ${columns} from jsonb_populate_record(null::${relation},$1::jsonb))`;
 return `begin read only;set local statement_timeout='8s';set local lock_timeout='1s';set local timezone='UTC';
 with page as materialized (select * from ${relation} ${where} order by ${columns} limit ${limit})
 select count(*) as row_count,
 encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex'),'' order by ${columns}),''),'UTF8')),'hex') as page_hash,
 (select jsonb_build_object(${keys.map(k=>"'"+k+"',"+ident(k)).join(',')}) from page order by ${keys.map(k=>ident(k)+' desc').join(',')} limit 1) as private_memory_cursor
 from page p;commit;`;
}
export function schemaQuery(schema,table){const relation=ident(schema)+'.'+ident(table);return `begin read only;set local statement_timeout='8s';set local lock_timeout='1s';
 select encode(sha256(convert_to(jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='${relation}'::regclass and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid='${relation}'::regclass),
 'indexes',(select jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid::regclass::text) from pg_index where indrelid='${relation}'::regclass),
 'rls',(select jsonb_build_array(relrowsecurity,relforcerowsecurity,relacl,pg_get_userbyid(relowner)) from pg_class where oid='${relation}'::regclass),
 'policies',(select jsonb_agg(jsonb_build_array(polname,polcmd,polroles::text,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) order by polname) from pg_policy where polrelid='${relation}'::regclass),
 'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid='${relation}'::regclass and not tgisinternal)
 )::text,'UTF8')),'hex') as schema_hash;commit;`;}
