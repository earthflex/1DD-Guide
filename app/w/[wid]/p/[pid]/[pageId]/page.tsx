import Link from "next/link";
import { Button } from "@/components/ui/button";

// Phase 4 placeholder: the editor replaces this page.
export default async function EditorPage({ params }: PageProps<"/w/[wid]/p/[pid]/[pageId]">) {
  const { wid } = await params;
  return (
    <div className="m-auto grid max-w-md gap-4 p-6 text-center">
      <h1 className="text-xl font-medium">หน้าแก้ไขคู่มือ</h1>
      <p className="text-sm text-muted-foreground">หน้าแก้ไขกำลังพัฒนา ระหว่างนี้แก้ไขได้ที่เว็บเดิม</p>
      <Button asChild variant="outline"><Link href={`/w/${wid}`}>กลับไปหน้ารวมโปรเจกต์</Link></Button>
    </div>
  );
}
