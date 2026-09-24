import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <SearchXIcon className="size-6 text-muted-foreground" />
          </div>

          <p className="text-base font-semibold text-foreground">Page not found</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>

          <div className="mt-3">
            <Button render={<Link href="/" />}>Go to dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
