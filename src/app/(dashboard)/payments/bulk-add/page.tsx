'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { useBranches, useDepartments, useEmployees, useVendors } from '@/lib/hooks/useApi';
import { toast } from '@/lib/toast';
import SearchableSelect from '@/components/ui/SearchableSelect';
import MultiselectDropdown from '@/components/MultiselectDropdown';
import SaveOverlay from '@/components/SaveOverlay';
import { roundAmount, formatAmount, formatStyleOrderDisplay } from '@/lib/utils';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const PAYMENT_MODES = [
  { _id: 'cash', name: 'Cash' },
  { _id: 'upi', name: 'UPI' },
  { _id: 'bank_transfer', name: 'Bank Transfer' },
  { _id: 'cheque', name: 'Cheque' },
  { _id: 'other', name: 'Other' },
];

export default function PaymentsBulkAddPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const canAdd = ['admin', 'finance'].includes(user?.role || '');

  const [paymentMode, setPaymentMode] = useState<'regular' | 'advance'>('regular');
  const [recipientType, setRecipientType] = useState<'full_time' | 'contractor' | 'vendor'>('full_time');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkData, setBulkData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const { branches } = useBranches(false);
  const { departments } = useDepartments(false);
  const { employees: allEmployees } = useEmployees(false, {
    limit: 0,
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
  });
  const { vendors } = useVendors(false, { limit: 0 });

  const entityOptions = useMemo(() => {
    if (recipientType === 'vendor') {
      return (Array.isArray(vendors) ? vendors : []).map((v: any) => ({ _id: v._id, name: v.name }));
    }
    return (Array.isArray(allEmployees) ? allEmployees : [])
      .filter((e: any) => e.employeeType === recipientType)
      .map((e: any) => ({ _id: e._id, name: e.name }));
  }, [allEmployees, vendors, recipientType]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkData({});
  }, [branchId, recipientType, departmentId, month, paymentMode]);

  const fetchCalculationForId = async (id: string, selectedRecords?: string[]) => {
    setBulkData(prev => ({ ...prev, [id]: { ...prev[id], loading: true } }));
    try {
      let calcRes, advRes;
      if (recipientType === 'vendor') {
        const voParam = selectedRecords ? `&selectedVendorWorkOrderIds=${selectedRecords.join(',')}` : '';
        [calcRes, advRes] = await Promise.all([
          fetch(`/api/vendor-payments/calculate?vendorId=${id}&month=${month}${voParam}`).then(r => r.json()),
          fetch(`/api/vendor-payments/advance-outstanding?vendorId=${id}&month=${month}`).then(r => r.json()),
        ]);
      } else {
        const wrParam = recipientType === 'contractor' && selectedRecords ? `&selectedWorkRecordIds=${selectedRecords.join(',')}` : '';
        const ftParam = recipientType === 'full_time' && selectedRecords ? `&selectedFullTimeWorkRecordIds=${selectedRecords.join(',')}` : '';
        [calcRes, advRes] = await Promise.all([
          fetch(`/api/payments/calculate?employeeId=${id}&month=${month}&type=${recipientType}${wrParam}${ftParam}`).then(r => r.json()),
          fetch(`/api/payments/advance-outstanding?employeeId=${id}&month=${month}`).then(r => r.json()),
        ]);
      }

      if (calcRes.error) throw new Error(calcRes.error);
      const outstanding = advRes?.error ? 0 : (advRes?.outstanding ?? 0);

      const defaultWorkRecordIds = calcRes.workRecords?.filter((r: any) => !r.isPaid && !r.isPendingApproval).map((r: any) => r._id) || [];
      const defaultFtWorkRecordIds = calcRes.fullTimeWorkRecords?.filter((r: any) => !r.isPaid).map((r: any) => r._id) || [];
      const defaultVendorWorkOrderIds = calcRes.workOrders?.filter((r: any) => !r.isPaid && !r.isPendingApproval).map((r: any) => r._id) || [];

      setBulkData(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          loading: false,
          baseAmount: calcRes.baseAmount || 0,
          otAmount: calcRes.otAmount || 0,
          pfAmount: calcRes.pf || calcRes.pfToDeduct || 0,
          esiAmount: calcRes.esi || calcRes.esiToDeduct || 0,
          otherDeducted: calcRes.other || calcRes.otherToDeduct || 0,
          addDeductAmount: prev[id]?.addDeductAmount || 0,
          addDeductRemarks: prev[id]?.addDeductRemarks || '',
          advanceDeducted: outstanding,
          paymentMethod: prev[id]?.paymentMethod || 'cash',
          transactionRef: prev[id]?.transactionRef || '',
          workRecordIds: selectedRecords || defaultWorkRecordIds,
          fullTimeWorkRecordIds: selectedRecords || defaultFtWorkRecordIds,
          vendorWorkOrderIds: selectedRecords || defaultVendorWorkOrderIds,
          allWorkRecords: calcRes.workRecords || [],
          allFullTimeWorkRecords: calcRes.fullTimeWorkRecords || [],
          allVendorWorkOrders: calcRes.workOrders || [],
          error: false
        }
      }));
    } catch (err) {
      setBulkData(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          loading: false,
          error: true,
          baseAmount: 0,
          otAmount: 0,
          pfAmount: 0,
          esiAmount: 0,
          otherDeducted: 0,
          advanceDeducted: 0,
        }
      }));
    }
  };

  useEffect(() => {
    const fetchCalculations = async () => {
      const newIds = selectedIds.filter(id => !bulkData[id]);
      if (newIds.length === 0) return;
      
      for (const id of newIds) {
        await fetchCalculationForId(id);
      }
    };

    if (selectedIds.length > 0) fetchCalculations();
  }, [selectedIds, month, recipientType, paymentMode]);

  const handleInputChange = (id: string, field: string, value: any) => {
    setBulkData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const calculateNetPay = (id: string) => {
    const data = bulkData[id];
    if (!data) return 0;
    if (paymentMode === 'advance') return data.amount || 0;

    const gross = (data.baseAmount || 0) + (data.otAmount || 0) + (data.addDeductAmount || 0);
    const deductions = (data.pfAmount || 0) + 
                       (data.esiAmount || 0) + 
                       (data.otherDeducted || 0) + 
                       (data.advanceDeducted || 0);
    return roundAmount(gross - deductions);
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    for (const id of selectedIds) {
      const data = bulkData[id];
      if (data.error) continue;

      const total = calculateNetPay(id);
      let endpoint = recipientType === 'vendor' ? '/api/vendor-payments' : '/api/payments';
      
      let payload: any = {
        month: month,
        paymentAmount: total,
        paymentMode: data.paymentMethod,
        transactionRef: data.transactionRef,
      };

      if (recipientType === 'vendor') {
        payload.vendorId = id;
        if (paymentMode === 'regular') {
          payload = {
            ...payload,
            paymentType: 'monthly',
            baseAmount: data.baseAmount,
            addDeductAmount: data.addDeductAmount,
            addDeductRemarks: data.addDeductRemarks,
            advanceDeducted: data.advanceDeducted,
            totalPayable: total,
            vendorWorkOrderIds: data.vendorWorkOrderIds || [],
          };
        } else {
          payload = {
            ...payload,
            paymentType: 'advance',
            totalPayable: total,
            addDeductRemarks: data.reasons,
          };
        }
      } else {
        payload.employeeId = id;
        payload.paymentType = recipientType;
        if (paymentMode === 'regular') {
          payload = {
            ...payload,
            baseAmount: data.baseAmount,
            addDeductAmount: data.addDeductAmount,
            addDeductRemarks: data.addDeductRemarks,
            pfDeducted: data.pfAmount,
            esiDeducted: data.esiAmount,
            otherDeducted: data.otherDeducted,
            advanceDeducted: data.advanceDeducted,
            totalPayable: total,
            isAdvance: false,
            workRecordIds: data.workRecordIds || [],
            fullTimeWorkRecordIds: data.fullTimeWorkRecordIds || [],
          };
        } else {
          payload = {
            ...payload,
            totalPayable: total,
            isAdvance: true,
            addDeductRemarks: data.reasons,
          };
        }
      }

      // Final check for empty work orders if in regular mode
      if (paymentMode === 'regular') {
        const hasWorkOrders = (payload.workRecordIds?.length || 0) > 0 || (payload.fullTimeWorkRecordIds?.length || 0) > 0 || (payload.vendorWorkOrderIds?.length || 0) > 0;
        if (!hasWorkOrders) {
           errorMessages.push(`${entityOptions.find(e => e._id === id)?.name || id}: No work orders selected`);
           continue;
        }
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) successCount++;
        else errorMessages.push(`${entityOptions.find(e => e._id === id)?.name || id}: ${result.error || 'Failed'}`);
      } catch (err) {
        errorMessages.push(`${entityOptions.find(e => e._id === id)?.name || id}: Network error`);
      }
    }

    setSaving(false);
    if (successCount > 0) toast.success(`Successfully processed ${successCount} payments`);
    if (errorMessages.length > 0) errorMessages.forEach(msg => toast.error(msg));
    if (successCount === selectedIds.length) router.push('/payments');
  };

  if (!canAdd) return <div className="p-6 text-red-500">Access Denied</div>;

  return (
    <div className="pb-24">
      <PageHeader title={`${t('add')} Bulk Payments`}>
        <button
          onClick={() => router.push('/payments')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg hover:bg-slate-100 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to List
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Payment Type</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
            >
              <option value="regular">Salary / Monthly</option>
              <option value="advance">Advance / Loan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Type</label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
            >
              <option value="full_time">Full Time (Employee)</option>
              <option value="contractor">Contractor (Employee)</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          {recipientType !== 'vendor' && (
            <>
              <SearchableSelect
                label={t('branches')}
                options={Array.isArray(branches) ? branches : []}
                value={branchId}
                onChange={setBranchId}
                placeholder="Select branch..."
              />
              <SearchableSelect
                label={t('department')}
                options={Array.isArray(departments) ? departments : []}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="All Departments"
              />
            </>
          )}
          <div className={recipientType === 'vendor' ? 'md:col-span-1' : ''}>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')}</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          
          <div className="lg:col-span-5 mt-2">
            <MultiselectDropdown
              label={recipientType === 'vendor' ? t('vendors') : t('employees')}
              options={entityOptions}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              placeholder={`Select ${recipientType === 'vendor' ? 'vendors' : 'employees'}...`}
              disabled={recipientType !== 'vendor' && !branchId}
            />
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th className="sticky left-0 z-10 bg-slate-50 text-left p-4 text-sm font-bold text-slate-800 border-r border-slate-300 min-w-[220px]">
                    Field / {recipientType === 'vendor' ? 'Vendor' : 'Employee'}
                  </th>
                  {selectedIds.map((id) => (
                    <th key={id} className="p-4 text-center text-sm font-bold text-slate-800 border-r border-slate-300 min-w-[180px]">
                      {entityOptions.find((e) => e._id === id)?.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paymentMode === 'regular' ? (
                  <>
                    <tr className="bg-white">
                      <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300 align-top">Work Orders / Records</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 align-top min-w-[250px]">
                           <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                             {recipientType === 'contractor' && (bulkData[id]?.allWorkRecords || []).map((wr: any) => {
                               const isDisabled = wr.isPaid || wr.isPendingApproval;
                               const isSelected = (bulkData[id]?.workRecordIds || []).includes(wr._id);
                               return (
                                 <label key={wr._id} className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer ${isDisabled ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50'}`}>
                                   <input
                                     type="checkbox"
                                     checked={isSelected}
                                     disabled={isDisabled || bulkData[id]?.loading}
                                     onChange={() => {
                                       const next = isSelected 
                                         ? bulkData[id].workRecordIds.filter((rid: string) => rid !== wr._id)
                                         : [...(bulkData[id].workRecordIds || []), wr._id];
                                       fetchCalculationForId(id, next);
                                     }}
                                     className="mt-0.5"
                                   />
                                   <div className="flex-1">
                                      <p className="font-semibold text-slate-700">
                                        {formatStyleOrderDisplay(wr.styleOrder?.styleCode, wr.styleOrder?.brand, wr.styleOrder?.colour) || 'Work Record'}
                                        {wr.isPaid ? ' (Paid)' : wr.isPendingApproval ? ' (Awaiting Approval)' : ''}
                                      </p>
                                      <p className="text-slate-500">₹{formatAmount(wr.totalAmount)}</p>
                                   </div>
                                 </label>
                               );
                             })}
                             {recipientType === 'full_time' && (bulkData[id]?.allFullTimeWorkRecords || []).map((wr: any) => {
                               const isDisabled = wr.isPaid;
                               const isSelected = (bulkData[id]?.fullTimeWorkRecordIds || []).includes(wr._id);
                               return (
                                 <label key={wr._id} className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer ${isDisabled ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50'}`}>
                                   <input
                                     type="checkbox"
                                     checked={isSelected}
                                     disabled={isDisabled || bulkData[id]?.loading}
                                     onChange={() => {
                                       const next = isSelected 
                                         ? bulkData[id].fullTimeWorkRecordIds.filter((rid: string) => rid !== wr._id)
                                         : [...(bulkData[id].fullTimeWorkRecordIds || []), wr._id];
                                       fetchCalculationForId(id, next);
                                     }}
                                     className="mt-0.5"
                                   />
                                   <div className="flex-1">
                                      <p className="font-semibold text-slate-700">
                                        {wr.branch?.name || 'Full Time Record'} – {wr.daysWorked}d
                                        {wr.isPaid ? ' (Paid)' : ''}
                                      </p>
                                      <p className="text-slate-500">₹{formatAmount(wr.totalAmount)}</p>
                                   </div>
                                 </label>
                               );
                             })}
                             {recipientType === 'vendor' && (bulkData[id]?.allVendorWorkOrders || []).map((wr: any) => {
                               const isDisabled = wr.isPaid || wr.isPendingApproval;
                               const isSelected = (bulkData[id]?.vendorWorkOrderIds || []).includes(wr._id);
                               return (
                                 <label key={wr._id} className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer ${isDisabled ? 'bg-slate-50 opacity-60' : 'bg-white hover:bg-slate-50'}`}>
                                   <input
                                     type="checkbox"
                                     checked={isSelected}
                                     disabled={isDisabled || bulkData[id]?.loading}
                                     onChange={() => {
                                       const next = isSelected 
                                         ? bulkData[id].vendorWorkOrderIds.filter((rid: string) => rid !== wr._id)
                                         : [...(bulkData[id].vendorWorkOrderIds || []), wr._id];
                                       fetchCalculationForId(id, next);
                                     }}
                                     className="mt-0.5"
                                   />
                                   <div className="flex-1">
                                      <p className="font-semibold text-slate-700">
                                         {formatStyleOrderDisplay(wr.styleOrder?.styleCode, wr.styleOrder?.brand, wr.styleOrder?.colour) || 'Work Order'}
                                         {wr.isPaid ? ' (Paid)' : wr.isPendingApproval ? ' (Awaiting Approval)' : ''}
                                      </p>
                                      <p className="text-slate-500">₹{formatAmount(wr.totalAmount)}</p>
                                   </div>
                                 </label>
                               );
                             })}
                             {!(bulkData[id]?.allWorkRecords?.length || bulkData[id]?.allFullTimeWorkRecords?.length || bulkData[id]?.allVendorWorkOrders?.length) && !bulkData[id]?.loading && (
                               <p className="text-slate-400 italic">No work records found</p>
                             )}
                           </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="sticky left-0 bg-slate-50/50 p-4 font-medium border-r border-slate-300">Base {recipientType === 'vendor' ? 'Amount' : 'Salary'} (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 text-center border-r border-slate-200 tabular-nums font-semibold relative">
                          {bulkData[id]?.loading && (
                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                              <div className="w-4 h-4 border-2 border-uff-accent border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                          {formatAmount(bulkData[id]?.baseAmount || 0)}
                        </td>
                      ))}
                    </tr>
                    {recipientType !== 'vendor' && (
                      <tr className="bg-slate-50/50">
                        <td className="sticky left-0 bg-slate-50/50 p-4 font-medium border-r border-slate-300">OT Amount (₹)</td>
                        {selectedIds.map(id => (
                          <td key={id} className="p-4 text-center border-r border-slate-200 tabular-nums">
                            {formatAmount(bulkData[id]?.otAmount || 0)}
                          </td>
                        ))}
                      </tr>
                    )}
                    {recipientType !== 'vendor' && (
                      <>
                        <tr>
                          <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">PF Deduction (₹)</td>
                          {selectedIds.map(id => (
                            <td key={id} className="p-4 text-center border-r border-slate-200 text-red-600 font-medium tabular-nums">
                          {formatAmount(bulkData[id]?.pfAmount || 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">ESI Deduction (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 text-center border-r border-slate-200 text-red-600 font-medium tabular-nums">
                          {formatAmount(bulkData[id]?.esiAmount || 0)}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
                <tr>
                  <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">Other Deductions (₹)</td>
                  {selectedIds.map(id => (
                    <td key={id} className="p-4 text-center border-r border-slate-200 text-red-600 font-medium tabular-nums">
                      {formatAmount(bulkData[id]?.otherDeducted || 0)}
                    </td>
                  ))}
                </tr>
                    <tr className="bg-amber-50/30">
                      <td className="sticky left-0 bg-amber-50/30 p-4 font-bold border-r border-slate-300">Bonus / Adjustments (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                           <input
                             type="number"
                             placeholder="+/- amount"
                             value={bulkData[id]?.addDeductAmount || ''}
                             onChange={(e) => handleInputChange(id, 'addDeductAmount', parseFloat(e.target.value) || 0)}
                             className="w-full px-3 py-1.5 border border-slate-300 rounded text-center font-bold text-green-700"
                           />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-amber-50/30">
                      <td className="sticky left-0 bg-amber-50/30 p-4 font-medium border-r border-slate-300 italic">Adjust. Remarks</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                           <input
                             type="text"
                             value={bulkData[id]?.addDeductRemarks || ''}
                             onChange={(e) => handleInputChange(id, 'addDeductRemarks', e.target.value)}
                             className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                             placeholder="Bonus/Penalty for..."
                           />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">Advance Deduction (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                           <input
                             type="number"
                             value={bulkData[id]?.advanceDeducted || ''}
                             onChange={(e) => handleInputChange(id, 'advanceDeducted', parseFloat(e.target.value) || 0)}
                             className="w-full px-3 py-1.5 border border-slate-300 rounded text-center text-amber-700"
                           />
                        </td>
                      ))}
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">Advance Amount (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                           <input
                             type="number"
                             value={bulkData[id]?.amount || ''}
                             onChange={(e) => handleInputChange(id, 'amount', parseFloat(e.target.value) || 0)}
                             className="w-full px-3 py-2 border border-slate-300 rounded text-center text-lg font-bold text-blue-700"
                           />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="sticky left-0 bg-white p-4 font-medium border-r border-slate-300">Purpose / Remarks</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                           <input
                             type="text"
                             value={bulkData[id]?.reasons || ''}
                             onChange={(e) => handleInputChange(id, 'reasons', e.target.value)}
                             className="w-full px-3 py-2 border border-slate-300 rounded"
                             placeholder="Loan, Advance, etc."
                           />
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* Net Pay Calculation Row */}
                <tr className="bg-uff-primary text-white font-bold">
                  <td className="sticky left-0 bg-uff-primary p-4 border-r border-uff-primary/50 uppercase tracking-wider">Net Payable</td>
                  {selectedIds.map(id => (
                    <td key={id} className="p-4 text-center text-xl tabular-nums">
                      ₹{formatAmount(calculateNetPay(id))}
                    </td>
                  ))}
                </tr>

                {/* Payment Metadata Rows */}
                <tr className="bg-slate-50/50 hover:bg-slate-100">
                  <td className="sticky left-0 bg-slate-50 p-4 font-medium border-r border-slate-300">Payment Mode</td>
                  {selectedIds.map(id => (
                    <td key={id} className="p-4 border-r border-slate-200">
                      <select
                        value={bulkData[id]?.paymentMethod || 'cash'}
                        onChange={(e) => handleInputChange(id, 'paymentMethod', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      >
                        {PAYMENT_MODES.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50/50 hover:bg-slate-100">
                  <td className="sticky left-0 bg-slate-50 p-4 font-medium border-r border-slate-300">Reference / Trx ID</td>
                  {selectedIds.map(id => (
                    <td key={id} className="p-4 border-r border-slate-200">
                      <input
                        type="text"
                        value={bulkData[id]?.transactionRef || ''}
                        onChange={(e) => handleInputChange(id, 'transactionRef', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                        placeholder="UTR, Cheque No, etc."
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixed Actions Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <button
          onClick={() => router.push('/payments')}
          className="px-6 py-2 rounded-lg border border-slate-400 text-slate-700 font-medium hover:bg-slate-50 transition"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || selectedIds.length === 0}
          className="px-10 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-bold shadow-lg disabled:opacity-50 transform active:scale-95 transition-all"
        >
          {saving ? 'Processing...' : `Pay All (${selectedIds.length})`}
        </button>
      </div>

      <SaveOverlay show={saving} label="Processing bulk payments..." />
    </div>
  );
}
