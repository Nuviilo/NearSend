import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, X } from 'lucide-react';
import type { ActiveTransfer } from '../types';
import { formatBytes, formatEta, formatSpeed } from '../utils/device';

interface TransferProgressListProps {
  transfers: ActiveTransfer[];
  onCancel: (sessionId: string) => void;
  onDismiss: (sessionId: string) => void;
}

export function TransferProgressList({
  transfers,
  onCancel,
  onDismiss,
}: TransferProgressListProps) {
  if (transfers.length === 0) return null;

  return (
    <section aria-label="Active Transfers" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Active Transfers
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {transfers.length} {transfers.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
        {transfers.map((t) => {
          const pct =
            t.totalBytes > 0
              ? Math.min(100, Math.round((t.bytesTransferred / t.totalBytes) * 100))
              : t.status === 'completed'
                ? 100
                : 0;
          const remaining = Math.max(0, t.totalBytes - t.bytesTransferred);
          const etaSeconds = t.speedBps > 0 ? remaining / t.speedBps : 0;
          const isRunning =
            t.status === 'preparing' ||
            t.status === 'awaiting_acceptance' ||
            t.status === 'connecting' ||
            t.status === 'transferring';

          const statusLabel = (() => {
            switch (t.status) {
              case 'preparing':
                return 'Preparing checksums';
              case 'awaiting_acceptance':
                return 'Waiting for recipient';
              case 'connecting':
                return 'Establishing WebRTC P2P';
              case 'transferring':
                return t.transport === 'webrtc' ? 'WebRTC Direct' : 'WebSocket Relay';
              case 'completed':
                return 'Completed';
              case 'declined':
                return 'Declined';
              case 'cancelled':
                return 'Cancelled';
              case 'error':
                return t.errorMessage || 'Transfer failed';
            }
          })();

          return (
            <div key={t.sessionId} className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                    {t.direction === 'send' ? (
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {t.currentFileName || 'Transfer'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>
                        {t.direction === 'send' ? 'To' : 'From'} {t.peerAlias}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t.peerOs}</span>
                      <span aria-hidden="true">·</span>
                      <span>{statusLabel}</span>
                      {t.files.length > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            File {Math.min(t.currentFileIndex + 1, t.files.length)} of{' '}
                            {t.files.length}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {t.status === 'completed' && (
                    <CheckCircle2
                      className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                      aria-label="Completed"
                    />
                  )}
                  {(t.status === 'error' || t.status === 'declined') && (
                    <AlertCircle
                      className="w-5 h-5 text-rose-600 dark:text-rose-400"
                      aria-label={statusLabel}
                    />
                  )}
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={() => onCancel(t.sessionId)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDismiss(t.sessionId)}
                      aria-label="Dismiss transfer"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {t.totalBytes > 0 && (
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-150 ${
                        t.status === 'error' || t.status === 'declined' || t.status === 'cancelled'
                          ? 'bg-rose-500'
                          : t.status === 'completed'
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-teal-600 dark:bg-teal-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums font-mono">
                    <span>
                      {formatBytes(t.bytesTransferred)} / {formatBytes(t.totalBytes)} ({pct}%)
                    </span>
                    {t.status === 'transferring' && t.speedBps > 0 ? (
                      <span>
                        {formatSpeed(t.speedBps)}
                        {etaSeconds > 0 ? ` · ${formatEta(etaSeconds)} left` : ''}
                      </span>
                    ) : (
                      <span>{t.transport === 'webrtc' ? 'P2P' : 'Relay'}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
