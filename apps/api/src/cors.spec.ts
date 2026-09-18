import { isAllowedCorsOrigin, resolveCorsOrigins } from "./cors";

describe(resolveCorsOrigins, () => {
  it("allows the current Next dev origin even when FRONTEND_URL still points to the old Vite port", () => {
    expect(resolveCorsOrigins("http://localhost:5173")).toStrictEqual(
      expect.arrayContaining(["http://localhost:3001", "http://localhost:5173"])
    );
  });

  it("accepts comma-separated extra frontend origins", () => {
    expect(
      resolveCorsOrigins(
        "https://projectwing.example.com",
        "http://localhost:4000, http://127.0.0.1:3001"
      )
    ).toStrictEqual(
      expect.arrayContaining([
        "https://projectwing.example.com",
        "http://localhost:4000",
        "http://127.0.0.1:3001",
      ])
    );
  });

  it("allows localhost preview ports in development", () => {
    expect(
      isAllowedCorsOrigin("http://localhost:56566", [], "development")
    ).toBeTruthy();
    expect(isAllowedCorsOrigin("http://127.0.0.1:56566", [])).toBeTruthy();
  });

  it("keeps the local TMS origin allowed when the API runs with production config", () => {
    const origins = resolveCorsOrigins("http://localhost:3001");

    expect(
      isAllowedCorsOrigin("http://localhost:3004", origins, "production")
    ).toBeTruthy();
  });

  it("does not allow arbitrary localhost ports outside development", () => {
    expect(
      isAllowedCorsOrigin("http://localhost:56566", [], "production")
    ).toBeFalsy();
  });
});
