import { useEffect, useState } from 'react';
import { Monitor, RefreshCw, Smartphone, Sun, Moon, Laptop } from 'lucide-react';
import type {
  AppSettings,
  DeviceOS,
  DeviceType,
  QuickSaveMode,
  ThemePreference,
} from '../types';
import { generateRandomAlias } from '../utils/device';

interface SettingsViewProps {
  settings: AppSettings;
  fingerprint: string;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export function SettingsView({
  settings,
  fingerprint,
  onUpdateSettings,
}: SettingsViewProps) {
  const isNativeApk =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      window.location.hostname === 'appassets.androidplatform.net');

  const [serverDraft, setServerDraft] = useState(settings.serverUrl || '');
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);

  useEffect(() => {
    if (isNativeApk) return;
    fetch('/api/server-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { lanAddresses?: string[] } | null) => {
        if (data?.lanAddresses) setLanAddresses(data.lanAddresses);
      })
      .catch(() => {});
  }, [isNativeApk]);

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ serverUrl: serverDraft.trim() });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Customize appearance, device identity, and transfer preferences
        </p>
      </div>

      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Appearance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Switch between daylight porcelain and obsidian dark surfaces
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              {
                id: 'light',
                label: 'Light',
                desc: 'Porcelain surface',
                icon: Sun,
                previewClass: 'bg-[#F6F8FA] border-slate-200 text-slate-900',
              },
              {
                id: 'dark',
                label: 'Dark',
                desc: 'Obsidian surface',
                icon: Moon,
                previewClass: 'bg-[#090C10] border-slate-800 text-slate-100',
              },
              {
                id: 'system',
                label: 'System',
                desc: 'Match OS theme',
                icon: Laptop,
                previewClass:
                  'bg-gradient-to-br from-[#F6F8FA] via-[#F6F8FA] to-[#090C10] border-slate-300 dark:border-slate-700 text-slate-900',
              },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = settings.theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateSettings({ theme: opt.id as ThemePreference })}
                className={`min-h-[82px] flex flex-col justify-between p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-500/10'
                    : 'border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {opt.label}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border ${opt.previewClass}`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Device Identity */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Device Identity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              How this device appears to nearby Android and Windows peers
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            #{fingerprint}
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="device-alias-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Device Alias
            </label>
            <div className="flex gap-2">
              <input
                id="device-alias-input"
                type="text"
                maxLength={40}
                value={settings.alias}
                onChange={(e) => onUpdateSettings({ alias: e.target.value })}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#090C10] px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
              />
              <button
                type="button"
                onClick={() => onUpdateSettings({ alias: generateRandomAlias() })}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#1A212C] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Random</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Device Form Factor
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'desktop', label: 'Desktop', icon: Monitor },
                    { id: 'mobile', label: 'Mobile', icon: Smartphone },
                    { id: 'tablet', label: 'Tablet', icon: Laptop },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = settings.deviceType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ deviceType: item.id as DeviceType })
                      }
                      className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#090C10] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="device-os-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Platform Label
              </label>
              <select
                id="device-os-select"
                value={settings.os}
                onChange={(e) => onUpdateSettings({ os: e.target.value as DeviceOS })}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#090C10] px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
              >
                <option value="Windows">Windows</option>
                <option value="Android">Android</option>
                <option value="macOS">macOS</option>
                <option value="Linux">Linux</option>
                <option value="iOS">iOS</option>
                <option value="Web">Web</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol & Transfer */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Transfer Protocol
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            WebRTC direct peer-to-peer streaming with automatic WebSocket relay fallback
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Prefer Direct WebRTC P2P
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Streams 64 KB chunks directly between devices; falls back to relay if NAT blocks P2P
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.preferWebRTC}
              onClick={() =>
                onUpdateSettings({ preferWebRTC: !settings.preferWebRTC })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.preferWebRTC
                  ? 'bg-teal-600 dark:bg-teal-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings.preferWebRTC ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-1 border-t border-slate-100 dark:border-white/[0.06] pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Verify SHA-256 Checksums
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verifies file integrity automatically on files up to 150 MB
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.verifyChecksums}
              onClick={() =>
                onUpdateSettings({ verifyChecksums: !settings.verifyChecksums })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.verifyChecksums
                  ? 'bg-teal-600 dark:bg-teal-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings.verifyChecksums ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 space-y-2.5">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Quick Save Default
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['off', 'ask', 'all'] as QuickSaveMode[]).map((mode) => {
                const active = settings.quickSave === mode;
                const label =
                  mode === 'off' ? 'Off' : mode === 'ask' ? 'Ask' : 'Auto-Accept';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateSettings({ quickSave: mode })}
                    className={`min-h-[44px] rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#090C10] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {(isNativeApk || lanAddresses.length > 0) && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isNativeApk ? 'Discovery Server URL' : 'Local Network Address'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isNativeApk
                ? 'Point this Android app to your Windows NearSend server on Wi-Fi or keep the default relay URL'
                : 'Enter one of these addresses in the Android app or phone browser on the same Wi-Fi'}
            </p>
          </div>

          {lanAddresses.length > 0 && (
            <div className="space-y-1.5">
              {lanAddresses.map((addr) => (
                <div
                  key={addr}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090C10] border border-slate-200/80 dark:border-white/[0.06] font-mono text-xs text-slate-800 dark:text-slate-200"
                >
                  {addr}
                </div>
              ))}
            </div>
          )}

          {isNativeApk && (
            <form onSubmit={handleSaveServerUrl} className="flex gap-2">
              <input
                type="url"
                value={serverDraft}
                onChange={(e) => setServerDraft(e.target.value)}
                placeholder="http://192.168.1.25:3000"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#090C10] px-3.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-xs font-semibold text-white dark:text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
              >
                Save
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
