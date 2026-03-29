import { describe, expect, it } from "vitest";

import { buildCsvContent } from "./report-export.service.js";

describe("buildCsvContent", () => {
  it("creates a CSV document with escaped values", () => {
    const csv = buildCsvContent([
      {
        employeeName: "Neha Patil",
        comment: 'Needs "finance" follow-up',
        pendingCount: 2
      }
    ]);

    expect(csv).toContain("employeeName,comment,pendingCount");
    expect(csv).toContain('"Needs ""finance"" follow-up"');
    expect(csv.endsWith("\n")).toBe(true);
  });
});
