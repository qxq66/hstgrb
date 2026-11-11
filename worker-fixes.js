'use strict';
importScripts('lib/fixes.js');

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
    for(const r of x.rules)if(r.id==='imx-thumb')self.HG.applyImxThumb(r);
    await chrome.storage.local.set({rules:x.rules});
  }
  await chrome.storage.local.set({imxFixV2:true});
}

getSettings().then(configure).catch(console.error);
migrateImxRule().catch(console.error);
