import { google } from "googleapis";
import type { SheetEmployeeRow } from "@/lib/services/sheets-sync";

const DEFAULT_RANGE = "Sheet1!A:D";
const DEFAULT_RS_RANGE = "Resource Segregation!A:N";

export type RsSheetRow = {
  name: string;
  email: string;
  jobTitle: string;
  currentProject: string;
  attendance: string;
  date: string;
  rowNumber: number;
};

export class SheetsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsConfigError";
  }
}

function buildAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
  }
  return null;
}

export async function readEmployeeRows(): Promise<SheetEmployeeRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || DEFAULT_RANGE;
  if (!spreadsheetId) {
    throw new SheetsConfigError(
      "GOOGLE_SHEET_ID is not configured. Set it in .env."
    );
  }

  const auth = buildAuth();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!auth && !apiKey) {
    throw new SheetsConfigError(
      "Google Sheets auth missing. Configure either a service account (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) or GOOGLE_SHEETS_API_KEY for a public sheet."
    );
  }

  const sheets = google.sheets({
    version: "v4",
    ...(auth ? { auth } : { auth: apiKey })
  });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  const values = response.data.values ?? [];
  if (values.length === 0) return [];

  const [header, ...dataRows] = values;
  const headers = (header ?? []).map((cell) => String(cell).trim().toLowerCase());

  const idx = {
    name: headers.indexOf("name"),
    email: headers.indexOf("email"),
    project: headers.indexOf("project"),
    position: headers.indexOf("position")
  };

  if (idx.email === -1 || idx.name === -1 || idx.project === -1 || idx.position === -1) {
    throw new SheetsConfigError(
      `Sheet must contain headers: name, email, project, position. Found: ${headers.join(", ")}`
    );
  }

  return dataRows
    .map((row) => ({
      name: String(row[idx.name] ?? "").trim(),
      email: String(row[idx.email] ?? "").trim(),
      project: String(row[idx.project] ?? "").trim(),
      position: String(row[idx.position] ?? "").trim()
    }))
    .filter((row) => row.email);
}

export async function readRsRows(): Promise<RsSheetRow[]> {
  const spreadsheetId = process.env.GOOGLE_RS_SHEET_ID;
  const range = process.env.GOOGLE_RS_SHEET_RANGE || DEFAULT_RS_RANGE;
  if (!spreadsheetId) {
    throw new SheetsConfigError(
      "GOOGLE_RS_SHEET_ID is not configured. Set it in .env."
    );
  }

  const auth = buildAuth();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!auth && !apiKey) {
    throw new SheetsConfigError(
      "Google Sheets auth missing. Configure either a service account (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) or GOOGLE_SHEETS_API_KEY for a public sheet."
    );
  }

  const sheets = google.sheets({
    version: "v4",
    ...(auth ? { auth } : { auth: apiKey })
  });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });

  const values = response.data.values ?? [];
  if (values.length === 0) return [];

  const COL = {
    candidateName: 2,
    candidateEmail: 3,
    jobTitle: 4,
    currentProject: 6,
    date: 10,
    presentAbsent: 11
  } as const;

  const header = (values[0] ?? []).map((cell) => String(cell).trim().toLowerCase());
  const emailHeader = header[COL.candidateEmail] ?? "";
  const projectHeader = header[COL.currentProject] ?? "";
  const attendanceHeader = header[COL.presentAbsent] ?? "";
  if (
    !emailHeader.includes("email") ||
    !projectHeader.includes("project") ||
    !attendanceHeader.match(/present|absent|leave/i)
  ) {
    throw new SheetsConfigError(
      `Resource Segregation sheet header mismatch. Expected col D=email, G=current project, L=present/absent. Got: D="${header[COL.candidateEmail]}", G="${header[COL.currentProject]}", L="${header[COL.presentAbsent]}".`
    );
  }

  return values.slice(1).map((row, i) => ({
    name: String(row[COL.candidateName] ?? "").trim(),
    email: String(row[COL.candidateEmail] ?? "").trim().toLowerCase(),
    jobTitle: String(row[COL.jobTitle] ?? "").trim(),
    currentProject: String(row[COL.currentProject] ?? "").trim(),
    attendance: String(row[COL.presentAbsent] ?? "").trim(),
    date: String(row[COL.date] ?? "").trim(),
    rowNumber: i + 2
  })).filter((row) => row.email);
}
