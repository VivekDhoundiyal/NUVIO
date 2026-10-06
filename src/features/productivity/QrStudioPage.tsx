import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import { QrCode, Download, Scan, Copy, Check } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { ImageEngine } from '../../engines/image/imageEngine';

export const QrStudioPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'scan'>('generate');

  // Generator state
  const [text, setText] = useState('https://doculoom.pages.dev');
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Scanner state
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (text.trim()) {
      ImageEngine.generateQrCode(text, {
        width: 380,
        darkColor,
        lightColor,
        margin: 2,
      }).then((url) => setQrDataUrl(url));
    }
  }, [text, darkColor, lightColor]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    saveAs(qrDataUrl, 'qrcode.png');
    toast.success('Downloaded QR Code', 'qrcode.png');
  };

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const res = await ImageEngine.scanQrFromImage(img);
      if (res) {
        setScannedResult(res);
        toast.success('QR Code detected');
      } else {
        toast.warning('No QR code found in uploaded image');
      }
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  const handleCopyScanned = () => {
    if (!scannedResult) return;
    navigator.clipboard.writeText(scannedResult);
    setHasCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">QR Studio</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Generate high-resolution QR codes and scan QR codes locally in your browser.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
          tabs={[
            { id: 'generate', label: 'Generate QR Code' },
            { id: 'scan', label: 'Scan from Image', icon: <Scan className="w-3.5 h-3.5" /> },
          ]}
        />

        {activeTab === 'generate' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
            <div className="flex flex-col gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Content / URL
                </label>
                <textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter URL or text..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Foreground Color
                  </label>
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="w-full h-8 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="w-full h-8 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download PNG QR Code
              </Button>
            </div>

            {/* QR Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Preview"
                  className="w-48 h-48 rounded shadow-subtle border bg-white"
                />
              )}
              <span className="text-[11px] text-slate-400 mt-3 font-mono">
                Scan with any mobile camera
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleScanImage}
                className="hidden"
                id="qr-scan-input"
              />
              <label
                htmlFor="qr-scan-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Scan className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Select image with QR code
                </span>
                <span className="text-xs text-slate-400">Click to browse from device</span>
              </label>
            </div>

            {scannedResult && (
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 flex flex-col gap-2">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Decoded Content
                </span>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
                    {scannedResult}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopyScanned}
                  >
                    {hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
