import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'branch_create'
  | 'branch_update'
  | 'branch_import'
  | 'department_create'
  | 'department_update'
  | 'employee_create'
  | 'employee_update'
  | 'employee_import'
  | 'user_create'
  | 'user_update'
  | 'rate_create'
  | 'rate_update'
  | 'rate_import'
  | 'style_order_create'
  | 'style_order_update'
  | 'style_order_delete'
  | 'style_order_import'
  | 'work_record_create'
  | 'work_record_update'
  | 'work_record_delete'
  | 'work_record_import'
  | 'vendor_create'
  | 'vendor_update'
  | 'vendor_import'
  | 'vendor_work_order_create'
  | 'vendor_work_order_update'
  | 'vendor_work_order_delete'
  | 'vendor_work_order_import'
  | 'vendor_payment_create'
  | 'payment_create'
  | 'profile_update'
  | 'profile_photo_update'
  | 'profile_document_upload';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  action: AuditAction;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    actorId: { type: String, default: null },
    actorEmail: { type: String, default: null },
    actorRole: { type: String, default: null },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export default (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
