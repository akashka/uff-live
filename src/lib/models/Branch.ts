import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBranch extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    email: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default (mongoose.models.Branch as Model<IBranch>) || mongoose.model<IBranch>('Branch', BranchSchema);
