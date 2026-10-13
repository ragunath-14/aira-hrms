"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
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
import { errorText } from "@/lib/format/error-text";
import { setDisplayPrefs } from "@/lib/format/date";
import { Input } from "@/components/ui/input";

type SystemConfig = {
  theme: string;
  timezone: string;
  language: string;
  dateFormat: string;
  notifyPayroll: boolean;
  notifyLeave: boolean;
  notifySystem: boolean;
  leaveCountNonWorkingDays: boolean;
  shiftStart: string;
  graceMinutes: number;
  halfDayAfter: string;
  minFullDayHours: number;
};

const defaultConfig: SystemConfig = {
  theme: "light",
  timezone: "Asia/Kolkata",
  language: "en",
  dateFormat: "DD/MM/YYYY",
  notifyPayroll: true,
  notifyLeave: true,
  notifySystem: false,
  leaveCountNonWorkingDays: false,
  shiftStart: "09:30",
  graceMinutes: 15,
  halfDayAfter: "13:00",
  minFullDayHours: 4,
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
          throw new Error(errorText(data.error, "Failed to load system settings"));
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
        throw new Error(errorText(data.error, "Failed to update system settings"));
      }

      setDisplayPrefs({ dateFormat: config.dateFormat as "DD/MM/YYYY", timezone: config.timezone });
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
            <CardTitle>Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-2">
              <div className="pr-4">
                <p className="font-semibold text-foreground">Count weekends and holidays as leave</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Off (recommended): Saturdays, Sundays and company holidays are not deducted from a leave balance.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  aria-label="Count weekends and holidays as leave"
                  checked={config.leaveCountNonWorkingDays}
                  onChange={(e) =>
                    setConfig({ ...config, leaveCountNonWorkingDays: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground peer-focus:outline-none"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">
              Applied to new check-ins, in the company timezone. Past records are not changed.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="shift-start" className="mb-1.5">Shift start</Label>
                <Input
                  id="shift-start"
                  type="time"
                  required
                  value={config.shiftStart}
                  onChange={(e) => setConfig({ ...config, shiftStart: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="grace" className="mb-1.5">Grace period (minutes)</Label>
                <Input
                  id="grace"
                  type="number"
                  min={0}
                  max={180}
                  required
                  value={config.graceMinutes}
                  onChange={(e) => setConfig({ ...config, graceMinutes: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Check-ins after shift start plus grace are marked Late.</p>
              </div>
              <div>
                <Label htmlFor="half-after" className="mb-1.5">Half day if checked in after</Label>
                <Input
                  id="half-after"
                  type="time"
                  required
                  value={config.halfDayAfter}
                  onChange={(e) => setConfig({ ...config, halfDayAfter: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="min-hours" className="mb-1.5">Minimum hours for a full day</Label>
                <Input
                  id="min-hours"
                  type="number"
                  min={0}
                  max={12}
                  step="0.5"
                  required
                  value={config.minFullDayHours}
                  onChange={(e) => setConfig({ ...config, minFullDayHours: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Checking out sooner than this marks the day Half day.</p>
              </div>
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
