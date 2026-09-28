// Copyright (c) 2024-2026 EVtivity. All rights reserved.
// SPDX-License-Identifier: BUSL-1.1

import ExcelJS from 'exceljs';

export interface ExcelColumn<T> {
  /** Column header shown in the first row of the table. */
  header: string;
  /** Width in Excel character units. */
  width: number;
  /** Extract the cell value from a row. */
  value: (row: T) => string | number | boolean | Date | null | undefined;
}

export interface ExcelExportOptions<T> {
  /** Worksheet name. */
  sheetName: string;
  /** Optional title rendered above the table. */
  title?: string;
  /** Applied filters/parameters rendered above the table, one per row. */
  parameters?: { label: string; value: string }[];
  columns: ExcelColumn<T>[];
  rows: T[];
}

const HEADER_FILL = 'FFE8EEF7';
const TITLE_FONT_SIZE = 14;
const PARAM_FONT_SIZE = 10;

/**
 * Build an .xlsx workbook (Office Open XML) containing the given rows.
 * Applied filters are written into the sheet header so the exported report
 * documents exactly which parameters produced it.
 */
export async function buildXlsx<T>(options: ExcelExportOptions<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(options.sheetName, {
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  sheet.columns = options.columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));

  const lastColumn = Math.max(options.columns.length, 1);

  if (options.title != null) {
    const titleRow = sheet.addRow([options.title]);
    titleRow.font = { bold: true, size: TITLE_FONT_SIZE };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, lastColumn);
    sheet.addRow([]);
  }

  if (options.parameters != null && options.parameters.length > 0) {
    for (const parameter of options.parameters) {
      const row = sheet.addRow([parameter.label, parameter.value]);
      row.font = { size: PARAM_FONT_SIZE };
      row.getCell(1).font = { size: PARAM_FONT_SIZE, bold: true };
    }
    sheet.addRow([]);
  }

  const headerRow = sheet.addRow(options.columns.map((column) => column.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF9AA5B1' } },
    };
  });

  for (const item of options.rows) {
    sheet.addRow(
      options.columns.map((column) => {
        const value = column.value(item);
        return value === undefined ? null : value;
      }),
    );
  }

  // Freeze everything above the table header so the column titles stay visible.
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }];

  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: lastColumn },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
