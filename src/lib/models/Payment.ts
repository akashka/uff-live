import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';

export interface IWorkRecordRef {
  workRecord: mongoose.Types.ObjectId;
  totalAmount: number;
}

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  paymentType: 'contractor' | 'full_time';
  month: string; // YYYY-MM
  baseAmount: number;
  addDeductAmount: number;
  addDeductRemarks: string;
  pfDeducted: number;
  esiDeducted: number;
  advanceDeducted?: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: PaymentMode;
  transactionRef: string;
  remainingAmount: number;
  carriedForward: number;
  carriedForwardRemarks: string;
  isAdvance: boolean;
  workRecordRefs: IWorkRecordRef[];
  /** For full_time salary: days worked in the month (used for proration) */
  daysWorked?: number;
  /** For full_time salary: total working days in the month */
  totalWorkingDays?: number;
  paidAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkRecordRefSchema = new Schema<IWorkRecordRef>(
  {
    workRecord: { type: Schema.Types.ObjectId, ref: 'WorkRecord', required: true },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    paymentType: { type: String, enum: ['contractor', 'full_time'], required: true },
    month: { type: String, required: true }, // YYYY-MM
    baseAmount: { type: Number, required: true, default: 0 },
    addDeductAmount: { type: Number, default: 0 },
    addDeductRemarks: { type: String, default: '' },
    pfDeducted: { type: Number, default: 0 },
    esiDeducted: { type: Number, default: 0 },
    advanceDeducted: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true },
    paymentAmount: { type: Number, required: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'], required: true },
    transactionRef: { type: String, default: '' },
    remainingAmount: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    carriedForwardRemarks: { type: String, default: '' },
    isAdvance: { type: Boolean, default: false },
    workRecordRefs: [WorkRecordRefSchema],
    daysWorked: { type: Number },
    totalWorkingDays: { type: Number },
    paidAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes for list queries at scale (lakhs of payments)
PaymentSchema.index({ employee: 1, paidAt: -1 });
PaymentSchema.index({ paidAt: -1 });
PaymentSchema.index({ employee: 1, month: 1 });

export default (mongoose.models.Payment as Model<IPayment>) ||
  mongoose.model<IPayment>('Payment', PaymentSchema);
