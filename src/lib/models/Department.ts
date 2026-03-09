import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DepartmentSchema.index({ isActive: 1 });
DepartmentSchema.index({ name: 1 });

export default (mongoose.models.Department as Model<IDepartment>) || mongoose.model<IDepartment>('Department', DepartmentSchema);
