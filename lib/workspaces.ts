import { createClient } from "@/lib/supabase/client";

export type WorkspaceSummary = { id: string; name: string; revision: number };

const LAST_WORKSPACE = "1dd-active-workspace";

export const lastWorkspace = {
  get: () => (typeof localStorage === "undefined" ? null : localStorage.getItem(LAST_WORKSPACE)),
  set: (id: string) => localStorage.setItem(LAST_WORKSPACE, id),
  clear: () => localStorage.removeItem(LAST_WORKSPACE),
};

/** Workspaces the user belongs to (RLS filters by membership). Accepts pending invites first. */
export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const supabase = createClient();
  await supabase.rpc("guide_accept_invites");
  const { data, error } = await supabase
    .from("guide_workspaces")
    .select("id,name,revision")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWorkspace(name: string): Promise<string> {
  const { data, error } = await createClient().rpc("guide_create_workspace", { workspace_name: name.trim() });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function signOut() {
  lastWorkspace.clear();
  await createClient().auth.signOut({ scope: "local" });
}
