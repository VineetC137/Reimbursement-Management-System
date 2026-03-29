import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "./app.js";

describe("app", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok"
      }
    });
  });

  it("serves the generated OpenAPI document", async () => {
    const response = await request(app).get("/api/v1/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.info.title).toContain("Reimbursement Management");
    expect(response.body.paths["/expenses/{expenseId}/receipt"]).toBeDefined();
    expect(response.body.paths["/reports/export"]).toBeDefined();
  });
});
