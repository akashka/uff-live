## 2. PEENYA salaries-2024-2025- MARCH-ORG.xlsx

### Excel Structure

#### Sheet 1: PRODUCTION
- **STITCHING section**: Name/code, BILL QTY, VALUE (price × qty), REMARKS, DISPATCH QTY, DIFF, PRICE, VALUE
- **Style/order codes** (e.g. 25BJN56542, MAC LT GREY, GLOBUS GREY RFD) – each has qty, rate, value
- **Total**: Sum of all stitching values
- **BARTACK section**: Same structure – Name, QTY, REMARKS, VALUE (VALUE = REMARKS/QTY, i.e. rate per piece)
- **Multiple work types**: STITCHING, BARTACK – different rate structures

#### Sheet 2: tailor list (2)
- **Columns**: SL.NO., Beneficiary_Name, BILL AMOUNT, ESI & PF DEDUCTION, NET PAY, ADVANCE, BALANCE
- **Calculation**: NET PAY = BILL AMOUNT − ESI & PF DEDUCTION (or BILL AMOUNT if no deduction)
- **BALANCE** = NET PAY (amount to be paid)
- **ESI & PF**: Combined deduction; some employees have it, some don’t (contractors vs full-time)

#### Sheet 3: FC-PCS WORK - BUTTON & RIVETS
- **Multiple sub-contractors/sections**:
  - LEATHER - YOGESH: QTY × NO OF FIX = VALUE
  - IRON - YOGI: QTY × PRICE = Value
  - IRON - NARSAPA: Same
  - BUTTON / RIVET - KUMAR V: QTY × NO OF FIX × price/pcs = Value
- **Style names** (BASICS, R/R REID, FORCA, etc.) with qty and value per style
- **Summary**: Advance Taken, Earned salary, Net Salary, METER (addl?), NET TO PAY
- **Advance deduction**: Net Salary = Earned − Advance

#### Sheet 4: FC- PCS WORK - TRIM & CHECK
- **Per-person breakdown**: ANITHA, GOWRAMMA, BHANU, MAHI, SUNIL
- **Style-wise qty** per person, RATE, VALUE
- **OT HRS, OT AMT** – overtime tracking
- **NET AMT, adv, NET TO PAY**

### App Implementation (Current)

- **Work records**: employee + branch + period + workItems (rateName, qty, multiplier, ratePerUnit, amount)
- **Amount formula**: amount = quantity × (multiplier || 1) × ratePerUnit (supports QTY × NO OF FIX × price)
- **Payments**: baseAmount, pfDeducted, esiDeducted, advanceDeducted, addDeductAmount, totalPayable, paymentAmount, paymentRun
- **Rate Master**: name, description, unit, branchRates (per-branch), bulk import from Excel
- **Bank export**: Export payments to Excel/CSV (Amount, Name, IFSC, Account), filter by run, include zero-amount option

### Gaps & Status

| Item | Status | Notes |
|------|--------|-------|
| **Work categories** | ❌ Missing | Excel: STITCHING, BARTACK, FC-PCS. App: flat work items. Add work category to WorkRecord/WorkItem. |
| **Style/Order codes** | ❌ Missing | Excel style codes (25BJN56542). App has rate names only. Add styleCode/orderReference to work items. |
| **ESI + PF** | ✅ Done | Employee: esiOpted, monthlyEsiAmount. Payment: esiDeducted. TotalPayable = base − pf − esi − advance + addDeduct. |
| **Advance tracking** | ✅ Done | Payment.advanceDeducted; totalPayable subtracts it. isAdvance for advance payments. |
| **Overtime (OT)** | ✅ Done | WorkRecord.otHours, otAmount; included in totalAmount. |
| **Per-style breakdown** | ⚠️ Partial | Work items have rate + qty + amount. Rate names can map to styles. |
| **Multiple formulas** | ✅ Done | WorkItem.multiplier; amount = qty × multiplier × rate. Bartack (rate per piece) maps to multiplier=1. |
| **Sub-contractor / section** | ❌ Missing | Excel groups by section. App: one employee per record. |

---

## 4. Cross-Cutting Workflow Comparison

### End-to-end flow (Excel)
1. **PRODUCTION** → Compute work (style × qty × rate) per person
2. **tailor list** → BILL AMOUNT, ESI/PF, NET PAY, ADVANCE, BALANCE
3. **PAYMENT_TAILOR** → Export for bank transfer

### App flow (Current)
1. **Work Records** → Enter work items (rate, qty, multiplier) per employee/branch/period → totalAmount
2. **Payments** → Calculate from work or manual; baseAmount, PF, ESI, advance deduct, add/deduct, totalPayable
3. **Export** → Bank format (Excel/CSV) by payment run, optional zero-amount rows

### Summary: Implemented vs Pending

| Priority | Feature | Status | Notes |
|----------|---------|--------|-------|
| **P0** | **Rate List import** | ✅ Done | Bulk import from Excel (replace/add), per-branch rates |
| **P0** | **ESI support** | ✅ Done | Employee esiOpted/monthlyEsiAmount; Payment esiDeducted |
| **P0** | **Bank payment export** | ✅ Done | Excel/CSV with Amount, Name, IFSC, Account; filter by run; include zero-amount option |
| **P1** | **Work categories** | ❌ Pending | Stitching, Bartack, Button, Trim & Check |
| **P1** | **Style/Order codes** | ❌ Pending | Link work items to style (e.g. 25BJN56542) |
| **P1** | **Advance flow** | ✅ Done | advanceDeducted in payment; isAdvance for advance payments |
| **P2** | **Overtime** | ✅ Done | otHours, otAmount on WorkRecord; included in totalAmount |
| **P2** | **Formula types** | ✅ Done | WorkItem.multiplier; amount = qty × multiplier × rate |
| **P2** | **Payment batch/run** | ✅ Done | paymentRun field; filter and export by run |
| **P2** | **Excel import** | ❌ Pending | Import work/production from PEENYA-style Excel |

---

## 5. Data Model: Excel vs App

### Employee
| Excel | App | Status |
|-------|-----|--------|
| — | esiOpted, monthlyEsiAmount (contractors) | ✅ Added |
| — | esiNumber | ❌ Optional, not added |

### WorkRecord / WorkItem
| Excel | App | Status |
|-------|-----|--------|
| style/order codes | styleCode, orderReference | ❌ Not added |
| STITCHING, BARTACK, FC-PCS | workCategory | ❌ Not added |
| QTY × NO OF FIX × rate | multiplier (default 1) | ✅ Added |
| OT HRS, OT AMT | otHours, otAmount | ✅ Added |

### RateMaster
| Excel | App | Status |
|-------|-----|--------|
| description | description | ✅ Added |
| per-branch rate | branchRates | ✅ Yes |
| formulaType | — | ❌ Per-item multiplier used instead |

### Payment
| Excel | App | Status |
|-------|-----|--------|
| ESI & PF DEDUCTION | pfDeducted, esiDeducted | ✅ Added |
| ADVANCE | advanceDeducted | ✅ Added |
| payment batch | paymentRun | ✅ Added |

---

## 6. Calculation Alignment

| Excel | App | Match? |
|-------|-----|--------|
| BILL AMOUNT = Σ(style qty × rate) | totalAmount = Σ(workItems.amount) | ✅ Yes |
| NET PAY = BILL − ESI&PF | totalPayable = baseAmount − pfDeducted − esiDeducted | ✅ Yes |
| BALANCE = NET PAY − ADVANCE | totalPayable − advanceDeducted; paymentAmount, remainingAmount | ✅ Yes |
| VALUE = QTY × PRICE | amount = quantity × ratePerUnit (multiplier=1) | ✅ Yes |
| VALUE = QTY × NO OF FIX × price/pcs | amount = quantity × (multiplier \|\| 1) × ratePerUnit | ✅ Yes |

---

## 7. Differences Summary

### Implemented (Excel parity)
- ESI + PF deduction in Employee and Payment
- Advance deduction (advanceDeducted)
- Multiplier formula (QTY × NO OF FIX × rate)
- Overtime (otHours, otAmount on WorkRecord, included in totalAmount)
- Bank payment export (Excel/CSV, by run, zero-amount option)
- Payment run/batch
- Rate Master: description, per-branch rates, bulk import

### Not yet implemented
- Work categories (Stitching, Bartack, Button, Trim & Check)
- Style/Order codes on work items
- Sub-contractor / section grouping
- Bartack-style formula (VALUE = REMARKS/QTY as rate) — use multiplier or custom rate instead
