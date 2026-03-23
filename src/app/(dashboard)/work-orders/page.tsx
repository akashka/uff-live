'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell, DataTableEmpty } from '@/components/ui/DataTable';
import { PageLoader } from '@/components/Skeleton';
import { useWorkOrders, useBranches, useDepartments, useEmployees, useVendors } from '@/lib/hooks/useApi';
import { formatMonth, formatAmount } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { toast } from '@/lib/toast';
import WorkOrderFormContractor from '@/components/work-orders/WorkOrderFormContractor';
import WorkOrderFormFullTime from '@/components/work-orders/WorkOrderFormFullTime';
import WorkOrderFormVendor from '@/components/work-orders/WorkOrderFormVendor';

export type WorkOrderType = 'contractor' | 'full_time' | 'vendor';

interface WorkOrderRow {
  _id: string;
  type: WorkOrderType;
  month: string;
  totalAmount: number;
  subjectName: string;
  branchName?: string;
  styleCode?: string;
  raw: Record<string, unknown>;
}

export default function WorkOrdersPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const canAccessAll = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const isContractorEmployee = !!user?.employeeId && user?.employeeType === 'contractor';
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const canAccess = canAccessAll || isContractorEmployee;

  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') as WorkOrderType | null;
  const [filterType, setFilterType] = useState<WorkOrderType | ''>(initialType || '');
  useEffect(() => {
    if (initialType) setFilterType(initialType);
  }, [initialType]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [page, setPage] = useState(1);

  const { records, total, limit, hasMore, loading, mutate } = useWorkOrders(
    {
      type: filterType || undefined,
      employeeId: filterEmployee || undefined,
      vendorId: filterVendor || undefined,
      branchId: filterBranch || undefined,
      departmentId: filterDepartment || undefined,
      month: filterMonth || undefined,
      page,
      limit: 50,
    },
    canAccess
  );

  const { branches } = useBranches(false);
  const { departments } = useDepartments(true);
  const { employees: empList } = useEmployees(false, { limit: 0, departmentId: filterDepartment || undefined });
  const { vendors: vendorList } = useVendors(false, { limit: 0 });

  const employees = (Array.isArray(empList) ? empList : []).filter((e: { employeeType: string }) => e.employeeType === 'contractor');
  const vendors = (Array.isArray(vendorList) ? vendorList : []).filter((v: { isActive?: boolean }) => v.isActive !== false);

  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [createStep, setCreateStep] = useState<'type' | 'form'>('type');
  const [createType, setCreateType] = useState<WorkOrderType | null>(null);
  const [editingRecord, setEditingRecord] = useState<WorkOrderRow | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('month-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  const recordIdFromUrl = searchParams.get('recordId');
  const vendorWorkOrderIdFromUrl = searchParams.get('vendorWorkOrderId');

  useEffect(() => {
    if (recordIdFromUrl && canAccessAll) {
      const found = (Array.isArray(records) ? records : []).find((r: WorkOrderRow) => r._id === recordIdFromUrl && r.type === 'contractor');
      if (found) {
        setCreateType('contractor');
        setCreateStep('form');
        setEditingRecord(found);
        setModal('view');
      } else if (!loading) {
        fetch(`/api/work-records/${recordIdFromUrl}`)
          .then((res) => res.ok ? res.json() : null)
          .then((raw) => {
            if (raw) {
              setCreateType('contractor');
              setCreateStep('form');
              setEditingRecord({ _id: raw._id, type: 'contractor', month: raw.month, totalAmount: raw.totalAmount, subjectName: (raw.employee as { name?: string })?.name || '', raw });
              setModal('view');
            }
          })
          .catch(() => {});
      }
    }
  }, [recordIdFromUrl, records, loading, canAccessAll]);

  useEffect(() => {
    if (vendorWorkOrderIdFromUrl && canAccessAll) {
      const found = (Array.isArray(records) ? records : []).find((r: WorkOrderRow) => r._id === vendorWorkOrderIdFromUrl && r.type === 'vendor');
      if (found) {
        setCreateType('vendor');
        setCreateStep('form');
        setEditingRecord(found);
        setModal('view');
      } else if (!loading) {
        fetch(`/api/vendor-work-orders/${vendorWorkOrderIdFromUrl}`)
          .then((res) => res.ok ? res.json() : null)
          .then((raw) => {
            if (raw) {
              setCreateType('vendor');
              setCreateStep('form');
              setEditingRecord({ _id: raw._id, type: 'vendor', month: raw.month, totalAmount: raw.totalAmount, subjectName: (raw.vendor as { name?: string })?.name || '', raw });
              setModal('view');
            }
          })
          .catch(() => {});
      }
    }
  }, [vendorWorkOrderIdFromUrl, records, loading, canAccessAll]);

  // Quick Action Handler
  const quickAction = searchParams.get('action');
  const qaType = searchParams.get('type') as WorkOrderType | null;
  const qaEmployeeId = searchParams.get('employeeId');
  const qaEmployeeName = searchParams.get('employeeName');
  const qaVendorId = searchParams.get('vendorId');
  const qaVendorName = searchParams.get('vendorName');
  const qaMonth = searchParams.get('month');
  const qaStyleCode = searchParams.get('styleCode');

  useEffect(() => {
    if (quickAction === 'create_work_order' && qaType) {
      if (modal !== 'create') {
        const dummyRaw: any = {};
        if (qaMonth) dummyRaw.month = qaMonth;
        if (qaType === 'contractor' || qaType === 'full_time') {
           if (qaEmployeeId) dummyRaw.employee = { _id: qaEmployeeId, name: qaEmployeeName };
        } else if (qaType === 'vendor') {
           if (qaVendorId) dummyRaw.vendor = { _id: qaVendorId, name: qaVendorName };
        }
        if (qaStyleCode) dummyRaw.styleOrder = { styleCode: qaStyleCode };
        
        setCreateType(qaType);
        setCreateStep('form');
        setEditingRecord({
          _id: '',
          type: qaType,
          month: qaMonth || '',
          totalAmount: 0,
          subjectName: qaEmployeeName || qaVendorName || '',
          raw: dummyRaw
        });
        setModal('create');
        
        // Remove params from URL so it doesn't reopen on refresh
        window.history.replaceState(null, '', '/work-orders');
      }
    }
  }, [quickAction, qaType, qaEmployeeId, qaVendorId, qaMonth, qaStyleCode, modal]);

  const filtered = (Array.isArray(records) ? records : []).filter((r: WorkOrderRow) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.subjectName?.toLowerCase().includes(q) ||
      r.branchName?.toLowerCase().includes(q) ||
      r.styleCode?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a: WorkOrderRow, b: WorkOrderRow) => {
    if (sortBy === 'amount-asc') return (a.totalAmount || 0) - (b.totalAmount || 0);
    if (sortBy === 'amount-desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sortBy === 'month-asc') return (a.month || '').localeCompare(b.month || '');
    return (b.month || '').localeCompare(a.month || '');
  });

  const SORT_OPTIONS = [
    { value: 'month-desc', label: `${t('month')} (newest)` },
    { value: 'month-asc', label: `${t('month')} (oldest)` },
    { value: 'amount-desc', label: `${t('totalAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('totalAmount')} (low–high)` },
  ];

  const openCreate = () => {
    setCreateStep('type');
    setCreateType(null);
    setEditingRecord(null);
    setModal('create');
  };

  const handleTypeSelected = (type: WorkOrderType) => {
    setCreateType(type);
    setCreateStep('form');
  };

  const openEdit = (r: WorkOrderRow) => {
    setEditingRecord(r);
    setCreateType(r.type);
    setCreateStep('form');
    setModal('edit');
  };

  const openView = (r: WorkOrderRow) => {
    setEditingRecord(r);
    setCreateType(r.type);
    setCreateStep('form');
    setModal('view');
  };

  const handleFormClose = () => {
    setModal(null);
    setCreateStep('type');
    setCreateType(null);
    setEditingRecord(null);
    mutate();
  };

  const handleDelete = (r: WorkOrderRow) => {
    setConfirmModal({
      message: t('confirmDelete'),
      confirmLabel: t('delete'),
      variant: 'danger',
      onConfirm: async () => {
        const api = r.type === 'contractor' ? '/api/work-records' : r.type === 'full_time' ? '/api/full-time-work-records' : '/api/vendor-work-orders';
        const res = await fetch(`${api}/${r._id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutate();
      },
    });
  };

  const getTypeLabel = (type: WorkOrderType) => {
    if (type === 'contractor') return t('contractor');
    if (type === 'full_time') return t('fullTime');
    return t('vendor');
  };

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-700">{t('accessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('workOrders')} />
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('workOrders')}>
        {canAdd && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
          >
            {t('add')} {t('workOrder')}
          </button>
        )}
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchPlaceholder={t('search')}
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('type') || 'Type'}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as WorkOrderType | '')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
            >
              <option value="">{t('all')}</option>
              {canAccessAll && (
                <>
                  <option value="contractor">{t('contractor')}</option>
                  <option value="full_time">{t('fullTime')}</option>
                  <option value="vendor">{t('vendor')}</option>
                </>
              )}
              {isContractorEmployee && !canAccessAll && <option value="contractor">{t('contractor')}</option>}
            </select>
          </div>
          {canAccessAll && filterType === 'contractor' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('employeeName')}</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
              >
                <option value="">{t('all')}</option>
                {employees.map((e: { _id: string; name: string }) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          {canAccessAll && filterType === 'vendor' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('vendor')}</label>
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
              >
                <option value="">{t('all')}</option>
                {vendors.map((v: { _id: string; name: string }) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('branches')}</label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
            >
              <option value="">{t('all')}</option>
              {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          {canAccessAll && (filterType === 'contractor' || filterType === 'full_time') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('filterByDepartment')}</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
              >
                <option value="">{t('all')}</option>
                {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('month')}</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
            />
          </div>
        </div>
      </ListToolbar>

      {viewMode === 'table' ? (
        <>
          <DataTable>
            <DataTableHeader className="bg-slate-50">
              <tr>
                <DataTableHead>{t('type') || 'Type'}</DataTableHead>
                <DataTableHead>{filterType === 'vendor' ? t('vendor') : t('employeeName')}</DataTableHead>
                <DataTableHead>{t('branches')}</DataTableHead>
                <DataTableHead>{t('month')}</DataTableHead>
                <DataTableHead>{t('styleOrder')}</DataTableHead>
                <DataTableHead align="right">{t('totalAmount')}</DataTableHead>
                <DataTableHead align="right">{t('actions')}</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {sorted.length === 0 ? (
                <DataTableEmpty colSpan={7}>{t('noData')}</DataTableEmpty>
              ) : (
                sorted.map((r: WorkOrderRow) => (
                  <DataTableRow key={`${r.type}-${r._id}`}>
                    <DataTableCell>
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800">
                        {getTypeLabel(r.type)}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="font-medium text-slate-800">{r.subjectName}</DataTableCell>
                    <DataTableCell>{r.branchName || '–'}</DataTableCell>
                    <DataTableCell className="text-slate-600">{formatMonth(r.month)}</DataTableCell>
                    <DataTableCell>{r.styleCode || '–'}</DataTableCell>
                    <DataTableCell align="right" className="font-medium text-slate-800">₹{formatAmount(r.totalAmount)}</DataTableCell>
                    <DataTableCell align="right">
                      <ActionButtons
                        onView={() => openView(r)}
                        onEdit={canAdd ? () => openEdit(r) : undefined}
                        onDelete={canAdd ? () => handleDelete(r) : undefined}
                        viewLabel={t('view')}
                        editLabel={t('edit')}
                        deleteLabel={t('delete')}
                      />
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
          {sorted.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  {t('loadMore')}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">
              {t('noData')}
            </div>
          ) : (
            sorted.map((r: WorkOrderRow) => (
              <div key={`${r.type}-${r._id}`} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">{r.subjectName}</h3>
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    {getTypeLabel(r.type)}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{r.branchName || '–'}</p>
                <p className="text-sm text-slate-600">
                  {formatMonth(r.month)} • {r.styleCode || '–'}
                </p>
                <p className="mt-2 font-semibold text-slate-900">₹{formatAmount(r.totalAmount)}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(r)}
                    onEdit={canAdd ? () => openEdit(r) : undefined}
                    onDelete={canAdd ? () => handleDelete(r) : undefined}
                    viewLabel={t('view')}
                    editLabel={t('edit')}
                    deleteLabel={t('delete')}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={handleFormClose}
        title={
          modal === 'create'
            ? createStep === 'type'
              ? `${t('add')} ${t('workOrder')} – ${t('selectWorkOrderType') || 'Select type'}`
              : `${t('add')} ${t('workOrder')} – ${createType ? getTypeLabel(createType) : ''}`
            : modal === 'view'
              ? `${t('view')} ${t('workOrder')}`
              : `${t('edit')} ${t('workOrder')}`
        }
        size="5xl"
      >
        {modal === 'create' && createStep === 'type' ? (
          <div className="space-y-4">
            <p className="text-slate-600">{t('selectWorkOrderType') || 'Select the type of work order to create:'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {canAccessAll && (
                <>
                  <button
                    onClick={() => handleTypeSelected('contractor')}
                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-uff-accent hover:bg-uff-accent/5 transition text-left"
                  >
                    <span className="font-semibold text-slate-900 block">{t('contractor')}</span>
                    <span className="text-sm text-slate-600 mt-1">{t('contractorWorkOrderDesc') || 'For contractor employees with work items and rates'}</span>
                  </button>
                  <button
                    onClick={() => handleTypeSelected('full_time')}
                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-uff-accent hover:bg-uff-accent/5 transition text-left"
                  >
                    <span className="font-semibold text-slate-900 block">{t('fullTime')}</span>
                    <span className="text-sm text-slate-600 mt-1">{t('fullTimeWorkOrderDesc') || 'For full-time employees with days and overtime'}</span>
                  </button>
                  <button
                    onClick={() => handleTypeSelected('vendor')}
                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-uff-accent hover:bg-uff-accent/5 transition text-left"
                  >
                    <span className="font-semibold text-slate-900 block">{t('vendor')}</span>
                    <span className="text-sm text-slate-600 mt-1">{t('vendorWorkOrderDesc') || 'For external vendors'}</span>
                  </button>
                </>
              )}
              {isContractorEmployee && !canAccessAll && (
                <button
                  onClick={() => handleTypeSelected('contractor')}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-uff-accent hover:bg-uff-accent/5 transition text-left"
                >
                  <span className="font-semibold text-slate-900 block">{t('contractor')}</span>
                  <span className="text-sm text-slate-600 mt-1">{t('contractorWorkOrderDesc') || 'Record your work'}</span>
                </button>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={handleFormClose} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50">
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : createType === 'contractor' ? (
          <WorkOrderFormContractor
            mode={modal === 'create' ? 'create' : modal === 'view' ? 'view' : 'edit'}
            record={editingRecord?.raw ?? null}
            onClose={handleFormClose}
            onSaved={handleFormClose}
            onSwitchToEdit={modal === 'view' ? () => setModal('edit') : undefined}
          />
        ) : createType === 'full_time' ? (
          <WorkOrderFormFullTime
            mode={modal === 'create' ? 'create' : modal === 'view' ? 'view' : 'edit'}
            record={editingRecord?.raw ?? null}
            onClose={handleFormClose}
            onSaved={handleFormClose}
          />
        ) : createType === 'vendor' ? (
          <WorkOrderFormVendor
            mode={modal === 'create' ? 'create' : modal === 'view' ? 'view' : 'edit'}
            record={editingRecord?.raw ?? null}
            onClose={handleFormClose}
            onSaved={handleFormClose}
          />
        ) : null}
      </Modal>

      {confirmModal && (
        <ConfirmModal
          open={!!confirmModal}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={t('cancel')}
          variant={confirmModal.variant}
          onConfirm={async () => {
            try {
              await confirmModal.onConfirm();
              setConfirmModal(null);
            } catch (err) {
              toast.error(t('error'));
              throw err;
            }
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
