import mongoose, { Schema, Document, Model } from 'mongoose';

export type VendorPaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
export type VendorPaymentType = 'advance' | 'monthly';

export interface IVendorWorkOrderRef {
  vendorWorkOrder: mongoose.Types.ObjectId;
  totalAmount: number;
}

export interface IVendorPayment extends Document {
  _id: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  paymentType: VendorPaymentType;
  month: string; // YYYY-MM
  baseAmount: number;
  addDeductAmount: number;
  addDeductRemarks: string;
  advanceDeducted: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: VendorPaymentMode;
  transactionRef: string;
  remainingAmount: number;
  carriedForward: number;
  carriedForwardRemarks: string;
  vendorWorkOrderRefs: IVendorWorkOrderRef[];
  paidAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VendorWorkOrderRefSchema = new Schema<IVendorWorkOrderRef>(
  {
    vendorWorkOrder: { type: Schema.Types.ObjectId, ref: 'VendorWorkOrder', required: true },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const VendorPaymentSchema = new Schema<IVendorPayment>(
  {
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    paymentType: { type: String, enum: ['advance', 'monthly'], required: true },
    month: { type: String, required: true },
    baseAmount: { type: Number, required: true, default: 0 },
    addDeductAmount: { type: Number, default: 0 },
    addDeductRemarks: { type: String, default: '' },
    advanceDeducted: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true },
    paymentAmount: { type: Number, required: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'], required: true },
    transactionRef: { type: String, default: '' },
    remainingAmount: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    carriedForwardRemarks: { type: String, default: '' },
    vendorWorkOrderRefs: [VendorWorkOrderRefSchema],
    paidAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

VendorPaymentSchema.index({ vendor: 1, paidAt: -1 });
VendorPaymentSchema.index({ paidAt: -1 });
VendorPaymentSchema.index({ vendor: 1, month: 1 });

export default (mongoose.models.VendorPayment as Model<IVendorPayment>) ||
  mongoose.model<IVendorPayment>('VendorPayment', VendorPaymentSchema);
