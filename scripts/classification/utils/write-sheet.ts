declare const require: any;
declare const __dirname: string;
declare const process: {
  env: Record<string, string | undefined>;
};

const fs = require("fs");
const { google } = require("googleapis");
const path = require("path");

require("../../load-env.cjs");
const credentials = {
  type: process.env.GOOGLE_SHEET_TYPE,
  project_id: process.env.GOOGLE_SHEET_PROJECT_ID,
  private_key_id: process.env.GOOGLE_SHEET_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
};

function patchRequestSheetIds(requests: any[], sheetIdNumber: number) {
  for (const request of requests) {
    for (const key in request) {
      if (request[key].range) {
        request[key].range.sheetId = sheetIdNumber;
      } else if (request[key].properties) {
        request[key].properties.sheetId = sheetIdNumber;
      }
    }
  }
}

/** Create a new spreadsheet with a single tab (Drive file + Sheets API). */
export async function createSpreadsheetWithSingleSheet(
  documentTitle: string,
  sheetTabTitle: string,
): Promise<{ spreadsheetId: string }> {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes,
  });

  const sheetsApi = google.sheets({ version: "v4", auth });

  const res = await sheetsApi.spreadsheets.create({
    resource: {
      properties: { title: documentTitle },
      sheets: [{ properties: { title: sheetTabTitle } }],
    },
  });

  const spreadsheetId = res.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("spreadsheets.create returned no spreadsheetId");
  }
  return { spreadsheetId };
}

/** 1-based column index → A1 column letters (e.g. 1 → A, 27 → AA). */
export function columnIndex1BasedToA1Letters(col1Based: number): string {
  let n = col1Based;
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/**
 * Like `writeIntoSheet`, but writes `headerRows` first then body in batches from
 * `streamBodyChunks` so the full grid never has to sit in memory.
 */
export const writeIntoSheetChunked = async ({
  sheetName,
  sheetId,
  requestsBeforeClear = [],
  requests = [],
  headerRows,
  /** Total rows on the sheet after upload (headers + body). */
  totalRowCount,
  /** Width of the grid (for clear range + row expansion). */
  columnCount,
  streamBodyChunks,
}: {
  sheetName: string;
  sheetId: string;
  requestsBeforeClear?: any[];
  requests?: any[];
  headerRows: (string | number)[][];
  totalRowCount: number;
  columnCount: number;
  streamBodyChunks: AsyncIterable<(string | number)[][]>;
}) => {
  try {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    const sheetsApi = google.sheets({ version: "v4", auth });

    const spreadsheet = await sheetsApi.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s: any) => s.properties.title === sheetName,
    );

    if (!sheet) {
      console.log(`Sheet "${sheetName}" not found. Creating new sheet...`);
      const addSheetResponse = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      const addedSheet =
        addSheetResponse.data.replies?.[0]?.addSheet?.properties;
      sheet = { properties: addedSheet };
      console.log(`Created new sheet: "${sheetName}"`);
    }

    const sheetIdNumber = sheet.properties.sheetId;
    let currentRowCount = sheet.properties.gridProperties.rowCount || 1000;

    if (requestsBeforeClear.length > 0) {
      patchRequestSheetIds(requestsBeforeClear, sheetIdNumber);
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: { requests: requestsBeforeClear },
      });
    }

    const endCol = columnIndex1BasedToA1Letters(columnCount);
    /** Only expand to actual data height; inflating (e.g. to 60k) wastes the 10M workbook cell budget. */
    const clearEndRow = totalRowCount;
    const clearRange = `${sheetName}!A1:${endCol}${clearEndRow}`;

    if (clearEndRow > currentRowCount) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [
            {
              appendDimension: {
                sheetId: sheetIdNumber,
                dimension: "ROWS",
                length: clearEndRow - currentRowCount,
              },
            },
          ],
        },
      });
      currentRowCount = clearEndRow;
    }

    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: clearRange,
    });

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values: headerRows },
    });

    let nextRow1Based = headerRows.length + 1;
    let chunkIndex = 0;
    for await (const chunk of streamBodyChunks) {
      if (chunk.length === 0) continue;
      chunkIndex++;
      const endRow = nextRow1Based + chunk.length - 1;
      if (endRow > currentRowCount) {
        const additional = endRow - currentRowCount;
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            requests: [
              {
                appendDimension: {
                  sheetId: sheetIdNumber,
                  dimension: "ROWS",
                  length: additional,
                },
              },
            ],
          },
        });
        currentRowCount = endRow;
      }
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${nextRow1Based}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: chunk },
      });
      if (chunkIndex % 5 === 0) {
        console.log(`  … wrote body rows up to ${endRow} / ${totalRowCount}`);
      }
      nextRow1Based = endRow + 1;
    }

    if (requests.length > 0) {
      patchRequestSheetIds(requests, sheetIdNumber);
      const mergeRequests = requests.filter((r: any) => r.mergeCells);
      const nonMergeRequests = requests.filter((r: any) => !r.mergeCells);
      if (mergeRequests.length > 0) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: { requests: mergeRequests },
        });
      }
      if (nonMergeRequests.length > 0) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: { requests: nonMergeRequests },
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const writeIntoSheet = async ({
  sheetName,
  sheetId,
  data,
  range = "A1",
  /** Runs after sheet is resolved, before clear+values (e.g. unmerge old layout). */
  requestsBeforeClear = [],
  requests = [],
}: {
  sheetName: string;
  sheetId: string;
  data: (string | number)[][];
  range?: string;
  requestsBeforeClear?: any[];
  requests?: any;
}) => {
  try {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    const sheetsApi = google.sheets({ version: "v4", auth });

    // Fetch spreadsheet info
    const spreadsheet = await sheetsApi.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s: any) => s.properties.title === sheetName,
    );

    // If sheet doesn't exist -> create it
    if (!sheet) {
      console.log(`Sheet "${sheetName}" not found. Creating new sheet...`);
      const addSheetResponse = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      const addedSheet =
        addSheetResponse.data.replies?.[0]?.addSheet?.properties;
      sheet = { properties: addedSheet };
      console.log(`Created new sheet: "${sheetName}"`);
    }

    const sheetIdNumber = sheet.properties.sheetId;
    const currentRowCount = sheet.properties.gridProperties.rowCount || 1000; // default fallback

    if (requestsBeforeClear.length > 0) {
      patchRequestSheetIds(requestsBeforeClear, sheetIdNumber);
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: { requests: requestsBeforeClear },
      });
    }

    // Determine the last row we'll need
    // Example: "A56001" → row 56001
    const match = range.match(/\d+$/);
    const startRow = match ? parseInt(match[0], 10) : 1;
    const requiredRows = startRow + data.length - 1;

    if (requiredRows > currentRowCount) {
      const additional = requiredRows - currentRowCount;

      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [
            {
              appendDimension: {
                sheetId: sheetIdNumber,
                dimension: "ROWS",
                length: additional,
              },
            },
          ],
        },
      });
    }

    // Clear existing values
    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${sheetName}!${range}`,
    });

    // Write new data
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!${range}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: data,
      },
    });

    // Merges must run in their own batch first; a follow-up repeatCell spanning
    // merged regions can otherwise leave row-1 role titles unmerged (only first cell shows text).
    if (requests.length > 0) {
      patchRequestSheetIds(requests, sheetIdNumber);
      const mergeRequests = requests.filter((r: any) => r.mergeCells);
      const nonMergeRequests = requests.filter((r: any) => !r.mergeCells);
      if (mergeRequests.length > 0) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: { requests: mergeRequests },
        });
      }
      if (nonMergeRequests.length > 0) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: { requests: nonMergeRequests },
        });
      }
    }

    // console.log("Data written successfully!", sheetName);
  } catch (error) {
    console.error("Error:", error);
  }
};

export const readFromSheet = async ({
  sheetName,
  sheetId,
  range, // new optional argument
}: {
  sheetName: string;
  sheetId: string;
  range?: string; // optional, e.g. "A2:D20"
}) => {
  try {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}${range ? `!${range}` : ""}`, // adds range if provided
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log(
        `No data found in range "${sheetName}${range ? `!${range}` : ""}"`,
      );
      return [];
    }

    return rows;
  } catch (error) {
    console.error("Error reading sheet:", error);
    return [];
  }
};

export const getSheetNames = async (sheetId: string) => {
  try {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheetNames =
      response.data.sheets?.map(
        (sheet: any) => sheet.properties?.title || "",
      ) || [];

    console.log(`Found ${sheetNames.length} sheets in spreadsheet`);
    return sheetNames;
  } catch (error) {
    console.error("Error fetching sheet names:", error);
    return [];
  }
};
