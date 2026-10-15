/* Editable starter content, ported from legacy/templates.js. Creating a template never contacts a customer's website. */
import { page as newPage, project as newProject, safeURL, uid, type Project } from "@/lib/guide-core";

type TemplatePage = { title: string; path: string; description: string; note: string };
export type Template = { id: string; name: string; platform: string; description: string; pages: TemplatePage[] };

const content = (title: string, path: string, description: string, note = ''): TemplatePage => ({title, path, description, note});
const wp = {
  login: content('เข้าสู่ระบบหลังบ้าน', '', '1. เปิดลิงก์หลังบ้านเว็บไซต์ แล้วเข้าสู่ระบบด้วยบัญชีที่ได้รับ\n2. ตรวจสอบชื่อเว็บไซต์บนแถบด้านบน\n3. เลือกเมนูที่ต้องการจากด้านซ้าย'),
  pages: content('จัดการหน้าเว็บไซต์', 'edit.php?post_type=page', '1. เปิด Pages แล้วเลือกหน้าที่ต้องการแก้ไข หรือเพิ่มหน้าใหม่\n2. ปรับชื่อ ข้อความ และรูปภาพ\n3. ดูตัวอย่างก่อนกด Publish หรือ Update', 'หน้าเว็บที่ใช้ Page Builder อาจมีปุ่มเปิดตัวแก้ไขเพิ่มเติม ให้ปรับคำอธิบายตามเว็บไซต์จริง'),
  media: content('อัปโหลดรูปและไฟล์', 'upload.php', '1. เปิด Media แล้วเพิ่มไฟล์จากเครื่อง\n2. ตั้งชื่อและข้อความอธิบายภาพให้สื่อความหมาย\n3. เลือกไฟล์นี้เมื่อเพิ่มรูปในหน้าเว็บหรือบทความ'),
  posts: content('เพิ่มและแก้ไขบทความ', 'edit.php', '1. เปิด Posts เพื่อเลือกบทความเดิม หรือสร้างบทความใหม่\n2. ใส่ชื่อ เนื้อหา รูปปก และหมวดหมู่\n3. ดูตัวอย่าง แล้วบันทึกฉบับร่างหรือเผยแพร่'),
  categories: content('จัดหมวดหมู่และแท็กบทความ', 'edit-tags.php?taxonomy=category', '1. เปิด Posts › Categories เพื่อเพิ่มหรือแก้ไขหมวดหมู่\n2. ใช้ Tags สำหรับคำสำคัญของบทความ\n3. กลับไปเลือกหมวดหมู่และแท็กในบทความที่เกี่ยวข้อง'),
  draft: content('บันทึกฉบับร่างและตั้งเวลาเผยแพร่', 'edit.php', '1. เปิดบทความที่กำลังจัดเตรียม\n2. บันทึกเป็นฉบับร่างระหว่างตรวจเนื้อหา\n3. เลือกวันที่เผยแพร่ ตรวจสอบเขตเวลาของเว็บไซต์ แล้วบันทึก'),
  menus: content('แก้ไขเมนูเว็บไซต์', 'themes.php', '1. เปิด Appearance แล้วเลือก Menus หรือ Editor ตามธีมที่ใช้\n2. เพิ่มลิงก์และจัดลำดับรายการเมนู\n3. บันทึก แล้วเปิดเว็บไซต์เพื่อตรวจสอบลิงก์บนคอมพิวเตอร์และมือถือ', 'ตำแหน่งเมนูขึ้นอยู่กับธีม ให้เปลี่ยนลิงก์หลังบ้านเป็นหน้าที่เว็บไซต์นี้ใช้งานจริง'),
  products: content('เพิ่มและแก้ไขสินค้า', 'edit.php?post_type=product', '1. เปิด Products แล้วเลือกสินค้าที่ต้องการ หรือเพิ่มสินค้าใหม่\n2. ใส่ชื่อ รายละเอียด รหัสสินค้า และราคาตามข้อมูลที่เตรียมไว้\n3. ดูตัวอย่าง แล้วกด Publish หรือ Update'),
  productImages: content('รูปสินค้าและแกลเลอรี', 'edit.php?post_type=product', '1. เปิดหน้าสินค้าที่ต้องการแก้ไข\n2. เลือกรูปหลักและเพิ่มรูปในแกลเลอรี\n3. จัดลำดับรูป แล้วบันทึกและตรวจสอบหน้าสินค้าจริง'),
  productCategories: content('หมวดหมู่สินค้า', 'edit-tags.php?taxonomy=product_cat&post_type=product', '1. เปิด Products › Categories\n2. เพิ่มชื่อหมวดหมู่และหมวดหมู่หลักตามโครงสร้างสินค้า\n3. เปิดสินค้าเพื่อเลือกหมวดหมู่ที่เกี่ยวข้อง แล้วบันทึก'),
  stock: content('ราคาและสต็อกสินค้า', 'edit.php?post_type=product', '1. เปิดสินค้าแล้วตรวจสอบข้อมูลราคาและ Inventory\n2. ปรับราคา จำนวนคงเหลือ หรือสถานะสินค้าตามที่ร้านใช้งาน\n3. บันทึก แล้วตรวจสอบข้อมูลบนหน้าร้าน'),
  orders: content('ตรวจสอบและจัดการออเดอร์', 'admin.php?page=wc-orders', '1. เปิด WooCommerce › Orders และเลือกออเดอร์\n2. ตรวจสอบรายการสินค้า สถานะการชำระเงิน และข้อมูลจัดส่ง\n3. เมื่อดำเนินการแล้ว ให้ปรับสถานะตามขั้นตอนของร้านและบันทึก', 'บางเว็บไซต์ใช้หน้ารายการออเดอร์รุ่นเดิม ให้คัดลอก URL จากเมนู Orders ของเว็บไซต์มาแทน'),
  catalog: content('รายละเอียดสินค้าและข้อมูลติดต่อ', 'edit.php?post_type=product', '1. เปิดสินค้าที่ต้องการแก้ไขข้อมูล\n2. เพิ่มคุณสมบัติ ขนาด หรือเอกสารประกอบตามช่องที่เว็บไซต์เตรียมไว้\n3. ตรวจสอบช่องทางสอบถามสินค้า แล้วบันทึกและดูตัวอย่าง', 'เทมเพลตนี้อ้างอิงเมนูสินค้า WooCommerce หากใช้ปลั๊กอินแค็ตตาล็อกอื่น ให้ปรับชื่อเมนูและ URL ให้ตรงกับเว็บไซต์')
};
const shopify = [
  content('เข้าสู่ระบบ Shopify', '', '1. เข้าสู่ Shopify admin ด้วยบัญชีของคุณ\n2. เลือกร้านที่ต้องการจัดการ\n3. ใช้เมนูด้านซ้ายเพื่อเปิดส่วนสินค้า ออเดอร์ หรือเนื้อหา'),
  content('เพิ่มและแก้ไขสินค้า', '', '1. เปิด Products แล้วเลือกสินค้า หรือกด Add product\n2. ใส่ชื่อ รายละเอียด รูปภาพ ราคา และข้อมูลสต็อก\n3. ตรวจสอบสถานะการขายและช่องทางเผยแพร่ แล้วกด Save'),
  content('จัดกลุ่มสินค้าด้วย Collections', '', '1. เปิด Products › Collections\n2. เลือกคอลเลกชันเดิม หรือสร้างกลุ่มสินค้าใหม่\n3. จัดสินค้าและเงื่อนไขของกลุ่มตามที่ร้านต้องการ แล้วบันทึก'),
  content('ตรวจสอบออเดอร์', '', '1. เปิด Orders และเลือกออเดอร์ที่ต้องการ\n2. ตรวจสอบสินค้า สถานะการชำระเงิน และข้อมูลลูกค้า\n3. ดำเนินการจัดส่งตามขั้นตอนของร้าน แล้วบันทึกข้อมูลที่เกี่ยวข้อง'),
  content('แก้ไขหน้าเว็บไซต์', '', '1. เปิด Online Store › Pages\n2. เลือกหน้าเดิม หรือกด Add page แล้วใส่ชื่อและเนื้อหา\n3. ตรวจสอบการมองเห็นของหน้า กด Save แล้วดูตัวอย่าง'),
  content('ปรับหน้าแรกและรูปแบนเนอร์', '', '1. เปิด Online Store › Themes แล้วเปิดตัวแก้ไขของธีมที่ใช้งาน\n2. เลือกส่วนหน้าแรกที่ต้องการแก้ข้อความหรือรูปภาพ\n3. ดูตัวอย่างทั้งคอมพิวเตอร์และมือถือก่อนบันทึก', 'ชื่อส่วนและตัวเลือกขึ้นอยู่กับธีมที่ติดตั้ง')
];
export const templates: Template[] = [
  {id:'new', name:'New project', platform:'เริ่มว่าง', description:'', pages:[]},
  {id:'corporate', name:'Corporate', platform:'WordPress', description:'คู่มือดูแลเว็บไซต์องค์กรและอัปเดตเนื้อหาประจำวัน', pages:[wp.login,wp.pages,wp.media,wp.posts,wp.menus]},
  {id:'woocommerce', name:'WooCommerce', platform:'WordPress + WooCommerce', description:'คู่มือจัดการสินค้าและออเดอร์สำหรับร้านค้า WooCommerce', pages:[wp.login,wp.products,wp.productImages,wp.productCategories,wp.stock,wp.orders]},
  {id:'shopify', name:'Shopify', platform:'Shopify', description:'คู่มือดูแลร้านค้า สินค้า ออเดอร์ และหน้าเว็บไซต์บน Shopify', pages:shopify},
  {id:'catalog', name:'Product Catalog', platform:'WordPress + WooCommerce', description:'คู่มือดูแลแค็ตตาล็อกสินค้า รูปภาพ และรายละเอียดสินค้า', pages:[wp.login,wp.products,wp.productImages,wp.productCategories,wp.catalog]},
  {id:'article', name:'Article', platform:'WordPress', description:'คู่มือเขียน จัดหมวดหมู่ และเผยแพร่บทความบนเว็บไซต์', pages:[wp.login,wp.posts,wp.categories,wp.media,wp.draft]}
];
export function adminURL(website: string, path: string) {
  const safe = safeURL(website);
  if (!safe) return '';
  const url = new URL(safe);
  // Accept a site root, a WordPress installation in a subfolder, or an existing admin URL.
  const base = url.pathname.split(/\/wp-admin(?:\/|$)|\/wp-login\.php(?:\/|$)/)[0];
  url.pathname = base.replace(/\/+$/, '') + '/wp-admin/';
  url.search = ''; url.hash = '';
  return new URL(path, url).href;
}
export function createFromTemplate(id: string, name: string, website = ''): Project {
  const template = templates.find(t=>t.id===id);
  if (!template) throw new Error('กรุณาเลือกเทมเพลตที่รองรับ');
  const project = newProject(name, safeURL(website), template.description);
  project.pages = template.pages.map(item => ({...newPage(item.title), description:'', note:item.note, steps:item.description.split('\n').filter(Boolean).map((line: string, n: number)=>({id:uid(),x:null,y:null,title:'ขั้นตอนที่ '+(n+1),text:line.replace(/^\d+\.\s*/, '')})),
    url:id==='shopify'?'https://admin.shopify.com/':adminURL(website,item.path)}));
  return project;
}
