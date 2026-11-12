'use strict';
importScripts('lib/fixes.js');

const IMX_RULES=[
  {id:'imx-thumb',name:'IMX.to – Thumbnail direkt umwandeln',enabled:true,match:{field:'imageUrl',pattern:'^https?://t[0-9]*[.]imx[.]to/t/',flags:'i'},source:'imageUrl',resolver:{type:'direct'},transforms:[{type:'regex-replace',pattern:'^https?://t[0-9]*[.]imx[.]to/t/',flags:'i',replace:'https://i.imx.to/i/'}]},
  {id:'imx-link',name:'IMX.to – Landingpage',enabled:true,match:{field:'linkUrl',pattern:'^https?://(?:www[.])?(?:imx[.]to|img[.]yt)/(?:i/[A-Za-z0-9_-]+|img-[A-Za-z0-9_-]+)(?:[.]html)?(?:[?#].*)?$',flags:'i'},source:'linkUrl',resolver:{type:'fetch-css',selector:'img.img-full',attribute:'src'},transforms:[{type:'html-entities'}]}
];

(function(){
  const d=self.HG.DEFAULT_RULES;
  for(const n of IMX_RULES){
    const i=d.findIndex(r=>r.id===n.id);
    if(i>=0)d[i]=self.HG.clone(n);else d.unshift(self.HG.clone(n));
  }
})();

configure=async function(s){
  await chrome.action.setPopup({popup:s.toolbarAutoScan?'':'popup.html'});
  await chrome.action.setBadgeBackgroundColor({color:'#08676b'});
  await chrome.action.setTitle({title:'Host Grabber – Bilder ermitteln'});
};

const origScanTab=scanTab;
scanTab=async function(tabId,scope='page',useCache=false){
  const r=await origScanTab(tabId,scope,useCache);
  try{
    const s=await getSettings();
    if(s.debugMode)console.log('[HostGrabber] scan',{tabId,scope,cached:r.cached,stats:r.stats,debug:r.debug,errors:r.errors});
  }catch{}
  return r;
};

async function migrateImxRule(){
  const x=await chrome.storage.local.get(['rules','imxFixV2']);
  if(x.imxFixV2)return;
  if(Array.isArray(x.rules)){
    const rest=x.rules.filter(r=>!String(r.id||'').startsWith('imx-'));
    await chrome.storage.local.set({rules:[...IMX_RULES.map(r=>self.HG.clone(r)),...rest]});
  }
  await chrome.storage.local.set({imxFixV2:true});
}

getSettings().then(configure).catch(console.error);
migrateImxRule().catch(console.error);
