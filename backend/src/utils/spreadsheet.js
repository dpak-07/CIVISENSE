const XLSX = require('xlsx');

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const parseWorkbookRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false
  });
};

const getRowValue = (row, aliases) => {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const match = entries.find(([key]) => normalizeHeader(key) === normalizedAlias);
    if (match) {
      return match[1];
    }
  }
  return '';
};

const buildWorkbookBuffer = ({ sheetName, rows }) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  normalizeHeader,
  parseWorkbookRows,
  getRowValue,
  buildWorkbookBuffer
};
