import { XLSX } from "../common/xlsx";

export const spreadsheetWorkbookReader = {
  readFile(absolutePath: string) {
    return XLSX.readFile(absolutePath, { cellDates: true });
  },
};
