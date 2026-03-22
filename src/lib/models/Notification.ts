import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  | 'work_record_created'
  | 'work_record_updated'
  | 'work_record_deleted'
  | 'work_record_rate_override_pending'
  | 'work_record_rate_override_approved'
  | 'vendor_work_order_rate_override_pending'
  | 'vendor_work_order_rate_override_approved'
  | 'payment_created'
  | 'style_order_created'
  | 'style_order_updated'
  | 'style_order_deleted'
  | 'employee_created'
  | 'employee_updated'
  | 'birthday_reminder'
  | 'anniversary_reminder';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  readAt: Date | null;
  metadata: {
    entityId?: string;
    entityType?: string;
    actorId?: string;
    actorRole?: string;
    employeeId?: string;
    employeeName?: string;
    month?: string;
    amount?: number;
    styleCode?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, required: true, default: '/' },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, readAt: 1 });

export default (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>('Notification', NotificationSchema);
