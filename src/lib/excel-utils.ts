/**
 * Shared utilities for generating Excel templates with data validation.
 * Uses exceljs for dropdowns and validation.
 */
import ExcelJS from 'exceljs';

export type ValidationType = 'list' | 'whole' | 'decimal' | 'date' | 'textLength';

/** Worksheet has dataValidations in runtime - use type assertion for TypeScript */
interface WorksheetWithDV extends ExcelJS.Worksheet {
  dataValidations?: { add: (range: string, rules: Record<string, unknown>) => void };
}

export function addListValidation(
  worksheet: ExcelJS.Worksheet,
  range: string,
  options: string[],
  allowBlank = false
) {
  if (options.length === 0) return;
  const ws = worksheet as WorksheetWithDV;
  if (ws.dataValidations?.add) {
    ws.dataValidations.add(range, {
      type: 'list',
      allowBlank,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Invalid value',
      error: `Please select from: ${options.join(', ')}`,
    });
  } else {
    const cellRef = range.split(':')[0] ?? 'A1';
    const cell = worksheet.getCell(cellRef);
    cell.dataValidation = {
      type: 'list',
      allowBlank,
      formulae: [`"${options.join(',')}"`],
    };
  }
}

export function addNumberValidation(
  worksheet: ExcelJS.Worksheet,
  range: string,
  opts: { min?: number; max?: number; allowBlank?: boolean } = {}
) {
  const { min = 0, max, allowBlank = true } = opts;
  const rules: Record<string, unknown> = {
    type: 'decimal',
    allowBlank,
    operator: 'greaterThanOrEqual',
    formulae: [min],
  };
  if (max != null) {
    rules.operator = 'between';
    rules.formulae = [min, max];
  }
  (worksheet as WorksheetWithDV).dataValidations?.add?.(range, rules);
}

export function addDateValidation(worksheet: ExcelJS.Worksheet, range: string, allowBlank = true) {
  (worksheet as WorksheetWithDV).dataValidations?.add?.(range, {
    type: 'date',
    allowBlank,
    showErrorMessage: true,
  });
}
