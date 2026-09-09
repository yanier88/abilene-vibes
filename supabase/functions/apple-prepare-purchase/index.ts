import { handler } from '../_shared/apple/http.mjs';
// NOT DEPLOYED. Requires separately reviewed attestation, repository and verifier composition.
Deno.serve(handler('prepare'));
