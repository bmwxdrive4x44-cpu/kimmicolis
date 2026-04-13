'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QrCameraScannerProps {
  onScan: (rawValue: string) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
}

const SCANNER_ELEMENT_ID = 'qr-camera-scanner-container';

export function QrCameraScanner({ onScan, disabled = false, onError }: QrCameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const state = scanner.getState();
      if (
        state === Html5QrcodeScannerState.SCANNING ||
        state === Html5QrcodeScannerState.PAUSED
      ) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
  };

  const handleToggle = async () => {
    if (isOpen) {
      await stopScanner();
      if (isMountedRef.current) setIsOpen(false);
      return;
    }

    setErrorMessage(null);
    setManualInput('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      const message = 'Votre navigateur ne supporte pas l\'accès caméra pour ce scanner.';
      setErrorMessage(message);
      onError?.(message);
      return;
    }

    if (!window.isSecureContext) {
      const message = 'La caméra nécessite HTTPS ou localhost (évitez 127.0.0.1 si permission refusée).';
      setErrorMessage(message);
      onError?.(message);
      return;
    }

    setIsOpen(true);
    setIsStarting(true);

    if (!isMountedRef.current) return;

    try {
      const qrScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = qrScanner;

      const onDecoded = (decodedText: string) => {
        onScan(decodedText);
        stopScanner().then(() => {
          if (isMountedRef.current) setIsOpen(false);
        });
      };

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8);
          return { width: edge, height: edge };
        },
      };

      // Prefer rear camera; if unavailable, fallback to front camera.
      try {
        await qrScanner.start({ facingMode: 'environment' }, config, onDecoded, undefined);
      } catch (firstErr: unknown) {
        const firstErrorName = (firstErr as { name?: string })?.name;

        if (firstErrorName === 'NotAllowedError') {
          throw firstErr;
        }

        await qrScanner.start({ facingMode: 'user' }, config, onDecoded, undefined);
      }
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      const errorMsg = (err as { message?: string })?.message;
      let message = 'Impossible de démarrer la caméra QR. Vous pouvez saisir le code manuellement.';

      if (errorName === 'NotFoundError') {
        message = 'Aucune caméra compatible détectée. Vérifiez qu\'une webcam est branchée/active.';
      } else if (errorName === 'NotAllowedError') {
        message = 'Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur (cadenas dans la barre d\'adresse).';
      } else if (errorName === 'NotReadableError') {
        message = 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
      } else if (errorName === 'OverconstrainedError') {
        message = 'Aucune caméra ne correspond aux contraintes demandées. Essayez un autre navigateur.';
      } else if (errorMsg?.includes('https') || errorMsg?.includes('secure')) {
        message = 'La caméra nécessite une connexion HTTPS. Saisissez le code manuellement.';
      } else if (errorName) {
        message = `Caméra indisponible (${errorName}). Saisissez le code manuellement.`;
      }

      setErrorMessage(message);
      onError?.(message);

      // Log detailed error info for debugging
      console.error('[QrCameraScanner] Erreur caméra:', {
        name: errorName,
        message: errorMsg,
        isSecureContext: window.isSecureContext,
        fullError: err,
      });

      await stopScanner();
      if (isMountedRef.current) setIsOpen(false);
    } finally {
      if (isMountedRef.current) setIsStarting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) return;

    onScan(trimmed);
    setManualInput('');
    setErrorMessage(null);
    stopScanner().then(() => {
      if (isMountedRef.current) setIsOpen(false);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        {isOpen ? (
          <>
            <CameraOff className="h-4 w-4 mr-2" />
            Fermer la caméra
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            Scanner via caméra
          </>
        )}
      </Button>

      <div className={`relative rounded-lg overflow-hidden border bg-black ${isOpen ? 'block' : 'hidden'}`}>
          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          <div id={SCANNER_ELEMENT_ID} className="w-full" />
      </div>

      {errorMessage && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700">
            {errorMessage}
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Saisissez le code QR (ex: SC123456)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded bg-white text-black placeholder-gray-400"
              autoFocus
              autoComplete="off"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!manualInput.trim()}
              className="whitespace-nowrap"
            >
              Soumettre
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
