/**
 * QR Code generation service using the `qrcode` library.
 * Generates QR code images (base64 data URLs) for parcel tracking.
 */

import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generate a QR code as a base64 data URL (PNG image).
 * Can be used directly in <img src="..." /> tags.
 */
export async function generateQRCodeImage(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    type: 'image/png',
    width: options.width ?? 256,
    margin: options.margin ?? 2,
    color: {
      dark: options.color?.dark ?? '#064e3b', // emerald-900
      light: options.color?.light ?? '#ffffff',
    },
  };

  const dataUrl = await QRCode.toDataURL(data, qrOptions);
  return dataUrl;
}

/**
 * Generate a QR code as an SVG string.
 */
export async function generateQRCodeSVG(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const qrOptions: QRCode.QRCodeToStringOptions = {
    type: 'svg',
    width: options.width ?? 256,
    margin: options.margin ?? 2,
    color: {
      dark: options.color?.dark ?? '#064e3b',
      light: options.color?.light ?? '#ffffff',
    },
  };

  const svg = await QRCode.toString(data, qrOptions);
  return svg;
}

/**
 * Generate the QR code data string for a tracking number.
 * This creates a JSON payload that relais and transporters scan.
 */
export function buildQRCodePayload(trackingNumber: string): string {
  return JSON.stringify({
    tracking: trackingNumber,
    platform: 'SwiftColis',
    generated: new Date().toISOString(),
  });
}
