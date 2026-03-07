import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkItem {
  rateMaster: mongoose.Types.ObjectId;
  rateName: string;
  unit: string;
  quantity: number;
  multiplier?: number; // NO OF FIX: amount = quantity × (multiplier || 1) × ratePerUnit
  remarks?: string;
  ratePerUnit: number;
  amount: number;
}

export interface IWorkRecord extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  branch: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  styleOrder?: mongoose.Types.ObjectId;
  workItems: IWorkItem[];
  otHours?: number;
  otAmount?: number;
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkItemSchema = new Schema<IWorkItem>(
  {
    rateMaster: { type: Schema.Types.ObjectId, ref: 'RateMaster', required: true },
    rateName: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    multiplier: { type: Number, default: 1, min: 0 },
    remarks: { type: String, default: '' },
    ratePerUnit: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const WorkRecordSchema = new Schema<IWorkRecord>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    month: { type: String, required: true }, // YYYY-MM
    styleOrder: { type: Schema.Types.ObjectId, ref: 'StyleOrder', default: null },
    workItems: [WorkItemSchema],
    otHours: { type: Number, default: 0, min: 0 },
    otAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Indexes for list queries at scale (lakhs of work records)
WorkRecordSchema.index({ employee: 1, month: -1 });
WorkRecordSchema.index({ employee: 1, month: 1 });
WorkRecordSchema.index({ createdAt: -1 });
WorkRecordSchema.index({ branch: 1, month: -1 });
WorkRecordSchema.index({ styleOrder: 1, branch: 1, month: 1 });

export default (mongoose.models.WorkRecord as Model<IWorkRecord>) ||
  mongoose.model<IWorkRecord>('WorkRecord', WorkRecordSchema);
