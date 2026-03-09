import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStyleOrder extends Document {
  _id: mongoose.Types.ObjectId;
  styleCode: string; // Fixed 4-digit number e.g. "0001"
  brand: string;
  details?: string;
  branches: mongoose.Types.ObjectId[];
  rateMasterItems: mongoose.Types.ObjectId[];
  month: string; // YYYY-MM - single month per style order
  totalOrderQuantity: number; // Total Pieces, default 0
  clientCostPerPiece: number; // Client cost per piece, default 0
  clientCostTotalAmount: number; // Client cost total, default 0
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StyleOrderSchema = new Schema<IStyleOrder>(
  {
    styleCode: { type: String, required: true },
    brand: { type: String, required: true },
    details: { type: String, default: '' },
    branches: [{ type: Schema.Types.ObjectId, ref: 'Branch', required: true }],
    rateMasterItems: [{ type: Schema.Types.ObjectId, ref: 'RateMaster' }],
    month: { type: String, required: true }, // YYYY-MM
    totalOrderQuantity: { type: Number, default: 0, min: 0 },
    clientCostPerPiece: { type: Number, default: 0, min: 0 },
    clientCostTotalAmount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StyleOrderSchema.index({ branches: 1, isActive: 1 });
StyleOrderSchema.index({ brand: 1, styleCode: 1 }, { unique: true });
StyleOrderSchema.index({ month: 1 });

export default (mongoose.models.StyleOrder as Model<IStyleOrder>) ||
  mongoose.model<IStyleOrder>('StyleOrder', StyleOrderSchema);
