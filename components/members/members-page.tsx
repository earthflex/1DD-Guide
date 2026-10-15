"use client";

import { Crown, KeyRound, Loader2, Mail, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { NewPasswordField } from "@/components/auth/new-password-field";
import { confirmDialog } from "@/components/confirm";
import { ChangePasswordForm } from "@/components/members/change-password-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addExistingMember, addMemberWithPassword, listTeamUsers, resetMemberPassword, type TeamUser } from "@/lib/member-actions";
import { logActivity } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Member = { user_id: string; email: string };
type Data = { users: TeamUser[]; invites: { email: string }[]; me: string; myEmail: string; isOwner: boolean };
type Filter = "all" | "in" | "out";

async function fetchData(wid: string): Promise<Data> {
  const supabase = createClient();
  const [{ data: claims }, result, invites] = await Promise.all([
    supabase.auth.getClaims(),
    listTeamUsers(wid),
    supabase.from("guide_invites").select("email").eq("workspace_id", wid),
  ]);
  if (!result.ok) throw new Error(result.error);
  const rank = (u: TeamUser) => (u.role === "owner" ? 0 : u.role === "editor" ? 1 : 2);
  const users = result.users.sort((x, y) => rank(x) - rank(y) || x.email.localeCompare(y.email));
  return { users, invites: invites.data ?? [], me: result.me, myEmail: String(claims?.claims.email ?? ""), isOwner: result.isOwner };
}

const formatDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "ยังไม่เคย";

export function MembersPage() {
  const wid = useWorkspace((s) => s.wid)!;
  const workspaceName = useWorkspace((s) => s.name);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [reset, setReset] = useState<Member | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = () => fetchData(wid).then(setData, (e: Error) => setError(e.message));
  useEffect(() => {
    fetchData(wid).then(setData, (e: Error) => setError(e.message));
  }, [wid]);

  const isOwner = !!data?.isOwner;
  const inWorkspace = data?.users.filter((u) => u.role).length ?? 0;
  const owners = data?.users.filter((u) => u.role === "owner").length ?? 0;
  const q = query.trim().toLowerCase();
  const visible = (data?.users ?? []).filter((u) =>
    (filter === "all" || (filter === "in" ? !!u.role : !u.role)) && (!q || u.email.toLowerCase().includes(q)));

  async function rpc(name: string, args: Record<string, string>) {
    const { error } = await createClient().rpc(name, args);
    if (error) throw new Error(error.message);
    await load();
  }
  async function setRole(u: TeamUser, role: "owner" | "editor") {
    const self = u.id === data?.me;
    const ok = role === "owner"
      ? await confirmDialog("ตั้งเป็นเจ้าของ", `${u.email} จะจัดการสมาชิก ตั้งค่า และลบ ${workspaceName} ได้เหมือนคุณ`, "ตั้งเป็นเจ้าของ")
      : await confirmDialog(self ? "สละสิทธิ์เจ้าของ" : "เปลี่ยนเป็นผู้แก้ไข",
        self ? `คุณจะยังแก้ไขโปรเจกต์ได้ แต่จัดการสมาชิกและตั้งค่า ${workspaceName} ไม่ได้อีก จนกว่าเจ้าของคนอื่นจะตั้งให้` : `${u.email} จะยังแก้ไขโปรเจกต์ได้ แต่จัดการสมาชิกและตั้งค่า Workspace ไม่ได้`,
        self ? "สละสิทธิ์" : "เปลี่ยนเป็นผู้แก้ไข", true);
    if (!ok) return;
    try {
      await rpc("guide_set_member_role", { wid, member_id: u.id, new_role: role });
      logActivity("change_role", { detail: `${u.email} เป็น${role === "owner" ? "เจ้าของ" : "ผู้แก้ไข"}` });
      toast.success(role === "owner" ? `${u.email} เป็นเจ้าของแล้ว` : self ? "สละสิทธิ์เจ้าของแล้ว" : `${u.email} เป็นผู้แก้ไขแล้ว`);
    } catch (e) {
      const message = (e as Error).message;
      toast.error(/at least one owner/i.test(message) ? "Workspace ต้องมีเจ้าของอย่างน้อย 1 คน"
        : /Could not find the function|does not exist/i.test(message) ? "ยังไม่ได้เปิดใช้เจ้าของหลายคน ผู้ดูแลต้องรัน supabase/setup.sql ล่าสุดใน Supabase ก่อน" : message);
    }
  }
  async function addToWorkspace(u: TeamUser) {
    const result = await addExistingMember(wid, u.id);
    if (!result.ok) return void toast.error(result.error);
    await load();
    toast.success(`เพิ่ม ${u.email} เข้า ${workspaceName} แล้ว`);
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">สมาชิก</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `บัญชีในระบบ ${data.users.length} คน · อยู่ใน ${workspaceName} ${inWorkspace} คน${data.invites.length ? ` · รอเข้าสู่ระบบ ${data.invites.length} คน` : ""}` : "กำลังโหลด…"}
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {isOwner && <AddMember wid={wid} onAdded={load} />}

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-wrap items-center gap-3 border-b py-4">
          <CardTitle className="mr-auto text-base">บัญชีทั้งหมดในระบบ</CardTitle>
          <label className="relative w-full max-w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาอีเมล…" aria-label="ค้นหาสมาชิก" className="h-8 pl-9" />
          </label>
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="กรองสมาชิก">
            <ToggleGroupItem value="all">ทั้งหมด</ToggleGroupItem>
            <ToggleGroupItem value="in">ใน Workspace นี้</ToggleGroupItem>
            <ToggleGroupItem value="out">ยังไม่อยู่</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="p-0">
          {!data ? (
            <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <ul className="divide-y">
              {visible.map((u) => (
                <li key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !u.role && "bg-muted/30")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-medium uppercase", u.role ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground")}>{u.email[0]}</span>
                  <span className="grid min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <strong className="truncate text-sm font-medium">{u.email}</strong>
                      {u.id === data.me && <Badge variant="secondary">คุณ</Badge>}
                      {u.role === "owner" && <Badge className="bg-brand text-brand-foreground">เจ้าของ</Badge>}
                      {u.role === "editor" && <Badge variant="outline">ผู้แก้ไข</Badge>}
                      {!u.role && <Badge variant="outline" className="text-muted-foreground">ไม่ได้อยู่ใน Workspace นี้</Badge>}
                    </span>
                    <small className="text-xs text-muted-foreground">
                      เข้าระบบล่าสุด {formatDate(u.lastSignIn)} · อยู่ใน {u.workspaces} Workspace · สร้างบัญชี {formatDate(u.createdAt)}
                    </small>
                  </span>
                  {isOwner && u.role === "owner" && (u.id !== data.me || owners > 1) && (
                    <Button variant="ghost" size="sm" onClick={() => setRole(u, "editor")}>
                      <UserMinus />{u.id === data.me ? "สละสิทธิ์เจ้าของ" : "เปลี่ยนเป็นผู้แก้ไข"}
                    </Button>
                  )}
                  {isOwner && u.role !== "owner" && (
                    <span className="flex flex-wrap gap-1">
                      {u.role === "editor" && (
                        <Button variant="outline" size="sm" onClick={() => setRole(u, "owner")}><Crown />ตั้งเป็นเจ้าของ</Button>
                      )}
                      {u.managed && (
                        <Button variant="outline" size="sm" onClick={() => setReset({ user_id: u.id, email: u.email })}><KeyRound />ตั้งรหัสผ่านใหม่</Button>
                      )}
                      {!u.role ? (
                        <Button size="sm" onClick={() => addToWorkspace(u)}><UserPlus />เพิ่มเข้า Workspace</Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async () => {
                          if (await confirmDialog("นำสมาชิกออก", `${u.email} จะเปิดหรือแก้ไข ${workspaceName} ไม่ได้อีก บัญชียังอยู่และใช้กับ Workspace อื่นได้`, "นำออก", true))
                            rpc("guide_remove_member", { wid, member_id: u.id }).then(() => { logActivity("remove_member", { detail: u.email }); toast.success("นำสมาชิกออกแล้ว"); }, (e: Error) => toast.error(e.message));
                        }}><Trash2 />นำออก</Button>
                      )}
                    </span>
                  )}
                </li>
              ))}
              {filter !== "out" && !q && data.invites.map((m) => (
                <li key={m.email} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Mail className="size-4" /></span>
                  <span className="grid min-w-0 flex-1">
                    <strong className="truncate text-sm font-medium">{m.email}</strong>
                    <small className="text-xs text-muted-foreground">คำเชิญรอเข้าสู่ระบบครั้งแรก</small>
                  </span>
                  {isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => rpc("guide_cancel_invite", { wid, member_email: m.email }).then(() => { logActivity("cancel_invite", { detail: m.email }); toast.success("ยกเลิกคำเชิญแล้ว"); }, (e: Error) => toast.error(e.message))}>
                      <X />ยกเลิกคำเชิญ
                    </Button>
                  )}
                </li>
              ))}
              {!visible.length && <li className="px-4 py-10 text-center text-sm text-muted-foreground">ไม่พบบัญชีตามตัวกรองนี้</li>}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">บัญชีของฉัน</CardTitle>
          <CardDescription>{data?.myEmail || "\u00a0"}</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm"><ChangePasswordForm /></CardContent>
      </Card>

      <Dialog open={!!reset} onOpenChange={(v) => !v && setReset(null)}>
        <DialogContent>
          {reset && <ResetPassword wid={wid} member={reset} onDone={() => { setReset(null); void load(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddMember({ wid, onAdded }: { wid: string; onAdded: () => Promise<void> }) {
  const [round, setRound] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setPending(true);
    setError("");
    try {
      const result = await addMemberWithPassword(wid, String(values.get("email")), String(values.get("password")));
      if (!result.ok) throw new Error(result.error);
      await onAdded();
      form.reset();
      setRound((r) => r + 1);
      if (result.created) toast.success("สร้างบัญชีและเพิ่มสมาชิกแล้ว ส่งอีเมลและรหัสผ่านให้สมาชิกได้เลย");
      else toast.info("อีเมลนี้มีบัญชีอยู่แล้ว ระบบเพิ่มสิทธิ์ให้ สมาชิกใช้รหัสผ่านเดิมเข้าสู่ระบบ");
    } catch (e) { setError((e as Error).message); }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="size-4 text-brand" />เพิ่มสมาชิก</CardTitle>
        <CardDescription>สร้างบัญชีให้ทันที แล้วส่งอีเมลและรหัสผ่านให้สมาชิกเอง ถ้าอีเมลนี้มีบัญชีอยู่แล้ว ระบบจะเพิ่มสิทธิ์โดยไม่เปลี่ยนรหัสผ่านเดิม</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid items-end gap-3 sm:grid-cols-[1fr_1.3fr_auto]">
          <div className="grid gap-2">
            <Label htmlFor="member-email">อีเมล</Label>
            <Input id="member-email" type="email" name="email" required autoComplete="off" placeholder="name@example.com" />
          </div>
          <NewPasswordField key={round} id="member-password" name="password" />
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}เพิ่มสมาชิก</Button>
        </form>
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}

function ResetPassword({ wid, member, onDone }: { wid: string; member: Member; onDone: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password"));
    if (password !== String(values.get("confirm"))) return setError("ยืนยันรหัสผ่านไม่ตรงกัน");
    setPending(true);
    const result = await resetMemberPassword(wid, member.user_id, password);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success(`ตั้งรหัสผ่านใหม่ให้ ${member.email} แล้ว`);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>ตั้งรหัสผ่านใหม่</DialogTitle>
        <DialogDescription>สำหรับ {member.email} — ส่งรหัสผ่านใหม่ให้สมาชิกเอง</DialogDescription>
      </DialogHeader>
      <NewPasswordField id="reset-password" name="password" label="รหัสผ่านใหม่" confirmName="confirm" confirmLabel="ยืนยันรหัสผ่านใหม่" autoFocus />
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>ยกเลิก</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}บันทึกรหัสผ่าน</Button>
      </div>
    </form>
  );
}
