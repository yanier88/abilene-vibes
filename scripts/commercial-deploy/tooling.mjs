import {accessSync,constants,realpathSync,statSync} from 'node:fs';
import {isAbsolute} from 'node:path';
export function resolveExecutable(name, configuredPath) {
 if(!configuredPath||!isAbsolute(configuredPath))throw Error(`${name}_ABSOLUTE_EXECUTABLE_REQUIRED`);
 try {const resolved=realpathSync(configuredPath);if(!statSync(resolved).isFile())throw Error();accessSync(resolved,constants.X_OK);return resolved;}
 catch {throw Error(`${name}_EXECUTABLE_UNAVAILABLE`);}
}
export function canonicalDownloadArgs(functionName, project) {
 return ['functions','download',functionName,'--project-ref',project,'--use-api'];
}
export function requireCanonicalDownload(args) {
 if(args[0]!=='functions'||args[1]!=='download'||args.filter(x=>x==='--use-api').length!==1)throw Error('CANONICAL_API_DOWNLOAD_REQUIRED');
 return args;
}
