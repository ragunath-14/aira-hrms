"use client";

import { useEffect, useState } from "react";

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
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("hrms_system_config");
    if (saved) {
      try {
        setConfig({ ...defaultConfig, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse system config:", e);
      }
    }
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");

    setTimeout(() => {
      localStorage.setItem("hrms_system_config", JSON.stringify(config));
      setSaving(false);
      setSuccess("System preferences updated successfully!");
    }, 800);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 font-sans">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">System Settings</h1>
        <p className="mt-1.5 text-sm text-gray-500">Configure global application preferences and defaults.</p>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Localization settings */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Localization & Appearance</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Display Theme</label>
              <select
                value={config.theme}
                onChange={(e) => setConfig({ ...config, theme: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="system">Follow System Settings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Timezone</label>
              <select
                value={config.timezone}
                onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="America/New_York">Eastern Time (EST/EDT)</option>
                <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="Europe/London">London / Greenwich Time (GMT/BST)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Default Language</label>
              <select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="en">English (US)</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
                <option value="de">Deutsch (German)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date Format</label>
              <select
                value={config.dateFormat}
                onChange={(e) => setConfig({ ...config, dateFormat: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 28/08/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 08/28/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-08-28)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications toggles */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Email Notification Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
              <div>
                <p className="font-semibold text-gray-900">Payroll Reports</p>
                <p className="text-xs text-gray-500 mt-0.5">Receive monthly payroll summaries and payslip receipts.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifyPayroll}
                  onChange={(e) => setConfig({ ...config, notifyPayroll: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
              <div>
                <p className="font-semibold text-gray-900">Leave Requests & Approvals</p>
                <p className="text-xs text-gray-500 mt-0.5">Alerts when team members request leave or leave state changes.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifyLeave}
                  onChange={(e) => setConfig({ ...config, notifyLeave: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
              <div>
                <p className="font-semibold text-gray-900">System announcements</p>
                <p className="text-xs text-gray-500 mt-0.5">Critical notifications about maintenance and workspace updates.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config.notifySystem}
                  onChange={(e) => setConfig({ ...config, notifySystem: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            disabled={saving}
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving System Preferences...
              </>
            ) : (
              "Save System Settings"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
