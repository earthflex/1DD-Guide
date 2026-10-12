/* Self-contained customer guide: exported files need no server or CDN. */
(function () {
  'use strict';
  const CSS = `
  ${window.GUIDE_FONT_CSS||""}
  :root{font-family:"Google Sans",sans-serif;font-size:14px;line-height:1.8;color:#303030;background:#f8f8f8;--accent:#777777}*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer;color:inherit}a{color:inherit}button:focus-visible,a:focus-visible,input:focus,select:focus{outline:3px solid #afafaf;outline-offset:3px}[hidden]{display:none!important}h1,h2,h3,p{margin:0}.brand{font-size:28px;font-weight:850;letter-spacing:-2px;color:#363636}.brand sup{font-size:9px;vertical-align:top;letter-spacing:0}.header{min-height:78px;display:flex;align-items:center;justify-content:space-between;padding:16px 38px;background:white;border-bottom:1px solid #e6e6e6;gap:15px}.brand-group{display:flex;gap:18px;align-items:center}.brand-label{font-size:10px;border-left:1px solid #e0e0e0;padding-left:18px;letter-spacing:1.7px;line-height:1.5;color:#828282}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #dfdfdf;border-radius:7px;padding:8px 13px;background:white;text-decoration:none;font-size:12px;color:#6d6d6d;min-height:38px}.btn:hover{background:#f3f3f3}.btn.primary{background:#383838;border-color:#383838;color:white}.btn:disabled{opacity:.4;cursor:not-allowed}.layout{max-width:1360px;display:grid;grid-template-columns:250px minmax(0,1fr);margin:auto;min-height:calc(100vh - 78px)}.sidebar{padding:36px 28px;border-right:1px solid #e5e5e5}.eyebrow{font-size:10px;font-weight:650;letter-spacing:1.5px;color:#8f8f8f;text-transform:uppercase}.project-title{font-size:21px;line-height:1.4;margin:8px 0;color:#3c3c3c;overflow-wrap:anywhere}.project-description{font-size:11px;color:#919191;margin-bottom:25px}.search{width:100%;padding:9px 11px;border:1px solid #e3e3e3;border-radius:7px;background:white;font-size:11px;margin:18px 0}.nav{display:grid;gap:5px}.chapter{border:0;background:none;text-align:left;padding:11px 10px;font-size:12px;display:flex;gap:10px;align-items:flex-start;border-radius:7px;color:#848484;width:100%;overflow-wrap:anywhere}.chapter.active{background:#ececec;color:#434343}.chapter b{font-size:10px;color:#9d9d9d;margin-top:2px;font-weight:400}.chapter.active b{color:var(--accent)}.sidebar-footer{font-size:10px;color:#9f9f9f;margin-top:35px;padding-top:20px;border-top:1px solid #e5e5e5}.main{padding:40px 44px 30px;min-width:0}.chapter-meta{font-size:10px;color:var(--accent);letter-spacing:1.2px;margin-bottom:12px}.main h1{font-size:30px;line-height:1.45;letter-spacing:-.7px;overflow-wrap:anywhere}.description{font-size:13px;color:#838383;line-height:1.9;margin-top:9px;white-space:pre-wrap;overflow-wrap:anywhere}.screen{margin:27px 0 9px;border:1px solid #e3e3e3;border-radius:10px;background:white;padding:12px}.image{position:relative;line-height:0;width:100%}.image>img{width:100%;height:auto;display:block;border-radius:3px}.pin{position:absolute;transform:translate(-50%,-50%);border:2px solid white;background:var(--accent);color:white;border-radius:50%;width:29px;height:29px;font-size:11px;font-weight:700;display:grid;place-items:center;line-height:1;box-shadow:0 2px 7px #21212130;padding:0}.pin.active{outline:3px solid #adadad66;outline-offset:3px}.screen-footer{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#989898;margin:12px 0 0;gap:10px}.screen-footer button{border:0;background:none;color:#787878;font-size:11px;padding:0}.steps{display:grid;gap:12px;margin-top:25px}.step{display:flex;gap:16px;padding:21px 23px;background:white;border:1px solid #e6e6e6;border-radius:10px;scroll-margin-top:20px}.step.active{border-color:#bfbfbf;background:#fbfbfb}.num{width:28px;height:28px;background:#f0f0f0;color:#6e6e6e;display:grid;place-items:center;border-radius:50%;font-size:11px;font-weight:600;flex:none}.step.active .num{background:var(--accent);color:white}.step h3{font-size:14px;margin-bottom:5px;overflow-wrap:anywhere}.step p{font-size:12px;color:#818181;white-space:pre-wrap;overflow-wrap:anywhere}.note{background:#f3f3f3;border:1px solid #e3e3e3;padding:17px 20px;border-radius:9px;margin-top:22px;font-size:12px;color:#767676;white-space:pre-wrap;overflow-wrap:anywhere}.note strong{display:block;font-size:11px;margin-bottom:4px}.source{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:22px;font-size:11px;color:#919191}.source a{overflow-wrap:anywhere}.pagination{border-top:1px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;margin-top:35px;padding-top:24px;gap:15px}.pagination span{font-size:10px;color:#a4a4a4}.mobile-nav{display:none}.print-only{display:none}.empty{border:1px dashed #dcdcdc;border-radius:10px;padding:40px 20px;text-align:center;color:#929292;margin-top:25px;font-size:13px}.no-results{font-size:11px;color:#969696;padding:15px 0}dialog{width:95vw;max-width:1500px;border:1px solid #e0e0e0;border-radius:12px;padding:15px;max-height:94vh}dialog::backdrop{background:#262626b0}dialog .image{margin-top:15px}dialog>button{display:flex;margin-left:auto;float:none}.guide-footer{font-size:10px;color:#a4a4a4;text-align:center;margin-top:35px}.print-error{color:#494949;font-size:12px;padding:10px 0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  @media(max-width:780px){.header{padding:13px 20px;gap:10px}.brand-label{font-size:8px;padding-left:12px}.brand-group{gap:12px}.brand{font-size:25px}.header select{max-width:90px}.header .btn{font-size:10px;padding:7px 9px}.layout{display:block}.sidebar{display:none}.main{padding:25px 20px 35px}.main h1{font-size:25px}.mobile-nav{display:block;padding:15px 20px 0}.mobile-nav select{width:100%;border:1px solid #dedede;padding:10px;border-radius:7px;background:white;font-size:13px;color:#646464}.screen{padding:7px;border-radius:7px}.pin{width:23px;height:23px;font-size:9px}.step{padding:17px 16px;gap:12px}.step p{font-size:13px}.pagination{flex-wrap:wrap}.pagination span{order:3;width:100%;text-align:center}.source a{max-width:100%}.screen-footer{font-size:9px}.description{font-size:13px}.note{font-size:12px}}@media(pointer:coarse){.pin::after{content:"";position:absolute;inset:-10px}.btn,.chapter{min-height:44px}input,select{font-size:16px!important}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  .brand-logo{width:48px;height:48px;object-fit:contain}.brand-label{font-size:22px;letter-spacing:-.5px;border:0;padding:0;font-weight:500;color:#3d3d3d}.print-brand img{width:28px;height:28px;vertical-align:middle;object-fit:contain;margin-right:8px}
  .content-image+.content-image{margin-top:48px;padding-top:32px;border-top:1px solid #e9e9e9}.image-heading{font-size:14px;font-weight:500;margin-top:24px}.image-heading span{color:#999999;font-weight:400}.content-image .screen{margin-top:16px}.step{border:0;border-bottom:1px solid #ededed;border-radius:0;background:transparent;padding:18px 0}.step.active{background:#fbfbfb}.screen{padding:0;border-radius:8px;overflow:hidden}.sidebar{background:#fafafa}.header{padding-top:12px;padding-bottom:12px}.guide-footer{display:none}
  .description,.step p,.note,.project-description{font-size:14px;color:rgba(0,0,0,.8);line-height:1.8}.step h3{font-size:16px}.sidebar{background:#e5e5e5}.chapter.active{background:#404040;color:white}.chapter.active b{color:white}.chapter-meta{color:#666}
  .image-jumps{position:sticky;top:0;z-index:5;display:flex;gap:8px;overflow-x:auto;padding:12px 0;margin:20px 0 4px;background:#f9f9f9;border-bottom:1px solid #dedede}.image-jump{flex:none;border:1px solid #dedede;border-radius:6px;padding:8px 18px;font-size:13px;background:white;color:#555}.image-jump.active{background:#404040;border-color:#404040;color:white}.content-image{scroll-margin-top:76px}.content-image:focus{outline:none}.highlight-box{position:absolute;border:2px solid #ff6600;border-radius:2px;pointer-events:none;z-index:1}.pin{z-index:2}.pin.active{outline-color:#ff660055}.step.active{background:#fff7f0}.image-jump:focus-visible{outline-color:#555}
  .layout{grid-template-columns:200px minmax(0,1fr);max-width:1440px}.sidebar{padding:24px 18px}.project-title{font-size:18px;margin:6px 0 12px}.project-description{margin-bottom:16px}.project-description:empty{display:none}.sidebar-footer{font-size:12px;margin-top:22px;padding-top:16px}.main{padding:30px 30px 36px}
  .chapter.active,.chapter.active:hover{background:rgba(255,102,0,.14);color:#202020}.chapter.active b{color:#202020}
  .image-jump{display:flex;align-items:center;gap:8px;padding:5px 10px 5px 5px;max-width:240px}.image-jump img{width:42px;height:32px;object-fit:cover;border-radius:3px}.image-jump span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.image-jump.active{background:#fff3eb;border-color:#ffc299;color:#333}
  .reader-image-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px;align-items:start}.reader-figure{min-width:0;position:sticky;top:88px}.reader-image-grid .screen{margin-top:14px}.reader-image-grid .steps{margin-top:0;gap:0;min-width:0}.reader-image-grid .step{padding:14px 0;gap:10px;scroll-margin-top:88px}.step>div{min-width:0}.screen-footer{font-size:12px}.screen-footer .zoom-button{width:32px;height:32px;display:grid;place-items:center;border-radius:6px}.zoom-button:hover{background:#eee}.zoom-button svg{pointer-events:none}.image-heading{margin-top:18px;overflow-wrap:anywhere}
  @media(max-width:1100px){.reader-image-grid{grid-template-columns:1fr}.reader-figure{position:static}.reader-image-grid .steps{margin-top:16px}}
  @media(max-width:780px){.layout{display:block}.main{padding:24px 18px 32px}.image-jump{max-width:180px}}
  /* Shared sidebar colors from the 1DD Hub reference. */
  .sidebar{background:#fff;color:#52525b;border-right-color:#e5e7eb}.sidebar .project-title{color:#21242a}.sidebar .eyebrow,.sidebar .project-description,.sidebar .sidebar-footer{color:#71717a}.sidebar .sidebar-footer{border-top-color:#e5e7eb}.sidebar .chapter{color:#52525b}.sidebar .chapter b{color:#71717a}.sidebar .chapter:hover,.sidebar .chapter.active,.sidebar .chapter.active:hover{background:#fdf4ed;color:#ff6600}.sidebar .chapter.active b{color:#ff6600}
  .print-cover{position:relative;background:#fff;color:#000;width:297mm;height:209mm;box-sizing:border-box;overflow:hidden}
  .cover-client{position:absolute;left:17.45mm;top:43mm;width:100px;height:100px;display:flex;align-items:center}
  .cover-client img{width:100px;height:100px;object-fit:contain;object-position:left center}
  .cover-client-text{flex:none;font-size:28px;line-height:1.2;font-weight:500;width:240mm;overflow-wrap:anywhere}
  .print-cover h1{position:absolute;left:17.45mm;top:80mm;margin:0;font-size:60pt;font-weight:500;line-height:1.18;letter-spacing:-1.3pt;color:#000}
  .cover-agency-logo{position:absolute;left:17.45mm;bottom:21mm;width:14.5mm;height:14.5mm;object-fit:contain}
  .cover-credit{position:absolute;right:18mm;bottom:18.5mm;font-size:10pt;font-weight:500;letter-spacing:.2pt;color:#000}
  dialog:has(.cover-preview-stage){width:fit-content} .cover-preview-stage{position:relative;overflow:hidden;margin-top:14px;background:white;border:1px solid #eee}.cover-preview-stage .print-cover{transform-origin:top left}
  @page{size:A4 landscape;margin:12mm 17.45mm 13mm}
  @page guide-cover{size:A4 landscape;margin:0}
  @media print{
    :root,body{background:white;color:#262626;font-size:10pt}.header,.layout,.mobile-nav,dialog,.guide-footer{display:none!important}.print-only{display:block}
    .print-cover{page:guide-cover;break-after:page}.print-chapter{break-before:page;page:auto}
    .print-brand{display:flex;align-items:center;font-size:9pt;color:#717171;border-bottom:1px solid #e1e1e1;padding-bottom:5pt;margin-bottom:7pt;gap:6pt}.print-brand img{width:22px;height:22px;object-fit:contain;margin:0}
    .print-chapter h1{font-size:20pt;line-height:1.3;overflow-wrap:anywhere;margin:0 0 5pt}.print-chapter .description{font-size:10pt;margin:0 0 9pt;line-height:1.5}.print-chapter .image-heading{font-size:9pt;margin:0 0 7pt;color:#777}
    .print-grid{display:grid;grid-template-columns:minmax(0,1.95fr) minmax(0,1fr);gap:6mm;align-items:start}.print-grid.no-image{display:block}
    .print-figure{break-inside:avoid;margin:0}.print-figure img{display:block;width:100%;border:1px solid #e7e7e7}.print-figure figcaption{font-size:8pt;color:#919191;margin-top:4pt}
    .print-chapter .steps{display:block;margin:0}.print-chapter .step{break-inside:avoid;border-radius:0;padding:7pt 0;gap:8pt;border:0;border-bottom:1px solid #e8e8e8;background:white}.print-chapter .step:first-child{padding-top:0}.print-chapter .step>div{min-width:0}.print-chapter .step h3{font-size:11pt;line-height:1.45;margin-bottom:4pt}.print-chapter .step p{font-size:10pt;line-height:1.6;color:#444}.print-chapter .num{border:1px solid #ddd;background:#fff3eb;color:#a84b15;width:22px;height:22px;font-size:9pt}
    .print-chapter .note{margin-top:10pt;padding:8pt 10pt;break-inside:avoid;font-size:9pt;line-height:1.5;border-radius:0;background:white}.print-chapter .source{margin-top:8pt;font-size:8pt;display:block;overflow-wrap:anywhere}.print-chapter .source a{color:#666;text-decoration:none}.print-footer{font-size:8pt;color:#959595;margin-top:10pt}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
  `;

  function runtime() {
    'use strict';
    const p = JSON.parse(document.getElementById('guide-data').textContent);
    const placed = s => Number.isFinite(s.x)&&Number.isFinite(s.y);
    const frames = q => [q, ...(q.extraImages || [])];
    const e = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safe = s => {try {const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';} catch{return '';}};
    let index = 0, selected = '', printReady = null, activeImage = 0, imageObserver = null;
    const main = document.getElementById('main');
    const nav = document.getElementById('chapters');
    const date = new Date(p.updatedAt).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'});
    document.title = p.name + ' — 1DD Guide';
    const annotationColor='#ff6600';document.documentElement.style.setProperty('--accent',annotationColor);
    document.getElementById('project-name').textContent = p.name;
    document.getElementById('project-description').textContent = p.description;
    document.getElementById('updated').textContent = 'อัปเดต ' + date;
    const stepHTML = (s,n,active=false) => `<section class="step${active?' active':''}" id="step-${e(s.id)}"><span class="num">${n+1}</span><div><h3>${e(s.title || 'ขั้นตอนที่ '+(n+1))}</h3><p>${e(s.text)}</p></div></section>`;
    const imageLabel = (f,n) => f.imageLabel||'ภาพ '+(n+1);
    const zoomIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6M10 7v6"/></svg>';
    const sourceHTML = q => safe(q.url) ? `<div class="source">หน้าหลังบ้าน: <a href="${e(safe(q.url))}" target="_blank" rel="noopener noreferrer">${e(q.url)}</a></div>` : '';
    const imageHTML = q => `<div class="image"><img src="${q.image}" alt="ภาพประกอบ ${e(q.title)}">${(q.highlights||[]).map(h=>`<span class="highlight-box" style="left:${h.x*100}%;top:${h.y*100}%;width:${h.width*100}%;height:${h.height*100}%"></span>`).join('')}${q.steps.map((s,n)=>placed(s)?`<button class="pin ${selected===s.id?'active':''}" data-step="${e(s.id)}" style="left:${s.x*100}%;top:${s.y*100}%" aria-label="ขั้นตอน ${n+1}: ${e(s.title)}">${n+1}</button>`:'').join('')}</div>`;
    function renderNav() {
      nav.innerHTML = p.pages.map((q,n)=>({q,n})).map(({q,n})=>`<button class="chapter ${n===index?'active':''}" data-page="${n}" ${n===index?'aria-current="page"':''}><b>${String(n+1).padStart(2,'0')}</b><span>${e(q.title)}</span></button>`).join('') || '';
      document.getElementById('mobile-select').innerHTML = p.pages.map((q,n)=>`<option value="${n}" ${n===index?'selected':''}>${n+1}. ${e(q.title)}</option>`).join('');
    }
    function render(scroll=true) {
      const q = p.pages[index];
      renderNav();
      if (!q) {main.innerHTML='<h1>'+e(p.name)+'</h1><div class="empty">ยังไม่มีเนื้อหาในคู่มือนี้</div>';return;}
      main.innerHTML = `<div class="chapter-meta">เนื้อหา ${String(index+1).padStart(2,'0')} / ${String(p.pages.length).padStart(2,'0')}</div><h1>${e(q.title)}</h1><p class="description">${e(q.description)}</p>${frames(q).length>1?`<nav class="image-jumps" aria-label="เลือกภาพในเนื้อหา">${frames(q).map((f,n)=>`<button class="image-jump ${n===activeImage?'active':''}" data-jump="${n}" aria-controls="content-image-${n}" ${n===activeImage?'aria-current="location"':''}>${f.image?`<img src="${f.image}" alt="">`: ''}<span>${e(imageLabel(f,n))}</span></button>`).join('')}</nav>`:''}${frames(q).map((f,n)=>`<section class="content-image" id="content-image-${n}" tabindex="-1">${frames(q).length>1?`<h2 class="image-heading">${e(imageLabel(f,n))} <span>· ${n+1} / ${frames(q).length}</span></h2>`:''}<div class="reader-image-grid"><div class="reader-figure">${f.image?`<div class="screen">${imageHTML({...f,title:q.title})}</div><div class="screen-footer"><span>กดหมายเลขเพื่ออ่านคำอธิบาย</span><button class="zoom-button" data-action="zoom" data-image="${n}" aria-label="ขยาย ${e(imageLabel(f,n))}" title="ขยายภาพ">${zoomIcon}</button></div>`:'<div class="empty">ยังไม่มีภาพประกอบ</div>'}</div><div class="steps" aria-label="คำอธิบาย ${e(imageLabel(f,n))}">${f.steps.map((step,i)=>stepHTML(step,i,step.id===selected)).join('')}</div></div></section>`).join('')}${q.note?`<div class="note"><strong>ข้อควรทราบ</strong>${e(q.note)}</div>`:''}${sourceHTML(q)}<div class="pagination"><button class="btn" data-action="prev" ${index===0?'disabled':''}>← เนื้อหาก่อนหน้า</button><span>${e(p.name)} · ${index+1} / ${p.pages.length}</span><button class="btn" data-action="next" ${index===p.pages.length-1?'disabled':''}>เนื้อหาถัดไป →</button></div><footer class="guide-footer">จัดทำโดย 1DD · Website Tutorial Guide</footer>`;
      imageObserver?.disconnect();
      if(frames(q).length>1&&'IntersectionObserver' in window){imageObserver=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(visible.length)setActiveImage(Number(visible[0].target.dataset.imageHeading));},{rootMargin:'-65px 0px -55% 0px',threshold:0});main.querySelectorAll('.content-image').forEach((section,n)=>{const heading=section.querySelector('.image-heading');if(heading){heading.dataset.imageHeading=n;imageObserver.observe(heading);}});}
      if(scroll)window.scrollTo({top:0,behavior:'instant'});
    }
    function fitCoverPreview(){const stage=document.querySelector('#zoom[open] .cover-preview-stage');if(!stage)return;const cover=stage.firstElementChild,scale=Math.min((innerWidth*.95-34)/cover.offsetWidth,(innerHeight*.94-84)/cover.offsetHeight);cover.style.transform='scale('+scale+')';stage.style.width=cover.offsetWidth*scale+'px';stage.style.height=cover.offsetHeight*scale+'px';}
    window.addEventListener('resize',fitCoverPreview);
    function setActiveImage(n){activeImage=n;main.querySelectorAll('[data-jump]').forEach(button=>{const active=Number(button.dataset.jump)===n;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');});}
    function choose(n) {if(n<0||n>=p.pages.length)return;index=n;selected='';activeImage=0;render();}
    document.getElementById('mobile-select').addEventListener('change',ev=>choose(Number(ev.target.value)));
    document.addEventListener('click',ev=>{
      const jump=ev.target.closest('[data-jump]');if(jump){const n=Number(jump.dataset.jump),section=document.getElementById('content-image-'+n);setActiveImage(n);section?.focus({preventScroll:true});section?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return;}
      const page=ev.target.closest('[data-page]');if(page)choose(Number(page.dataset.page));
      const pin=ev.target.closest('[data-step]');
      if(pin){selected=pin.dataset.step;document.getElementById('zoom').close();render(false);document.getElementById('step-'+selected)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}
      const action=ev.target.closest('[data-action]')?.dataset.action;
      if(action==='prev')choose(index-1);
      if(action==='next')choose(index+1);
      if(action==='zoom'){const d=document.getElementById('zoom');d.innerHTML='<button class="btn" data-action="close-zoom">ปิดภาพ ×</button>'+imageHTML({...frames(p.pages[index])[Number(ev.target.closest('[data-image]').dataset.image)],title:p.pages[index].title});d.showModal();}
      if(action==='close-zoom')document.getElementById('zoom').close();
      if(action==='cover'){const d=document.getElementById('zoom');d.innerHTML='<button class="btn" data-action="close-zoom">ปิดหน้าปก ×</button><div class="cover-preview-stage">'+coverHTML()+'</div>';d.showModal();fitCoverPreview();}

    });
    function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('โหลดภาพสำหรับ PDF ไม่สำเร็จ'));img.src=src;});}
    async function printImages(q){
      if(!q.image)return [{html:'',start:0,end:1}];
      const img=await loadImage(q.image);
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      ctx.strokeStyle=annotationColor;ctx.lineWidth=Math.max(2,canvas.width/450);
      (q.highlights||[]).forEach(h=>{const inset=ctx.lineWidth/2;ctx.strokeRect(h.x*canvas.width+inset,h.y*canvas.height+inset,Math.max(1,h.width*canvas.width-ctx.lineWidth),Math.max(1,h.height*canvas.height-ctx.lineWidth));});
      const r=Math.max(15,canvas.width/65);
      q.steps.forEach((s,n)=>{if(!placed(s))return;const x=s.x*canvas.width,y=s.y*canvas.height;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=annotationColor;ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(3,r/7);ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='bold '+Math.round(r*.94)+'px "Google Sans"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(n+1),x,y+1);});
      const height=Math.max(1,Math.floor(canvas.width*.67)), count=Math.ceil(canvas.height/height),parts=[];
      for(let y=0,n=1;y<canvas.height;y+=height,n++){
        const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(height,canvas.height-y);slice.getContext('2d').drawImage(canvas,0,y,canvas.width,slice.height,0,0,slice.width,slice.height);
        parts.push({html:`<figure class="print-figure"><img src="${slice.toDataURL('image/png')}" alt="${e(q.title)}"><figcaption>${e(q.title)}${count>1?' · ภาพส่วน '+n+' / '+count:''}</figcaption></figure>`,start:y/canvas.height,end:(y+slice.height)/canvas.height});
      }
      return parts;
    }
    function coverHTML(){
      const client=p.logo?`<img src="${e(p.logo)}" alt="โลโก้ ${e(p.name)}">`:`<div class="cover-client-text">${e(p.logoText||p.name)}</div>`;
      return `<section class="print-cover" aria-label="หน้าปก PDF"><div class="cover-client">${client}</div><h1>CONTENT UPLOAD<br>TUTORIAL</h1><img class="cover-agency-logo" src="${document.getElementById('brand-logo').src}" alt="1DD"><div class="cover-credit">BY 1DD HUB CO.,LTD</div></section>`;
    }
    async function preparePrint(){
      await document.fonts.load('700 18px "Google Sans"');
      const sections=[coverHTML()];
      for(const q of p.pages){
        const images=frames(q);
        for(let n=0;n<images.length;n++){
          const f=images[n],slices=await printImages({...f,title:q.title});
          for(let k=0;k<slices.length;k++){
            const slice=slices[k],last=n===images.length-1&&k===slices.length-1;
            const steps=f.steps.map((s,i)=>({s,i})).filter(({s})=>placed(s)?s.y>=slice.start&&(s.y<slice.end||(k===slices.length-1&&s.y===1)):k===0);
            sections.push(`<section class="print-chapter" data-print-id="${e(q.id)}"><div class="print-brand"><img src="${document.getElementById('brand-logo').src}" alt="1DD"><span>Guide / ${e(p.name)}</span></div><h1>${e(q.title)}</h1>${images.length>1?`<p class="image-heading">${e(imageLabel(f,n))} · ${n+1} / ${images.length}</p>`:''}${n===0&&k===0&&q.description?`<p class="description">${e(q.description)}</p>`:''}<div class="print-grid ${f.image?'':'no-image'}">${slice.html}<div class="steps">${steps.map(({s,i})=>stepHTML(s,i)).join('')}</div></div>${last&&q.note?`<div class="note"><strong>ข้อควรทราบ</strong>${e(q.note)}</div>`:''}${last?sourceHTML(q):''}<p class="print-footer">${e(p.name)} · อัปเดต ${e(date)}</p></section>`);
          }
        }
      }
      if(!p.pages.length)sections.push('<section class="print-chapter"><h1>'+e(p.name)+'</h1><p>ยังไม่มีเนื้อหา</p></section>');
      document.getElementById('print-content').innerHTML=sections.join('');
      await Promise.all(Array.from(document.querySelectorAll('#print-content img')).map(img=>img.decode()));
      await document.fonts.ready;
    }
    function applyScope(){const current=document.getElementById('print-scope').value==='current';document.querySelectorAll('.print-chapter').forEach(el=>el.hidden=current&&el.dataset.printId!==p.pages[index]?.id);}
    window.addEventListener('beforeprint',applyScope);
    document.getElementById('print').addEventListener('click',async()=>{
      const b=document.getElementById('print');b.disabled=true;b.textContent='กำลังเตรียม…';
      try{await printReady;applyScope();window.print();}catch(error){document.getElementById('print-error').textContent=error.message;}finally{b.disabled=false;b.textContent='ดาวน์โหลด PDF';}
    });
    render(false);
    printReady=preparePrint();
    printReady.catch(error=>{document.getElementById('print-error').textContent=error.message;});
    window.guideReady=printReady;
  }
  function makeHTML(project) {
    const p=GuideCore.copy(project);if(!GuideCore.logoURL(p.logo))p.logo='';p.logoText=typeof p.logoText==='string'?p.logoText.slice(0,120):'';
    // Escape '<' as well as Unicode line separators to prevent closing script tags.
    const data=JSON.stringify(p).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="robots" content="noindex,nofollow"><title>${GuideCore.esc(p.name)} — 1DD Guide</title><style>${CSS}</style></head><body><header class="header"><div class="brand-group"><img id="brand-logo" class="brand-logo" src="${window.GUIDE_LOGO}" alt="1DD"><span class="brand-label">Guide</span></div><div class="actions"><button class="btn" data-action="cover">ดูหน้าปก PDF</button><label class="sr-only" for="print-scope">ขอบเขต PDF</label><select class="btn" id="print-scope"><option value="all">ทั้งโปรเจกต์</option><option value="current">เนื้อหานี้</option></select><button class="btn primary" id="print">ดาวน์โหลด PDF</button></div></header><div class="mobile-nav"><label class="sr-only" for="mobile-select">เลือกเนื้อหา</label><select id="mobile-select"></select></div><div class="layout"><aside class="sidebar"><div class="eyebrow">Client handbook</div><h2 id="project-name" class="project-title"></h2><p id="project-description" class="project-description"></p><nav id="chapters" class="nav" aria-label="สารบัญเนื้อหา"></nav><p class="sidebar-footer" id="updated"></p><p class="print-error" id="print-error" role="alert"></p></aside><main id="main" class="main"></main></div><div class="print-only" id="print-content"></div><dialog id="zoom" aria-label="ขยายภาพประกอบ"></dialog><script type="application/json" id="guide-data">${data}</script><script>(${runtime.toString()})();</script></body></html>`;
  }
  window.GuideViewer={makeHTML};
})();
