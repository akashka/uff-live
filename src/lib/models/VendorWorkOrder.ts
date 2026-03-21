import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVendorWorkItem {
  rateMaster?: mongoose.Types.ObjectId | null;
  /** For vendor-only items (no rate master): stitching | cutting | finishing-packing */
  workItemKey?: string;
  rateName: string;
  unit: string;
  quantity: number;
  multiplier?: number;
  remarks?: string;
  ratePerUnit: number;
  amount: number;
}

export interface IVendorWorkOrder extends Document {
  _id: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  branch?: mongoose.Types.ObjectId | null; // Optional for vendor - removed per requirements
  month: string; // YYYY-MM
  styleOrder?: mongoose.Types.ObjectId;
  colour?: string; // Optional - from style order colours when selected
  workItems: IVendorWorkItem[];
  extraAmount?: number;
  reasons?: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const VendorWorkItemSchema = new Schema<IVendorWorkItem>(
  {
    rateMaster: { type: Schema.Types.ObjectId, ref: 'RateMaster', default: null },
    workItemKey: { type: String, default: null },
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

const VendorWorkOrderSchema = new Schema<IVendorWorkOrder>(
  {
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: false, default: null },
    month: { type: String, required: true },
    styleOrder: { type: Schema.Types.ObjectId, ref: 'StyleOrder', default: null },
    colour: { type: String, default: '' },
    workItems: [VendorWorkItemSchema],
    extraAmount: { type: Number, default: 0, min: 0 },
    reasons: { type: String, default: '' },
    totalAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

VendorWorkOrderSchema.index({ vendor: 1, month: -1 });
VendorWorkOrderSchema.index({ vendor: 1, month: 1 });
VendorWorkOrderSchema.index({ createdAt: -1 });
VendorWorkOrderSchema.index({ branch: 1, month: -1 });
VendorWorkOrderSchema.index({ styleOrder: 1, branch: 1, month: 1 });

export default (mongoose.models.VendorWorkOrder as Model<IVendorWorkOrder>) ||
  mongoose.model<IVendorWorkOrder>('VendorWorkOrder', VendorWorkOrderSchema);
