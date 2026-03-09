import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVendor extends Document {
  _id: mongoose.Types.ObjectId;
  vendorId: string; // Unique identifier, e.g. VEN001
  name: string;
  contactNumber: string;
  email?: string;
  /** Service type / task outsourced, e.g. stitching, finishing */
  serviceType: string;
  address?: string;
  /** Banking details for payments */
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  accountNumber?: string;
  upiId?: string;
  panNumber?: string;
  gstNumber?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>(
  {
    vendorId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, default: '' },
    serviceType: { type: String, required: true },
    address: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    upiId: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VendorSchema.index({ isActive: 1, createdAt: -1 });
VendorSchema.index({ vendorId: 1 });
VendorSchema.index({ name: 1 });
VendorSchema.index({ serviceType: 1 });

export default (mongoose.models.Vendor as Model<IVendor>) || mongoose.model<IVendor>('Vendor', VendorSchema);
