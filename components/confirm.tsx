"use client";

import { create } from "zustand";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Request = { title: string; text: string; submit: string; danger?: boolean; image?: string; resolve: (ok: boolean) => void };

const useConfirm = create<{ request: Request | null }>()(() => ({ request: null }));

/** Promise-based confirm, the replacement for legacy confirmDialog(). */
export function confirmDialog(title: string, text: string, submit = "ยืนยัน", danger = false, image?: string) {
  useConfirm.getState().request?.resolve(false);
  return new Promise<boolean>((resolve) => useConfirm.setState({ request: { title, text, submit, danger, image, resolve } }));
}

export function ConfirmHost() {
  const request = useConfirm((s) => s.request);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    useConfirm.setState({ request: null });
  };
  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{request?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
        {request?.image && <img src={request.image} alt="ตัวอย่างภาพที่จับมา" className="max-h-72 w-full rounded-md border object-contain" />}
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction variant={request?.danger ? "destructive" : "default"} onClick={() => close(true)}>
            {request?.submit}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
