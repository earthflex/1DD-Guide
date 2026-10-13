'use strict';
const el=id=>document.getElementById(id);
const status=(text,error=false)=>{el('status').textContent=text;el('status').className=error?'error':'';};
const pattern=url=>url.protocol+'//'+url.hostname+'/*';
chrome.storage.local.get(['studioURL','token']).then(config=>{el('url').value=config.studioURL||'';el('token').value=config.token||'';if(!config.studioURL)el('settings').open=true;});
el('setup').addEventListener('submit',async event=>{
  event.preventDefault();try{
    const url=new URL(el('url').value.trim());
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('ใช้ HTTPS หรือ localhost สำหรับทดสอบเท่านั้น');
    if(url.username||url.password)throw new Error('URL ต้องไม่มีรหัสผ่าน');url.hash='';url.search='';
    const token=el('token').value.trim();if(token.length<32)throw new Error('กรุณาคัดลอกรหัสเชื่อมต่อให้ครบ');
    const granted=await chrome.permissions.request({origins:[pattern(url)]});if(!granted)throw new Error('ต้องอนุญาตเว็บไซต์ Guide เพื่อส่งภาพ');
    await chrome.storage.local.set({studioURL:url.href,token});status('บันทึกแล้ว เปิดแท็บหลังบ้านแล้วกดจับภาพได้เลย');el('settings').open=false;
  }catch(error){status(error.message,true);}
});
el('capture').addEventListener('click',async()=>{
  const btn=el('capture');btn.disabled=true;status('กำลังจับภาพ…');
  try{
    const conf=await chrome.storage.local.get(['studioURL','token']);if(!conf.studioURL||!conf.token)throw new Error('กรุณาตั้งค่า URL และรหัสเชื่อมต่อก่อน');
    const [source]=await chrome.tabs.query({active:true,currentWindow:true});if(!source?.url||!/^https?:\/\//.test(source.url))throw new Error('กรุณาเปิดแท็บเว็บไซต์ที่ต้องการจับภาพ');
    const sourceURL=new URL(source.url),studioURL=new URL(conf.studioURL);
    // Guide tabs are matched by origin (the Next.js app uses a path per page); /g/ and ?guide= are customer views.
    const isGuide=u=>u.origin===studioURL.origin&&!u.pathname.startsWith('/g/')&&!u.searchParams.has('guide');
    if(isGuide(sourceURL))throw new Error('เปลี่ยนไปแท็บหลังบ้านลูกค้าก่อนจับภาพ');
    const targets=await chrome.tabs.query({url:pattern(studioURL)});
    const guides=targets.filter(t=>{try{return isGuide(new URL(t.url));}catch{return false;}});
    // Prefer an open editor page (/w/…/p/…), then the legacy single-page app, then any Guide tab.
    const target=guides.find(t=>/\/w\/[^/]+\/p\//.test(new URL(t.url).pathname))||guides.find(t=>new URL(t.url).pathname===studioURL.pathname)||guides[0];
    if(!target)throw new Error('เปิด Guide ตาม URL ที่ตั้งค่า และเลือกเนื้อหาปลายทางก่อน');
    const image=await chrome.tabs.captureVisibleTab(source.windowId,{format:'png'});
    const result=await chrome.scripting.executeScript({target:{tabId:target.id},func:(data)=>{
      if(!document.querySelector('[data-field="title"]'))return 'กรุณาเปิดเนื้อหาปลายทางใน Guide ก่อน';
      if(document.querySelector('dialog[open],[role="dialog"],[role="alertdialog"]'))return 'ปิดหน้าต่างใน Guide แล้วจับภาพอีกครั้ง';
      if(localStorage.getItem('1dd-capture-token')!==data.token)return 'รหัสเชื่อมต่อไม่ตรง คัดลอกรหัสจาก Guide ใหม่';
      window.postMessage(data,location.origin);return 'ok';
    },args:[{type:'1DD_CAPTURE',token:conf.token,image,url:source.url}]});
    if(result[0]?.result!=='ok')throw new Error(result[0]?.result||'ส่งภาพไม่สำเร็จ');
    status('ส่งภาพแล้ว กลับไปยืนยันใน Guide');await chrome.tabs.update(target.id,{active:true});await chrome.windows.update(target.windowId,{focused:true});
  }catch(error){status(error.message,true);}finally{btn.disabled=false;}
});
