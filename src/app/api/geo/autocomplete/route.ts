import { NextRequest, NextResponse } from 'next/server';

import { WILAYAS } from '@/lib/constants';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';

type NominatimEntry = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    county?: string;
  };
};

function normalize(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/wilaya\s+d[e']?\s*/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveWilayaId(entry: NominatimEntry): string | null {
  const candidates = [
    entry.address?.state,
    entry.address?.county,
    entry.address?.city,
    entry.address?.town,
    entry.address?.village,
    entry.address?.municipality,
  ]
    .map((value) => normalize(String(value || '')))
    .filter(Boolean);

  if (candidates.length === 0) return null;

  for (const wilaya of WILAYAS) {
    const name = normalize(wilaya.name);
    if (candidates.some((candidate) => candidate === name || candidate.includes(name) || name.includes(candidate))) {
      return wilaya.id;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.public);
  if (rateCheck.limited) {
    return NextResponse.json({ error: 'Too many requests', retryAfter: rateCheck.retryAfter }, { status: 429 });
  }

  const query = String(request.nextUrl.searchParams.get('q') || '').trim();
  const limitParam = Number.parseInt(String(request.nextUrl.searchParams.get('limit') || '6'), 10);
  const limit = Number.isFinite(limitParam) ? Math.min(10, Math.max(1, limitParam)) : 6;

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('addressdetails', '1');
  endpoint.searchParams.set('countrycodes', 'dz');
  endpoint.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        'User-Agent': 'SwiftColis/1.0 (support@swiftcolis.dz)',
        'Accept-Language': 'fr,en',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const payload = (await response.json()) as NominatimEntry[];
    const suggestions = (Array.isArray(payload) ? payload : [])
      .map((entry) => {
        const lat = Number.parseFloat(String(entry.lat || ''));
        const lon = Number.parseFloat(String(entry.lon || ''));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const city = entry.address?.city || entry.address?.town || entry.address?.village || entry.address?.municipality || '';
        const state = entry.address?.state || entry.address?.county || '';

        return {
          label: String(entry.display_name || '').trim(),
          lat,
          lon,
          city,
          state,
          wilayaId: resolveWilayaId(entry),
        };
      })
      .filter((entry): entry is { label: string; lat: number; lon: number; city: string; state: string; wilayaId: string | null } => Boolean(entry));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[geo/autocomplete] request failed', error);
    return NextResponse.json({ suggestions: [] });
  }
}
