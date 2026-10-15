'use strict';
chrome.runtime.onMessage.addListener((m,_sender,send)=>{
  if(m?.target!=='offscreen'||m?.type!=='PARSE') return false;
  try{
    const doc=new DOMParser().parseFromString(m.html,'text/html');
    const el=doc.querySelector(m.selector);
    let value=el?(m.attribute==='textContent'?el.textContent:el.getAttribute(m.attribute)):null;
    if(value&&m.attribute!=='textContent') try{value=new URL(value,m.base).href}catch{}
    send({value});
  }catch(e){send({error:e.message})}
  return true;
});
