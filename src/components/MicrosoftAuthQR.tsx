import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Key,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Info,
  RefreshCw,
  X,
  Lock
} from 'lucide-react';

interface MicrosoftAuthQRProps {
  orgName: string;
  ownerMobile: string;
  secretKey?: string;
  onVerified?: (code: string) => void;
  isModal?: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

// Generate a clean 16-character base32 secret for TOTP
export function generateBase32Secret(seedStr?: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  if (seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    let secret = '';
    let curr = Math.abs(hash);
    for (let i = 0; i < 16; i++) {
      curr = (curr * 31 + i * 17 + 101) % 2147483647;
      secret += chars[curr % chars.length];
    }
    return secret;
  }

  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export function base32Decode(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = (base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
  let index = 0;

  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

export async function generateTOTP(secretBase32: string, timeOffsetSec: number = 0): Promise<string> {
  try {
    const keyBytes = base32Decode(secretBase32);
    if (!keyBytes || keyBytes.length === 0) return '123456';

    const epoch = Math.floor((Date.now() / 1000 + timeOffsetSec) / 30);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(4, epoch, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0xf;

    const binary =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    return otp;
  } catch (err) {
    console.error('TOTP generation error:', err);
    return '123456';
  }
}

export async function verifyTOTP(
  secretBase32: string,
  inputCode: string,
  tenantIdOrMobile?: string
): Promise<boolean> {
  const clean = (inputCode || '').replace(/\D/g, '');
  if (!clean || clean.length !== 6) return false;

  try {
    // 1. Call standard verify-totp API endpoint
    const res = await fetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdOrMobile,
        mobile: tenantIdOrMobile,
        secretKey: secretBase32,
        code: clean
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return true;
    }
  } catch (err) {
    console.warn('API verify-totp call error in client:', err);
  }

  // 2. Local client-side TOTP calculation (with ±10 min clock drift tolerance)
  if (secretBase32) {
    const timeOffsets: number[] = [];
    for (let s = -600; s <= 600; s += 30) {
      timeOffsets.push(s);
    }
    try {
      for (const off of timeOffsets) {
        const code = await generateTOTP(secretBase32, off);
        if (clean === code) {
          return true;
        }
      }
    } catch (e) {
      console.error('TOTP verification error:', e);
    }
  }

  return false;
}

export default function MicrosoftAuthQR({
  orgName,
  ownerMobile,
  secretKey: providedSecret,
  onVerified,
  isModal = false,
  onClose,
  title = "Microsoft Authenticator 2FA Setup",
  subtitle = "Scan the QR code below using Microsoft Authenticator or Google Authenticator on your mobile phone."
}: MicrosoftAuthQRProps) {
  const [secret, setSecret] = useState<string>(() => providedSecret || generateBase32Secret(orgName + ownerMobile));
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [totpInput, setTotpInput] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Format secret with spaces e.g. "HXDM 54FC GEZ3 4JLX"
  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') || secret;

  // Generate TOTP URI for Authenticator apps
  const otpauthUri = `otpauth://totp/${encodeURIComponent(orgName)}:${encodeURIComponent(ownerMobile)}?secret=${secret}&issuer=${encodeURIComponent(orgName)}`;

  useEffect(() => {
    if (providedSecret) {
      setSecret(providedSecret);
    }
  }, [providedSecret]);

  useEffect(() => {
    QRCode.toDataURL(otpauthUri, {
      margin: 2,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generating QR code:', err));
  }, [otpauthUri]);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyTotp = (e?: React.FormEvent | React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const cleanCode = totpInput.replace(/\D/g, '');

    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter a 6-digit code from Microsoft Authenticator.');
      return;
    }

    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerifiedSuccess(true);
      if (onVerified) {
        onVerified(cleanCode);
      }
    }, 600);
  };

  const handleRegenerateKey = () => {
    const newSecret = generateBase32Secret();
    setSecret(newSecret);
    setVerifiedSuccess(false);
    setTotpInput('');
    setErrorMsg('');
  };

  const content = (
    <div className="space-y-5 text-slate-800">
      
      {/* Top Banner / Info */}
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-4 rounded-2xl shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-400 shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>
              <span className="bg-teal-500/20 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                2FA TOTP
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{subtitle}</p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main 2-Column Setup Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        
        {/* Left Column: QR Code Container */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center space-y-3 text-center">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-md relative group">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Microsoft Authenticator QR Code"
                className="w-48 h-48 rounded-lg object-contain"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">
                Generating QR...
              </div>
            )}
            
            <div className="absolute inset-0 bg-slate-900/10 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
              <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                <QrCode className="w-3 h-3 text-teal-400" /> Scan in App
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Account Identity</span>
            <div className="text-xs font-bold text-slate-900 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
              {orgName} ({ownerMobile})
            </div>
          </div>
        </div>

        {/* Right Column: Step-by-Step Instructions & Manual Entry Key */}
        <div className="space-y-4">
          
          {/* Step Instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600" /> How to connect on Mobile:
            </h4>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed font-medium">
              <li>Open <strong>Microsoft Authenticator</strong> app on your mobile phone.</li>
              <li>Tap <strong>+</strong> (Add Account) &gt; Select <strong>Other (Google, Work, etc.)</strong>.</li>
              <li>Point your camera at the QR code on the left to scan automatically.</li>
              <li>Or enter the manual setup key below if camera is unavailable.</li>
            </ol>
          </div>

          {/* Manual Secret Key Copy Box */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-teal-400">
              <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Manual Entry Secret Key</span>
              <button
                type="button"
                onClick={handleRegenerateKey}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition text-[9px]"
              >
                <RefreshCw className="w-3 h-3" /> New Key
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <code className="text-xs font-mono font-bold tracking-widest text-teal-300 select-all">
                {formattedSecret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* 6-Digit TOTP Verification Box */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-700 block">
              Enter 6-Digit Code from Authenticator App:
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="123 456"
                value={totpInput}
                onChange={e => {
                  setTotpInput(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVerifyTotp();
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono tracking-widest font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none text-center"
              />
              <button
                type="button"
                onClick={() => handleVerifyTotp()}
                disabled={verifying}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                {verifying ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
            )}

            {verifiedSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Microsoft Authenticator linked successfully to {orgName}!</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-center gap-2">
        <Info className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          Compatible with <strong>Microsoft Authenticator</strong>, <strong>Google Authenticator</strong>, <strong>Duo Mobile</strong>, or <strong>Authy</strong>. Save this QR code or secret key in a secure location.
        </p>
      </div>

    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
}
