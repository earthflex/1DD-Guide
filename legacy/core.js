/* Portable data model. No framework, network calls, or HTML from imported files. */
(function (root) {
  'use strict';
  const VERSION = 2;
  const uid = () => root.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy = v => JSON.parse(JSON.stringify(v));
  function safeURL(value) {
    if (!value || typeof value !== 'string') return '';
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  const placed = s => Number.isFinite(s?.x) && Number.isFinite(s?.y);
  const websiteURL = value => {const v=String(value||'').trim();return v?safeURL(/^[a-z][a-z0-9+.-]*:/i.test(v)?v:'https://'+v):'';};
  function imageURL(s) { return typeof s === 'string' && s.length <= 18000000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s); }
  const logoURL = s => typeof s === 'string' && s.length <= 2000000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
  const str = (v, n=10000) => typeof v === 'string' ? v.slice(0, n) : '';
  const colors = ['#ff6600','#404040','#e65c35','#336c61','#4668ad','#9064ae','#b57b2a'];
  const page = (title = 'เนื้อหาใหม่') => ({id:uid(), title, description:'', url:'', image:'', steps:[], highlights:[], extraImages:[], note:''});
  const project = (name, website='', description='') => ({id:uid(), name, website, description, color:colors[0], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), pages:[page()]});
  const frames = q => [q, ...(q.extraImages || [])];
  const frame = () => ({id:uid(),image:'',steps:[],highlights:[]});
  function starter(image) {
    const p = project('Foline Lube','https://www.folinelube.com','คู่มือจัดการเว็บไซต์ WordPress สำหรับทีม Foline Lube');
    p.pages = [{id:uid(), title:'จัดการหน้าเว็บไซต์', description:'ดูรายการหน้าเว็บไซต์ทั้งหมด เพิ่มหน้าใหม่ และแก้ไขเนื้อหาที่มีอยู่ใน WordPress', url:'https://www.folinelube.com/wp-admin/edit.php?post_type=page', image, highlights:[],
      steps:[
        {id:uid(),x:0.055,y:0.214,title:'เปิดเมนู Pages',text:'คลิก Pages จากเมนูด้านซ้าย เพื่อดูหน้าทั้งหมดที่มีอยู่บนเว็บไซต์'},
        {id:uid(),x:0.181,y:0.207,title:'เพิ่มหน้าใหม่',text:'คลิก Add Page ด้านบน แล้วกรอกชื่อหน้าและเนื้อหาที่ต้องการ'},
        {id:uid(),x:0.158,y:0.645,title:'แก้ไขหน้าที่มีอยู่',text:'คลิกชื่อหน้าที่ต้องการ เช่น เกี่ยวกับเรา หรือ ติดต่อเรา เพื่อเปิดหน้าแก้ไข จากนั้นปรับเนื้อหาและกด Update'}
      ], note:'ก่อนแก้ไข ให้ตรวจสอบชื่อหน้าให้ถูกต้อง และหลีกเลี่ยงการลบหน้าที่ไม่แน่ใจว่าถูกใช้งานอยู่หรือไม่'}];
    return p;
  }
  function validateImport(raw) {
    if (!raw || raw.format !== '1dd-guide' || ![1, VERSION].includes(raw.version) || !Array.isArray(raw.projects) || raw.projects.length < 1 || raw.projects.length > 100) throw new Error('ไฟล์นี้ไม่ใช่ข้อมูลสำรอง 1DD Guide รุ่นที่รองรับ');
    let totalPages = 0, totalImages = 0;
    return raw.projects.map(p => {
      if (!p || !str(p.name,120).trim() || !Array.isArray(p.pages) || p.pages.length > 200) throw new Error('ข้อมูลโปรเจกต์ไม่ครบ หรือมีเนื้อหามากเกินไป');
      const out = project(str(p.name,120).trim(),safeURL(p.website),str(p.description,2000));
      if (p.logo && !logoURL(p.logo)) throw new Error('โลโก้ในไฟล์ไม่ถูกต้อง');
      if (p.logo !== undefined) out.logo = p.logo || '';
      if (p.logoText !== undefined) out.logoText = str(p.logoText,120).trim();
      totalImages += (out.logo || '').length;
      if (totalImages > 80000000) throw new Error('ข้อมูลภาพรวมเกิน 80 MB กรุณาแยกสำรองเป็นรายโปรเจกต์');
      out.color = colors.includes(p.color) ? p.color : colors[0];
      out.pages = p.pages.map(q => {
        if (!q || !str(q.title,160).trim() || !Array.isArray(q.steps) || q.steps.length > 100 || ++totalPages > 500) throw new Error('ข้อมูลเนื้อหาไม่ถูกต้อง');
        const np = {...page(str(q.title,160).trim()),description:str(q.description),url:safeURL(q.url),note:str(q.note)};
        if (q.extraImages !== undefined && !Array.isArray(q.extraImages)) throw new Error('ข้อมูลภาพเพิ่มเติมไม่ถูกต้อง');
        if ((q.extraImages || []).length > 19) throw new Error('หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ');
        const cleanFrame = f => {
          if (!f || !Array.isArray(f.steps) || f.steps.length > 100) throw new Error('ข้อมูลคำอธิบายภาพไม่ถูกต้อง');
          if (f.image && !imageURL(f.image)) throw new Error('รองรับภาพ PNG, JPEG และ WebP ที่ฝังอยู่ในไฟล์เท่านั้น');
          totalImages += (f.image || '').length;
          if (totalImages > 80000000) throw new Error('ข้อมูลภาพรวมเกิน 80 MB กรุณาแยกสำรองเป็นรายโปรเจกต์');
          const out = {...frame(), image:f.image || ''};
          if(typeof f.imageLabel==='string')out.imageLabel=str(f.imageLabel,80).trim();
          out.steps = f.steps.map(s => {
            if (s && s.x===null && s.y===null) return {id:uid(),x:null,y:null,title:str(s.title,200),text:str(s.text)};
            if (!s || typeof s.x !== 'number' || typeof s.y !== 'number' || !Number.isFinite(s.x) || !Number.isFinite(s.y) || s.x<0 || s.x>1 || s.y<0 || s.y>1) throw new Error('ตำแหน่งหมายเลขในไฟล์ไม่ถูกต้อง');
            return {id:uid(),x:s.x,y:s.y,title:str(s.title,200),text:str(s.text)};
          });
          if (f.highlights!==undefined && (!Array.isArray(f.highlights)||f.highlights.length>100)) throw new Error('ข้อมูลกรอบไฮไลท์ไม่ถูกต้อง');
          out.highlights=(f.highlights||[]).map(h=>{
            if (!h || !['x','y','width','height'].every(k=>typeof h[k]==='number'&&Number.isFinite(h[k])) || h.x<0 || h.y<0 || h.width<=0 || h.height<=0 || h.x+h.width>1.000001 || h.y+h.height>1.000001) throw new Error('ตำแหน่งกรอบไฮไลท์ไม่ถูกต้อง');
            return {id:uid(),x:h.x,y:h.y,width:h.width,height:h.height};
          });
          if (!out.image && (out.steps.some(placed)||out.highlights.length)) throw new Error('เนื้อหามีหมายเลขแต่ไม่มีภาพ');
          return out;
        };
        const first = cleanFrame(q);np.image=first.image;np.steps=first.steps;np.highlights=first.highlights;if(first.imageLabel!==undefined)np.imageLabel=first.imageLabel;
        np.extraImages = (q.extraImages || []).map(cleanFrame);
        return np;
      });
      return out;
    });
  }
  const pack = projects => ({format:'1dd-guide',version:VERSION,exportedAt:new Date().toISOString(),projects:copy(projects)});
  const filename = s => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().slice(0,90) || '1dd-guide';
  const api = {VERSION,uid,esc,copy,safeURL,websiteURL,placed,imageURL,logoURL,colors,page,frame,frames,project,starter,validateImport,pack,filename};
  root.GuideCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
