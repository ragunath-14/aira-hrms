"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_CUSTOM_FIELDS, type CustomFieldDefinition, type CustomFieldType } from "@/lib/config/custom-fields";
import { errorText } from "@/lib/format/error-text";

// A readable, unique key from a field's name. Existing fields keep their key.
function keyFor(label: string, taken: Set<string>) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]+/, "") || "field";
  let key = base.slice(0, 26);
  let n = 2;

  while (taken.has(key)) key = `${base.slice(0, 24)}_${n++}`;

  return key;
}

// A field not saved yet has no key; it gets one from its name when saved.
type Row = CustomFieldDefinition & { isNew?: boolean };

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [res, tenantRes] = await Promise.all([fetch("/api/settings/custom-fields"), fetch("/api/tenant")]);
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load custom fields"));

        setFields(data.fields);
        const tenant = await tenantRes.json().catch(() => null);
        setCanEdit(["owner", "admin"].includes(tenant?.membership?.role));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load custom fields");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function add() {
    setFields([...fields, { id: "", label: "", type: "text", isNew: true }]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Keys are fixed once saved; a brand-new field gets its key from its name.
    const taken = new Set(fields.filter((f) => !f.isNew).map((f) => f.id));
    const prepared = fields.map((f) => {
      const key = f.isNew ? keyFor(f.label, taken) : f.id;
      taken.add(key);

      return { id: key, label: f.label.trim(), type: f.type };
    });

    try {
      const res = await fetch("/api/settings/custom-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: prepared }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save custom fields"));

      setFields(data.fields);
      toast.success("Custom fields saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save custom fields";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Custom Fields"
        description="Extra details you want on every employee, such as blood group or T-shirt size."
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {!loading && !canEdit && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Only the company owner or an admin can change these.
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <form onSubmit={save}>
          <Card>
            <CardContent className="space-y-3 px-6">
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No custom fields yet. HR fills them in on each employee&apos;s Overview tab.
                </p>
              )}

              {fields.map((field, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Field ${index + 1} name`}
                    className="min-w-48 flex-1"
                    placeholder="e.g. Blood group"
                    maxLength={40}
                    required
                    disabled={!canEdit}
                    value={field.label}
                    onChange={(e) => setFields(fields.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))}
                  />
                  <select
                    aria-label={`Field ${index + 1} type`}
                    className={`${selectClass} w-32`}
                    disabled={!canEdit}
                    value={field.type}
                    onChange={(e) =>
                      setFields(fields.map((f, i) => (i === index ? { ...f, type: e.target.value as CustomFieldType } : f)))
                    }
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove field ${index + 1}`}
                      onClick={() => setFields(fields.filter((_, i) => i !== index))}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              ))}

              {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={add} disabled={fields.length >= MAX_CUSTOM_FIELDS}>
                    <PlusIcon /> Add field
                  </Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save fields"}</Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Up to {MAX_CUSTOM_FIELDS} fields. Removing a field hides it; values already entered are kept in case
                you add it back.
              </p>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
