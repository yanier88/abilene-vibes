import {loadCurrentAuthenticReplay} from './current-authentic-replay-loader.mjs';
export const {compositionInput,responses,contexts,NOW}=loadCurrentAuthenticReplay(process.env.ABILENE_AUTHENTIC_FIXTURE_DIR);
