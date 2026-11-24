import { useEffect, useRef, useState } from 'react';
import {
  FilePlus2,
  FolderOpen,
  ImagePlus,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UploadCloud,
  Wifi,
  X,
} from 'lucide-react';
import type { ActiveTransfer, PeerDevice, QueuedItem } from '../types';
import { formatBytes, generateId } from '../utils/device';
import { DeviceIcon, FileTypeIcon } from './DeviceIcon';
import { TransferProgressList } from './TransferProgressList';

interface SendViewProps {
  peers: PeerDevice[];
  activeTransfers: ActiveTransfer[];
  onSendToPeer: (peer: PeerDevice, items: QueuedItem[]) => void;
  onRescanPeers: () => void;
  onCancelTransfer: (sessionId: string) => void;
  onDismissTransfer: (sessionId: string) => void;
}

export function SendView({
  peers,
  activeTransfers,
  onSendToPeer,
  onRescanPeers,
  onCancelTransfer,
  onDismissTransfer,
}: SendViewProps) {
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onRescanPeers();
  }, [onRescanPeers]);

  useEffect(() => {
    if (peers.length > 0) return;
    const id = window.setInterval(() => {
      onRescanPeers();
    }, 4000);
    return () => window.clearInterval(id);
  }, [peers.length, onRescanPeers]);
  const directPeerInputRef = useRef<HTMLInputElement>(null);
  const directPeerRef = useRef<PeerDevice | null>(null);

  const addFilesToQueue = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const next: QueuedItem[] = Array.from(fileList).map((file) => ({
      id: generateId(),
      kind: 'file',
      file,
      fileName: file.webkitRelativePath || file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }));
    setQueue((prev) => [...prev, ...next]);
  };

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    setQueue((prev) => [
      ...prev,
      {
        id: generateId(),
        kind: 'text',
        fileName: trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed,
        size: new Blob([trimmed]).size,
        mimeType: 'text/plain',
        textContent: trimmed,
      },
    ]);
    setTextDraft('');
    setShowTextComposer(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRescan = () => {
    setIsScanning(true);
    onRescanPeers();
    setTimeout(() => setIsScanning(false), 600);
  };

  const handleSelectDeviceToSend = (peer: PeerDevice) => {
    if (queue.length > 0) {
      onSendToPeer(peer, queue);
      return;
    }
    directPeerRef.current = peer;
    directPeerInputRef.current?.click();
  };

  const handleDirectFilesPicked = (fileList: FileList | null) => {
    const peer = directPeerRef.current;
    if (!peer || !fileList || fileList.length === 0) return;
    const picked: QueuedItem[] = Array.from(fileList).map((file) => ({
      id: generateId(),
      kind: 'file',
      file,
      fileName: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }));
    setQueue(picked);
    onSendToPeer(peer, picked);
    directPeerRef.current = null;
  };

  const totalBytes = queue.reduce((sum, item) => sum + item.size, 0);

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        className="hidden"
        onChange={(e) => {
          addFilesToQueue(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={directPeerInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          handleDirectFilesPicked(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Selection Box */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Selection
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {queue.length > 0
                ? `${queue.length} ${queue.length === 1 ? 'item' : 'items'} selected · ${formatBytes(totalBytes)}`
                : 'Select files, media, folders, or text to send'}
            </p>
          </div>

          {queue.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => setQueue([])}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>

        {/* 4-Way Picker Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-[#090C10] hover:bg-slate-200/70 dark:hover:bg-slate-800/80 text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Files</span>
          </button>
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-[#090C10] hover:bg-slate-200/70 dark:hover:bg-slate-800/80 text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Media</span>
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-[#090C10] hover:bg-slate-200/70 dark:hover:bg-slate-800/80 text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Folder</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTextComposer((v) => !v)}
            className={`min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              showTextComposer
                ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                : 'bg-slate-100/80 dark:bg-[#090C10] hover:bg-slate-200/70 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
            }`}
          >
            <MessageSquarePlus className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Text</span>
          </button>
        </div>

        {showTextComposer && (
          <form
            onSubmit={handleAddText}
            className="rounded-xl bg-slate-50 dark:bg-[#090C10] p-4 space-y-3"
          >
            <textarea
              rows={3}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Paste a link, note, or snippet..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11161D] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTextComposer(false)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!textDraft.trim()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-45 dark:bg-teal-500 dark:hover:bg-teal-400 text-xs font-semibold text-white dark:text-slate-950 transition-colors cursor-pointer"
              >
                Add Text
              </button>
            </div>
          </form>
        )}

        {/* Selected Files Box or Empty Dropzone */}
        {queue.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`rounded-xl border border-dashed p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-500/10'
                : 'border-slate-300 dark:border-slate-700/80 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-[#090C10]/50'
            }`}
          >
            <UploadCloud
              className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-500 mb-1.5"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Drop files here or click to select
            </p>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border divide-y divide-slate-100 dark:divide-white/[0.05] max-h-60 overflow-y-auto transition-colors ${
              isDragging
                ? 'border-teal-500 bg-teal-50/30 dark:bg-teal-500/10'
                : 'border-slate-200/80 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#090C10]/60'
            }`}
          >
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-[#11161D] border border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-slate-300">
                    {item.kind === 'text' ? (
                      <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <FileTypeIcon
                        mimeType={item.mimeType}
                        fileName={item.fileName}
                        className="w-4 h-4"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.kind === 'text' ? 'Text snippet' : formatBytes(item.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.fileName}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nearby Devices (Directly underneath Selection Box) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nearby Devices
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {peers.length} {peers.length === 1 ? 'device' : 'devices'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRescan}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`}
            />
            <span>Rescan</span>
          </button>
        </div>

        {peers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] p-6 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
              <Wifi className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No nearby devices found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open NearSend on your Android or Windows device on the same network to select and send files.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {peers.map((peer) => (
              <button
                key={peer.id}
                type="button"
                onClick={() => handleSelectDeviceToSend(peer)}
                className="w-full min-h-[76px] flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11161D] hover:border-teal-500/60 dark:hover:border-teal-400/50 hover:bg-teal-50/20 dark:hover:bg-teal-500/[0.04] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <DeviceIcon type={peer.deviceType} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {peer.alias}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {peer.os} · #{peer.fingerprint}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 dark:bg-teal-500 text-xs font-semibold text-white dark:text-slate-950 whitespace-nowrap shrink-0">
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{queue.length > 0 ? 'Send' : 'Select & Send'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Active Outgoing Transfers */}
      <TransferProgressList
        transfers={activeTransfers}
        onCancel={onCancelTransfer}
        onDismiss={onDismissTransfer}
      />
    </div>
  );
}
