import { NextResponse } from 'next/server';

export function GET(request: Request) {
  const url = new URL('/logo.svg', request.url);
  return NextResponse.redirect(url, { status: 307 });
}
