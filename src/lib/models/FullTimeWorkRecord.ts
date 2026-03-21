import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFullTimeWorkRecord extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  daysWorked: number;
  otHours: number;
  otAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FullTimeWorkRecordSchema = new Schema<IFullTimeWorkRecord>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    month: { type: String, required: true },
    daysWorked: { type: Number, required: true, min: 0 },
    otHours: { type: Number, default: 0, min: 0 },
    otAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

FullTimeWorkRecordSchema.index({ employee: 1, month: 1 });
FullTimeWorkRecordSchema.index({ branch: 1, month: -1 });
FullTimeWorkRecordSchema.index({ createdAt: -1 });

export default (mongoose.models.FullTimeWorkRecord as Model<IFullTimeWorkRecord>) ||
  mongoose.model<IFullTimeWorkRecord>('FullTimeWorkRecord', FullTimeWorkRecordSchema);
