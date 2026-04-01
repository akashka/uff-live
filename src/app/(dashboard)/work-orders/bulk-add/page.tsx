'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { 
  useBranches, 
  useDepartments, 
  useEmployees, 
  useVendors, 
  useRates, 
  useStyleOrdersByBranchMonth 
} from '@/lib/hooks/useApi';
import { formatAmount, formatStyleOrderDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SearchableSelect from '@/components/ui/SearchableSelect';
import MultiselectDropdown from '@/components/MultiselectDropdown';
import SaveOverlay from '@/components/SaveOverlay';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
}

interface RateMaster {
  _id: string;
  name: string;
  unit: string;
  amountForBranch?: number;
}

interface StyleOrderWithAvailability {
  _id: string;
  styleCode: string;
  brand?: string;
  colour?: string;
  monthData?: {
    entries: { 
      rateMasterId: string; 
      rateName?: string; 
      unit?: string; 
      totalOrderQuantity: number; 
      availableQuantity: number;
      ratePerUnit?: number;
    }[];
  } | null;
}

export default function WorkOrderBulkAddPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');

  const [mode, setMode] = useState<'full_time' | 'contractor' | 'vendor'>('full_time');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  
  // Style Order selection
  const [styleOrderId, setStyleOrderId] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkData, setBulkData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // API Data
  const { branches } = useBranches(false);
  const { departments } = useDepartments(false);
  const { vendors: vendorList } = useVendors(false, { limit: 0 });
  const { employees: allEmployees } = useEmployees(false, {
    limit: 0,
    branchId: branchId || undefined,
    departmentId: departmentId || undefined,
  });

  const { rates: allRates } = useRates(false, branchId || undefined, departmentId || undefined);
  const { styleOrders: stylesForForm } = useStyleOrdersByBranchMonth(
    mode === 'vendor' ? undefined : (branchId || undefined), 
    month || undefined, 
    !!month
  );

  const selectedStyle = useMemo(() => 
    stylesForForm?.find((s: { _id: string }) => s._id === styleOrderId) as StyleOrderWithAvailability | undefined,
    [stylesForForm, styleOrderId]
  );

  // Options for selection
  const entityOptions = useMemo(() => {
    if (mode === 'vendor') {
      return (Array.isArray(vendorList) ? vendorList : []).map((v: any) => ({ _id: v._id, name: v.name }));
    }
    return (Array.isArray(allEmployees) ? allEmployees : [])
      .filter((e: Employee) => e.employeeType === mode)
      .map((e: Employee) => ({ _id: e._id, name: e.name }));
  }, [mode, allEmployees, vendorList]);

  // Work Items (Rate Masters) to show as rows
  const workItemRows = useMemo(() => {
    if (mode === 'full_time') return [];
    
    let rows: any[] = [];
    if (styleOrderId && selectedStyle?.monthData?.entries) {
      rows = selectedStyle.monthData.entries;
    } else if (mode === 'contractor') {
      rows = Array.isArray(allRates) ? allRates : [];
    }

    if (mode === 'contractor' && (branchId || departmentId)) {
      const rateMap = new Map((allRates || []).map((r: any) => [r._id, r]));
      return rows
        .map((row) => {
          const id = row._id || row.rateMasterId;
          const rateData = rateMap.get(id);
          if (!rateData) return null;

          // Strict filter: must have THIS branch and department in the rate master
          const hasStrictMatch = rateData.branchDepartmentRates?.some((bdr: any) => {
            const bid = bdr.branch && typeof bdr.branch === 'object' && '_id' in bdr.branch ? String(bdr.branch._id) : String(bdr.branch);
            const did = bdr.department && typeof bdr.department === 'object' && '_id' in bdr.department ? String(bdr.department._id) : String(bdr.department);
            return bid === branchId && (!departmentId || did === departmentId);
          });
          if (!hasStrictMatch && departmentId) return null;

          return {
            ...row,
            amountForBranch: rateData.amountForBranch,
            name: row.name || row.rateName || rateData.name,
            unit: row.unit || rateData.unit || 'pcs'
          };
        })
        .filter(Boolean) as any[];
    }

    if (mode === 'vendor') {
      const rateMap = new Map((allRates || []).map((r: any) => [r._id, r]));
      return rows.map((row) => {
        const id = row._id || row.rateMasterId;
        const rateData = rateMap.get(id);
        // Pricing "as for the contractors" (fetching from Rate Master)
        const defaultPrice = rateData?.amountForBranch ?? rateData?.branchDepartmentRates?.[0]?.amount ?? rateData?.branchRates?.[0]?.amount ?? 0;
        return {
          ...row,
          amountForBranch: defaultPrice,
          name: row.name || row.rateName || rateData?.name || row.name,
          unit: row.unit || rateData?.unit || row.unit || 'pcs'
        };
      });
    }

    return rows;
  }, [mode, allRates, selectedStyle, styleOrderId, branchId, departmentId]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkData({});
  }, [branchId, mode, departmentId, month, styleOrderId]);

  useEffect(() => {
    const newData = { ...bulkData };
    selectedIds.forEach((id) => {
      if (!newData[id]) {
        newData[id] = {
          daysWorked: 0,
          otHours: 0,
          otAmount: 0,
          notes: '',
          workItems: {} as Record<string, { quantity: number; ratePerUnit: number; remarks: string }>,
          extraAmount: 0,
          reasons: '',
        };
        // Initialize work items with default rates if available
        workItemRows.forEach((r: any) => {
          const itemId = r._id || r.rateMasterId;
          const defaultRate = r.ratePerUnit || r.amountForBranch || 0;
          newData[id].workItems[itemId] = { 
            quantity: 0, 
            ratePerUnit: defaultRate, 
            remarks: '' 
          };
        });
      }
    });
    // Cleanup
    Object.keys(newData).forEach((id) => {
      if (!selectedIds.includes(id)) delete newData[id];
    });
    setBulkData(newData);
  }, [selectedIds, workItemRows, mode]);

  const handleInputChange = (id: string, field: string, value: any, subField?: string) => {
    setBulkData((prev) => {
      const current = { ...prev[id] };
      if (subField) {
        current[field] = {
          ...current[field],
          [subField]: value
        };
      } else {
        current[field] = value;
      }
      return { ...prev, [id]: current };
    });
  };

  const handleWorkItemChange = (id: string, itemId: string, field: string, value: any) => {
    setBulkData((prev) => {
      const current = { ...prev[id] };
      const workItems = { ...current.workItems };
      workItems[itemId] = {
        ...workItems[itemId],
        [field]: value
      };
      current.workItems = workItems;
      return { ...prev, [id]: current };
    });
  };

  const calculateTotal = (id: string) => {
    const data = bulkData[id];
    if (!data) return 0;
    let total = 0;
    if (mode === 'full_time') return 0;
    Object.values(data.workItems || {}).forEach((wi: any) => {
      total += (wi.quantity || 0) * (wi.ratePerUnit || 0);
    });
    total += (data.otAmount || 0);
    total += (data.extraAmount || 0);
    return total;
  };

  const validateQuantities = () => {
    if (!styleOrderId || !selectedStyle) return true;

    for (const item of workItemRows) {
      const itemId = item._id || item.rateMasterId;
      const available = item.availableQuantity ?? Infinity;
      
      let totalEntered = 0;
      selectedIds.forEach(id => {
        totalEntered += (bulkData[id]?.workItems?.[itemId]?.quantity || 0);
      });

      if (totalEntered > available) {
        toast.error(`Total quantity for ${item.name || item.rateName} (${totalEntered}) exceeds available (${available})`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    if (mode !== 'full_time' && !styleOrderId) {
      toast.error('Please select a Style/Order');
      return;
    }
    if (!validateQuantities()) return;
    
    setSaving(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    for (const id of selectedIds) {
      const data = bulkData[id];
      let payload: any = {};
      let endpoint = '';

      if (mode === 'full_time') {
        endpoint = '/api/full-time-work-records';
        payload = {
          employeeId: id,
          branchId: branchId,
          month: month,
          daysWorked: data.daysWorked || 0,
          otHours: data.otHours || 0,
          notes: data.notes || '',
        };
      } else if (mode === 'contractor') {
        endpoint = '/api/work-records';
        const workItemsArr = Object.entries(data.workItems || {})
          .filter(([, wi]: [string, any]) => (wi.quantity || 0) > 0 && (wi.ratePerUnit || 0) > 0)
          .map(([itemId, wi]: [string, any]) => ({
            rateMasterId: itemId,
            quantity: wi.quantity,
            ratePerUnit: wi.ratePerUnit,
            remarks: wi.remarks,
          }));
        payload = {
          employeeId: id,
          branchId: branchId,
          month: month,
          styleOrderId: styleOrderId,
          workItems: workItemsArr,
          otHours: data.otHours || 0,
          otAmount: data.otAmount || 0,
          notes: data.notes || '',
        };
      } else if (mode === 'vendor') {
        endpoint = '/api/vendor-work-orders';
        const workItemsArr = Object.entries(data.workItems || {})
          .filter(([, wi]: [string, any]) => (wi.quantity || 0) > 0 && (wi.ratePerUnit || 0) > 0)
          .map(([itemId, wi]: [string, any]) => ({
            rateMasterId: itemId,
            quantity: wi.quantity,
            ratePerUnit: wi.ratePerUnit,
            remarks: wi.remarks,
          }));
        payload = {
          vendorId: id,
          month: month,
          styleOrderId: styleOrderId,
          workItems: workItemsArr,
          extraAmount: data.extraAmount || 0,
          reasons: data.reasons || '',
        };
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
    if (successCount > 0) toast.success(`Successfully saved ${successCount} work orders`);
    if (errorMessages.length > 0) errorMessages.forEach(msg => toast.error(msg));
    if (successCount === selectedIds.length) router.push('/work-orders');
  };

  if (!canAdd) return <div className="p-6 text-red-500">Access Denied</div>;

  return (
    <div className="pb-24">
      <PageHeader title={`${t('add')} Bulk ${t('workOrders')}`} />

      {/* Filters Hub */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Type</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
            >
              <option value="full_time">Full Time</option>
              <option value="contractor">Contractor</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')}</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {mode !== 'vendor' && (
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

          {mode !== 'full_time' && (
            <div className={mode === 'vendor' ? 'md:col-span-2' : ''}>
              <SearchableSelect
                label={t('styleOrder')}
                options={(Array.isArray(stylesForForm) ? stylesForForm : []).map((s: any) => ({
                  _id: s._id,
                  name: formatStyleOrderDisplay(s.styleCode, s.brand, s.colour) || s._id
                }))}
                value={styleOrderId}
                onChange={setStyleOrderId}
                placeholder="Select Style/Order..."
              />
            </div>
          )}
          
          <div className="lg:col-span-5 mt-2">
            <MultiselectDropdown
              label={mode === 'vendor' ? t('vendors') : t('employees')}
              options={entityOptions}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              placeholder={`Select ${mode === 'vendor' ? 'vendors' : 'employees'}...`}
              disabled={mode === 'full_time' ? !branchId : !styleOrderId}
            />
          </div>
        </div>
      </div>

      {/* Tabular Entry Area */}
      {selectedIds.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <th className="sticky left-0 z-10 bg-slate-50 text-left p-4 text-sm font-bold text-slate-800 border-r border-slate-300 min-w-[280px]">
                    Field / {mode === 'vendor' ? 'Vendor' : 'Employee'}
                  </th>
                  {selectedIds.map((id) => (
                    <th key={id} className="p-4 text-center text-sm font-bold text-slate-800 border-r border-slate-300 min-w-[200px]">
                      {entityOptions.find((e) => e._id === id)?.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Mode Specific Rows */}
                {mode === 'full_time' && (
                  <>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-slate-50 p-4 text-sm font-medium text-slate-700 border-r border-slate-300">Days Worked</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 text-center">
                          <input
                            type="number" step="0.5"
                            value={bulkData[id]?.daysWorked || ''}
                            onChange={(e) => handleInputChange(id, 'daysWorked', parseFloat(e.target.value) || 0)}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded text-center focus:ring-2 focus:ring-uff-accent"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-slate-50 p-4 text-sm font-medium text-slate-700 border-r border-slate-300">OT Hours</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 text-center">
                          <input
                            type="number" step="0.5"
                            value={bulkData[id]?.otHours || ''}
                            onChange={(e) => handleInputChange(id, 'otHours', parseFloat(e.target.value) || 0)}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded text-center focus:ring-2 focus:ring-uff-accent"
                          />
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {(mode === 'contractor' || mode === 'vendor') && workItemRows.map((item: any) => {
                  const itemId = item._id || item.rateMasterId;
                  const itemName = item.name || item.rateName || 'Unknown Item';
                  const available = item.availableQuantity;
                  const defaultPrice = item.ratePerUnit || item.amountForBranch || 0;

                  return (
                    <tr key={itemId} className="hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-slate-50 p-4 text-sm border-r border-slate-300">
                        <div className="font-bold text-slate-800">{itemName}</div>
                        {available != null && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Available: <span className="font-bold text-uff-accent">{available}</span> | Price: <span className="font-bold">₹{defaultPrice}</span>
                          </div>
                        )}
                        {available == null && defaultPrice > 0 && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Default Price: <span className="font-bold">₹{defaultPrice}</span>
                          </div>
                        )}
                      </td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                             <div className="flex-1">
                               <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Qty</label>
                               <input
                                 type="number"
                                 value={bulkData[id]?.workItems?.[itemId]?.quantity || ''}
                                 onChange={(e) => handleWorkItemChange(id, itemId, 'quantity', parseFloat(e.target.value) || 0)}
                                 className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-sm"
                                 placeholder="0"
                               />
                             </div>
                             <div className="flex-1">
                               <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Rate</label>
                               <input
                                 type="number" step="0.01"
                                 value={bulkData[id]?.workItems?.[itemId]?.ratePerUnit || ''}
                                 onChange={(e) => handleWorkItemChange(id, itemId, 'ratePerUnit', parseFloat(e.target.value) || 0)}
                                 className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-sm font-semibold"
                                 placeholder="0.00"
                               />
                             </div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* OT Fields for Contractor */}
                {mode === 'contractor' && (
                  <>
                    <tr className="border-t-2 border-slate-300 bg-amber-50/50">
                      <td className="sticky left-0 bg-amber-50/50 p-4 text-sm font-bold text-slate-800 border-r border-slate-300 italic">OT Hours</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 text-center">
                          <input
                            type="number" step="0.5"
                            value={bulkData[id]?.otHours || ''}
                            onChange={(e) => handleInputChange(id, 'otHours', parseFloat(e.target.value) || 0)}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded text-center bg-white"
                            placeholder="0"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-amber-50/50">
                      <td className="sticky left-0 bg-amber-50/50 p-4 text-sm font-bold text-slate-800 border-r border-slate-300 italic">OT Amount (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 text-center">
                          <input
                            type="number"
                            value={bulkData[id]?.otAmount || ''}
                            onChange={(e) => handleInputChange(id, 'otAmount', parseFloat(e.target.value) || 0)}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded text-center bg-white font-bold text-green-700"
                            placeholder="0"
                          />
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {mode === 'vendor' && (
                  <>
                    <tr className="border-t-2 border-slate-300 bg-amber-50/50">
                      <td className="sticky left-0 bg-amber-50/50 p-4 text-sm font-bold text-slate-800 border-r border-slate-300 italic">Extra Amount (₹)</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200 text-center">
                          <input
                            type="number"
                            value={bulkData[id]?.extraAmount || ''}
                            onChange={(e) => handleInputChange(id, 'extraAmount', parseFloat(e.target.value) || 0)}
                            className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded text-center bg-white font-bold text-green-700"
                            placeholder="0"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-amber-50/50">
                      <td className="sticky left-0 bg-amber-50/50 p-4 text-sm font-bold text-slate-800 border-r border-slate-300 italic">Reasons</td>
                      {selectedIds.map(id => (
                        <td key={id} className="p-4 border-r border-slate-200">
                          <input
                            type="text"
                            value={bulkData[id]?.reasons || ''}
                            onChange={(e) => handleInputChange(id, 'reasons', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                            placeholder="Explanation..."
                          />
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* Calculation / Total Row */}
                {(mode === 'contractor' || mode === 'vendor') && (
                  <tr className="bg-uff-primary text-white font-bold">
                    <td className="sticky left-0 bg-uff-primary p-4 text-sm border-r border-uff-primary/50 uppercase tracking-widest">Gross Total</td>
                    {selectedIds.map(id => (
                      <td key={id} className="p-4 text-center text-xl tabular-nums">
                        ₹{formatAmount(calculateTotal(id))}
                      </td>
                    ))}
                  </tr>
                )}

                {/* Notes Row */}
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="sticky left-0 bg-slate-50 p-4 text-sm font-medium text-slate-700 border-r border-slate-300">General Notes</td>
                  {selectedIds.map(id => (
                    <td key={id} className="p-4 border-r border-slate-200">
                      <textarea
                        value={bulkData[id]?.notes || ''}
                        onChange={(e) => handleInputChange(id, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-uff-accent"
                        rows={2}
                        placeholder="Internal notes..."
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
          onClick={() => router.push('/work-orders')}
          className="px-6 py-2 rounded-lg border border-slate-400 text-slate-700 font-medium hover:bg-slate-50 transition"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || selectedIds.length === 0}
          className="px-10 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-bold shadow-lg disabled:opacity-50 transform active:scale-95 transition-all"
        >
          {saving ? 'Saving...' : `${t('save')} All (${selectedIds.length})`}
        </button>
      </div>

      <SaveOverlay show={saving} label="Saving bulk work records..." />
    </div>
  );
}
