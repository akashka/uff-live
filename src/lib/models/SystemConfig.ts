import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISystemConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  value: unknown;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

SystemConfigSchema.index({ key: 1 });

export default (mongoose.models.SystemConfig as Model<ISystemConfig>) ||
  mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
