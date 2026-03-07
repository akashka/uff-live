import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import { getAuthUser, hasRole } from '@/lib/auth';
import { getMetrics } from '@/lib/health';

export async function GET() {
  const start = Date.now();
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let dbLatencyMs = 0;

    try {
      await connectDB();
      const state = mongoose.connection.readyState;
      dbStatus = state === 1 ? 'connected' : state === 0 ? 'disconnected' : 'error';
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'error';
      dbLatencyMs = Date.now() - start;
    }

    const metrics = getMetrics();

    return NextResponse.json({
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      api: metrics,
      uptimeSeconds: Math.floor(process.uptime()),
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
