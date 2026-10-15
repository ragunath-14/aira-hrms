"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomFieldDefinition } from "@/lib/config/custom-fields";
import { errorText } from "@/lib/format/error-text";

// The company's own extra fields for one employee, on the HR employee page.
// Renders nothing when the company has not defined any.
export function EmployeeCustomFields({ employeeId }: { employeeId: string }) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/employees/${employeeId}/custom-fields`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !cancelled) {
          setFields(data.fields ?? []);
          setValues(data.values ?? {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (fields.length === 0) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/custom-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: Object.fromEntries(fields.map((f) => [f.id, values[f.id] ?? ""])) }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save"));

      setValues(data.values);
      toast.success("Saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="px-6">
        <h2 className="mb-5 text-lg font-semibold text-foreground">Additional details</h2>

        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <div key={field.id}>
                <Label htmlFor={`cf-${field.id}`} className="mb-1.5">{field.label}</Label>
                <Input
                  id={`cf-${field.id}`}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  maxLength={200}
                  value={values[field.id] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
