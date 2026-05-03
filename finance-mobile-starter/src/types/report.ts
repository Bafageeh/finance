export type ReportKind = 'smart_collection' | 'portfolio' | 'late' | 'late_with_ali' | 'court' | 'upcoming';

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportDocument {
  kind: ReportKind;
  title: string;
  subtitle: string;
  filename: string;
  generatedAt: string;
  summary: ReportSummaryItem[];
  headers: string[];
  rows: Array<Array<string | number>>;
}
