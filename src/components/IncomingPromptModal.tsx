import { Inbox, MessageSquareText } from 'lucide-react';
import type { IncomingTransferPrompt } from '../types';
import { formatBytes } from '../utils/device';
import { DeviceIcon, FileTypeIcon } from './DeviceIcon';

interface IncomingPromptModalProps {
  prompt: IncomingTransferPrompt | null;
  onAccept: (prompt: IncomingTransferPrompt) => void;
  onDecline: (prompt: IncomingTransferPrompt) => void;
}

export function IncomingPromptModal({
  prompt,
  onAccept,
  onDecline,
}: IncomingPromptModalProps) {
  if (!prompt) return null;

  const isTextOnly = prompt.files.length === 0 && Boolean(prompt.textPayload);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-transfer-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#121821] border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Mobile drag handle affordance */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <DeviceIcon type={prompt.sender.deviceType} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="incoming-transfer-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Incoming {isTextOnly ? 'Message' : 'Transfer'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {prompt.sender.alias} · {prompt.sender.os} · #{prompt.sender.fingerprint}
              </p>
            </div>
          </div>

          {isTextOnly && prompt.textPayload ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] p-3.5 text-sm text-slate-800 dark:text-slate-200 max-h-44 overflow-y-auto whitespace-pre-wrap break-words">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Text snippet</span>
              </div>
              {prompt.textPayload}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {prompt.files.length} {prompt.files.length === 1 ? 'file' : 'files'}
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  {formatBytes(prompt.totalBytes)}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F14]">
                {prompt.files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon
                        mimeType={f.mimeType}
                        fileName={f.fileName}
                        className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                        {f.fileName}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onDecline(prompt)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => onAccept(prompt)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-sm font-semibold text-white dark:text-slate-950 transition-colors cursor-pointer"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
