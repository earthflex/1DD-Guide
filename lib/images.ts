/** Image helpers ported from legacy/app.js: decode, shrink to WebP, read files, capture the screen, redact. */
import { imageData, signedUrl } from "@/lib/cloud";
import { logoURL, type Frame } from "@/lib/guide-core";

const MAX_IMAGE_WIDTH = 1920, IMAGE_QUALITY = 0.85;

export function decodeImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.naturalWidth * img.naturalHeight > 40000000
      ? reject(new Error("ภาพใหญ่เกิน 40 ล้านพิกเซล กรุณาย่อภาพก่อน"))
      : resolve(img);
    img.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ภาพนี้ได้"));
    img.src = src;
  });
}

/** Shrink screenshots before saving: cap width, re-encode as WebP, keep the original if that is not smaller. */
export async function optimizeImage(data: string) {
  const img = await decodeImage(data), scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const out = c.toDataURL("image/webp", IMAGE_QUALITY);
  return out.startsWith("data:image/webp") && out.length < data.length ? out : data;
}

const fileData = (file: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
  r.readAsDataURL(file);
});

export async function imageFromFile(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 12000000)
    throw new Error("กรุณาใช้ภาพ PNG, JPG หรือ WebP ขนาดไม่เกิน 12 MB");
  const data = await fileData(file);
  await decodeImage(data);
  return data;
}

export class CaptureCancelled extends Error {}

/** Capture a browser tab or window as a PNG data URL. */
export async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia)
    throw new Error("เบราว์เซอร์นี้จับภาพไม่ได้ กรุณาเปิดผ่าน HTTPS ใน Chrome/Edge บนคอมพิวเตอร์ หรืออัปโหลดภาพแทน");
  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" }, audio: false, selfBrowserSurface: "exclude",
    } as DisplayMediaStreamOptions);
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ไม่ได้รับภาพจากหน้าจอ")), 8000);
      const done = () => { clearTimeout(timeout); resolve(); };
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(done);
      else setTimeout(done, 400);
    });
    if (!video.videoWidth) throw new Error("ไม่ได้รับภาพจากหน้าจอ");
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    video.srcObject = null;
    return c.toDataURL("image/png");
  } catch (e) {
    const name = (e as Error).name;
    if (name === "NotAllowedError" || name === "AbortError") throw new CaptureCancelled("ยกเลิกการจับภาพแล้ว");
    throw e;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

/** The frame image as a data URL, downloading it from Storage if needed. */
export const frameData = (f: Pick<Frame, "image" | "_imagePath">) =>
  f.image ? Promise.resolve(f.image) : f._imagePath ? imageData(f._imagePath) : Promise.reject(new Error("ไม่มีภาพ"));

/** Data URL of one of a frame's images: 1 = left/only, 2 = right image of a pair. */
export const slotData = (f: Pick<Frame, "image" | "_imagePath" | "image2" | "_imagePath2">, slot: 1 | 2) =>
  slot === 1 ? frameData(f) : frameData({ image: f.image2 ?? "", _imagePath: f._imagePath2 });

/** Height/width ratio of an image given as a data URL or a Storage path. */
export async function imageRatio(image?: string, path?: string) {
  const src = image || (path ? await signedUrl(path) : "");
  if (!src) throw new Error("ไม่มีภาพ");
  const img = await decodeImage(src);
  return img.naturalHeight / img.naturalWidth;
}

/** Paint a solid box into the image pixels. Rect is in 0–1 image coordinates. */
export async function redact(src: string, r: { x: number; y: number; width: number; height: number }) {
  const img = await decodeImage(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#202823";
  ctx.fillRect(Math.floor(r.x * c.width), Math.floor(r.y * c.height), Math.ceil(r.width * c.width) + 2, Math.ceil(r.height * c.height) + 2);
  return c.toDataURL("image/webp", IMAGE_QUALITY);
}

/** Client logo from an SVG or PNG file, flattened to a 600×600 PNG data URL. */
export async function logoFromFile(file: File) {
  if (file.size > 5000000) throw new Error("กรุณาใช้โลโก้ SVG หรือ PNG ขนาดไม่เกิน 5 MB");
  const svg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (!svg && file.type !== "image/png" && !/\.png$/i.test(file.name)) throw new Error("รองรับโลโก้ SVG หรือ PNG เท่านั้น");
  let data: string;
  if (svg) {
    const text = await file.text(), doc = new DOMParser().parseFromString(text, "image/svg+xml");
    if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg" || /<!DOCTYPE|<!ENTITY/i.test(text) || doc.querySelector("script,foreignObject"))
      throw new Error("อ่าน SVG นี้ไม่ได้ กรุณาใช้ SVG ที่ฝังรูปครบ หรือใช้ PNG");
    for (const el of doc.querySelectorAll("*")) for (const attr of el.attributes) {
      if (/^on/i.test(attr.name) || (attr.localName === "href" && !/^(#|data:image\/(png|jpeg|webp);base64,)/i.test(attr.value.trim())))
        throw new Error("กรุณาใช้ SVG ที่ไม่มีสคริปต์หรือลิงก์รูปภายนอก");
    }
    if (/@import/i.test(text) || Array.from(text.matchAll(/url\(([^)]*)\)/gi)).some((m) => !m[1].trim().replace(/^['"]|['"]$/g, "").startsWith("#")))
      throw new Error("กรุณาใช้ SVG ที่ไม่มีลิงก์รูปภายนอก");
    // Loaded only as an image, never inserted as SVG markup into the document.
    data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(doc));
  } else data = await fileData(file);
  const img = await decodeImage(data), canvas = document.createElement("canvas");
  canvas.width = canvas.height = 600;
  const scale = Math.min(600 / img.naturalWidth, 600 / img.naturalHeight), w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  canvas.getContext("2d")!.drawImage(img, 0, (600 - h) / 2, w, h);
  const png = canvas.toDataURL("image/png");
  if (!logoURL(png)) throw new Error("โลโก้มีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กลง");
  return png;
}
