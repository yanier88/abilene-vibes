import { handler } from '../_shared/apple/http.mjs';
// NOT DEPLOYED. Never accepts client verified:true or TEST receipts as Apple evidence.
Deno.serve(handler('verify'));
