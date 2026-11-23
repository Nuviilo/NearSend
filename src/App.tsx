import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { HistoryView } from './components/HistoryView';
import { IncomingPromptModal } from './components/IncomingPromptModal';
import { ReceiveView } from './components/ReceiveView';
import { SendView } from './components/SendView';
import { SettingsView } from './components/SettingsView';
import { useNearSend } from './services/useNearSend';

type NavTab = 'receive' | 'send' | 'history' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('receive');
  const nearSend = useNearSend();
  const { settings, updateSettings } = nearSend;

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleQuickTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: typeof ArrowDownToLine;
    badgeCount?: number;
  }> = [
    {
      id: 'receive',
      label: 'Receive',
      icon: ArrowDownToLine,
      badgeCount: nearSend.receivedFiles.length + nearSend.receivedTexts.length,
    },
    {
      id: 'send',
      label: 'Send',
      icon: ArrowUpFromLine,
      badgeCount: nearSend.peers.length,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FA] dark:bg-[#090C10] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <div className="flex min-h-screen">
        {/* Desktop Navigation Rail */}
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#0D1117]">
          <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100 dark:border-white/[0.06]">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              NearSend
            </span>
            <button
              type="button"
              onClick={toggleQuickTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06]">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {settings.alias}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {settings.os} · #{nearSend.fingerprint}
            </p>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
          {/* Mobile Compact Top Bar */}
          <header className="lg:hidden sticky top-0 z-30 h-13 px-4 flex items-center justify-between gap-4 bg-[#F6F8FA]/90 dark:bg-[#090C10]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.06]">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              NearSend
            </span>

            <button
              type="button"
              onClick={toggleQuickTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </header>

          {/* Desktop Subtle Context Bar */}
          <div className="hidden lg:flex h-16 px-8 items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06]">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
              {activeTab}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {nearSend.connectionState === 'connected'
                ? `${nearSend.peers.length} nearby ${nearSend.peers.length === 1 ? 'device' : 'devices'}`
                : 'Reconnecting'}
            </p>
          </div>

          <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-12">
            {activeTab === 'receive' && (
              <ReceiveView
                settings={settings}
                fingerprint={nearSend.fingerprint}
                connectionState={nearSend.connectionState}
                activeTransfers={nearSend.activeTransfers.filter(
                  (t) => t.direction === 'receive',
                )}
                receivedFiles={nearSend.receivedFiles}
                receivedTexts={nearSend.receivedTexts}
                onSetQuickSave={nearSend.setQuickSave}
                onDownloadFile={nearSend.triggerDownload}
                onCancelTransfer={nearSend.cancelTransfer}
                onDismissTransfer={nearSend.dismissTransfer}
              />
            )}

            {activeTab === 'send' && (
              <SendView
                peers={nearSend.peers}
                activeTransfers={nearSend.activeTransfers.filter(
                  (t) => t.direction === 'send',
                )}
                onSendToPeer={nearSend.sendToPeer}
                onRescanPeers={nearSend.rescanPeers}
                onCancelTransfer={nearSend.cancelTransfer}
                onDismissTransfer={nearSend.dismissTransfer}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                history={nearSend.history}
                onClearHistory={nearSend.clearHistory}
                onGoToSend={() => setActiveTab('send')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                fingerprint={nearSend.fingerprint}
                onUpdateSettings={updateSettings}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 safe-bottom bg-white/95 dark:bg-[#0D1117]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.06]"
      >
        <div className="h-16 grid grid-cols-4 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-medium tracking-tight leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Incoming Transfer Prompt */}
      <IncomingPromptModal
        prompt={nearSend.incomingPrompt}
        onAccept={nearSend.acceptIncomingTransfer}
        onDecline={nearSend.declineIncomingTransfer}
      />
    </div>
  );
}
