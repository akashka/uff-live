import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPaymentHistory extends Document {
  _id: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  amount: number;
  paymentType: 'monthly' | 'piece_based';
  period?: string;
  workDetails?: { workId: mongoose.Types.ObjectId; quantity: number; rate: number }[];
  notes?: string;
  paidBy: mongoose.Types.ObjectId;
  paidAt: Date;
  createdAt: Date;
}

const PaymentHistorySchema = new Schema<IPaymentHistory>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true },
    paymentType: { type: String, enum: ['monthly', 'piece_based'], required: true },
    period: { type: String },
    workDetails: [{
      workId: { type: Schema.Types.ObjectId, ref: 'WorkMaster' },
      quantity: { type: Number },
      rate: { type: Number },
    }],
    notes: { type: String },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default (mongoose.models.PaymentHistory as Model<IPaymentHistory>) || mongoose.model<IPaymentHistory>('PaymentHistory', PaymentHistorySchema);
