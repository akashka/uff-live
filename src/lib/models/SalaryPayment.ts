import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISalaryPayment extends Document {
  _id: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  month: Date;
  grossSalary: number;
  deductions: {
    pf: number;
    esi: number;
    other: number;
  };
  netSalary: number;
  status: 'pending' | 'paid';
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryPaymentSchema = new Schema<ISalaryPayment>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: Date, required: true },
    grossSalary: { type: Number, required: true, min: 0 },
    deductions: {
      pf: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    netSalary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default (mongoose.models.SalaryPayment as Model<ISalaryPayment>) ||
  mongoose.model<ISalaryPayment>('SalaryPayment', SalaryPaymentSchema);
