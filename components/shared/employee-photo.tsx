"use client";

import { useRef, useState } from "react";
import { CameraIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resizeToSquareJpeg } from "@/lib/format/image";
import { errorText } from "@/lib/format/error-text";

export const photoUrl = (employeeId: string, version: number) =>
  `/api/employees/${employeeId}/photo?v=${version}`;

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

// The employee's picture, or their initials when they have none (or it fails to
// load). `className` sets the size and shape, e.g. "size-20 rounded-2xl text-2xl".
export function EmployeePhoto({
  employeeId,
  name,
  photoVersion,
  className,
}: {
  employeeId: string;
  name: string;
  photoVersion: number | null | undefined;
  className?: string;
}) {
  // A new version is a new picture, so a failure for the old one is forgotten.
  const [failed, setFailed] = useState<number | null>(null);
  const show = photoVersion != null && failed !== photoVersion;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-primary to-indigo-500 font-bold text-white shadow-md",
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(employeeId, photoVersion)}
          alt={`${name}'s photo`}
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(photoVersion)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

// A photo with a small camera button to upload a new one or remove it. Anyone
// may change their own; HR may change anyone's (the server enforces this).
export function PhotoEditor({
  employeeId,
  name,
  photoVersion,
  onChanged,
  className,
}: {
  employeeId: string;
  name: string;
  photoVersion: number | null | undefined;
  onChanged: () => void | Promise<void>;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);

    try {
      const picture = await resizeToSquareJpeg(file);
      const form = new FormData();
      form.set("file", picture, "photo.jpg");

      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "PUT", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Could not save the photo"));

      toast.success("Photo updated");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the photo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);

    try {
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(errorText(data?.error, "Could not remove the photo"));
      }

      toast.success("Photo removed");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("relative shrink-0", busy && "opacity-60")}>
      <EmployeePhoto employeeId={employeeId} name={name} photoVersion={photoVersion} className={className} />

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          render={
            <button
              type="button"
              aria-label="Change photo"
              className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border bg-card text-foreground shadow transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <CameraIcon className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <UploadIcon /> {photoVersion != null ? "Upload a new photo" : "Upload photo"}
          </DropdownMenuItem>
          {photoVersion != null && (
            <DropdownMenuItem onClick={remove}>
              <Trash2Icon /> Remove photo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
