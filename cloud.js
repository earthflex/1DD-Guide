/* Supabase Auth + PostgREST + private Storage, using native fetch only. */
(function () {
  'use strict';
  const KEY='1dd-cloud-config',SESSION='1dd-cloud-session';
  let config=window.GUIDE_CONFIG||{}, session=null, refreshPromise=null;
  const images=new Map();
  try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');if(!config.supabaseUrl&&stored)config=stored;}catch{}
  // Session lives in localStorage so new tabs stay signed in; tabs pick up each other's refreshes and logout.
  const readStored=()=>{try{const s=JSON.parse(localStorage.getItem(SESSION)||'null');return s?.origin===config.supabaseUrl?s:null;}catch{return null;}};
  session=readStored();
  addEventListener('storage',ev=>{if(ev.key===SESSION)session=readStored();});
  function configure(url,key){
    const u=new URL(url.trim());if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/')throw new Error('ใช้ Supabase Project URL แบบ https://ชื่อโปรเจกต์.supabase.co');
    key=key.trim();if(key.startsWith('sb_secret_'))throw new Error('ห้ามใช้ secret key ใช้ publishable key เท่านั้น');
    if(!key.startsWith('sb_publishable_')){let claims;try{claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new Error('API key ไม่ถูกต้อง');}if(claims.role!=='anon')throw new Error('ใช้ anon หรือ publishable key เท่านั้น ห้ามใช้ service_role');}
    const old=config.supabaseUrl;config={supabaseUrl:u.origin,supabaseKey:key};localStorage.setItem(KEY,JSON.stringify(config));if(old!==u.origin)storeSession(null);return config;
  }
  function storeSession(s){session=s?{...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),origin:config.supabaseUrl}:null;try{if(session)localStorage.setItem(SESSION,JSON.stringify(session));else localStorage.removeItem(SESSION);}catch{}return session;}
  async function request(path,{method='GET',body,auth=true,headers={},blob=false}={}){
    if(!config.supabaseUrl||!config.supabaseKey)throw new Error('กรุณาตั้งค่า Supabase ก่อน');
    if(auth){const stored=readStored();if(stored&&stored.expires_at>(session?.expires_at||0))session=stored;if(!session)throw new Error('กรุณาเข้าสู่ระบบคลาวด์');if(session.expires_at*1000<Date.now()+60000)await refresh();}
    const h={apikey:config.supabaseKey,...headers};const token=auth?session.access_token:(config.supabaseKey.startsWith('eyJ')?config.supabaseKey:'');if(token)h.Authorization='Bearer '+token;
    if(body!==undefined&&!(body instanceof Blob)){h['Content-Type']='application/json';body=JSON.stringify(body);}
    let response;try{response=await fetch(config.supabaseUrl+path,{method,headers:h,body,signal:AbortSignal.timeout(45000),referrerPolicy:'no-referrer'});}catch{throw new Error('ติดต่อคลาวด์ไม่ได้ ตรวจอินเทอร์เน็ตและ Project URL แล้วลองใหม่');}
    if(!response.ok){let error;try{error=await response.json();}catch{}const msg=error?.message||error?.msg||error?.error_description||error?.error||'เชื่อมต่อคลาวด์ไม่สำเร็จ';if(response.status===409||error?.code==='PT409')throw new Error('มีคนแก้ไข Workspace นี้แล้ว กรุณาสำรองงานของคุณ และโหลดข้อมูลล่าสุดก่อนแก้ต่อ');throw new Error(msg);}
    if(blob)return response.blob();const text=await response.text();return text?JSON.parse(text):null;
  }
  async function refresh(){if(refreshPromise)return refreshPromise;if(!session?.refresh_token)throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:session.refresh_token}}).then(storeSession).finally(()=>refreshPromise=null);return refreshPromise;}
  async function login(email,password){return storeSession(await request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}}));}
  async function signup(email,password){const result=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(location.href.split('#')[0].split('?')[0]),{method:'POST',auth:false,body:{email,password}});if(result.access_token)storeSession(result);return result;}
  async function logout(){try{if(session)await request('/auth/v1/logout?scope=local',{method:'POST'});}finally{storeSession(null);images.clear();}}
  const rpc=(name,body={},auth=true)=>request('/rest/v1/rpc/'+name,{method:'POST',body,auth});
  async function workspaces(){await rpc('guide_accept_invites');return request('/rest/v1/guide_workspaces?select=id,name,revision&order=created_at.asc');}
  const readBlob=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('อ่านรูปจากคลาวด์ไม่ได้'));r.readAsDataURL(blob);});
  async function load(wid){
    images.clear();const rows=await request('/rest/v1/guide_workspaces?id=eq.'+encodeURIComponent(wid)+'&select=id,name,document,revision');if(!rows?.length)throw new Error('ไม่พบ Workspace หรือคุณไม่มีสิทธิ์เข้าถึง');
    const w=rows[0],projects=GuideCore.copy(w.document.projects||[]);
    const validID=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
    for(const p of projects){if(!validID(p.id))throw new Error('Project ID ไม่ถูกต้อง');if(p._logoPath&&!new RegExp('^'+wid+'/[a-f0-9]{64}\\.png$').test(p._logoPath))throw new Error('ตำแหน่งโลโก้ไม่ถูกต้อง');for(const page of p.pages)for(const q of GuideCore.frames(page)){if(!validID(q.id)||q.steps.some(s=>!validID(s.id))||(q.highlights||[]).some(h=>!validID(h.id)))throw new Error('Page ID ไม่ถูกต้อง');if(q._imagePath&&!new RegExp('^'+wid+'/[a-f0-9]{64}\\.(png|jpg|webp)$').test(q._imagePath))throw new Error('ตำแหน่งภาพไม่ถูกต้อง');}}
    const cache=new Map();
    for(const p of projects)for(const page of p.pages)for(const q of GuideCore.frames(page)){if(q._imagePath){if(!q._imagePath.startsWith(wid+'/'))throw new Error('ตำแหน่งภาพไม่ตรงกับ Workspace');let data=cache.get(q._imagePath);if(!data){const blob=await request('/storage/v1/object/authenticated/guide-images/'+q._imagePath,{blob:true});data=await readBlob(blob);cache.set(q._imagePath,data);}if(!GuideCore.imageURL(data))throw new Error('รูปในคลาวด์มีรูปแบบที่ไม่รองรับ');q.image=data;images.set(data,q._imagePath);delete q._imagePath;}}
    for(const p of projects){if(p._logoPath){let data=cache.get(p._logoPath);if(!data){data=await readBlob(await request('/storage/v1/object/authenticated/guide-images/'+p._logoPath,{blob:true}));cache.set(p._logoPath,data);}if(!GuideCore.logoURL(data))throw new Error('โลโก้ในคลาวด์ไม่ถูกต้อง');p.logo=data;images.set(data,p._logoPath);delete p._logoPath;}}
    // Sanitize text/URLs/images on the read boundary, while preserving internal IDs.
    if(projects.length){const clean=GuideCore.validateImport(GuideCore.pack(projects));clean.forEach((p,i)=>{p.id=projects[i].id;p.createdAt=projects[i].createdAt;p.updatedAt=projects[i].updatedAt;p.pages.forEach((q,j)=>{q.id=projects[i].pages[j].id;q.steps.forEach((s,k)=>s.id=projects[i].pages[j].steps[k].id);q.highlights.forEach((h,k)=>h.id=projects[i].pages[j].highlights[k].id);q.extraImages.forEach((f,k)=>{const original=projects[i].pages[j].extraImages[k];f.id=original.id;f.steps.forEach((s,n)=>s.id=original.steps[n].id);f.highlights.forEach((h,n)=>h.id=original.highlights[n].id);});});});return {...w,projects:clean};}
    return {...w,projects};
  }
  async function imagePath(data,wid){if(images.has(data))return images.get(data);const [head,base64]=data.split(',');const mime=head.slice(5).split(';')[0],bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');const path=wid+'/'+hash+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]);await request('/storage/v1/object/guide-images/'+path,{method:'POST',body:new Blob([bytes],{type:mime}),headers:{'Content-Type':mime,'x-upsert':'true','cache-control':'3600'}});images.set(data,path);return path;}
  async function save(wid,revision,projects){const data=GuideCore.copy(projects);for(const p of data){if(p.logo){if(!GuideCore.logoURL(p.logo))throw new Error('โลโก้ไม่ถูกต้อง');p._logoPath=await imagePath(p.logo,wid);p.logo='';}}for(const p of data)for(const page of p.pages)for(const q of GuideCore.frames(page)){if(q.image){q._imagePath=await imagePath(q.image,wid);q.image='';}}return rpc('guide_save_workspace',{wid,expected_revision:revision,doc:{projects:data}});}
  async function consumeAuthHash(){const params=new URLSearchParams(location.hash.slice(1));if(!params.has('access_token'))return '';const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');const type=params.get('type');history.replaceState(null,'',location.pathname+location.search);storeSession({access_token,refresh_token,expires_in:Number(params.get('expires_in'))||3600});const user=await request('/auth/v1/user');storeSession({...session,user});return type;}
  async function recover(email){return request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.href.split('#')[0].split('?')[0]),{method:'POST',auth:false,body:{email}});}
  async function changePassword(password){return request('/auth/v1/user',{method:'PUT',body:{password}});}
  function configDownload(){return '// Public Supabase configuration. Never use a secret or service_role key.\nwindow.GUIDE_CONFIG = '+JSON.stringify(config,null,2)+';\n';}
  const deployConfigured=()=>window.GUIDE_CONFIG?.supabaseUrl?.replace(/\/$/,'')===config.supabaseUrl&&window.GUIDE_CONFIG?.supabaseKey===config.supabaseKey;
  window.GuideCloud={configure,request,rpc,login,signup,logout,workspaces,load,save,consumeAuthHash,recover,changePassword,configDownload,deployConfigured,get config(){return config;},get session(){return session;},get configured(){return !!(config.supabaseUrl&&config.supabaseKey);}};
})();
