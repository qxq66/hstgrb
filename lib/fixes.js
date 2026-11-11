(function(root){
'use strict';
const H=root.HG;
if(!H||H.__fixesApplied)return;
H.__fixesApplied=true;

const fixImx=p=>typeof p==='string'?p.split('t[0-9]+\\.imx').join('t[0-9]*\\.imx'):p;
H.fixImxPattern=fixImx;
for(const r of H.DEFAULT_RULES||[]){
  if(r.id!=='imx-thumb')continue;
  r.match.pattern=fixImx(r.match.pattern);
  for(const t of r.transforms||[])if(t.pattern)t.pattern=fixImx(t.pattern);
}

const origSettings=H.settings;
H.settings=function(v){
  const x=origSettings(v);
  if(v&&Array.isArray(v.autoScanWhitelist))x.autoScanWhitelist=v.autoScanWhitelist.map(s=>String(s||'').trim()).filter(Boolean);
  return x;
};

function globToRegExp(p){
  const esc=s=>s.replace(/[.+^${}()|[\]\\?]/g,'\\$&');
  const m=String(p).trim().match(/^(\*|https?):\/\/(\*\.)?([^/]*)(\/.*)?$/i);
  if(!m)return null;
  const scheme=m[1]==='*'?'https?':m[1];
  const host=(m[2]?'(?:[^/]*\\.)?':'')+esc(m[3]).replace(/\*/g,'[^/]*');
  const path=esc(m[4]||'/*').replace(/\*/g,'.*');
  return new RegExp('^'+scheme+'://'+host+path+'$','i');
}

H.whitelistMatches=function(url,list){
  try{
    const u=new URL(String(url||''));
    const href=u.origin+u.pathname+u.search;
    return(list||[]).some(p=>{const re=globToRegExp(p);return !!re&&re.test(href)});
  }catch{return false}
};
})(typeof self!=='undefined'?self:globalThis);
