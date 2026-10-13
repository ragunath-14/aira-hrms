"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Lets any signed-in user change their own password. Needs the current one,
// and signs out their other devices.
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  function close(value: boolean) {
    if (!value) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    onOpenChange(value);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (next !== confirm) {
      toast.error("The new passwords do not match");
      return;
    }

    setSaving(true);

    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message || "Could not change the password");
      }

      toast.success("Password changed");
      close(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Other devices are signed out when you change it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="cp-current" className="mb-1.5">Current password</Label>
            <Input id="cp-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp-new" className="mb-1.5">New password</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">At least 12 characters.</p>
          </div>
          <div>
            <Label htmlFor="cp-confirm" className="mb-1.5">Confirm new password</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || next.length < 12}>
              {saving ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
