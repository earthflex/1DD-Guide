# 1DD Guide

ระบบสร้างคู่มือเว็บไซต์สำหรับลูกค้า พร้อมภาพหน้าจอ หมายเลข Point กรอบไฮไลท์ และคำอธิบาย รองรับ HTML แบบอ่านอย่างเดียว และ PDF ขนาด A4 แนวนอนพร้อมหน้าปกและโลโก้ลูกค้า

เว็บนี้เป็น HTML / CSS / JavaScript แบบ static เปิดใช้งานได้โดยไม่ต้องติดตั้ง dependency หรือสั่ง build

## อัปโหลดเข้า GitHub

1. แตกไฟล์ ZIP นี้
2. สร้าง repository ของคุณ แล้วเลือก **Add file → Upload files**
3. อัปโหลดไฟล์และโฟลเดอร์ภายในชุดนี้ โดยให้ `index.html`, `README.md` และ `vercel.json` อยู่ระดับบนสุดของ repository
4. Commit ไฟล์ ไม่ต้องอัปโหลด ZIP ทั้งก้อนลง repository

ถ้าใช้ Git บนเครื่อง ให้เปิด Terminal ในโฟลเดอร์ที่มี `index.html` แล้วใช้คำสั่งต่อไปนี้ โดยแทน `YOUR-USER/YOUR-REPOSITORY` ด้วย repository ที่สร้างไว้:

```sh
git init
git add .
git commit -m "Add 1DD Guide"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
git push -u origin main
```

## เชื่อม Vercel

Import repository นี้ โดยตั้งค่า:

| รายการ | ค่า |
| --- | --- |
| Root Directory | ระดับบนสุดของ repository (`.`) |
| Framework Preset | Other |
| Build Command | เว้นว่าง |
| Install Command | เว้นว่าง |
| Output Directory | `.` |

มี `vercel.json` เตรียมไว้แล้ว เว็บใช้ hash routing จึงไม่ต้องเพิ่ม rewrite สำหรับแต่ละหน้า

เมื่อเผยแพร่แล้ว:

- `/` — ตัวแก้ไขคู่มือ
- `/preview.html` — ตัวอย่าง HTML แบบลูกค้า
- `/preview.pdf` — ตัวอย่าง PDF A4 แนวนอน

## เปิดบนเครื่อง

จากโฟลเดอร์ที่มี `index.html` รัน:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

เปิด <http://localhost:4173/> ไม่แนะนำให้เปิดตัวแก้ไขผ่าน `file://`

## ข้อมูลโปรเจกต์และคลาวด์

ค่าเริ่มต้นบันทึกโปรเจกต์ใน IndexedDB ของเบราว์เซอร์นั้น ไฟล์ source ใน repository ไม่รวมโปรเจกต์ที่คุณสร้างไว้บน localhost

เมื่อต้องการย้ายงานเดิมไป URL ใหม่ ให้เปิดเว็บเดิมแล้วเลือก **เพิ่มเติม → สำรองข้อมูลทั้งหมด** จากนั้นนำเข้าไฟล์สำรองที่เว็บใหม่

`config.js` ยังเว้นค่าการเชื่อม Supabase ว่างไว้ จึงใช้งานแบบบันทึกในเครื่องได้ทันที หากต้องการทำงานร่วมกันหลายเครื่อง ให้ตั้งค่า Supabase ตาม [คู่มือภาษาไทย](README-TH.md#เปิดใช้คลาวด์ครั้งแรก) ใช้เฉพาะ publishable/anon key ในเว็บ

## โครงสร้าง

```text
index.html                 หน้าเว็บหลัก
styles.css                 รูปแบบและหน้าตา
app.js                     ตัวแก้ไขคู่มือ
core.js                    โมเดลและตรวจข้อมูล
viewer.js                  HTML ลูกค้าและเลย์เอาต์ PDF
templates.js               เทมเพลตเริ่มต้น
cloud.js / config.js       การเชื่อม Supabase
assets/                    โลโก้ ฟอนต์ และภาพเริ่มต้น
supabase/setup.sql         โครงสร้างฐานข้อมูลและสิทธิ์
1dd-capture-extension/     ส่วนขยาย Chrome สำหรับจับภาพ (เลือกใช้)
preview.html / preview.pdf ตัวอย่างคู่มือ
vercel.json                ตั้งค่าโฮสต์
```

รายละเอียดการใช้โลโก้ รูปภาพ เทมเพลต การส่งออก และการตั้งค่าคลาวด์อยู่ใน [README-TH.md](README-TH.md)

ฟอนต์ Google Sans ใช้ SIL Open Font License ดู [ใบอนุญาตฟอนต์](assets/GOOGLE-SANS-LICENSE.txt)
