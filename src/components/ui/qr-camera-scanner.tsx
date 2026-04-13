'use client';

import { useEffect, useRef, useState } from 'react';

// Extrait une représentation string de n'importe quelle erreur (pour comparaison regex)
function extractErrString(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return `${err.name} ${err.message}`;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    return [o.name, o.message, o.errorMessage].filter(Boolean).join(' ');
  }
  return String(err);
}
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
  // onScan ref pour éviter de le capturer dans useEffect
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

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

  // Démarre la caméra APRÈS le re-render React (isOpen=true rend le container visible avec des dimensions réelles)
  useEffect(() => {
    if (!isOpen || !isStarting) return;

    // `cancelled` protège contre le double-run React StrictMode (dev)
    let cancelled = false;

    const startCamera = async () => {
      try {
        // ── Pré-vérification getUserMedia ──────────────────────────────────────
        // Tester l'accès caméra AVANT html5-qrcode pour obtenir un vrai DOMException
        // avec .name/.message, plutôt que les objets custom de la lib.
        let testStream: MediaStream | null = null;
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } finally {
          // Libère la stream de test (sinon elle bloquerait l'init html5-qrcode)
          testStream?.getTracks().forEach((t) => t.stop());
        }

        if (cancelled) return;

        const qrScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        if (cancelled) {
          try { qrScanner.clear(); } catch { /* ignore */ }
          return;
        }
        scannerRef.current = qrScanner;

        const onDecoded = (decodedText: string) => {
          onScanRef.current(decodedText);
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

        // Essayer plusieurs stratégies avant de conclure "pas de caméra"
        const attemptErrors: string[] = [];
        const cameras = await Html5Qrcode.getCameras().catch((e) => {
          attemptErrors.push(`getCameras:${extractErrString(e)}`);
          return [] as Array<{ id: string; label: string }>;
        });

        const preferred = cameras.find((camera) =>
          /back|rear|environment|arriere|traseira|trasera/i.test(camera.label)
        );

        const orderedIds = [
          preferred?.id,
          ...cameras.map((camera) => camera.id),
        ].filter((id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx);

        let started = false;

        for (const deviceId of orderedIds) {
          try {
            await qrScanner.start(deviceId, config, onDecoded, undefined);
            started = true;
            break;
          } catch (e) {
            attemptErrors.push(`device:${deviceId}:${extractErrString(e)}`);
          }
        }

        if (!started) {
          try {
            await qrScanner.start({ facingMode: 'environment' }, config, onDecoded, undefined);
            started = true;
          } catch (e) {
            attemptErrors.push(`facing:environment:${extractErrString(e)}`);
          }
        }

        if (!started) {
          try {
            await qrScanner.start({ facingMode: 'user' }, config, onDecoded, undefined);
            started = true;
          } catch (e) {
            attemptErrors.push(`facing:user:${extractErrString(e)}`);
          }
        }

        if (!started) {
          throw new Error(`camera_start_failed::${attemptErrors.join(' || ') || 'no strategy succeeded'}`);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        // Normalise n'importe quel type d'erreur en {name, message}
        let errorName: string | undefined;
        let errorMsg: string | undefined;

        if (err instanceof Error) {
          errorName = err.name;
          errorMsg = err.message;
        } else if (typeof err === 'string') {
          errorMsg = err;
          if (/NotFoundError|no cameras/i.test(err)) errorName = 'NotFoundError';
          else if (/NotAllowedError|permission denied/i.test(err)) errorName = 'NotAllowedError';
          else if (/NotReadableError/i.test(err)) errorName = 'NotReadableError';
        } else if (err && typeof err === 'object') {
          // html5-qrcode v2 peut utiliser `errorMessage` au lieu de `message`
          const o = err as Record<string, unknown>;
          errorName = typeof o.name === 'string' ? o.name : undefined;
          errorMsg = typeof o.message === 'string'
            ? o.message
            : typeof o.errorMessage === 'string'
              ? o.errorMessage
              : JSON.stringify(err);
          if (!errorName && typeof o.type === 'string') {
            errorName = o.type;
          }
          // Dérive le nom si absent
          if (!errorName && errorMsg) {
            if (/NotFoundError|no cameras/i.test(errorMsg)) errorName = 'NotFoundError';
            else if (/NotAllowedError|permission/i.test(errorMsg)) errorName = 'NotAllowedError';
            else if (/NotReadableError/i.test(errorMsg)) errorName = 'NotReadableError';
          }
        }

        let message = 'Impossible de démarrer la caméra. Saisissez le code manuellement.';

        if (errorName === 'NotFoundError' || /no cameras/i.test(errorMsg ?? '')) {
          message = 'Aucune caméra compatible détectée sur cet appareil.';
        } else if (errorName === 'NotAllowedError') {
          message = 'Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur (icône cadenas dans la barre d\'adresse).';
        } else if (errorName === 'NotReadableError') {
          message = 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
        } else if (errorName === 'OverconstrainedError') {
          message = 'Aucune caméra ne correspond aux contraintes. Essayez un autre navigateur.';
        } else if (errorMsg?.includes('https') || errorMsg?.includes('secure')) {
          message = 'La caméra nécessite une connexion HTTPS.';
        } else if (errorMsg) {
          message = `Caméra indisponible: ${errorMsg.substring(0, 100)}. Saisissez le code manuellement.`;
        }

        setErrorMessage(message);
        onError?.(message);
        // Log brut intégral pour debug
        console.error('[QrCameraScanner] Erreur caméra ▶', {
          rawErr: err,
          errorName,
          errorMsg,
          isSecureContext: window.isSecureContext,
        });

        await stopScanner();
        if (isMountedRef.current) setIsOpen(false);
      } finally {
        if (!cancelled && isMountedRef.current) setIsStarting(false);
      }
    };

    startCamera();

    // Cleanup: annule l'init si React démonte entre-temps (StrictMode, navigation rapide)
    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isStarting]);

  const handleToggle = async () => {
    if (isOpen) {
      await stopScanner();
      if (isMountedRef.current) {
        setIsOpen(false);
        setIsStarting(false);
      }
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
      const message = 'La caméra nécessite HTTPS ou localhost.';
      setErrorMessage(message);
      onError?.(message);
      return;
    }

    // 1. isOpen=true → React re-render → container devient visible avec vraies dimensions
    // 2. isStarting=true → useEffect détecte les deux à true → démarre la caméra
    setIsOpen(true);
    setIsStarting(true);
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
          <div id={SCANNER_ELEMENT_ID} className="w-full min-h-[300px]" />
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
