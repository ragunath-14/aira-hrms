"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/hr/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SystemConfig = {
  theme: string;
  timezone: string;
  language: string;
  dateFormat: string;
  notifyPayroll: boolean;
  notifyLeave: boolean;
  notifySystem: boolean;
};

const defaultConfig: SystemConfig = {
  theme: "light",
  timezone: "Asia/Kolkata",
  language: "en",
  dateFormat: "DD/MM/YYYY",
  notifyPayroll: true,
  notifyLeave: true,
  notifySystem: false,
};

export default function SystemSettingsPage() {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/settings/system");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load system settings");
        }
        setConfig({ ...defaultConfig, ...data });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load system settings",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccess("");
      setError("");

      const response = await fetch("/api/settings/system", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update system settings");
      }

      setSuccess("System preferences updated successfully!");
      toast.success("System preferences updated");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update system settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure global application preferences and defaults."
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Localization & Appearance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Display Theme</Label>
              <Select
                value={config.theme}
                onValueChange={(value) =>
                  setConfig({ ...config, theme: value ?? config.theme })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                  <SelectItem value="system">Follow System Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Primary Timezone</Label>
              <Select
                value={config.timezone}
                onValueChange={(value) =>
                  setConfig({ ...config, timezone: value ?? config.timezone })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">Coordinated Universal Time (UTC)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (EST/EDT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PST/PDT)</SelectItem>
                  <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                  <SelectItem value="Europe/London">London / Greenwich Time (GMT/BST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Default Language</Label>
              <Select
                value={config.language}
                onValueChange={(value) =>
                  setConfig({ ...config, language: value ?? config.language })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English (US)</SelectItem>
                  <SelectItem value="es">Español (Spanish)</SelectItem>
                  <SelectItem value="fr">Français (French)</SelectItem>
                  <SelectItem value="de">Deutsch (German)</SelectItem>
                  <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Date Format</Label>
              <Select
                value={config.dateFormat}
                onValueChange={(value) =>
                  setConfig({ ...config, dateFormat: value ?? config.dateFormat })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (e.g. 28/08/2026)</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/28/2026)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-28)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b py-2 last:border-b-0">
              <div>
                <p className="font-semibold text-foreground">Payroll Reports</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Receive monthly payroll summaries and payslip receipts.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifyPayroll}
                  onChange={(e) =>
                    setConfig({ ...config, notifyPayroll: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground peer-focus:outline-none"></div>
              </label>
            </div>

            <div className="flex items-center justify-between border-b py-2 last:border-b-0">
              <div>
                <p className="font-semibold text-foreground">
                  Leave Requests & Approvals
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alerts when team members request leave or leave state changes.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifyLeave}
                  onChange={(e) =>
                    setConfig({ ...config, notifyLeave: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground peer-focus:outline-none"></div>
              </label>
            </div>

            <div className="flex items-center justify-between border-b py-2 last:border-b-0">
              <div>
                <p className="font-semibold text-foreground">System announcements</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Critical notifications about maintenance and workspace updates.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifySystem}
                  onChange={(e) =>
                    setConfig({ ...config, notifySystem: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground peer-focus:outline-none"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save System Settings"}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
