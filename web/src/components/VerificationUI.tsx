import React, { useState, useRef, useCallback } from 'react';
import { mobileLogin, getMobileSettings, submitVerification } from '../services/api';

type Step = 'login' | 'capture' | 'result';

interface VerificationResult {
  success: boolean;
  code?: string;
  message?: string;
  data?: {
    transactionGuid?: string;
    verified?: 'TRUE' | 'FALSE';
    person?: Record<string, any>;
    image?: string;
    reason?: string;
  } | null;
  verificationType?: string;
}

export default function VerificationUI() {
  const [step, setStep] = useState<Step>('login');
  const [mobileToken, setMobileToken] = useState('');
  const [settings, setSettings] = useState<any>(null);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Capture state
  const [cardNumber, setCardNumber] = useState('');
  const [cardNumberError, setCardNumberError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const loginResult = await mobileLogin(loginUsername, loginPassword);
      setMobileToken(loginResult.token);
      const s = await getMobileSettings(loginResult.token);
      setSettings(s);
      setStep('capture');
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function validateCardNumber(val: string): boolean {
    const pattern = /^GHA-\d{9}-\d$/;
    return pattern.test(val);
  }

  function handleCardNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setCardNumber(val);
    if (val && !validateCardNumber(val)) {
      setCardNumberError('Format: GHA-XXXXXXXXX-X');
    } else {
      setCardNumberError('');
    }
  }

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Please allow camera permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  function captureFrame() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');

    const targetWidth = 480;
    const targetHeight = 640;

    const videoAspect = video.videoWidth / video.videoHeight;
    const targetAspect = targetWidth / targetHeight;

    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

    if (videoAspect > targetAspect) {
      sw = video.videoHeight * targetAspect;
      sx = (video.videoWidth - sw) / 2;
    } else {
      sh = video.videoWidth / targetAspect;
      sy = (video.videoHeight - sh) / 2;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    stopCamera();
  }

  const toggleFacing = useCallback(async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(newFacing);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }, [cameraFacing]);

  async function handleSubmit() {
    if (!validateCardNumber(cardNumber)) {
      setCardNumberError('Format: GHA-XXXXXXXXX-X');
      return;
    }
    if (!capturedImage) {
      setSubmitError('Please capture a selfie first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const base64 = capturedImage.replace(/^data:image\/png;base64,/, '');
      const res = await submitVerification(mobileToken, {
        pinNumber: cardNumber,
        image: base64,
        livenessPassed: true,
      });
      setResult({ ...res, verificationType: settings?.defaultVerificationType ?? 'kyc' });
      setStep('result');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStep('capture');
    setCardNumber('');
    setCapturedImage(null);
    setResult(null);
    setSubmitError('');
    setCardNumberError('');
  }

  // ── Login Step ────────────────────────────────────────────────────────
  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Verification Portal</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to verify Ghana Cards</p>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 text-sm">{loginError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loginLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Result Step ───────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const isKyc = result.verificationType === 'kyc';
    const person = result.data?.person;
    const verified = result.data?.verified === 'TRUE' || result.success;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-lg">
          {isKyc && person ? (
            // Ghana Card display for KYC
            <div className="mb-6">
              <h3 className="text-white font-semibold text-lg mb-4 text-center">Identity Verified</h3>
              <div
                style={{
                  background: 'linear-gradient(135deg, #1a3a1a 0%, #0d2b0d 50%, #1a3a1a 100%)',
                  border: '2px solid #b8860b',
                  borderRadius: 16,
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 }}>
                  <div style={{ width: '100%', height: '100%', backgroundImage: 'repeating-linear-gradient(45deg, #b8860b 0, #b8860b 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, background: '#b8860b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#1a3a1a', fontWeight: 'bold', fontSize: 18 }}>GH</span>
                    </div>
                    <div>
                      <p style={{ color: '#b8860b', fontWeight: 'bold', fontSize: 14, margin: 0 }}>REPUBLIC OF GHANA</p>
                      <p style={{ color: '#9dc08b', fontSize: 11, margin: 0 }}>NATIONAL IDENTIFICATION AUTHORITY</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    {result.data?.image ? (
                      <img
                        src={`data:image/jpeg;base64,${result.data.image}`}
                        alt="ID Photo"
                        style={{ width: 90, height: 110, objectFit: 'cover', border: '2px solid #b8860b', borderRadius: 6 }}
                      />
                    ) : (
                      <div style={{ width: 90, height: 110, background: '#2d4a2d', border: '2px solid #b8860b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#b8860b', fontSize: 32 }}>👤</span>
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#b8860b', fontSize: 10, margin: '0 0 2px' }}>SURNAME</p>
                      <p style={{ color: 'white', fontWeight: 'bold', fontSize: 15, margin: '0 0 10px' }}>{person.surname ?? person.Surname ?? '—'}</p>
                      <p style={{ color: '#b8860b', fontSize: 10, margin: '0 0 2px' }}>FORENAMES</p>
                      <p style={{ color: 'white', fontSize: 13, margin: '0 0 10px' }}>{person.forenames ?? person.Forenames ?? person.firstName ?? '—'}</p>
                      <div style={{ display: 'flex', gap: 20 }}>
                        <div>
                          <p style={{ color: '#b8860b', fontSize: 10, margin: '0 0 2px' }}>DATE OF BIRTH</p>
                          <p style={{ color: 'white', fontSize: 12, margin: 0 }}>{person.dateOfBirth ?? person.DateOfBirth ?? person.dob ?? '—'}</p>
                        </div>
                        <div>
                          <p style={{ color: '#b8860b', fontSize: 10, margin: '0 0 2px' }}>GENDER</p>
                          <p style={{ color: 'white', fontSize: 12, margin: 0 }}>{person.gender ?? person.Gender ?? '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #b8860b44' }}>
                    <p style={{ color: '#b8860b', fontSize: 10, margin: '0 0 2px' }}>CARD NUMBER</p>
                    <p style={{ color: '#9dc08b', fontFamily: 'monospace', fontSize: 14, letterSpacing: 2, margin: 0 }}>{cardNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Pass/Fail banner for yes_no
            <div className={`rounded-2xl p-8 text-center mb-6 ${verified ? 'bg-green-900/40 border border-green-500' : 'bg-red-900/40 border border-red-500'}`}>
              <div className={`text-6xl mb-4`}>{verified ? '✅' : '❌'}</div>
              <h3 className={`text-2xl font-bold ${verified ? 'text-green-400' : 'text-red-400'}`}>
                {verified ? 'Identity Verified' : 'Verification Failed'}
              </h3>
              {result.data?.reason && (
                <p className="text-slate-300 mt-2 text-sm">{result.data.reason}</p>
              )}
              {result.message && (
                <p className="text-slate-400 mt-2 text-sm">{result.message}</p>
              )}
            </div>
          )}

          {result.data?.transactionGuid && (
            <p className="text-slate-500 text-xs text-center mb-6 font-mono">
              Transaction: {result.data.transactionGuid}
            </p>
          )}

          <button
            onClick={resetAll}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            New Verification
          </button>
        </div>
      </div>
    );
  }

  // ── Capture Step ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Ghana Card Verification</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['Card Number', 'Selfie', 'Submit'].map((label, i) => {
            const isDone = i === 0 ? !!cardNumber && !cardNumberError : i === 1 ? !!capturedImage : false;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-slate-600 -mt-4" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card number input */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Ghana Card Number</label>
          <input
            type="text"
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="GHA-123456789-0"
            maxLength={15}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500 uppercase"
          />
          {cardNumberError && <p className="text-red-400 text-xs mt-1.5">{cardNumberError}</p>}
        </div>

        {/* Camera section */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Selfie Photo</p>

          {!showCamera && !capturedImage && (
            <div>
              {cameraError && <p className="text-red-400 text-xs mb-3">{cameraError}</p>}
              <button
                onClick={startCamera}
                className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white py-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Open Camera
              </button>
            </div>
          )}

          {showCamera && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-black"
                style={{ aspectRatio: '3/4', objectFit: 'cover' }}
              />
              {/* Overlay frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative" style={{ width: '70%', aspectRatio: '3/4' }}>
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-cyan-400" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-cyan-400" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-cyan-400" />
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={toggleFacing}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Flip
                </button>
                <button
                  onClick={captureFrame}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Capture
                </button>
                <button
                  onClick={stopCamera}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {capturedImage && !showCamera && (
            <div>
              <img src={capturedImage} alt="Captured selfie" className="w-full rounded-lg" style={{ aspectRatio: '3/4', objectFit: 'cover' }} />
              <button
                onClick={() => { setCapturedImage(null); startCamera(); }}
                className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
              >
                Retake
              </button>
            </div>
          )}
        </div>

        {submitError && (
          <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">{submitError}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !capturedImage || !cardNumber || !!cardNumberError}
          className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Verifying…' : 'Verify Identity'}
        </button>
      </div>
    </div>
  );
}
