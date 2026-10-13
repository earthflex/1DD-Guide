# 1DD Guide

เว็บสร้างคู่มือการใช้งานเว็บไซต์ให้ลูกค้า: ภาพหน้าจอ + หมายเลข Point + คำอธิบาย แล้วส่งออก HTML / PDF หรือเผยแพร่เป็นลิงก์

Next.js (App Router) + shadcn/ui + Supabase (Auth, Postgres, Storage)

## เริ่มใช้งานในเครื่อง
```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase
npm run dev                  # http://localhost:3000
```

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (เปิดเผยได้ ใช้คู่กับ RLS) |
| `SUPABASE_SECRET_KEY` | **ใช้ฝั่ง server เท่านั้น** สร้างบัญชีสมาชิก, รายชื่อบัญชี, ลบ Workspace/ไฟล์ ห้ามใส่ `NEXT_PUBLIC_` |

## ตั้งค่า Supabase
1. รัน [`supabase/setup.sql`](supabase/setup.sql) ทั้งไฟล์ใน SQL Editor (รันซ้ำได้ ไม่ลบข้อมูล)
2. Authentication → ปิด **Allow new users to sign up** (บัญชีสร้างจากหน้า "สมาชิก" ในแอป)
3. URL Configuration → Site URL เป็นโดเมนจริง และเพิ่ม Redirect URLs ของโดเมน / Preview

## Deploy (Vercel)
- ใส่ env ทั้ง 3 ตัวใน Vercel (Production + Preview) แล้ว push — Vercel build ด้วย `npm run build`
- `prebuild` สร้าง `public/1dd-capture-extension.zip` จากโฟลเดอร์ `1dd-capture-extension/`
- ลิงก์คู่มือเดิมแบบ `/?guide=<token>` ถูกพาไป `/g/<token>` อัตโนมัติ

## โครงสร้าง
| path | หน้าที่ |
|---|---|
| `app/` | หน้าเว็บ: login, workspaces, `/w/[wid]` (โปรเจกต์, แก้ไข, คลังไฟล์, กิจกรรม, สมาชิก, ตั้งค่า), `/g/[token]` คู่มือลูกค้า, `/system` ภาพรวมระบบ |
| `lib/guide-core.ts` | รูปแบบข้อมูลและการตรวจไฟล์นำเข้า (ตรงกับเว็บเดิม) |
| `lib/cloud.ts`, `lib/store.ts` | โหลด/บันทึก Workspace, บันทึกอัตโนมัติ, กันบันทึกทับ (409), signed URL ของรูป |
| `lib/viewer/` | สร้าง HTML คู่มือแบบไฟล์เดียว (ส่งออก, พิมพ์ PDF, ลิงก์เผยแพร่) |
| `1dd-capture-extension/` | ส่วนขยาย Chrome สำหรับจับภาพส่งเข้า Guide |
| `legacy/` | เว็บรุ่นเดิม (vanilla JS) เก็บไว้อ้างอิง |

## ตรวจโค้ด
```bash
npm run typecheck && npm run lint && npm run build
```
