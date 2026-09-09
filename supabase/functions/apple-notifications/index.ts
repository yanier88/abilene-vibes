import { handler } from '../_shared/apple/http.mjs';
// NOT DEPLOYED. A verified Apple adapter must be composed before this accepts events.
Deno.serve(handler('notifications'));
