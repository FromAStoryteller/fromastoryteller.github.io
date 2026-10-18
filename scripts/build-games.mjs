import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['rally-clash','brick-blitz']){
 await build({absWorkingDir:root,entryPoints:['sources/games/'+name+'.mjs'],outfile:'games/'+name+'/game.js',bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'none',banner:{js:'// Generated from sources/games/'+name+'.mjs; edit source and run npm run build:games.'}});
}
console.log('Built two independent game entries; each includes its own menu and runtime helpers.');
