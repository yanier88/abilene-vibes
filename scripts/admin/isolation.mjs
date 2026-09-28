import {readFileSync} from 'node:fs';
import {relative,resolve} from 'node:path';
export const forbiddenModules = [/^src\/App\.(jsx|css)$/, /^src\/(account|notifications|native|billing|legal)\//, /^src\/ugc\/UgcSafety\.jsx$/, /^src\/components\/(AdvertiserAccount|ApplePromotionPurchase|PremiumEvents|Promo3DIcon)\./, /node_modules\/@capacitor\//];
export const forbiddenRuntime = ['Permanently delete my account','Your account has been deleted.','ugc_hidden_content','ugc_my_blocks','ugc_unblock','ugc_can_block','ugc_block','ugc_report"','ApplePromotionPlans','AppleProductionPurchase','notification_register_device','register-device','Enable Notifications'];
export function assertIsolation(modules,code) {
 const invalid=modules.filter(id=>forbiddenModules.some(p=>p.test(id)));
 if(invalid.length)throw Error('ADMIN_IMPORT_BOUNDARY: '+invalid.join(', '));
 const found=forbiddenRuntime.filter(s=>code.includes(s));
 if(found.length)throw Error('ADMIN_RUNTIME_BOUNDARY: '+found.join(', '));
}
export function adminIsolationPlugin(){return {name:'admin-isolation',generateBundle(_,bundle){
 const root=process.cwd();const modules=[...this.getModuleIds()].filter(id=>id.startsWith(root+'/')).map(id=>relative(root,id).split('?')[0]).sort();
 const code=Object.values(bundle).filter(x=>x.type==='chunk').map(x=>x.code).join('\n');assertIsolation(modules,code);
 this.emitFile({type:'asset',fileName:'admin-isolation-manifest.json',source:JSON.stringify({target:'admin-only',sourceModules:modules.filter(id=>!id.startsWith('node_modules/')),forbiddenRuntimeAbsent:true},null,2)});
 const shell=readFileSync(resolve(root,'src/admin/AdminShell.jsx'),'utf8');const assets=new Set(['icon-192.png',...[...shell.matchAll(/appAsset\("([^"]+)"\)/g)].map(x=>x[1])]);
 for(const fileName of assets)this.emitFile({type:'asset',fileName,source:readFileSync(resolve(root,'public',fileName))});
}};}
