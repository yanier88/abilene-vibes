// Contract for a future restricted atomic claim adapter; no network or general DB credential here.
import {AppleError,requireThat,sha256} from './domain.mjs';
export class RestrictedReplayStore{
 constructor(repository){requireThat(typeof repository?.claimAtomic==='function','REPLAY_CONFIG_INVALID');this.repository=repository;}
 async claim(key,ttlMs=120000){requireThat(typeof key==='string'&&key.length<=256&&ttlMs===120000,'REPLAY_INVALID_REQUEST');
 try{const result=await this.repository.claimAtomic({nonceHash:await sha256(key),ttlMs});requireThat(typeof result==='boolean','REPLAY_STORAGE_INVALID');return result;}catch{throw new AppleError('REPLAY_STORE_UNAVAILABLE',503);}
 }
}
