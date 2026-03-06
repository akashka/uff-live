import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkMaster extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  ratePerPiece: number;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkMasterSchema = new Schema<IWorkMaster>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    ratePerPiece: { type: Number, required: true, default: 0 },
    unit: { type: String, default: 'piece' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default (mongoose.models.WorkMaster as Model<IWorkMaster>) || mongoose.model<IWorkMaster>('WorkMaster', WorkMasterSchema);
