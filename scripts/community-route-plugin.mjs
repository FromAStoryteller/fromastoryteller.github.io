import {existsSync} from 'node:fs';
import {contentPath,contentAddress} from '../systems/community/content-address.mjs';
export function communityRoutePlugin(root){return {name:'fas-community-routes',configureServer(server){server.middlewares.use((req,_res,next)=>{const address=contentAddress(new URL(req.url,'http://localhost').pathname);if(address&&!existsSync(root+contentPath(address)+'index.html'))req.url='/read/';next();});}};}
