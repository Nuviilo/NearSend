import { useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import type {
  ActiveTransfer,
  AppSettings,
  QuickSaveMode,
  ReceivedFileRecord,
  ReceivedTextRecord,
} from '../types';
import { formatBytes, formatTimestamp } from '../utils/device';
import { DeviceIcon, FileTypeIcon } from './DeviceIcon';
import { TransferProgressList } from './TransferProgressList';

interface ReceiveViewProps {
  settings: AppSettings;
  fingerprint: string;
  connectionState: 'connecting' | 'connected' | 'reconnecting';
  activeTransfers: ActiveTransfer[];
  receivedFiles: ReceivedFileRecord[];
  receivedTexts: ReceivedTextRecord[];
  onSetQuickSave: (mode: QuickSaveMode) => void;
  onDownloadFile: (blobUrl: string, fileName: string) => void;
  onCancelTransfer: (sessionId: string) => void;
  onDismissTransfer: (sessionId: string) => void;
}

export function ReceiveView({
  settings,
  fingerprint,
  connectionState,
  activeTransfers,
  receivedFiles,
  receivedTexts,
  onSetQuickSave,
  onDownloadFile,
  onCancelTransfer,
  onDismissTransfer,
}: ReceiveViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isDiscoverable = connectionState === 'connected' && settings.quickSave !== 'off';

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* Centered Minimalist Device Identity */}
      <section className="min-h-[56vh] flex flex-col items-center justify-center text-center py-12 px-4">
        <div className="relative flex items-center justify-center w-32 h-32 mb-6">
          {isDiscoverable && (
            <>
              <span
                className="absolute inset-0 rounded-full border border-teal-500/35 dark:border-teal-400/30 animate-radar-ripple"
                aria-hidden="true"
              />
              <span
                className="absolute inset-0 rounded-full border border-teal-500/25 dark:border-teal-400/20 animate-radar-ripple-delayed"
                aria-hidden="true"
              />
            </>
          )}
          <div
            className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full border transition-colors ${
              isDiscoverable
                ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400'
                : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
            }`}
          >
            <DeviceIcon type={settings.deviceType} className="w-10 h-10" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
          {settings.alias}
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-x-2">
          <span>{settings.os}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">#{fingerprint}</span>
          <span aria-hidden="true">·</span>
          <span>
            {connectionState === 'connected'
              ? settings.quickSave === 'off'
                ? 'Receiving paused'
                : 'Ready to receive'
              : 'Connecting'}
          </span>
        </p>

        {/* Minimal Quick Save Segmented Control */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick Save
          </span>
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#11161D] border border-slate-200/80 dark:border-white/[0.08] w-60"
            role="group"
            aria-label="Quick Save mode"
          >
            {(['off', 'ask', 'all'] as QuickSaveMode[]).map((mode) => {
              const active = settings.quickSave === mode;
              const label = mode === 'off' ? 'Off' : mode === 'ask' ? 'Ask' : 'Auto';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetQuickSave(mode)}
                  className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-[#1E2633] text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Active Incoming Transfers (only visible when receiving) */}
      <TransferProgressList
        transfers={activeTransfers}
        onCancel={onCancelTransfer}
        onDismiss={onDismissTransfer}
      />

      {/* Received Text Snippets (only visible when messages arrive) */}
      {receivedTexts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Received Messages
          </h2>
          <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] overflow-hidden">
            {receivedTexts.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    From {item.senderAlias} · {formatTimestamp(item.receivedAt)}
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
                    {item.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(item.id, item.text)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Received Files (only visible when files arrive) */}
      {receivedFiles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Received Files
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {receivedFiles.length} {receivedFiles.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="divide-y divide-slate-200/80 dark:divide-white/[0.06] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] overflow-hidden">
            {receivedFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <FileTypeIcon
                      mimeType={file.mimeType}
                      fileName={file.fileName}
                      className="w-5 h-5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5">
                      <span className="font-mono tabular-nums">
                        {formatBytes(file.size)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>From {file.senderAlias}</span>
                      {file.verifiedChecksum && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verified</span>
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDownloadFile(file.blobUrl, file.fileName)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-xs font-semibold text-white dark:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
