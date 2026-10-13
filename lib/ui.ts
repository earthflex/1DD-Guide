"use client";

import { create } from "zustand";

/** Which app-level dialog is open. One at a time, like the legacy <dialog>. */
export type DialogState =
  | { kind: "create-project" }
  | { kind: "project-settings"; pid: string }
  | { kind: "export"; pid: string }
  | { kind: "publish"; pid: string }
  | { kind: "password" }
  | { kind: "help" }
  | { kind: "extension" }
  | null;

export const useDialog = create<{ dialog: DialogState; preview: string | null }>()(() => ({ dialog: null, preview: null }));

export const openDialog = (dialog: DialogState) => useDialog.setState({ dialog });
export const closeDialog = () => useDialog.setState({ dialog: null });
/** Full-screen customer preview of one project. */
export const openPreview = (pid: string) => useDialog.setState({ dialog: null, preview: pid });
export const closePreview = () => useDialog.setState({ preview: null });
