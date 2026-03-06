import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBranchRate {
  branch: mongoose.Types.ObjectId;
  amount: number;
}

export interface IRateMaster extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  unit: string;
  branchRates: IBranchRate[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchRateSchema = new Schema<IBranchRate>(
  {
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const RateMasterSchema = new Schema<IRateMaster>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    unit: { type: String, required: true, default: 'per piece' },
    branchRates: [BranchRateSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default (mongoose.models.RateMaster as Model<IRateMaster>) ||
  mongoose.model<IRateMaster>('RateMaster', RateMasterSchema);
