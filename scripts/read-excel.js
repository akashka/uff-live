/**
 * Read Excel files and output structure + sample data
 */
const XLSX = require('xlsx');
const path = require('path');

const files = [
  'public/PAYMENT_TAILOR_15-03-2025_PNY.xls',
  'public/PEENYA salaries-2024-2025- MARCH-ORG.xlsx',
  'public/RATE LIST.xlsx',
];

files.forEach((file) => {
  const fullPath = path.join(process.cwd(), file);
  console.log('\n' + '='.repeat(80));
  console.log('FILE:', file);
  console.log('='.repeat(80));

  try {
    const workbook = XLSX.readFile(fullPath, { cellDates: true });
    console.log('Sheet names:', workbook.SheetNames);

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const rows = range.e.r - range.s.r + 1;
      const cols = range.e.c - range.s.c + 1;
      console.log('\n--- Sheet:', sheetName, `(${rows} rows x ${cols} cols) ---');

      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      // Print first 30 rows
      const toShow = Math.min(35, data.length);
      data.slice(0, toShow).forEach((row, i) => {
        console.log(JSON.stringify(row));
      });
      if (data.length > toShow) {
        console.log('... (' + (data.length - toShow) + ' more rows)');
      }
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
});
console.log('\nDone.');
