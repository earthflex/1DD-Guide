"use client";

/** Publish status per project (from guide_publication_status) and viewing-password changes. */
import { create } from "zustand";
import { logActivity } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export type Publication = {
  token: string; slug: string | null; updatedAt: string; hasPassword: boolean;
  /** Customer opens (team members' own views are not counted). */
  views: number; lastViewedAt: string | null; expiresAt: string | null;
};

type Row = {
  project_id: string; token: string; slug: string | null; updated_at: string; has_password: boolean;
  view_count?: number; last_viewed_at?: string | null; expires_at?: string | null;
};

export const isExpired = (pub: Pick<Publication, "expiresAt">, now = Date.now()) => !!pub.expiresAt && Date.parse(pub.expiresAt) <= now;

type State = {
  wid: string | null;
  /** null until loaded; "unavailable" when publication-password.sql has not been run yet. */
  status: Map<string, Publication> | null | "unavailable";
};

export const usePublications = create<State>()(() => ({ wid: null, status: null }));

export async function loadPublications(wid: string) {
  const { data, error } = await createClient().rpc("guide_publication_status", { wid });
  if (error) {
    usePublications.setState({ wid, status: "unavailable" });
    return;
  }
  const map = new Map<string, Publication>();
  for (const r of (data ?? []) as Row[])
    map.set(r.project_id, {
      token: r.token, slug: r.slug ?? null, updatedAt: r.updated_at, hasPassword: r.has_password,
      views: Number(r.view_count ?? 0), lastViewedAt: r.last_viewed_at ?? null, expiresAt: r.expires_at ?? null,
    });
  usePublications.setState({ wid, status: map });
}

/** Share link: the readable slug when set, otherwise the random token. */
export const shareURL = (pub: Pick<Publication, "token" | "slug">) => `${location.origin}/g/${pub.slug || pub.token}`;

/** 3–60 chars: a–z, 0–9 and inner hyphens. Mirrors the database check. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

/** Suggest a slug from the customer's website host or the project name (ASCII only). */
export function suggestSlug(name: string, website: string) {
  let base = "";
  try { base = new URL(website).hostname.replace(/^www\./, "").split(".")[0]; } catch {}
  if (!base) base = name.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
  const s = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return s.length >= 2 ? `${s}-guide` : "";
}

export async function setPublicationSlug(pid: string, slug: string | null) {
  const wid = useWorkspace.getState().wid;
  const { error } = await createClient().rpc("guide_set_publication_slug", { wid, pid, new_slug: slug });
  if (error) {
    if (/already used/i.test(error.message)) throw new Error("ชื่อลิงก์นี้มีคู่มืออื่นใช้แล้ว กรุณาเลือกชื่ออื่น");
    if (/3-60/.test(error.message)) throw new Error("ใช้ a-z, 0-9 และ - ได้ 3–60 ตัวอักษร ห้ามขึ้นต้นหรือลงท้ายด้วย -");
    if (/function .*does not exist|Could not find the function/i.test(error.message))
      throw new Error("ยังไม่ได้เปิดใช้ชื่อลิงก์ ผู้ดูแลต้องรัน supabase/setup.sql ล่าสุดใน Supabase ก่อน");
    throw new Error(error.message);
  }
  const name = useWorkspace.getState().projects.find((p) => p.id === pid)?.name;
  logActivity("update_project", { pid, projectName: name, detail: slug ? `ตั้งชื่อลิงก์ /g/${slug}` : "ยกเลิกชื่อลิงก์" });
  if (wid) await loadPublications(wid);
}

/** Status of one project, or undefined if unknown/unpublished. */
export function usePublication(pid: string) {
  return usePublications((s) => (s.status instanceof Map ? s.status.get(pid) : undefined));
}

export async function setPublicationPassword(pid: string, password: string | null) {
  const wid = useWorkspace.getState().wid;
  const { error } = await createClient().rpc("guide_set_publication_password", { wid, pid, pass: password });
  if (error) {
    if (/function .*does not exist|Could not find the function/i.test(error.message))
      throw new Error("ยังไม่ได้เปิดใช้รหัสผ่านลิงก์ ผู้ดูแลต้องรันไฟล์ supabase/publication-password.sql ใน Supabase ก่อน");
    throw new Error(error.message);
  }
  const name = useWorkspace.getState().projects.find((p) => p.id === pid)?.name;
  logActivity("update_project", { pid, projectName: name, detail: password ? "ตั้งรหัสผ่านลิงก์คู่มือ" : "ยกเลิกรหัสผ่านลิงก์คู่มือ" });
  if (wid) await loadPublications(wid);
}

/** Set (ISO date-time in the future) or clear (null) when the link stops opening. */
export async function setPublicationExpiry(pid: string, expires: string | null) {
  const wid = useWorkspace.getState().wid;
  const { error } = await createClient().rpc("guide_set_publication_expiry", { wid, pid, expires });
  if (error) {
    if (/future/i.test(error.message)) throw new Error("วันหมดอายุต้องเป็นวันในอนาคต");
    if (/function .*does not exist|Could not find the function/i.test(error.message))
      throw new Error("ยังไม่ได้เปิดใช้วันหมดอายุลิงก์ ผู้ดูแลต้องรัน supabase/setup.sql ล่าสุดใน Supabase ก่อน");
    throw new Error(error.message);
  }
  const name = useWorkspace.getState().projects.find((p) => p.id === pid)?.name;
  const label = expires ? new Date(expires).toLocaleDateString("th-TH", { dateStyle: "medium" }) : "";
  logActivity("update_project", { pid, projectName: name, detail: expires ? `ตั้งให้ลิงก์หมดอายุ ${label}` : "ยกเลิกวันหมดอายุลิงก์" });
  if (wid) await loadPublications(wid);
}
