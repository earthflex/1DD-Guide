"use client";

/**
 * Workspace state with autosave, ported from the save queue in legacy/app.js:
 * every change bumps a version, saves run one at a time 250 ms after the last
 * change, and a failed save stops further saves until the user acts.
 */
import { create } from "zustand";
import { ConflictError, loadWorkspace, saveWorkspace } from "@/lib/cloud";
import { copy, type Project } from "@/lib/guide-core";

type State = {
  wid: string | null;
  name: string;
  revision: number;
  projects: Project[];
  status: "idle" | "loading" | "ready" | "error";
  loadError: string;
  changeVersion: number;
  savedVersion: number;
  saveError: string;
  conflict: boolean;
};

type Actions = {
  load: (wid: string) => Promise<void>;
  /** Apply a change to a draft copy of the projects; `touch` bumps that project's updatedAt. */
  update: (change: (projects: Project[]) => void, touch?: string) => void;
  flush: () => Promise<void>;
  retry: () => Promise<void>;
};

export type SaveState = "saved" | "saving" | "error";

let timer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<void> = Promise.resolve();

export const useWorkspace = create<State & Actions>()((set, get) => ({
  wid: null,
  name: "",
  revision: 0,
  projects: [],
  status: "idle",
  loadError: "",
  changeVersion: 0,
  savedVersion: 0,
  saveError: "",
  conflict: false,

  async load(wid) {
    clearTimeout(timer);
    set({ wid, status: "loading", loadError: "", saveError: "", conflict: false, changeVersion: 0, savedVersion: 0 });
    try {
      const w = await loadWorkspace(wid);
      if (get().wid !== wid) return;
      set({ name: w.name, revision: w.revision, projects: w.projects, status: "ready" });
    } catch (e) {
      if (get().wid === wid) set({ status: "error", loadError: (e as Error).message });
    }
  },

  update(change, touch) {
    const projects = copy(get().projects);
    change(projects);
    if (touch) {
      const p = projects.find((x) => x.id === touch);
      if (p) p.updatedAt = new Date().toISOString();
    }
    set((s) => ({ projects, changeVersion: s.changeVersion + 1 }));
    clearTimeout(timer);
    timer = setTimeout(() => void get().flush(), 250);
  },

  flush() {
    clearTimeout(timer);
    const s = get();
    if (s.savedVersion === s.changeVersion || !s.wid) return queue;
    const version = s.changeVersion, snapshot = s.projects, wid = s.wid;
    queue = queue.catch(() => {}).then(async () => {
      const now = get();
      if (now.saveError) throw new Error(now.saveError);
      if (now.wid !== wid) return;
      const revision = await saveWorkspace(wid, now.revision, snapshot);
      set((x) => ({ revision, savedVersion: Math.max(x.savedVersion, version) }));
    }).catch((e: Error) => {
      set({ saveError: e.message, conflict: e instanceof ConflictError });
    });
    return queue;
  },

  async retry() {
    set({ saveError: "", conflict: false });
    await get().flush();
  },
}));

export const saveStateOf = (s: Pick<State, "saveError" | "savedVersion" | "changeVersion">): SaveState =>
  s.saveError ? "error" : s.savedVersion < s.changeVersion ? "saving" : "saved";

export const hasUnsaved = () => {
  const s = useWorkspace.getState();
  return s.savedVersion < s.changeVersion;
};
