"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiError } from "@/components/shared/ui-bits";
import { useIsHr } from "@/hooks/use-is-hr";
import { Button } from "@/components/ui/button";

// A trash button that asks for confirmation, calls DELETE on `url`, and then
// tells the page to reload. Hidden from people who aren't allowed to delete
// (HR roles by default) so nobody clicks a button that can only fail.
export function DeleteButton({
  url,
  itemName,
  title,
  description,
  onDeleted,
  anyone = false,
  withLabel = false,
}: {
  url: string;
  itemName: string;
  title?: string;
  description?: string;
  onDeleted: () => void;
  // true for things every signed-in user may delete (their own items).
  anyone?: boolean;
  withLabel?: boolean;
}) {
  const isHr = useIsHr();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!anyone && !isHr) {
    return null;
  }

  async function remove() {
    setBusy(true);

    try {
      const res = await fetch(url, { method: "DELETE" });

      if (!res.ok) {
        throw new Error(await apiError(res, `Failed to delete ${itemName}`));
      }

      toast.success(`${itemName} deleted`);
      setOpen(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={withLabel ? "sm" : "icon"}
        aria-label={`Delete ${itemName}`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        {withLabel && "Delete"}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title ?? `Delete ${itemName}?`}
        description={description ?? "This can't be undone."}
        confirmLabel="Delete"
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}
