import Image from "next/image";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/brand/1dd-logo.png" alt="1DD" width={56} height={56} priority />
          <span className="text-2xl font-medium tracking-tight">Guide</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;
}
