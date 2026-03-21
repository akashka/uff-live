import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  // Allow static assets, maintenance page, and auth during maintenance
  const path = request.nextUrl.pathname;
  if (
    path.startsWith('/_next') ||
    path.startsWith('/maintenance') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/logout') ||
    path.startsWith('/api/auth/me') ||
    path === '/login' ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // Block write operations on API
  if (path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return NextResponse.json(
      { error: 'System is under maintenance. Please try again later.' },
      { status: 503 }
    );
  }

  // For page requests (dashboard, etc.), redirect to maintenance page
  return NextResponse.redirect(new URL('/maintenance', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uff-logo.png).*)'],
};
