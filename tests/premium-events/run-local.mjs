// Only the disposable, networkless container created for this task is targeted.
import {execFileSync} from 'node:child_process';
const docker='/Applications/Docker.app/Contents/Resources/bin/docker';
const inspected=JSON.parse(execFileSync(docker,['inspect','abilene-premium-events-local'],{encoding:'utf8'}))[0];
if(inspected.HostConfig.NetworkMode!=='none'||inspected.Config.Image!=='postgres:17-bookworm'||inspected.Mounts.length && inspected.Mounts.some(m=>m.Type==='bind'))throw Error('ISOLATION_REQUIRED');
execFileSync(docker,['exec','-i','abilene-premium-events-local','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:'DROP DATABASE IF EXISTS premium_events_test; CREATE DATABASE premium_events_test;',stdio:['pipe','inherit','inherit']});
for(const path of ['authority-db','events-db'])execFileSync(process.execPath,['--test',`tests/premium-events/${path}.test.mjs`],{env:{...process.env,PREMIUM_TEST_DB:'premium_events_test'},stdio:'inherit'});

execFileSync(docker,['exec','-i','abilene-premium-events-local','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:'DROP DATABASE IF EXISTS premium_security_test; CREATE DATABASE premium_security_test;',stdio:['pipe','inherit','inherit']});
execFileSync(process.execPath,['--test','tests/premium-events/security-db.test.mjs'],{env:{...process.env,PREMIUM_TEST_DB:'premium_security_test'},stdio:'inherit'});
