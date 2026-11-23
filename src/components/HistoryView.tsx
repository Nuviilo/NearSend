import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, History, Search, Trash2 } from 'lucide-react';
import type { TransferHistoryItem } from '../types';
import { formatBytes, formatDateTime } from '../utils/device';

interface HistoryViewProps {
  history: TransferHistoryItem[];
  onClearHistory: () => void;
  onGoToSend: () => void;
}

export function HistoryView({
  history,
  onClearHistory,
  onGoToSend,
}: HistoryViewProps) {
  const [filter, setFilter] = useState<'all' | 'receive' | 'send'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => {
      if (filter !== 'all' && item.direction !== filter) return false;
      if (!q) return true;
      return (
        item.summaryName.toLowerCase().includes(q) ||
        item.peerAlias.toLowerCase().includes(q) ||
        item.peerOs.toLowerCase().includes(q)
      );
    });
  }, [filter, history, search]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Transfer History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recent sent and received sessions stored locally on this device
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by file name or device..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
          />
        </div>

        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#121821] border border-slate-200 dark:border-slate-800 sm:w-64"
          role="group"
          aria-label="Filter transfer direction"
        >
          {(['all', 'receive', 'send'] as const).map((tab) => {
            const active = filter === tab;
            const label = tab === 'all' ? 'All' : tab === 'receive' ? 'Received' : 'Sent';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-[#1E2736] text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-10 text-center space-y-3">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <History className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {history.length === 0 ? 'No transfers recorded yet' : 'No matching transfers'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {history.length === 0
                ? 'Completed, declined, and cancelled transfers between your Android and Windows devices will appear here.'
                : 'Try clearing the search query or switching the direction filter.'}
            </p>
          </div>
          {history.length === 0 && (
            <button
              type="button"
              onClick={onGoToSend}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-xs font-semibold text-white dark:text-slate-950 transition-colors cursor-pointer"
            >
              Send First File
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:px-5 sm:py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    item.direction === 'receive'
                      ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.direction === 'receive' ? (
                    <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.summaryName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5">
                    <span>
                      {item.direction === 'receive' ? 'From' : 'To'} {item.peerAlias} (
                      {item.peerOs})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatBytes(item.totalBytes)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.transport === 'webrtc' ? 'WebRTC P2P' : 'Relay'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        item.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {item.status === 'completed'
                        ? 'Completed'
                        : item.status === 'declined'
                          ? 'Declined'
                          : 'Cancelled'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {item.textPayload && (
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.textPayload!)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                )}
                <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                  {formatDateTime(item.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
