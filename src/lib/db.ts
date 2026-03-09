import mongoose from 'mongoose';
// Ensure Branch and Department are registered before models that ref them (Employee, WorkRecord, RateMaster)
import '@/lib/models/Branch';
import '@/lib/models/Department';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/factory-management';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in your .env.local file');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
