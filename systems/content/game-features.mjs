// Public capability flags only: no executable code or private progress.
export function normalizeGameFeatures(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.saves!=='boolean'||!['off','casual','realtime'].includes(value.multiplayer))return null;
 return {saves:value.saves,multiplayer:value.multiplayer};
}
export function gameFeatureLabels(value){const features=normalizeGameFeatures(value);return features?[features.multiplayer==='off'?'Single player':'Multiplayer',...(features.saves?['Account saves']:[])]:[];}
export function gameFeatureMarkup(value){const labels=gameFeatureLabels(value);return labels.length?'<div class="content-game-features">'+labels.map(label=>'<span class="content-game-feature">'+label+'</span>').join('')+'</div>':'';}
