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
        // Tester l'accès caméra AVANT html5-qrcode pour obtenir un vrai DOMException.
        // Important: NotFoundError n'est pas bloquant ici; on laisse html5-qrcode tenter
        // ses propres stratégies (deviceId/facingMode), parfois plus tolérantes.
        let preflightError: unknown = null;
        let testStream: MediaStream | null = null;
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (preErr) {
          preflightError = preErr;
          const preErrString = extractErrString(preErr);
          if (/NotAllowedError|permission denied/i.test(preErrString)) {
            throw preErr;
          }
        } finally {
          // Libère la stream de test (sinon elle bloquerait l'init html5-qrcode)
          testStream?.getTracks().forEach((t) => t.stop());
        }

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

        const strategies: Array<{ key: string; camera: string | { facingMode: 'environment' | 'user' } }> = [
          ...orderedIds.map((deviceId) => ({ key: `device:${deviceId}`, camera: deviceId })),
          { key: 'facing:environment', camera: { facingMode: 'environment' as const } },
          { key: 'facing:user', camera: { facingMode: 'user' as const } },
        ];

        let started = false;

        for (const strategy of strategies) {
          if (cancelled) return;
          const attemptScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
          scannerRef.current = attemptScanner;
          try {
            await attemptScanner.start(strategy.camera, config, onDecoded, undefined);
            started = true;
            break;
          } catch (e) {
            attemptErrors.push(`${strategy.key}:${extractErrString(e)}`);
            try {
              await attemptScanner.stop();
            } catch {
              // scanner not started, ignore
            }
            try {
              attemptScanner.clear();
            } catch {
              // ignore cleanup issues between attempts
            }
            scannerRef.current = null;
          }
        }

        if (!started) {
          throw new Error(`camera_start_failed::${attemptErrors.join(' || ') || 'no strategy succeeded'}`);
        }

        if (preflightError) {
          console.warn('[QrCameraScanner] preflight getUserMedia a échoué mais un fallback a réussi:', preflightError);
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

        if (errorName === 'NotFoundError' || /no cameras|requested device not found/i.test(errorMsg ?? '')) {
          message = 'Caméra introuvable ou occupée. Vérifiez les permissions OS/navigateur puis fermez les apps qui utilisent déjà la caméra.';
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
          attemptHint: 'Si Requested device not found persiste, le navigateur expose un deviceId invalide ou la caméra est indisponible',
        });

        await stopScanner();
        if (isMountedRef.current) setIsOpen(false);
      } finally {
        if (!cancelled && isMountedRef.current) setIsStarting(false);
      }
    };

    startCamera();

    // Cleanup: annule uniquement l'init en cours.
    // Ne pas stopper le scanner ici, sinon un changement d'état (isStarting -> false)
    // coupe la vidéo juste après démarrage et provoque un écran noir / AbortError.
    return () => {
      cancelled = true;
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

    // Vérification informative des entrées vidéo exposées par le navigateur.
    // Ne pas bloquer ici: certains navigateurs renvoient 0 caméra avant consentement utilisateur.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some((d) => d.kind === 'videoinput');
      if (!hasVideoInput) {
        console.warn('[QrCameraScanner] enumerateDevices: aucun videoinput avant permission, poursuite du démarrage');
      }
    } catch {
      // Si enumerateDevices échoue, on continue vers le flux normal.
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
              id="qr-manual-code"
              name="qrManualCode"
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
