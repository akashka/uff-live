import mongoose, { Schema, Document, Model } from 'mongoose';

export type EmployeeType = 'full_time' | 'contractor';

export interface IEmployee extends Document {
  _id: mongoose.Types.ObjectId;
  employeeId: string; // Unique login identifier, e.g. REC001
  name: string;
  contactNumber: string;
  email: string;
  emergencyNumber: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  maritalStatus?: 'single' | 'married' | 'other';
  anniversaryDate?: Date;
  aadhaarNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
  panNumber?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  accountNumber?: string;
  upiId?: string;
  photo?: string;
  documents?: { type: string; name?: string; fileUrl: string; uploadedAt: Date }[];
  employeeType: EmployeeType;
  branches: mongoose.Types.ObjectId[];
  department?: mongoose.Types.ObjectId; // Department the employee works in
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  esiOpted?: boolean;
  monthlyEsiAmount?: number;
  /** Full-time: monthly salary (mutually exclusive with dailySalary) */
  monthlySalary?: number;
  /** Full-time: daily salary (mutually exclusive with monthlySalary). Payment = dailySalary × daysWorked */
  dailySalary?: number;
  /** Full-time: mandatory overtime cost per hour. OT amount = otHours × this */
  overtimeCostPerHour?: number;
  salaryBreakup?: {
    pf?: number;
    esi?: number;
  };
  /** Multiple other deductions with reason. Total = sum(amount) */
  otherDeductions?: { reason: string; amount: number }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    contactNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    emergencyNumber: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    maritalStatus: { type: String, enum: ['single', 'married', 'other'], required: false },
    anniversaryDate: { type: Date, required: false },
    aadhaarNumber: { type: String, default: '' },
    pfNumber: { type: String, default: '' },
    esiNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    upiId: { type: String, default: '' },
    photo: { type: String, default: '' },
    documents: [{
      type: { type: String, required: true },
      name: { type: String, default: '' },
      fileUrl: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
    employeeType: { type: String, enum: ['full_time', 'contractor'], default: 'full_time' },
    branches: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: false },
    pfOpted: { type: Boolean, default: false },
    monthlyPfAmount: { type: Number, default: 0 },
    esiOpted: { type: Boolean, default: false },
    monthlyEsiAmount: { type: Number, default: 0 },
    monthlySalary: { type: Number, default: 0 },
    dailySalary: { type: Number, default: 0 },
    overtimeCostPerHour: { type: Number, default: 0 },
    salaryBreakup: {
      pf: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
    },
    otherDeductions: [{
      reason: { type: String, default: '' },
      amount: { type: Number, default: 0 },
    }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for list queries and lookups at scale (100s of employees)
EmployeeSchema.index({ isActive: 1, createdAt: -1 });
EmployeeSchema.index({ email: 1 });
EmployeeSchema.index({ contactNumber: 1 });
EmployeeSchema.index({ employeeId: 1 });
EmployeeSchema.index({ name: 1 });
EmployeeSchema.index({ employeeType: 1, isActive: 1 });
EmployeeSchema.index({ department: 1 });

export default (mongoose.models.Employee as Model<IEmployee>) || mongoose.model<IEmployee>('Employee', EmployeeSchema);
