import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMonthWiseData {
  month: string; // YYYY-MM
  totalOrderQuantity: number;
  sellingPricePerQuantity: number;
}

export interface IStyleOrder extends Document {
  _id: mongoose.Types.ObjectId;
  styleCode: string;
  details?: string;
  branches: mongoose.Types.ObjectId[];
  rateMasterItems: mongoose.Types.ObjectId[];
  monthWiseData: IMonthWiseData[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MonthWiseDataSchema = new Schema<IMonthWiseData>(
  {
    month: { type: String, required: true }, // YYYY-MM
    totalOrderQuantity: { type: Number, required: true, min: 0 },
    sellingPricePerQuantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const StyleOrderSchema = new Schema<IStyleOrder>(
  {
    styleCode: { type: String, required: true },
    details: { type: String, default: '' },
    branches: [{ type: Schema.Types.ObjectId, ref: 'Branch', required: true }],
    rateMasterItems: [{ type: Schema.Types.ObjectId, ref: 'RateMaster' }],
    monthWiseData: [MonthWiseDataSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StyleOrderSchema.index({ branches: 1, isActive: 1 });
StyleOrderSchema.index({ styleCode: 1 }, { unique: true });
StyleOrderSchema.index({ 'monthWiseData.month': 1 });

export default (mongoose.models.StyleOrder as Model<IStyleOrder>) ||
  mongoose.model<IStyleOrder>('StyleOrder', StyleOrderSchema);
