import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  
  // Get the request cookies to properly clear them
  const requestCookies = request.cookies;
  
  // Clear all possible NextAuth cookies with correct options
  const cookiesToClear = [
    // Non-secure cookies (http)
    { name: 'next-auth.session-token', secure: false },
    { name: 'next-auth.csrf-token', secure: false },
    { name: 'next-auth.callback-url', secure: false },
    // Secure cookies (https)
    { name: '__Secure-next-auth.session-token', secure: true },
    { name: '__Secure-next-auth.csrf-token', secure: true },
    { name: '__Secure-next-auth.callback-url', secure: true },
  ];
  
  // Clear each cookie with proper options
  cookiesToClear.forEach(({ name, secure }) => {
    // Delete using the cookies API
    response.cookies.delete(name);
    
    // Also explicitly set to expired with matching options
    response.cookies.set(name, '', {
      expires: new Date(0),
      path: '/',
      secure: secure,
      httpOnly: true,
      sameSite: 'lax',
    });
  });
  
  // Also clear any other session-related cookies that might exist
  const allCookies = requestCookies.getAll();
  allCookies.forEach(cookie => {
    if (cookie.name.includes('next-auth') || cookie.name.includes('session')) {
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, '', {
        expires: new Date(0),
        path: '/',
        secure: cookie.name.startsWith('__Secure-'),
        httpOnly: true,
        sameSite: 'lax',
      });
    }
  });
  
  return response;
}
