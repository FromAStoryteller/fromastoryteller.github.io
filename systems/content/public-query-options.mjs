const fields=['q','category','subtype','genre','tag','players','saves','length','sort','offset','limit','related'];
export function parseDiscoveryQuery(params){
 const keys=[...params.keys()];if(new Set(keys).size!==keys.length||keys.some(k=>!fields.includes(k)))throw Error('Invalid discovery query');
 const options=Object.fromEntries(params);if(JSON.stringify(options).length>2048||(options.q??'').length>160||(options.related??'').length>200)throw Error('Query too long');
 for(const [key,min,max,fallback]of [['offset',0,50000,0],['limit',1,24,24]]){const value=options[key]===undefined?fallback:Number(options[key]);if(!Number.isInteger(value)||value<min||value>max||options[key]!==undefined&&!/^\d+$/.test(options[key]))throw Error('Invalid page');options[key]=value;}
 for(const [key,allowed]of Object.entries({category:['','stories','games','tools','blog','videos','gallery'],sort:['','newest','oldest','title','shortest','longest'],players:['','single','multi'],saves:['','yes'],length:['','quick','medium','long']}))if(!allowed.includes(options[key]??''))throw Error('Invalid filter');
 if(options.related&&!/^\/(stories|games|tools|blog|videos)\/[a-z0-9][a-z0-9-]{0,119}\/$/.test(options.related))throw Error('Invalid related piece');return options;
}
