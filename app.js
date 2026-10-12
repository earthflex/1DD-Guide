/* 1DD Guide — vanilla JavaScript, local IndexedDB, portable exports. */
(function () {
  'use strict';
  const C=GuideCore, E=C.esc, $=s=>document.querySelector(s);
  const app=$('#app'), dialog=$('#dialog');
  const paths={
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    book:'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z M12 5v15',
    plus:'M12 5v14 M5 12h14', arrow:'M5 12h14 M14 7l5 5-5 5', back:'M19 12H5 M10 7l-5 5 5 5',
    download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5', upload:'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
    search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
    help:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    page:'M6 2h8l4 4v16H6Z M14 2v5h4 M9 12h6 M9 16h6',
    image:'M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M16 7h.01',
    camera:'M3 6h4l2-3h6l2 3h4v15H3Z M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    more:'M5 12h.01 M12 12h.01 M19 12h.01', link:'M10 14l4-4 M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M13 17a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1',
    external:'M14 3h7v7 M10 14L21 3 M10 3H3v18h18v-7',
    pin:'M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14Z M12 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
    cursor:'M4 3l6 18 3-8 8-3Z', square:'M4 4h16v16H4z M7 7h10v10H7z',
    undo:'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    up:'M6 14l6-6 6 6',down:'M6 10l6 6 6-6',trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    copy:'M9 9h12v12H9z M15 9V3H3v12h6',edit:'m15 3 6 6-12 12H3v-6Z M12 6l6 6',close:'M6 6l12 12 M18 6 6 18',
    menu:'M3 6h18 M3 12h18 M3 18h18',check:'m5 12 4 4 10-10',globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M2 12h20 M12 2c6 6 6 14 0 20-6-6-6-14 0-20',
    puzzle:'M4 4h6a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v4h-6a3 3 0 1 0-6 0H4Z', folder:'M3 5h7l2 3h9v13H3z'
  };
  const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.page}"/></svg>`;
  let projects=[], db, revision=0, saveQueue=Promise.resolve(), timer, changeVersion=0, savedVersion=0, storageError='', selected='', tool='select', undo=[], query='', mobileOpen=false, previewURL='';
  let toastTimer, dialogResolve, captureTarget=null, activeImage='', appendImages=false, selectedBox='';
  function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4400);}
  function current(){const parts=location.hash.slice(1).split('/');const project=projects.find(p=>p.id===parts[1]);const page=project?.pages.find(q=>q.id===parts[3])||project?.pages[0];return {project,page,frame:page?C.frames(page).find(f=>f.id===activeImage)||page:null};}
  function go(project,page){mobileOpen=false;selected='';activeImage='';selectedBox='';tool='select';const hash=project?'#project/'+project.id+(page?'/page/'+page.id:''):'#';if(location.hash===hash){render();}else location.hash=hash;}
  function host(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return 'ยังไม่ได้ระบุเว็บไซต์';}}
  function formatDate(s){return new Date(s).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});}
  const button=(action,label,name='',className='btn',extra='')=>`<button type="button" class="${className}" data-action="${action}" ${extra}>${name?icon(name):''}${label}</button>`;
  function openDB(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูล'));const req=indexedDB.open('1dd-guide-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>{const d=req.result;d.onversionchange=()=>{d.close();storageError='กรุณาโหลดหน้าใหม่เพื่อใช้รูปแบบข้อมูลล่าสุด';render();};resolve(d);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('กรุณาปิด 1DD Guide แท็บอื่นแล้วลองใหม่'));});}
  function readDB(){return new Promise((resolve,reject)=>{const req=db.transaction('data').objectStore('data').get('workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function writeDB(snapshot){return new Promise((resolve,reject)=>{
    const tx=db.transaction('data','readwrite'),store=tx.objectStore('data');let next,conflict=false;
    const req=store.get('workspace');req.onsuccess=()=>{if((req.result?.revision||0)!==revision){conflict=true;tx.abort();return;}next=revision+1;store.put({version:C.VERSION,revision:next,projects:snapshot},'workspace');};
    tx.oncomplete=()=>{revision=next;resolve();};tx.onabort=()=>reject(new Error(conflict?'มีการแก้ไขจากแท็บอื่น สำรองงานปัจจุบันก่อนโหลดหน้าใหม่':tx.error?.message||'บันทึกไม่สำเร็จ'));tx.onerror=()=>{};
  });}
  function saveStatus(){const el=$('#save-state');if(!el)return;el.className='save-state'+(storageError?' error':'');el.innerHTML=icon(storageError?'help':'check')+'<span>'+E(storageError?'ยังบันทึกไม่ได้':savedVersion<changeVersion?'กำลังบันทึก…':cloudWorkspace?'บันทึกบนคลาวด์แล้ว':'บันทึกแล้วในเครื่องนี้')+'</span>';}
  function scheduleSave(project){if(project)project.updatedAt=new Date().toISOString();changeVersion++;saveStatus();clearTimeout(timer);timer=setTimeout(flush,250);}
  function flush(){clearTimeout(timer);if(savedVersion===changeVersion)return saveQueue;const version=changeVersion,snapshot=C.copy(projects),wid=cloudWorkspace?.id;saveQueue=saveQueue.catch(()=>{}).then(async()=>{if(storageError)throw new Error(storageError);if(wid){cloudRevision=await GuideCloud.save(wid,cloudRevision,snapshot);}else{if(!db)throw new Error('ไม่สามารถเปิดพื้นที่บันทึกได้');await writeDB(snapshot);}savedVersion=Math.max(savedVersion,version);saveStatus();}).catch(error=>{storageError=error.message;saveStatus();const banner=$('#storage-banner');if(banner){banner.hidden=false;banner.innerHTML=E(storageError)+' — '+button('backup-all','สำรองข้อมูล','','btn small')+' '+button('retry-save','ลองบันทึกอีกครั้ง','','btn small')+(cloudWorkspace?' '+button('cloud-reload','โหลดล่าสุดจากคลาวด์','','btn small'):'');}toast('ยังบันทึกไม่ได้ กรุณาสำรอง JSON ก่อนปิดหน้านี้',true);});return saveQueue;}
  function save(project){scheduleSave(project);flush();}
  function remember(page){undo.push({id:page.id,value:{image:page.image,steps:C.copy(page.steps),highlights:C.copy(page.highlights||[])}});if(undo.length>12)undo.shift();}
  function applyUndo(){const {project,frame:page}=current();const idx=undo.findLastIndex?undo.findLastIndex(s=>s.id===page?.id):undo.map(s=>s.id).lastIndexOf(page?.id);if(idx<0)return;Object.assign(page,undo.splice(idx,1)[0].value);selected='';save(project);render();toast('ย้อนการจัดจุดแล้ว');}
  const needsLogin=()=>GuideCloud.configured&&!GuideCloud.session;
  function loginGate(){
    document.title='เข้าสู่ระบบ — 1DD Guide';
    app.innerHTML=`<main class="login-gate" id="main"><form class="login-card" id="login-form"><img class="boot-logo" src="assets/1dd-logo.png" alt="1DD"><h1>Guide</h1><p class="muted">เข้าสู่ระบบด้วยบัญชีทีมเพื่อใช้งาน</p><label class="field">อีเมล<input name="email" type="email" required autocomplete="username" autofocus></label><label class="field">รหัสผ่าน<input name="password" type="password" required autocomplete="current-password"></label><p class="login-error" role="alert"></p><button type="submit" class="btn primary">เข้าสู่ระบบ</button><div class="row between">${button('signup','สร้างบัญชีใหม่','','btn ghost small')}${button('recover','ลืมรหัสผ่าน','','btn ghost small')}</div></form></main>`;
    $('#login-form').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.target,b=form.querySelector('button[type="submit"]'),data=new FormData(form);b.disabled=true;form.querySelector('.login-error').textContent='';try{await GuideCloud.login(data.get('email'),data.get('password'));render();await workspacePicker();}catch(error){form.querySelector('.login-error').textContent=error.message;b.disabled=false;}});
  }
  function render(){
    if(needsLogin())return loginGate();
    const {project,page}=current();
    document.title=(project?project.name+' — ':'')+'1DD Guide';
    app.innerHTML=`<div class="shell"><aside class="sidebar ${mobileOpen?'open':''}" id="sidebar">${sidebar(project,page)}</aside><div class="main-shell"><header class="topbar">${button('mobile-menu','','menu','icon-btn mobile-toggle','aria-label="เปิดเมนู"')}<div class="breadcrumb"><button data-action="home">Guide</button>${project?'<span>/</span><strong>'+E(project.name)+'</strong>':'<span>/</span><strong>Workspace</strong>'}</div><div class="top-actions"><span id="save-state" class="save-state"></span></div></header><div id="storage-banner" class="banner" ${storageError?'':'hidden'}>${E(storageError)} ${button('backup-all','สำรองข้อมูลตอนนี้','','btn small')}</div><main id="main" class="content ${project?'editor-content':''}">${project?editor(project,page):dashboard()}</main></div></div>`;
    saveStatus();
    if(page)document.querySelectorAll('.annotation-canvas').forEach(bindCanvas);
  }
  function sidebar(p,q){return `<a href="#" class="brand" aria-label="1DD Guide หน้ารวมโปรเจกต์"><img class="brand-logo" src="assets/1dd-logo.png" alt="1DD"><span class="brand-name">Guide</span></a>${p?`${button('home','โปรเจกต์ทั้งหมด','back','side-link')}<div class="project-context">${projectNameInput(p)}<p>${E(host(p.website))}</p></div><div class="side-label">เนื้อหา</div><nav class="lesson-list" aria-label="เนื้อหา">${p.pages.map((page,n)=>`<a href="#project/${p.id}/page/${page.id}" class="lesson-link ${q?.id===page.id?'active':''}" ${q?.id===page.id?'aria-current="page"':''}><span class="lesson-number">${String(n+1).padStart(2,'0')}</span><span class="lesson-text">${E(page.title||'เนื้อหาใหม่')}</span></a>`).join('')}</nav>${button('new-page','เพิ่มเนื้อหา','plus','btn add-lesson')}`:button('home','โปรเจกต์ทั้งหมด','grid','side-link active')}<div class="sidebar-spacer"></div><details class="menu workspace-menu"><summary class="side-link" aria-label="เมนูเพิ่มเติม">${icon('more')} เพิ่มเติม</summary><div class="menu-panel">${p?button('project-settings','ตั้งค่าโปรเจกต์','edit',''):''}${button('cloud','คลาวด์ / ทีม','globe','')}${cloudWorkspace?button('cloud-reload','โหลดข้อมูลล่าสุด','download',''):''}${button('backup-all','สำรองข้อมูลทั้งหมด','download','')}${button('import','นำเข้าคู่มือ','upload','')}${button('extension','ส่วนขยายจับภาพ','puzzle','')}${button('help','วิธีใช้งาน','help','')}</div></details>`;}
  function projectNameInput(p){return `<label class="project-name-wrap"><input class="project-name-input" data-project-name="${p.id}" value="${E(p.name)}" maxlength="120" aria-label="ชื่อโปรเจกต์ ${E(p.name)}" title="พิมพ์เพื่อแก้ชื่อโปรเจกต์">${icon('edit')}</label>`;}
  function commitProjectName(input){if(!input.dataset.projectName)return;const p=projects.find(item=>item.id===input.dataset.projectName);if(!p)return;const name=input.value.trim();if(!name){input.value=p.name;toast('ชื่อโปรเจกต์ต้องไม่ว่าง',true);return;}if(name===p.name){input.value=name;return;}p.name=name;input.value=name;input.setAttribute('aria-label','ชื่อโปรเจกต์ '+name);save(p);if(current().project===p){document.title=name+' — 1DD Guide';const crumb=$('.breadcrumb strong');if(crumb)crumb.textContent=name;}toast('บันทึกชื่อโปรเจกต์แล้ว');}
  app.addEventListener('focusout',ev=>commitProjectName(ev.target));
  app.addEventListener('keydown',ev=>{if(!ev.target.dataset.projectName)return;if(ev.key==='Enter'){ev.preventDefault();commitProjectName(ev.target);ev.target.blur();}if(ev.key==='Escape'){const p=projects.find(item=>item.id===ev.target.dataset.projectName);if(p)ev.target.value=p.name;ev.target.blur();}});
  function projectWebsiteInput(p){return `<label class="project-website-wrap"><input class="project-website-input" data-project-website="${p.id}" value="${E(p.website)}" maxlength="2000" inputmode="url" autocomplete="url" spellcheck="false" placeholder="เพิ่ม URL เว็บไซต์" aria-label="URL เว็บไซต์ ${E(p.name)}" title="พิมพ์เพื่อแก้ URL เว็บไซต์">${icon('edit')}</label>`;}
  function commitProjectWebsite(input){if(!input.dataset.projectWebsite)return;const p=projects.find(item=>item.id===input.dataset.projectWebsite);if(!p)return;const raw=input.value.trim(),url=C.websiteURL(raw);if(raw&&!url){input.value=p.website;toast('URL ไม่ถูกต้อง กรุณาใช้เว็บไซต์แบบ https:// หรือ http://',true);return;}input.value=url;if(url===p.website)return;p.website=url;save(p);toast('บันทึก URL เว็บไซต์แล้ว');}
  app.addEventListener('focusout',ev=>commitProjectWebsite(ev.target));
  app.addEventListener('keydown',ev=>{const input=ev.target;if(!input.dataset.projectWebsite)return;if(ev.key==='Enter'){ev.preventDefault();commitProjectWebsite(input);input.blur();}if(ev.key==='Escape'){const p=projects.find(item=>item.id===input.dataset.projectWebsite);if(p)input.value=p.website;input.blur();}});
  function dashboard(){return `<div class="page-heading"><div><h1>คู่มือของคุณ</h1><p>${projects.length} โปรเจกต์</p></div>${button('new-project','สร้างโปรเจกต์','plus','btn primary')}</div><div class="section-bar"><label class="search">${icon('search')}<input type="search" id="project-search" placeholder="ค้นหาโปรเจกต์…" value="${E(query)}" aria-label="ค้นหาโปรเจกต์"></label></div><div id="project-grid" class="project-grid">${cards()}</div>`;}
  function cards(){const filtered=projects.filter(p=>(p.name+' '+p.website+' '+p.description).toLowerCase().includes(query.toLowerCase()));return filtered.map(p=>{const shot=p.pages.flatMap(C.frames).find(f=>f.image)?.image;return `<article class="project-card"><button class="project-cover" data-action="open-project" data-id="${p.id}" aria-label="เปิดโปรเจกต์ ${E(p.name)}">${shot?`<img src="${shot}" alt="ตัวอย่างคู่มือ ${E(p.name)}" loading="lazy">`:`<div class="cover-placeholder">${icon('book')}</div>`}</button><div class="project-info"><div class="row between">${projectNameInput(p)}<details class="menu"><summary class="icon-btn" aria-label="ตัวเลือก ${E(p.name)}">${icon('more')}</summary><div class="menu-panel">${button('duplicate-project','ทำสำเนาโปรเจกต์','copy','','data-id="'+p.id+'"')}${button('export-project','ส่งออกคู่มือ','download','','data-id="'+p.id+'"')}${button('delete-project','ลบโปรเจกต์','trash','danger','data-id="'+p.id+'"')}</div></details></div>${projectWebsiteInput(p)}<div class="project-stats"><span>${icon('page')}${p.pages.length} เนื้อหา</span></div></div><footer class="project-card-footer"><span>แก้ไข ${E(formatDate(p.updatedAt))}</span>${button('open-project','เปิดคู่มือ','arrow','btn ghost small','data-id="'+p.id+'"')}</footer></article>`;}).join('')+(!filtered.length&&query?'<div class="empty"><h3>ไม่พบโปรเจกต์</h3><p>ลองค้นหาด้วยชื่อหรือเว็บไซต์อื่น</p></div>':'')+(!projects.length?`<div class="empty"><p>เริ่มคู่มือลูกค้าด้วยโปรเจกต์แรกของคุณ</p></div>`:'');}
  function editor(p,q){
    if(!q)return `<div class="page-heading"><h1>${E(p.name)}</h1>${button('new-page','เพิ่มเนื้อหาแรก','plus','btn primary')}</div><div class="empty">เริ่มต้นด้วยเนื้อหาแรกของโปรเจกต์นี้</div>`;
    const f=current().frame,images=C.frames(q);
    return `<div class="editor-top"><span class="editor-label">เนื้อหา ${String(p.pages.indexOf(q)+1).padStart(2,'0')}</span><div class="row">${button('preview','ดูแบบลูกค้า','eye','btn')}${button('export-project','ส่งออกคู่มือ','download','btn primary')}<details class="menu"><summary class="btn" aria-label="ตัวเลือกเนื้อหา">${icon('more')}</summary><div class="menu-panel">${button('edit-page','ชื่อและลิงก์เนื้อหา','edit','')}${button('duplicate-page','ทำสำเนาเนื้อหา','copy','')}${button('page-up','เลื่อนเนื้อหาขึ้น','up','',p.pages.indexOf(q)===0?'disabled':'')}${button('page-down','เลื่อนเนื้อหาลง','down','',p.pages.indexOf(q)===p.pages.length-1?'disabled':'')}<hr>${button('delete-page','ลบเนื้อหานี้','trash','danger')}</div></details></div></div><section class="editor-intro" aria-label="รายละเอียดเนื้อหา"><input class="title-input" data-field="title" value="${E(q.title)}" maxlength="160" placeholder="ชื่อเนื้อหา" aria-label="ชื่อเนื้อหา"><textarea class="description-input" rows="${Math.max(2,Math.min(12,(q.description||'').split('\n').length))}" data-field="description" maxlength="10000" placeholder="อธิบายว่าลูกค้าจะเรียนรู้อะไรจากหน้านี้…" aria-label="คำเกริ่นเนื้อหา">${E(q.description)}</textarea><div class="url-box">${icon('link')}<input data-field="url" value="${E(q.url)}" type="url" maxlength="2000" placeholder="https://เว็บไซต์ลูกค้า/wp-admin/…" aria-label="URL หน้าหลังบ้าน">${C.safeURL(q.url)?`<a href="${E(C.safeURL(q.url))}" target="_blank" rel="noopener noreferrer" aria-label="เปิดหน้าหลังบ้าน">${icon('external')}</a>`:''}</div></section>${imageStrip(q,f)}<div class="editor-frames">${images.map((frame,n)=>editorFrame(q,frame,n,images.length)).join('')}</div><section class="editor-notes"><details class="note-field" ${q.note?'open':''}><summary>หมายเหตุ</summary><label class="sr-only" for="note">หมายเหตุ</label><div class="field"><textarea id="note" data-field="note" maxlength="10000" placeholder="เพิ่มข้อแนะนำที่ช่วยให้ลูกค้าทำตามได้ถูกต้อง…">${E(q.note)}</textarea></div></details></section>`;
  }
  function editorFrame(q,f,n,total){
    const mode=f.id===current().frame.id?tool:'select';
    return `<section class="editor-frame" id="editor-image-${f.id}" data-frame="${f.id}" tabindex="-1" aria-label="${E(imageLabel(f,n))}">${total>1?`<h2 class="editor-frame-heading"><b>${E(imageLabel(f,n))}</b> <span>· ${n+1} / ${total}</span></h2>`:''}<div class="editor-grid"><section class="editor-main" aria-label="แก้ไขภาพ ${n+1}"><div class="image-panel"><div class="image-toolbar"><div class="tool-group" role="group" aria-label="เครื่องมือบนภาพ">${button('tool-select','เลือก','cursor','tool '+(mode==='select'?'active':''),'aria-pressed="'+(mode==='select')+'"')}${button('tool-pin','ปักหมายเลข','pin','tool '+(mode==='pin'?'active':''),'aria-pressed="'+(mode==='pin')+'" '+(!f.image?'disabled':''))}${button('tool-highlight','กรอบไฮไลท์','square','tool '+(mode==='highlight'?'active':''),'aria-pressed="'+(mode==='highlight')+'" '+(!f.image?'disabled':''))}${button('tool-redact','ปิดทับ','square','tool '+(mode==='redact'?'active':''),'aria-pressed="'+(mode==='redact')+'" '+(!f.image?'disabled':''))}${button('undo','','undo','tool','aria-label="ย้อนการจัดจุด" '+(!undo.some(u=>u.id===f.id)?'disabled':''))}</div><details class="menu"><summary class="tool">${icon('image')} ${f.image?'เปลี่ยนภาพ':'เพิ่มภาพ'} ${icon('down')}</summary><div class="menu-panel">${button('upload-image','อัปโหลดภาพ','upload','')}${button('capture','จับภาพแท็บ / หน้าต่าง','camera','')}${f.image?button('remove-image','ลบภาพและหมายเลข','trash','danger'):''}</div></details></div><div class="image-stage">${f.image?`<div class="annotation-canvas" id="canvas-${f.id}" data-tool="${mode}"><img class="screenshot" src="${f.image}" alt="ภาพประกอบ ${E(q.title)}" draggable="false">${highlights(f)}${pins(f)}</div>`:`<div class="upload-empty">${icon('image')}<h3>เริ่มต้นด้วยภาพหน้าจอ</h3><p>เปิดหลังบ้านที่ล็อกอินไว้ แล้วจับภาพแท็บนั้น<br>หรือวางภาพด้วย Ctrl / ⌘ + V</p><div class="row">${button('upload-image','อัปโหลดภาพ','upload','btn')}${button('capture','จับภาพหน้าจอ','camera','btn dark')}</div></div>`}</div><div class="image-footer"><span class="tool-hint">${toolHint(f,mode)}</span>${selectedBox&&(f.highlights||[]).some(h=>h.id===selectedBox)?button('delete-highlight','ลบกรอบที่เลือก','trash','btn ghost small'):''}</div></div></section><aside class="inspector" aria-label="คำอธิบายภาพ ${n+1}"><div class="inspector-header"><div class="row between"><h2>Point / คำอธิบาย</h2><span class="badge">${f.steps.length}</span></div></div><div class="step-list" id="step-list-${f.id}">${steps(f)}</div><div class="inspector-bottom">${button('add-center','เพิ่มจุดที่กลางภาพ','plus','btn ghost small',!f.image?'disabled':'')}</div></aside></div></section>`;
  }
  function toolHint(frame,mode){return mode==='pin'?(frame.steps.some(s=>!C.placed(s))?'คลิกบนภาพเพื่อวาง Point ที่เลือก · ข้อความเดิมจะยังอยู่':'คลิกบนภาพเพื่อเพิ่มหมายเลข · ลากจุดเพื่อย้าย'):mode==='highlight'?'ลากบนภาพเพื่อสร้างกรอบไฮไลท์สีส้ม':mode==='redact'?'ลากกรอบบนภาพเพื่อปิดทับข้อมูลถาวร':'เลือกหมายเลขหรือกรอบเพื่อแก้ไข · ลากเพื่อย้าย';}
  function activateFrame(id){
    const {page}=current();if(!page||!C.frames(page).some(f=>f.id===id))return;
    if(current().frame.id!==id){selected='';selectedBox='';tool='select';}
    activeImage=id;syncFrameUI();
  }
  function activateFrameFrom(el){const id=el?.closest('[data-frame]')?.dataset.frame||el?.dataset.imageLabel;if(id)activateFrame(id);}
  function syncFrameUI(){
    const {page,frame}=current();if(!page)return;
    document.querySelectorAll('.image-tab').forEach(el=>{const active=el.dataset.image===frame.id;el.closest('.image-tab-wrap')?.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('[data-frame]').forEach(section=>{
      const f=C.frames(page).find(f=>f.id===section.dataset.frame);if(!f)return;const mode=f.id===frame.id?tool:'select';
      const canvas=section.querySelector('.annotation-canvas');if(canvas)canvas.dataset.tool=mode;
      section.querySelectorAll('[data-action^="tool-"]').forEach(el=>{const active=el.dataset.action==='tool-'+mode;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
      section.querySelector('.tool-hint').textContent=toolHint(f,mode);
      section.querySelectorAll('[data-pin]').forEach(el=>el.classList.toggle('selected',el.dataset.pin===selected));
      section.querySelectorAll('[data-step-card]').forEach(el=>el.classList.toggle('selected',el.dataset.stepCard===selected));
      section.querySelectorAll('[data-highlight]').forEach(el=>el.classList.toggle('selected',el.dataset.highlight===selectedBox));
      section.querySelector('[data-action="delete-highlight"]')?.toggleAttribute('hidden',f.id!==frame.id||!selectedBox);
    });
  }
  function jumpToFrame(id){
    activateFrame(id);const section=document.getElementById('editor-image-'+id);if(!section)return;
    section.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  app.addEventListener('focusin',ev=>activateFrameFrom(ev.target));
  const imageLabel=(f,n)=>f.imageLabel||'ภาพ '+(n+1);
  function imageStrip(q,f){const images=C.frames(q);return `<div class="image-strip" aria-label="ภาพในเนื้อหานี้"><div class="image-tabs">${images.map((item,n)=>`<div class="image-tab-wrap ${item.id===f.id?'active':''}">${button('select-image',`${item.image?`<img src="${item.image}" alt="">`:icon('image')}<span class="sr-only">ไปยัง ${E(imageLabel(item,n))}</span>`,'','image-tab',`data-image="${item.id}" aria-label="ไปยัง ${E(imageLabel(item,n))}" aria-controls="editor-image-${item.id}" aria-pressed="${item.id===f.id}"`)}<input class="image-label-input" data-image-label="${item.id}" value="${E(imageLabel(item,n))}" size="${Math.max(5,Math.min(18,imageLabel(item,n).length))}" maxlength="80" aria-label="ชื่อภาพ ${n+1}" title="พิมพ์เพื่อเปลี่ยนชื่อภาพ">${icon('edit')}</div>`).join('')}</div><details class="menu add-image-menu"><summary class="btn ghost small" aria-label="เพิ่มภาพ">${icon('plus')} เพิ่มภาพ</summary><div class="menu-panel">${button('add-images','อัปโหลดภาพ','upload','',images.length>=20?'disabled':'')}${button('capture-add','จับภาพหน้าจอ / หน้าต่าง','camera','',images.length>=20?'disabled':'')}</div></details></div>`;}
  function commitImageLabel(input){
    if(!input.dataset.imageLabel)return;const {project,page}=current();if(!page)return;const images=C.frames(page),n=images.findIndex(f=>f.id===input.dataset.imageLabel),f=images[n];if(!f)return;
    const value=input.value.trim().slice(0,80);if(value!==imageLabel(f,n)){f.imageLabel=value;save(project);}
    input.value=imageLabel(f,n);input.size=Math.max(5,Math.min(18,input.value.length));
    const section=document.getElementById('editor-image-'+f.id),heading=section?.querySelector('.editor-frame-heading b');if(heading)heading.textContent=input.value;section?.setAttribute('aria-label',input.value);
    const jump=input.closest('.image-tab-wrap').querySelector('.image-tab');jump.setAttribute('aria-label','ไปยัง '+input.value);jump.querySelector('.sr-only').textContent='ไปยัง '+input.value;
  }
  app.addEventListener('focusout',ev=>commitImageLabel(ev.target));
  app.addEventListener('keydown',ev=>{const input=ev.target;if(!input.dataset.imageLabel)return;if(ev.key==='Enter'){ev.preventDefault();commitImageLabel(input);input.blur();}if(ev.key==='Escape'){const images=C.frames(current().page),n=images.findIndex(f=>f.id===input.dataset.imageLabel);input.value=imageLabel(images[n],n);input.blur();}});
  function highlights(f){return (f.highlights||[]).map((h,n)=>`<button type="button" class="highlight-box ${h.id===selectedBox?'selected':''}" data-highlight="${h.id}" style="left:${h.x*100}%;top:${h.y*100}%;width:${h.width*100}%;height:${h.height*100}%" aria-label="กรอบไฮไลท์ ${n+1}" title="ลากเพื่อย้าย · Delete เพื่อลบ"></button>`).join('');}
  function pins(q){return q.steps.map((s,n)=>C.placed(s)?`<button class="pin ${s.id===selected?'selected':''}" data-pin="${s.id}" style="left:${s.x*100}%;top:${s.y*100}%" aria-label="หมายเลข ${n+1}: ${E(s.title)}">${n+1}</button>`:'').join('');}
  function steps(q){return q.steps.map((s,n)=>`<section class="step-card ${s.id===selected?'selected':''}" data-step-card="${s.id}"><div class="step-head"><button class="step-num" data-action="select-step" data-step="${s.id}" aria-label="เลือกจุด ${n+1}">${n+1}</button><input class="step-title" data-step="${s.id}" data-step-field="title" maxlength="200" value="${E(s.title)}" aria-label="หัวข้อขั้นตอน ${n+1}" placeholder="หัวข้อขั้นตอน ${n+1}"></div><textarea class="step-text" data-step="${s.id}" data-step-field="text" maxlength="10000" aria-label="คำอธิบายขั้นตอน ${n+1}" placeholder="อธิบายสิ่งที่ลูกค้าต้องทำ…">${E(s.text)}</textarea><div class="step-controls">${!C.placed(s)?button('place-step',q.image?'วางจุดบนภาพ':'รอเพิ่มภาพ','pin','btn ghost small place-step',`data-step="${s.id}" ${q.image?'':'disabled'}`):''}<div class="row" style="gap:2px">${button('step-up','','up','icon-btn',`data-step="${s.id}" aria-label="เลื่อนขั้นตอน ${n+1} ขึ้น" ${n===0?'disabled':''}`)}${button('step-down','','down','icon-btn',`data-step="${s.id}" aria-label="เลื่อนขั้นตอน ${n+1} ลง" ${n===q.steps.length-1?'disabled':''}`)}${button('step-delete','','trash','icon-btn danger',`data-step="${s.id}" aria-label="ลบขั้นตอน ${n+1}"`)}</div></div></section>`).join('')||`<div class="inspector-empty">${icon('pin')}<p>ปักหมายเลขบนภาพ<br>แล้วเขียนคำอธิบายได้เลย</p></div>`;}
  async function modal(title,body,submit='บันทึก',onSubmit,className=''){
    if(dialog.open){const closed=new Promise(resolve=>dialog.addEventListener('close',resolve,{once:true}));dialog.close();await closed;}
    dialog.className=className;
    dialog.innerHTML=`<form id="dialog-form"><div class="dialog-header"><h2 id="dialog-title">${E(title)}</h2>${button('close-dialog','','close','icon-btn','aria-label="ปิดหน้าต่าง"')}</div><div class="dialog-body">${body}</div><p class="dialog-error" id="dialog-error" role="alert"></p><div class="dialog-footer">${button('close-dialog',submit?'ยกเลิก':'ปิด','','btn')}${submit?`<button type="submit" class="btn primary">${E(submit)}</button>`:''}</div></form>`;
    let result=null;const promise=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(result),{once:true}));
    $('#dialog-form').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.target;if(!form.reportValidity())return;const data=new FormData(form),b=form.querySelector('button[type="submit"]');b.disabled=true;try{if(onSubmit)await onSubmit(data);result=data;dialog.close();}catch(error){$('#dialog-error').textContent=error.message;b.disabled=false;}});
    dialog.showModal();return promise;
  }
  function confirmDialog(title,text,submit='ยืนยัน'){return modal(title,`<p>${E(text)}</p>`,submit);}
  function templatePreview(id){
    const t=GuideTemplates.list.find(item=>item.id===id);
    return t.pages.length?`<div class="template-preview-heading"><strong>${t.pages.length} เนื้อหาเริ่มต้น</strong><span>มี Point พร้อมคำแนะนำให้แก้ไขต่อได้</span></div><ol>${t.pages.map(q=>`<li>${E(q.title)}</li>`).join('')}</ol><p class="template-hint">${id==='shopify'?'ลิงก์เริ่มต้นเปิด Shopify admin — เลือกร้านแล้ววาง URL ของแต่ละหน้าภายหลัง':'ลิงก์หลังบ้านอ้างอิงจากเว็บไซต์ที่กรอก — ปรับให้ตรงกับธีมหรือปลั๊กอินได้'}</p>`:'<strong>เริ่มต้นโปรเจกต์ว่าง</strong><p>เพิ่มเนื้อหา รูปภาพ และคำอธิบายด้วยตัวเอง</p>';
  }
  function logoFields(p={}){
    const logo=C.logoURL(p.logo)?p.logo:'';
    return `<fieldset class="logo-fields"><legend>โลโก้ลูกค้าบนหน้าปก PDF</legend><div class="logo-settings"><div class="client-logo-preview" id="client-logo-preview" aria-label="ตัวอย่างโลโก้ลูกค้า">${logo?`<img src="${logo}" alt="โลโก้ลูกค้า">`:`<span>${E(p.logoText||p.name||'ชื่อของลูกค้า')}</span>`}</div><div class="logo-controls"><label class="field">อัปโหลดโลโก้ (ไม่บังคับ)<input type="file" name="logoFile" accept=".svg,.png,image/svg+xml,image/png"></label><small>SVG หรือ PNG ไม่เกิน 5 MB · วางในพื้นที่ 100 × 100 px บนหน้าปก</small><button type="button" class="btn ghost small" data-logo-remove ${logo?'':'hidden'}>นำโลโก้ออก</button><input type="hidden" name="existingLogo" value="${E(logo)}"><label class="field">ข้อความแทนโลโก้<input name="logoText" maxlength="120" value="${E(p.logoText||'')}" placeholder="เช่น ชื่อบริษัทลูกค้า"></label><small>ใช้เมื่อไม่มีรูปโลโก้ หากเว้นว่างจะใช้ชื่อโปรเจกต์</small><p class="logo-error" role="alert"></p></div></div></fieldset>`;
  }
  async function logoFromFile(file){
    if(file.size>5000000)throw new Error('กรุณาใช้โลโก้ SVG หรือ PNG ขนาดไม่เกิน 5 MB');
    const svg=file.type==='image/svg+xml'||/\.svg$/i.test(file.name);
    if(!svg&&file.type!=='image/png'&&!/\.png$/i.test(file.name))throw new Error('รองรับโลโก้ SVG หรือ PNG เท่านั้น');
    let data;
    if(svg){
      const text=await file.text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');
      if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg'||/<!DOCTYPE|<!ENTITY/i.test(text)||doc.querySelector('script,foreignObject'))throw new Error('อ่าน SVG นี้ไม่ได้ กรุณาใช้ SVG ที่ฝังรูปครบ หรือใช้ PNG');
      for(const el of doc.querySelectorAll('*'))for(const attr of el.attributes){
        if(/^on/i.test(attr.name)||((attr.localName==='href')&&!/^(#|data:image\/(png|jpeg|webp);base64,)/i.test(attr.value.trim())))throw new Error('กรุณาใช้ SVG ที่ไม่มีสคริปต์หรือลิงก์รูปภายนอก');
      }
      if(/@import/i.test(text)||Array.from(text.matchAll(/url\(([^)]*)\)/gi)).some(m=>!m[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#')))throw new Error('กรุณาใช้ SVG ที่ไม่มีลิงก์รูปภายนอก');
      // Loaded only as an image, never inserted as SVG markup into the document.
      data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc));
    }else data=await fileData(file);
    const img=await decodeImage(data),canvas=document.createElement('canvas');
    canvas.width=canvas.height=600;
    const scale=Math.min(600/img.naturalWidth,600/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    canvas.getContext('2d').drawImage(img,0,(600-h)/2,w,h);
    const png=canvas.toDataURL('image/png');if(!C.logoURL(png))throw new Error('โลโก้มีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กลง');return png;
  }
  async function projectBranding(data){const file=data.get('logoFile');return {logo:file?.size?await logoFromFile(file):data.get('existingLogo')||'',logoText:String(data.get('logoText')||'').trim().slice(0,120)};}
  function updateLogoPreview(form,logo){
    const preview=form.querySelector('#client-logo-preview');if(!preview)return;
    const text=form.elements.logoText.value.trim()||form.elements.name.value.trim()||'ชื่อของลูกค้า';
    preview.innerHTML=logo?`<img src="${logo}" alt="โลโก้ลูกค้า">`:`<span>${E(text)}</span>`;
    form.querySelector('[data-logo-remove]').hidden=!logo;
  }
  dialog.addEventListener('input',ev=>{const form=ev.target.form;if(form?.elements.existingLogo&&['name','logoText'].includes(ev.target.name))updateLogoPreview(form,form.elements.existingLogo.value);});
  dialog.addEventListener('change',async ev=>{
    const input=ev.target;if(input.name!=='logoFile')return;
    const form=input.form,file=input.files[0],error=form.querySelector('.logo-error');error.textContent='';
    if(!file)return;
    try{const logo=await logoFromFile(file);if(!form.isConnected||input.files[0]!==file)return;form.elements.existingLogo.value=logo;updateLogoPreview(form,logo);}catch(err){if(!form.isConnected||input.files[0]!==file)return;input.value='';error.textContent=err.message;}
  });
  dialog.addEventListener('click',ev=>{if(!ev.target.closest('[data-logo-remove]'))return;const form=ev.target.form;form.elements.logoFile.value='';form.elements.existingLogo.value='';form.querySelector('.logo-error').textContent='';updateLogoPreview(form,'');});
  function createProjectDialog(){
    const picker=`<fieldset class="template-picker"><legend>เลือกเทมเพลต</legend><div class="template-options">${GuideTemplates.list.map(t=>`<label class="template-option"><input type="radio" name="template" value="${t.id}" aria-label="${E(t.name)}" ${t.id==='new'?'checked':''}><span><strong>${E(t.name)}</strong><small>${E(t.platform)}${t.pages.length?' · '+t.pages.length+' เนื้อหา':''}</small></span>${icon(t.id==='new'?'plus':'page')}</label>`).join('')}</div></fieldset><div id="template-preview" class="template-preview" aria-live="polite">${templatePreview('new')}</div>`;
    modal('สร้างโปรเจกต์',`${picker}<div class="project-fields"><label class="field">ชื่อลูกค้า / โปรเจกต์<input name="name" required maxlength="120" placeholder="เช่น Foline Lube" autofocus></label><label class="field">เว็บไซต์ลูกค้า (ไม่บังคับ)<input name="website" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" maxlength="2000" placeholder="เช่น 1dd.co"><small>เว้นว่างได้ หรือกรอกโดเมนโดยไม่ต้องใส่ https://</small></label></div>${logoFields()}`,'สร้างโปรเจกต์',async data=>{
      const name=data.get('name').trim(),rawWebsite=data.get('website').trim(),website=C.websiteURL(rawWebsite);
      if(!name)throw new Error('กรุณาใส่ชื่อโปรเจกต์');
      if(rawWebsite&&!website)throw new Error('กรุณาระบุเว็บไซต์ เช่น 1dd.co หรือเว้นว่างไว้');
      const branding=await projectBranding(data);
      const target=GuideTemplates.create(data.get('template'),name,website);Object.assign(target,branding);
      projects.unshift(target);save(target);go(target,target.pages[0]);render();
      toast(target.pages.length?`สร้างโปรเจกต์พร้อม ${target.pages.length} เนื้อหาแล้ว`:'สร้างโปรเจกต์ว่างแล้ว');
    },'project-create');
  }
  dialog.addEventListener('change',ev=>{if(ev.target.name==='template')$('#template-preview').innerHTML=templatePreview(ev.target.value);});
  function projectDialog(p){
    if(!p)return createProjectDialog();
    modal('ตั้งค่าโปรเจกต์',`<label class="field">ชื่อลูกค้า / โปรเจกต์<input name="name" required maxlength="120" value="${E(p.name)}" placeholder="เช่น Foline Lube" autofocus></label><label class="field">เว็บไซต์ลูกค้า (ไม่บังคับ)<input name="website" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" maxlength="2000" value="${E(p.website||'')}" placeholder="เช่น 1dd.co"><small>เว้นว่างได้ หรือกรอกโดเมนโดยไม่ต้องใส่ https://</small></label>${logoFields(p)}<label class="field">คำอธิบายโปรเจกต์<textarea name="description" maxlength="2000" placeholder="คู่มือนี้จัดทำขึ้นสำหรับใคร…">${E(p.description||'')}</textarea></label>`,'บันทึกการเปลี่ยนแปลง',async data=>{
      const name=data.get('name').trim(),rawWebsite=data.get('website').trim(),url=C.websiteURL(rawWebsite);
      if(!name)throw new Error('กรุณาใส่ชื่อโปรเจกต์');if(rawWebsite&&!url)throw new Error('กรุณาระบุเว็บไซต์ เช่น 1dd.co หรือเว้นว่างไว้');
      const branding=await projectBranding(data);Object.assign(p,{name,website:url,description:data.get('description'),...branding});
      save(p);go(p,p.pages[0]);render();toast('บันทึกโปรเจกต์แล้ว');
    },'project-create');
  }
  function pageDialog(p,q){const edit=!!q;modal(edit?'แก้ไขเนื้อหา':'เพิ่มเนื้อหา',`<label class="field">ชื่อเนื้อหา<input name="title" required maxlength="160" value="${E(q?.title||'')}" placeholder="เช่น วิธีเปลี่ยนรูปหน้าแรก" autofocus></label><label class="field">URL หน้าหลังบ้าน<input name="url" type="url" maxlength="2000" value="${E(q?.url||'')}" placeholder="https://example.com/wp-admin/…"><small>ลิงก์ใช้เปิดหน้าต้นทาง การจับภาพต้องเลือกแท็บที่ล็อกอินแล้ว</small></label><label class="field">คำเกริ่น<textarea name="description" maxlength="10000">${E(q?.description||'')}</textarea></label>`,edit?'บันทึก':'เพิ่มเนื้อหา',async data=>{if(!data.get('title').trim())throw new Error('กรุณาใส่ชื่อเนื้อหา');const url=data.get('url').trim();if(url&&!C.safeURL(url))throw new Error('URL ต้องขึ้นต้นด้วย https:// หรือ http://');const target=q||C.page();target.title=data.get('title').trim();target.url=C.safeURL(url);target.description=data.get('description');if(!edit)p.pages.push(target);save(p);go(p,target);render();});}
  function selectStep(id){selected=id;document.querySelectorAll('[data-pin]').forEach(el=>el.classList.toggle('selected',el.dataset.pin===id));document.querySelectorAll('[data-step-card]').forEach(el=>el.classList.toggle('selected',el.dataset.stepCard===id));}
  function addPin(x,y,target=current()){
    const {project,frame}=target;if(!frame?.image)return;
    const pending=frame.steps.find(s=>s.id===selected&&!C.placed(s))||frame.steps.find(s=>!C.placed(s));
    if(!pending&&frame.steps.length>=100)return toast('หนึ่งภาพรองรับได้สูงสุด 100 จุด',true);
    remember(frame);const step=pending||{id:C.uid(),title:'',text:''};step.x=Math.min(.985,Math.max(.015,x));step.y=Math.min(.985,Math.max(.015,y));if(!pending)frame.steps.push(step);
    selected=step.id;save(project);render();
    if(pending){toast('วาง Point '+(frame.steps.indexOf(step)+1)+' แล้ว');}else document.querySelector(`[data-step="${step.id}"][data-step-field="title"]`)?.focus({preventScroll:true});
  }
  function bindCanvas(canvas){
    const {project,page}=current(),frame=C.frames(page).find(f=>f.id===canvas.closest('[data-frame]').dataset.frame),context={project,page,frame};let drag=null;
    const coords=ev=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height))};};
    canvas.addEventListener('pointerdown',ev=>{
      if(ev.button!==0)return;activateFrame(frame.id);const pos=coords(ev),pin=ev.target.closest('[data-pin]');
      if(pin){const {frame:page}=context;const s=page.steps.find(s=>s.id===pin.dataset.pin);selectStep(s.id);drag={kind:'pin',id:s.id,start:pos,original:{x:s.x,y:s.y},moved:false};canvas.setPointerCapture(ev.pointerId);ev.preventDefault();}
      else if(tool==='select'&&ev.target.closest('[data-highlight]')){const h=context.frame.highlights.find(h=>h.id===ev.target.closest('[data-highlight]').dataset.highlight);selectedBox=h.id;selected='';canvas.querySelectorAll('[data-highlight]').forEach(el=>el.classList.toggle('selected',el.dataset.highlight===h.id));drag={kind:'box',id:h.id,start:pos,original:{x:h.x,y:h.y},moved:false};canvas.setPointerCapture(ev.pointerId);ev.preventDefault();}
      else if(tool==='redact'||tool==='highlight'){drag={kind:tool,start:pos};const box=document.createElement('div');box.className='redaction-draft'+(tool==='highlight'?' highlight-draft':'');canvas.append(box);canvas.setPointerCapture(ev.pointerId);ev.preventDefault();}
    });
    canvas.addEventListener('pointermove',ev=>{if(!drag)return;const pos=coords(ev);if(drag.kind==='pin'){const s=context.frame.steps.find(s=>s.id===drag.id);if(Math.abs(pos.x-drag.start.x)+Math.abs(pos.y-drag.start.y)>.004)drag.moved=true;if(drag.moved){s.x=Math.min(.985,Math.max(.015,drag.original.x+pos.x-drag.start.x));s.y=Math.min(.985,Math.max(.015,drag.original.y+pos.y-drag.start.y));const pin=canvas.querySelector(`[data-pin="${s.id}"]`);pin.style.left=s.x*100+'%';pin.style.top=s.y*100+'%';}}else if(drag.kind==='box'){const h=context.frame.highlights.find(h=>h.id===drag.id);if(Math.abs(pos.x-drag.start.x)+Math.abs(pos.y-drag.start.y)>.004)drag.moved=true;if(drag.moved){h.x=Math.max(0,Math.min(1-h.width,drag.original.x+pos.x-drag.start.x));h.y=Math.max(0,Math.min(1-h.height,drag.original.y+pos.y-drag.start.y));const box=canvas.querySelector(`[data-highlight="${h.id}"]`);box.style.left=h.x*100+'%';box.style.top=h.y*100+'%';}}else{const box=canvas.querySelector('.redaction-draft');Object.assign(box.style,{left:Math.min(pos.x,drag.start.x)*100+'%',top:Math.min(pos.y,drag.start.y)*100+'%',width:Math.abs(pos.x-drag.start.x)*100+'%',height:Math.abs(pos.y-drag.start.y)*100+'%'});}});
    canvas.addEventListener('pointerup',async ev=>{
      if(!drag){if(tool==='pin'&&!ev.target.closest('[data-pin]')){const pos=coords(ev);addPin(pos.x,pos.y,context);}return;}
      const d=drag;drag=null;if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
      const {project,frame:page}=context;
      if(d.kind==='pin'){if(d.moved){const s=page.steps.find(s=>s.id===d.id),now={x:s.x,y:s.y};Object.assign(s,d.original);remember(page);Object.assign(s,now);save(project);render();}else document.querySelector(`[data-step-card="${d.id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});}
      else if(d.kind==='box'){if(d.moved){const h=page.highlights.find(h=>h.id===d.id),now={x:h.x,y:h.y};Object.assign(h,d.original);remember(page);Object.assign(h,now);save(project);}render();document.querySelector(`[data-highlight="${d.id}"]`)?.focus({preventScroll:true});}
      else{canvas.querySelector('.redaction-draft')?.remove();const end=coords(ev);if(Math.abs(end.x-d.start.x)<.005||Math.abs(end.y-d.start.y)<.005)return;if(d.kind==='highlight'){if((page.highlights||[]).length>=100)return toast('หนึ่งภาพรองรับได้สูงสุด 100 กรอบ',true);remember(page);const h={id:C.uid(),x:Math.min(end.x,d.start.x),y:Math.min(end.y,d.start.y),width:Math.abs(end.x-d.start.x),height:Math.abs(end.y-d.start.y)};(page.highlights||=[]).push(h);selectedBox=h.id;tool='select';save(project);render();return;}const ok=await confirmDialog('ปิดทับข้อมูลในภาพ','พื้นที่นี้จะถูกระบายทึบลงในภาพ และย้อนคืนในแอปไม่ได้ ไฟล์ภาพต้นฉบับที่คุณอัปโหลดยังคงอยู่ที่เดิม','ปิดทับข้อมูล');if(!ok)return;const img=await decodeImage(page.image);const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);ctx.fillStyle='#202823';const x=Math.floor(Math.min(end.x,d.start.x)*c.width),y=Math.floor(Math.min(end.y,d.start.y)*c.height);ctx.fillRect(x,y,Math.ceil(Math.abs(end.x-d.start.x)*c.width)+2,Math.ceil(Math.abs(end.y-d.start.y)*c.height)+2);page.image=c.toDataURL('image/png');undo=undo.filter(u=>u.id!==page.id);save(project);render();toast('ปิดทับข้อมูลลงในภาพแล้ว');}
    });
    canvas.addEventListener('pointercancel',()=>{if(drag?.kind==='pin'){const s=context.frame.steps.find(s=>s.id===drag.id);Object.assign(s,drag.original);}if(drag?.kind==='box'){const h=context.frame.highlights.find(h=>h.id===drag.id);Object.assign(h,drag.original);}drag=null;render();});
    canvas.addEventListener('keydown',ev=>{activateFrame(frame.id);const box=ev.target.closest('[data-highlight]');if(box){const {project,frame}=context,h=frame.highlights.find(h=>h.id===box.dataset.highlight);if(['Delete','Backspace'].includes(ev.key)){ev.preventDefault();remember(frame);frame.highlights=frame.highlights.filter(item=>item!==h);selectedBox='';save(project);render();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();remember(frame);const d=ev.shiftKey ? .02 : .005;h.x=Math.max(0,Math.min(1-h.width,h.x+({ArrowLeft:-d,ArrowRight:d}[ev.key]||0)));h.y=Math.max(0,Math.min(1-h.height,h.y+({ArrowUp:-d,ArrowDown:d}[ev.key]||0)));box.style.left=h.x*100+'%';box.style.top=h.y*100+'%';save(project);}return;}const pin=ev.target.closest('[data-pin]');if(!pin)return;const {project,frame:page}=context;const s=page.steps.find(s=>s.id===pin.dataset.pin);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();remember(page);const amount=ev.shiftKey ? 0.02 : 0.005;s.x=Math.max(.015,Math.min(.985,s.x+({ArrowLeft:-amount,ArrowRight:amount}[ev.key]||0)));s.y=Math.max(.015,Math.min(.985,s.y+({ArrowUp:-amount,ArrowDown:amount}[ev.key]||0)));pin.style.left=s.x*100+'%';pin.style.top=s.y*100+'%';save(project);}if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();selectStep(s.id);document.querySelector(`[data-step="${s.id}"][data-step-field="title"]`)?.focus();}});
  }
  function decodeImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth*img.naturalHeight>40000000?reject(new Error('ภาพใหญ่เกิน 40 ล้านพิกเซล กรุณาย่อภาพก่อน')):resolve(img);img.onerror=()=>reject(new Error('ไม่สามารถอ่านไฟล์ภาพนี้ได้'));img.src=src;});}
  const fileData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('อ่านไฟล์ไม่สำเร็จ'));r.readAsDataURL(file);});
  async function imageFromFile(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000)throw new Error('กรุณาใช้ภาพ PNG, JPG หรือ WebP ขนาดไม่เกิน 12 MB');const data=await fileData(file);await decodeImage(data);return data;}
  async function replaceImage(data,target=current(),source=''){
    if(!target.page)return toast('กรุณาเลือกเนื้อหาก่อนเพิ่มภาพ',true);
    if(!C.imageURL(data))throw new Error('ข้อมูลภาพไม่ถูกต้อง');await decodeImage(data);
    if(target.frame.image&&(target.frame.steps.length||(target.frame.highlights||[]).length)){const ok=await confirmDialog('แทนที่ภาพเดิม','ข้อความ Point จะยังอยู่ โดยต้องวางจุดบนภาพใหม่อีกครั้ง และกรอบไฮไลท์เดิมจะถูกล้าง','เปลี่ยนภาพ');if(!ok)return;}
    target.frame.image=data;target.frame.steps.forEach(s=>{s.x=null;s.y=null;});target.frame.highlights=[];selectedBox='';if(source)target.page.url=C.safeURL(source);undo=undo.filter(u=>u.id!==target.frame.id);selected='';tool='pin';save(target.project);go(target.project,target.page);activeImage=target.frame.id;tool='pin';render();jumpToFrame(target.frame.id);toast('เพิ่มภาพแล้ว คลิกบนภาพเพื่อปักหมายเลข');
  }
  async function appendImageData(data,target){
    const available=20-C.frames(target.page).length+(target.page.image?0:1);
    if(data.length>available)throw new Error('หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ');
    for(const image of data){if(!C.imageURL(image))throw new Error('ข้อมูลภาพไม่ถูกต้อง');await decodeImage(image);}
    target.page.extraImages ||= [];let last;
    for(const image of data){if(!target.page.image){target.page.image=image;target.page.highlights=[];last=target.page;}else{last={...C.frame(),image};target.page.extraImages.push(last);}}
    save(target.project);go(target.project,target.page);activeImage=last.id;selected='';tool='pin';render();jumpToFrame(last.id);toast('เพิ่ม '+data.length+' ภาพแล้ว');
  }
  async function capture(append=false){const target=current();if(!target.page)return;if(append&&C.frames(target.page).length>=20&&target.page.image)return toast('หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ',true);let stream;try{
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('เบราว์เซอร์นี้จับภาพไม่ได้ กรุณาเปิดผ่าน HTTPS ใน Chrome/Edge บนคอมพิวเตอร์ หรืออัปโหลดภาพแทน');
    stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,selfBrowserSurface:'exclude'});
    const video=document.createElement('video');video.muted=true;video.srcObject=stream;
    await video.play();await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('ไม่ได้รับภาพจากหน้าจอ')),8000);if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(()=>{clearTimeout(timeout);resolve();});else setTimeout(()=>{clearTimeout(timeout);resolve();},400);});
    if(!video.videoWidth)throw new Error('ไม่ได้รับภาพจากหน้าจอ');
    const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);stream.getTracks().forEach(t=>t.stop());video.srcObject=null;
    const data=c.toDataURL('image/png');if(append)await appendImageData([data],target);else await replaceImage(data,target);
  }catch(error){if(error.name!=='NotAllowedError'&&error.name!=='AbortError')toast(error.message,true);else toast('ยกเลิกการจับภาพแล้ว');}finally{stream?.getTracks().forEach(t=>t.stop());}}
  function download(name,text,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function exportJSON(items){download((items.length===1?C.filename(items[0].name):'1dd-workspace')+'.1dd.json',JSON.stringify(C.pack(items),null,2));toast('ดาวน์โหลดข้อมูลพร้อมภาพแล้ว');}
  function preview(p){closePreview();const root=document.createElement('section');root.className='preview-wrap';root.id='preview';root.setAttribute('aria-label','ตัวอย่างคู่มือสำหรับลูกค้า');root.innerHTML=`<div class="preview-toolbar"><span>ตัวอย่างคู่มือ · ${E(p.name)}</span><div class="row">${button('close-preview','กลับไปแก้ไข','back','btn small')}${button('download-html','ดาวน์โหลด HTML','download','btn small','data-id="'+p.id+'"')}</div></div><iframe class="preview-frame" title="ตัวอย่างคู่มือ ${E(p.name)}"></iframe>`;document.body.append(root);root.querySelector('iframe').srcdoc=GuideViewer.makeHTML(p);document.body.classList.add('no-scroll');}
  function closePreview(){$('#preview')?.remove();if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';document.body.classList.remove('no-scroll');}
  function exportDialog(p){modal('ส่งออกคู่มือ',`<p>ส่งออกเฉพาะโปรเจกต์ <strong>${E(p.name)}</strong> รวม ${p.pages.length} เนื้อหา</p><button type="button" class="export-choice" data-action="download-html" data-id="${p.id}">${icon('book')}<span><strong>HTML สำหรับลูกค้า</strong><small>ไฟล์เดียว รวมภาพและคำอธิบาย เปิดอ่านได้ทันที หรือนำไปวางบนโฮสต์เพื่อส่งเป็นลิงก์</small></span></button><button type="button" class="export-choice" data-action="print-project" data-id="${p.id}">${icon('page')}<span><strong>พิมพ์ / บันทึกเป็น PDF</strong><small>A4 แนวนอน พร้อมหน้าปกและโลโก้ลูกค้า · เลือก “ดาวน์โหลด PDF” → Save as PDF</small></span></button><button type="button" class="export-choice" data-action="backup-project" data-id="${p.id}">${icon('download')}<span><strong>ไฟล์สำรองสำหรับแก้ไขต่อ (.json)</strong><small>เก็บภาพ ข้อความ และตำแหน่งหมายเลข นำเข้าใหม่ได้โดยไม่ทับโปรเจกต์เดิม</small></span></button>${cloudWorkspace?`<button type="button" class="export-choice" data-action="publish-guide" data-id="${p.id}">${icon('globe')}<span><strong>เผยแพร่ลิงก์คู่มือบนคลาวด์</strong><small>สร้างลิงก์อ่านอย่างเดียว สำหรับผู้ที่ได้รับลิงก์</small></span></button>`:''}`,null);}
  async function importFile(file){if(!file)return;if(file.size>85000000)throw new Error('ไฟล์มีขนาดเกิน 85 MB');let raw;try{raw=JSON.parse(await file.text());}catch{throw new Error('อ่าน JSON ไม่ได้ กรุณาเลือกไฟล์สำรองจาก 1DD Guide');}const imported=C.validateImport(raw);for(const p of imported){if(p.logo)await decodeImage(p.logo);}for(const p of imported)for(const q of p.pages)for(const f of C.frames(q))if(f.image)await decodeImage(f.image);const ok=await confirmDialog('นำเข้าคู่มือ',`พบ ${imported.length} โปรเจกต์ ระบบจะเพิ่มเป็นสำเนาใหม่ โดยไม่ทับงานเดิม`,'นำเข้า');if(!ok)return;projects.unshift(...imported);save();go(imported[0],imported[0].pages[0]);toast('นำเข้าคู่มือเรียบร้อยแล้ว');}
  function help(){modal('เริ่มต้นกับ 1DD Guide',`<ol><li>สร้างโปรเจกต์ แล้วเพิ่มเนื้อหาพร้อม URL หลังบ้าน</li><li>เปิดเว็บไซต์และล็อกอินด้วยตัวเอง จากนั้นจับภาพแท็บ อัปโหลด หรือวางภาพจากคลิปบอร์ด</li><li>เลือก “ปักหมายเลข” แล้วคลิกบนภาพ ลากเพื่อย้าย หรือใช้ปุ่มลูกศรบนคีย์บอร์ด</li><li>เขียนคำอธิบายด้านขวา และเรียงลำดับด้วย ↑ ↓</li><li>ดูแบบลูกค้า แล้วส่งออก HTML, PDF หรือเผยแพร่ลิงก์ผ่านคลาวด์</li></ol><div class="callout">${cloudWorkspace?'กำลังใช้คลาวด์ งานจะบันทึกลง Workspace ของทีม ตรวจสถานะมุมขวาบนก่อนปิดหน้า':'โหมดทดลองในเครื่อง: งานอยู่ในเบราว์เซอร์นี้ ยังไม่ได้ซิงก์คลาวด์ กด “คลาวด์ / ทีม” เพื่อเชื่อมต่อ'}<br>ไฟล์ HTML ที่ส่งออกไม่มีหน้าจอแก้ไขหรือข้อมูลโปรเจกต์อื่น</div>`,null);}
  function pairingToken(){let token;try{token=localStorage.getItem('1dd-capture-token');}catch{}if(!token){token=C.uid()+C.uid();try{localStorage.setItem('1dd-capture-token',token);}catch{}}return token;}
  const pairToken=pairingToken();
  function extensionHelp(){modal('จับภาพด้วยส่วนขยาย Chrome',`<p>ติดตั้งโฟลเดอร์ <strong>1dd-capture-extension</strong> ผ่าน Chrome → Extensions → Developer mode → Load unpacked</p><ol><li>ใส่ URL และรหัสเชื่อมต่อด้านล่างในส่วนขยาย</li><li>เปิดเนื้อหาปลายทางไว้ใน Guide</li><li>เปิดหลังบ้านลูกค้าที่ล็อกอินแล้ว แล้วกด “จับภาพส่งเข้า 1DD”</li><li>กลับมาดูตัวอย่างภาพและยืนยันเพิ่มในเนื้อหา</li></ol><label class="field">URL ของ Guide<input readonly value="${E(location.href.split('#')[0].split('?')[0])}" aria-label="URL สำหรับส่วนขยาย"></label><label class="field">รหัสเชื่อมต่อของเบราว์เซอร์นี้<input readonly value="${E(pairToken)}" aria-label="รหัสเชื่อมต่อ"><small>ใช้เฉพาะในส่วนขยายบนเครื่องนี้ ไม่ต้องส่งให้ลูกค้า</small></label><p>ส่วนขยายจับส่วนที่มองเห็นในแท็บ ไม่อ่านหรือส่งรหัสผ่านและคุกกี้</p>`,null);}
  // Cloud workspace orchestration. Local drafts and cloud workspaces stay separate.
  let cloudWorkspace=null,cloudRevision=0;
  async function configureCloud(){const conf=GuideCloud.config;const done=await modal('เชื่อม Supabase',`<p>ตั้งค่าบริการครั้งเดียว แล้วใช้ได้จากทุกเครื่องผ่าน URL ของ Guide</p><label class="field">Project URL<input name="url" type="url" required value="${E(conf.supabaseUrl||'')}" placeholder="https://your-project.supabase.co"></label><label class="field">Publishable / anon key<textarea name="key" required rows="3" spellcheck="false" placeholder="sb_publishable_…">${E(conf.supabaseKey||'')}</textarea><small>ใช้เฉพาะ public key ห้ามใส่ service_role หรือ secret key</small></label><div class="callout">ก่อนเชื่อมต่อ ให้รัน <a href="supabase/setup.sql" download>setup.sql</a> ใน Supabase SQL Editor แล้วเปิด Email authentication<br>ดูขั้นตอนในไฟล์ README-TH.md ที่แนบมากับชุดเว็บ</div>`,'บันทึกการเชื่อมต่อ',async data=>{GuideCloud.configure(data.get('url'),data.get('key'));});if(done)cloudPanel();}
  async function cloudPanel(){
    if(!GuideCloud.configured)return configureCloud();
    if(!GuideCloud.session){const done=await modal('เข้าสู่ระบบคลาวด์',`<p>ใช้บัญชีของทีมเพื่อเปิด Workspace และคู่มือของคุณ</p><label class="field">อีเมล<input name="email" type="email" required autocomplete="username" autofocus></label><label class="field">รหัสผ่าน<input name="password" type="password" required autocomplete="current-password"></label><div class="row between">${button('signup','สร้างบัญชีใหม่','','btn ghost small')}${button('recover','ลืมรหัสผ่าน','','btn ghost small')}</div>${GuideCloud.deployConfigured()?'':`<div class="row">${button('cloud-config','ตั้งค่าการเชื่อมต่อ','','btn ghost small')}${button('download-config','ดาวน์โหลด config.js','','btn ghost small')}</div>`}`,'เข้าสู่ระบบ',async data=>{await GuideCloud.login(data.get('email'),data.get('password'));});if(done)await workspacePicker();return;}
    const body=`<p>เข้าสู่ระบบด้วย <strong>${E(GuideCloud.session.user?.email||'บัญชีของคุณ')}</strong></p>${cloudWorkspace?`<div class="callout">Workspace: ${E(cloudWorkspace.name)}<br>สมาชิกที่ได้รับเชิญสามารถแก้ไขทุกโปรเจกต์ใน Workspace นี้</div>`:''}<div class="stack">${button('workspaces','เลือก / สร้าง Workspace','folder','btn')}${cloudWorkspace?button('members','จัดการสมาชิก','globe','btn'):''}${button('download-config','ดาวน์โหลด config.js สำหรับโฮสต์','download','btn')}${button('logout','ออกจากระบบคลาวด์','','btn')}</div>`;
    modal('คลาวด์และทีม',body,null);
  }
  async function signup(){const done=await modal('สร้างบัญชีทีม',`<label class="field">อีเมล<input name="email" type="email" required autocomplete="username"></label><label class="field">รหัสผ่าน<input name="password" type="password" required minlength="8" autocomplete="new-password"><small>อย่างน้อย 8 ตัวอักษร</small></label><p>หลังสมัครให้เปิดอีเมลยืนยัน แล้วกลับมาเข้าสู่ระบบที่นี่</p>`,'สร้างบัญชี',async data=>{await GuideCloud.signup(data.get('email'),data.get('password'));});if(done){if(GuideCloud.session){render();workspacePicker();}else toast('สมัครแล้ว กรุณายืนยันอีเมล แล้วเข้าสู่ระบบ');}}
  async function recovery(){const done=await modal('ขอลิงก์ตั้งรหัสผ่านใหม่',`<label class="field">อีเมล<input name="email" type="email" required autocomplete="email"></label>`,'ส่งลิงก์',async data=>GuideCloud.recover(data.get('email')));if(done)toast('หากมีบัญชีนี้ ระบบจะส่งลิงก์ไปยังอีเมล');}
  async function newPassword(){const done=await modal('ตั้งรหัสผ่านใหม่',`<label class="field">รหัสผ่านใหม่<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>`,'บันทึกรหัสผ่าน',async data=>GuideCloud.changePassword(data.get('password')));if(done){toast('เปลี่ยนรหัสผ่านแล้ว');workspacePicker();}}
  async function workspacePicker(){const list=await GuideCloud.workspaces();const done=await modal('เลือก Workspace',`${list.length?`<label class="field">Workspace ที่คุณเข้าถึงได้<select name="workspace">${list.map(w=>`<option value="${w.id}">${E(w.name)}</option>`).join('')}</select></label>`:'<p>ยังไม่มี Workspace สร้างพื้นที่สำหรับทีม หรือให้เจ้าของเชิญด้วยอีเมลของคุณ</p>'}${button('new-workspace','สร้าง Workspace ใหม่','plus','btn')}` ,list.length?'เปิด Workspace':null);if(done)await loadWorkspace(done.get('workspace'));}
  async function newWorkspace(){let id;const done=await modal('สร้าง Workspace',`<label class="field">ชื่อ Workspace<input name="name" required maxlength="120" placeholder="เช่น 1DD Team"></label><p>คุณจะเป็นเจ้าของ Workspace นี้ และเชิญสมาชิกเข้ามาช่วยทำคู่มือได้</p>`,'สร้าง Workspace',async data=>{if(!data.get('name').trim())throw new Error('กรุณาใส่ชื่อ');id=await GuideCloud.rpc('guide_create_workspace',{workspace_name:data.get('name').trim()});});if(done)await loadWorkspace(id);}
  async function canSwitch(){await flush();if(savedVersion<changeVersion){const ok=await confirmDialog('ยังมีงานที่ไม่ได้บันทึก','กรุณาสำรอง JSON ก่อน การสลับ Workspace หรือโหลดใหม่จะทิ้งการแก้ไขที่ยังบันทึกไม่สำเร็จ','ทิ้งการแก้ไขแล้วดำเนินการ');if(!ok)return false;}return true;}
  async function loadWorkspace(id,initial=false){if(!initial&&!(await canSwitch()))return;toast('กำลังโหลด Workspace…');const w=await GuideCloud.load(id);clearTimeout(timer);projects=w.projects;cloudWorkspace={id:w.id,name:w.name};cloudRevision=w.revision;changeVersion=savedVersion=0;storageError='';undo=[];query='';try{sessionStorage.setItem('1dd-active-workspace',id);}catch{}go();render();toast('เปิด Workspace '+w.name+' แล้ว');}
  async function members(){if(!cloudWorkspace)return;const wid=cloudWorkspace.id;const results=await Promise.all([GuideCloud.request('/rest/v1/guide_members?workspace_id=eq.'+wid+'&select=user_id,email,role'),GuideCloud.request('/rest/v1/guide_invites?workspace_id=eq.'+wid+'&select=email')]);const [list,invites]=results,isOwner=list.some(m=>m.user_id===GuideCloud.session.user.id&&m.role==='owner');modal('สมาชิกใน Workspace',`<p>ผู้แก้ไขเข้าถึงทุกโปรเจกต์ใน Workspace นี้ ให้ลูกค้าอ่านผ่านลิงก์คู่มือเฉพาะโปรเจกต์</p><div class="member-list">${list.map(m=>`<div class="member-row"><span><strong>${E(m.email)}</strong><small>${m.role==='owner'?'เจ้าของ':'ผู้แก้ไข'}</small></span>${isOwner&&m.role!=='owner'?button('remove-member','','trash','icon-btn danger',`data-id="${m.user_id}" aria-label="นำ ${E(m.email)} ออกจากทีม"`):''}</div>`).join('')}${invites.map(m=>`<div class="member-row"><span><strong>${E(m.email)}</strong><small>รอยืนยันอีเมลและเข้าสู่ระบบ</small></span>${button('cancel-invite','','close','icon-btn',`data-email="${E(m.email)}" aria-label="ยกเลิกคำเชิญ"`)}</div>`).join('')}</div>${isOwner?`<label class="field">เพิ่มผู้แก้ไขด้วยอีเมล<input type="email" name="email" required placeholder="team@example.com"><small>ระบบบันทึกสิทธิ์ให้ กรุณาส่ง URL ของ Guide ให้สมาชิกด้วยตัวเอง</small></label>`:''}`,isOwner?'เพิ่มสมาชิก':null,async data=>{await GuideCloud.rpc('guide_invite_member',{wid,member_email:data.get('email')});toast('เพิ่มสิทธิ์แล้ว สมาชิกต้องยืนยันอีเมลและเข้าสู่ระบบ');});}
  async function publishGuide(p){
    if(!GuideCloud.deployConfigured()){modal('ตั้งค่าโฮสต์ก่อนแชร์ลิงก์',`<p>เพื่อให้ลูกค้าเปิดได้จากเครื่องอื่น กรุณาดาวน์โหลด <strong>config.js</strong> แล้วแทนที่ไฟล์ชื่อเดียวกันบนโฮสต์ของ Guide จากนั้นโหลดหน้าใหม่</p>${button('download-config','ดาวน์โหลด config.js','download','btn primary')}`,null);return;}
    const ok=await confirmDialog('เผยแพร่คู่มือให้ลูกค้า',`เผยแพร่เฉพาะ ${p.name} เป็นฉบับอ่านอย่างเดียว ผู้ที่มีลิงก์ทุกคนเปิดอ่านและดาวน์โหลดได้ การแก้ไขภายหลังต้องกดเผยแพร่อีกครั้งเพื่ออัปเดตลิงก์เดิม`,'เผยแพร่ / อัปเดต');if(!ok)return;
    await flush();if(storageError)throw new Error('กรุณาแก้ปัญหาการบันทึกก่อนเผยแพร่');
    const token=await GuideCloud.rpc('guide_publish',{wid:cloudWorkspace.id,pid:p.id,guide:C.pack([p])});const url=new URL(location.href);url.hash='';url.search='';url.searchParams.set('guide',token);
    modal('ลิงก์คู่มือพร้อมส่ง',`<label class="field">ลิงก์สำหรับลูกค้า<input readonly id="share-link" value="${E(url.href)}"></label><div class="row">${button('copy-link','คัดลอกลิงก์','copy','btn')}<a class="btn" href="${E(url.href)}" target="_blank" rel="noopener noreferrer">เปิดคู่มือ ↗</a></div><p>ลิงก์นี้อ่านได้โดยไม่ต้องล็อกอิน และแสดงเฉพาะโปรเจกต์นี้ การเพิกถอนลิงก์ไม่ลบสำเนา HTML หรือ PDF ที่ผู้อ่านดาวน์โหลดไปแล้ว</p>${button('revoke-guide','เพิกถอนลิงก์นี้','trash','btn danger','data-id="'+p.id+'"')}`,null);
  }
  async function openPublic(token){app.innerHTML='<div class="boot"><img class="boot-logo" src="assets/1dd-logo.png" alt="1DD"><strong>Guide</strong><p>กำลังเปิดคู่มือ…</p></div>';try{if(!/^[a-f0-9]{64}$/.test(token))throw new Error('ลิงก์คู่มือไม่ถูกต้อง');const raw=await GuideCloud.rpc('guide_read_publication',{share_token:token},false);if(!raw)throw new Error('คู่มือนี้ไม่พร้อมใช้งาน หรือลิงก์ถูกเพิกถอนแล้ว');const [p]=C.validateImport(raw);p.updatedAt=raw.projects[0].updatedAt;const frame=document.createElement('iframe');frame.className='public-frame';frame.title='คู่มือ '+p.name;frame.srcdoc=GuideViewer.makeHTML(p);app.replaceChildren(frame);document.title=p.name+' — 1DD Guide';}catch(error){app.innerHTML='<div class="boot"><img class="boot-logo" src="assets/1dd-logo.png" alt="1DD"><strong>Guide</strong><p>'+E(error.message)+'</p></div>';}}

  async function act(action,el){
    activateFrameFrom(el);
    const {project:p,page:q,frame:f}=current(),target=projects.find(p=>p.id===el?.dataset.id)||p;
    document.querySelectorAll('.menu[open]').forEach(d=>d.removeAttribute('open'));
    switch(action){
      case 'home':query='';go();break;
      case 'mobile-menu':mobileOpen=!mobileOpen;$('#sidebar').classList.toggle('open',mobileOpen);break;
      case 'new-project':projectDialog();break;
      case 'project-settings':projectDialog(p);break;
      case 'open-project':go(target,target.pages[0]);break;
      case 'new-page':pageDialog(p);break;
      case 'edit-page':pageDialog(p,q);break;
      case 'duplicate-project':{const clone=C.validateImport(C.pack([target]))[0];clone.name=target.name+' (สำเนา)';projects.unshift(clone);save(clone);go(clone,clone.pages[0]);toast('สร้างสำเนาโปรเจกต์แล้ว');break;}
      case 'delete-project':if(await confirmDialog('ลบโปรเจกต์',`ลบ ${target.name} และทุกเนื้อหา${cloudWorkspace?' รวมถึงลิงก์ที่เผยแพร่ไว้':''}? แนะนำให้สำรอง JSON ก่อนลบ`,'ลบโปรเจกต์')){projects=projects.filter(p=>p.id!==target.id);save();go();render();toast('ลบโปรเจกต์แล้ว');}break;
      case 'duplicate-page':{const clone=C.copy(q);clone.id=C.uid();clone.title+=' (สำเนา)';clone.steps.forEach(s=>s.id=C.uid());(clone.highlights||[]).forEach(h=>h.id=C.uid());(clone.extraImages||[]).forEach(image=>{image.id=C.uid();image.steps.forEach(s=>s.id=C.uid());(image.highlights||[]).forEach(h=>h.id=C.uid());});p.pages.splice(p.pages.indexOf(q)+1,0,clone);save(p);go(p,clone);break;}
      case 'delete-page':if(await confirmDialog('ลบเนื้อหา',`ลบเนื้อหา “${q.title}” พร้อมภาพและคำอธิบาย?`,'ลบเนื้อหา')){p.pages=p.pages.filter(page=>page.id!==q.id);save(p);go(p,p.pages[0]);render();}break;
      case 'page-up':case 'page-down':{const i=p.pages.indexOf(q),j=i+(action==='page-up'?-1:1);if(j>=0&&j<p.pages.length){[p.pages[i],p.pages[j]]=[p.pages[j],p.pages[i]];save(p);render();}break;}
      case 'select-step':if(f.image&&f.steps.some(s=>s.id===el.dataset.step&&!C.placed(s))){selected=el.dataset.step;tool='pin';render();}else selectStep(el.dataset.step);break;
      case 'place-step':selected=el.dataset.step;tool='pin';render();document.getElementById('canvas-'+f.id)?.scrollIntoView({block:'nearest',behavior:'smooth'});break;
      case 'step-up':case 'step-down':case 'step-delete':{const i=f.steps.findIndex(s=>s.id===el.dataset.step);if(i<0)break;remember(f);if(action==='step-delete'){f.steps.splice(i,1);selected='';}else{const j=i+(action==='step-up'?-1:1);if(j>=0&&j<f.steps.length)[f.steps[i],f.steps[j]]=[f.steps[j],f.steps[i]];}save(p);render();break;}
      case 'tool-select':case 'tool-pin':case 'tool-highlight':case 'tool-redact':tool=action.split('-')[1];render();break;
      case 'add-center':addPin(.5,.5);break;
      case 'undo':applyUndo();break;
      case 'select-image':jumpToFrame(el.dataset.image);break;
      case 'add-images':appendImages=true;captureTarget=current();$('#image-input').multiple=true;$('#image-input').click();break;
      case 'upload-image':appendImages=false;captureTarget=current();$('#image-input').multiple=false;$('#image-input').click();break;
      case 'remove-image':if(await confirmDialog('ลบภาพ','ลบภาพที่เลือกและหมายเลขของภาพนี้?','ลบภาพ')){if(f===q){const next=(q.extraImages||[]).shift();q.image=next?.image||'';q.steps=next?.steps||[];q.highlights=next?.highlights||[];q.imageLabel=next?.imageLabel||'';}else{q.extraImages=q.extraImages.filter(image=>image!==f);}undo=[];activeImage='';selected='';save(p);render();}break;
      case 'capture':await capture();break;
      case 'capture-add':await capture(true);break;
      case 'delete-highlight':remember(f);f.highlights=(f.highlights||[]).filter(h=>h.id!==selectedBox);selectedBox='';save(p);render();break;
      case 'extension':extensionHelp();break;
      case 'import':$('#import-input').click();break;
      case 'backup-all':if(!projects.length)toast('ยังไม่มีโปรเจกต์ให้สำรอง');else exportJSON(projects);break;
      case 'backup-project':exportJSON([target]);break;
      case 'export-project':exportDialog(target);break;
      case 'preview':preview(p);break;
      case 'close-preview':closePreview();break;
      case 'download-html':download(C.filename(target.name)+'-guide.html',GuideViewer.makeHTML(target),'text/html;charset=utf-8');toast('ดาวน์โหลด HTML พร้อมภาพแล้ว');break;
      case 'print-project':dialog.close();preview(target);break;
      case 'help':help();break;
      case 'close-dialog':dialog.close();break;
      case 'cloud':await cloudPanel();break;
      case 'cloud-config':await configureCloud();break;
      case 'signup':await signup();break;
      case 'recover':await recovery();break;
      case 'workspaces':await workspacePicker();break;
      case 'new-workspace':await newWorkspace();break;
      case 'members':await members();break;
      case 'remove-member':if(await confirmDialog('นำสมาชิกออก','สมาชิกคนนี้จะเปิดหรือแก้ไข Workspace ไม่ได้อีก','นำออก')){await GuideCloud.rpc('guide_remove_member',{wid:cloudWorkspace.id,member_id:el.dataset.id});members();}break;
      case 'cancel-invite':await GuideCloud.rpc('guide_cancel_invite',{wid:cloudWorkspace.id,member_email:el.dataset.email});members();break;
      case 'download-config':download('config.js',GuideCloud.configDownload(),'text/javascript');toast('นำ config.js ไปแทนที่ไฟล์บนโฮสต์ แล้วโหลดหน้าใหม่');break;
      case 'cloud-reload':if(cloudWorkspace)await loadWorkspace(cloudWorkspace.id);break;
      case 'retry-save':storageError='';await flush();if(!storageError)render();break;
      case 'logout':if(await canSwitch()){await GuideCloud.logout();cloudWorkspace=null;cloudRevision=0;try{sessionStorage.removeItem('1dd-active-workspace');}catch{}await loadLocal();go();dialog.close();render();}break;
      case 'publish-guide':await publishGuide(target);break;
      case 'revoke-guide':if(await confirmDialog('เพิกถอนลิงก์คู่มือ','ลิงก์เดิมจะเปิดอ่านไม่ได้อีก แต่ไฟล์ที่ดาวน์โหลดไปแล้วจะยังคงอยู่','เพิกถอนลิงก์')){await GuideCloud.rpc('guide_revoke',{wid:cloudWorkspace.id,pid:target.id});toast('เพิกถอนลิงก์แล้ว');}break;
      case 'copy-link':{const input=$('#share-link');try{await navigator.clipboard.writeText(input.value);toast('คัดลอกลิงก์แล้ว');}catch{input.select();toast('เลือกลิงก์แล้ว กด Ctrl / ⌘ + C เพื่อคัดลอก');}break;}
    }
  }
  document.addEventListener('click',ev=>{if(ev.target.closest('.skip-link')){ev.preventDefault();const main=$('#main');if(main){main.tabIndex=-1;main.focus();}return;}const el=ev.target.closest('[data-action]');if(!el||el.disabled)return;act(el.dataset.action,el).catch(error=>toast(error.message,true));});
  app.addEventListener('input',ev=>{const el=ev.target;activateFrameFrom(el);if(el.id==='project-search'){query=el.value;$('#project-grid').innerHTML=cards();return;}const {project,page,frame}=current();if(!page)return;if(el.dataset.field){const field=el.dataset.field;if(field==='url'){el.setCustomValidity(el.value&&!C.safeURL(el.value)?'กรุณาใช้ URL แบบ https:// หรือ http://':'');if(el.value&&!C.safeURL(el.value))return;}page[field]=el.value;scheduleSave(project);}if(el.dataset.stepField){const step=frame.steps.find(s=>s.id===el.dataset.step);if(step){step[el.dataset.stepField]=el.value;scheduleSave(project);}}});
  app.addEventListener('change',ev=>{if(ev.target.dataset.field==='title'&&!ev.target.value.trim()){const {project,page}=current();page.title='เนื้อหาใหม่';ev.target.value=page.title;scheduleSave(project);}if(['title','url'].includes(ev.target.dataset.field)){const {project,page}=current();const side=$('#sidebar');if(side){side.innerHTML=sidebar(project,page);}if(ev.target.dataset.field==='url'){const box=ev.target.parentElement;box.querySelector('a')?.remove();if(C.safeURL(page.url))box.insertAdjacentHTML('beforeend',`<a href="${E(C.safeURL(page.url))}" target="_blank" rel="noopener noreferrer" aria-label="เปิดหน้าหลังบ้าน">${icon('external')}</a>`);}}});
  $('#image-input').addEventListener('change',async ev=>{try{
    const files=Array.from(ev.target.files),target=captureTarget||current();if(!files.length||!target.page)return;
    if(!appendImages){await replaceImage(await imageFromFile(files[0]),target);return;}
    const available=20-C.frames(target.page).length+(target.page.image?0:1);
    if(files.length>available)throw new Error('หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ');
    const data=[];for(const file of files)data.push(await imageFromFile(file));
    await appendImageData(data,target);
  }catch(error){toast(error.message,true);}finally{ev.target.value='';captureTarget=null;appendImages=false;}});
  $('#import-input').addEventListener('change',async ev=>{try{await importFile(ev.target.files[0]);}catch(error){toast(error.message,true);}finally{ev.target.value='';}});
  document.addEventListener('paste',async ev=>{if(dialog.open||$('#preview')||!current().page)return;const item=Array.from(ev.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));if(!item)return;ev.preventDefault();try{await replaceImage(await imageFromFile(item.getAsFile()));}catch(error){toast(error.message,true);}});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if($('#preview'))closePreview();mobileOpen=false;$('#sidebar')?.classList.remove('open');}if(ev.target.closest('input,textarea,select')||dialog.open||$('#preview')||!current().page)return;if(ev.key.toLowerCase()==='n'){tool='pin';render();}if(ev.key.toLowerCase()==='v'&&!ev.ctrlKey&&!ev.metaKey){tool='select';render();}if(ev.key.toLowerCase()==='z'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();applyUndo();}});
  window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.search).has('guide'))return;selected='';activeImage='';selectedBox='';tool='select';mobileOpen=false;render();});
  window.addEventListener('beforeunload',ev=>{if(savedVersion<changeVersion){ev.preventDefault();ev.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
  window.addEventListener('message',async ev=>{
    if(ev.source!==window||ev.origin!==location.origin||ev.data?.type!=='1DD_CAPTURE'||ev.data.token!==pairToken)return;
    const data=ev.data;if(!C.imageURL(data.image)||!C.safeURL(data.url))return;
    const target=current();if(!target.page){toast('รับภาพแล้วไม่ได้: กรุณาเปิดเนื้อหาใน Guide แล้วจับภาพอีกครั้ง',true);return;}
    if(dialog.open){toast('กรุณาปิดหน้าต่างใน Guide แล้วจับภาพอีกครั้ง',true);return;}
    try{await decodeImage(data.image);const ok=await modal('เพิ่มภาพจากส่วนขยาย',`<p>เพิ่มภาพใน <strong>${E(target.project.name)} / ${E(target.page.title)}</strong></p><img class="capture-preview" src="${data.image}" alt="ตัวอย่างภาพที่จับมา"><p>${E(data.url)}</p>`,'ใช้ภาพนี้');if(ok)await replaceImage(data.image,target,data.url);}catch(error){toast(error.message,true);}
  });
  async function loadLocal(){cloudWorkspace=null;storageError='';changeVersion=savedVersion=0;undo=[];try{if(!db)db=await openDB();const saved=await readDB();if(saved&&(!Array.isArray(saved.projects)||![1,C.VERSION].includes(saved.version)))throw new Error('ข้อมูลในเครื่องมีรูปแบบที่ไม่รองรับ กรุณาใช้ไฟล์สำรอง');revision=saved?.revision||0;projects=saved?saved.projects:[C.starter(window.GUIDE_STARTER_IMAGE)];if(!saved)save();}catch(error){storageError=error.message;projects=[C.starter(window.GUIDE_STARTER_IMAGE)];}}
  async function init(){
    const token=new URLSearchParams(location.search).get('guide');if(token){await openPublic(token);return;}
    const authType=await GuideCloud.consumeAuthHash().catch(error=>{toast(error.message,true);return '';});
    await loadLocal();render();
    if(authType==='recovery'){newPassword();return;}
    if(GuideCloud.session){let wid;try{wid=sessionStorage.getItem('1dd-active-workspace');}catch{}if(wid){try{await flush();await loadWorkspace(wid,true);}catch(error){toast('ยังเปิดคลาวด์ไม่ได้: '+error.message,true);cloudPanel();}}else workspacePicker().catch(error=>toast(error.message,true));}
  }
  init().catch(error=>{app.innerHTML='<div class="boot"><img class="boot-logo" src="assets/1dd-logo.png" alt="1DD"><strong>Guide</strong><p>'+E(error.message)+'</p></div>';});
})();
