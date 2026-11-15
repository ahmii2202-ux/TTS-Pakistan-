import React, { useState } from 'react';
import { Check, Copy, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  const copyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {isInstallable ? (
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent-ink bg-accent-soft border border-accent-border hover:opacity-90 rounded-md transition-all whitespace-nowrap shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install / Android App</span>
          </button>
        )}
      </div>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-panel border border-line p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Install SadaStudio on Android & iPhone
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Install directly like a native app or package an APK file from your live URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="p-3.5 rounded-lg bg-recessed border border-line space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  iPhone / iPad (Safari)
                </div>
                <p>1. Tap the Share button at the bottom of Safari.</p>
                <p>2. Scroll down and tap Add to Home Screen.</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-recessed border border-line space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Option 1: Direct Android Install (1 Tap, No Play Store Needed)
                </div>
                <p>1. Open the Shared App URL in Google Chrome on your Android phone.</p>
                <p>2. Tap Chrome’s menu (⋮) and tap Install App or Add to Home Screen.</p>
                <p>3. SadaStudio installs to your App Drawer and opens full-screen without a browser bar.</p>
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-recessed border border-line space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Option 2: Generate a Standalone .APK File (PWABuilder)
              </div>
              <p>
                Note: AI Studio preview URLs (<code className="font-mono">ais-pre / ais-dev</code>) use a browser cookie check that blocks external scanners like PWABuilder.
              </p>
              <p>1. Click <strong>Deploy</strong> in Google AI Studio (top-right) to publish to a public Cloud Run <code className="font-mono">.run.app</code> URL.</p>
              <p>2. Paste that public <code className="font-mono">.run.app</code> URL into <span className="font-semibold">pwabuilder.com</span> and click <strong>Package for Stores → Android</strong> to download your <code className="font-mono">.apk</code>.</p>
              {appUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <code className="flex-1 px-2.5 py-1.5 rounded bg-panel border border-line text-[11px] font-mono truncate">
                    {appUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-panel border border-line rounded hover:border-accent-bar transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-accent-ink" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline — Saved voices & downloaded audio library remain available</span>
    </div>
  );
};
