import { describe, expect, it } from "vitest";
import { fieldErrors, problemKey } from "@/lib/api/browser";
import { fmt } from "@/lib/format";
import { safeNext } from "@/lib/navigation";

describe("problemKey", () => {
  it.each([
    [{ status: 401, code: "auth.invalid_credentials" }, "invalidCredentials"],
    [{ status: 403, code: "auth.email_not_confirmed" }, "emailNotConfirmed"],
    [{ status: 400, code: "auth.invalid_token" }, "invalidToken"],
    [{ status: 400, code: "auth.invalid_code" }, "invalidCode"],
    [{ status: 404, code: "feature.disabled" }, "moduleDisabled"],
    [{ status: 503, code: "api.unreachable" }, "unavailable"],
    [{ status: 502 }, "unavailable"],
    [{ status: 429 }, "rateLimited"],
    [{ status: 500 }, "unknown"],
  ] as const)("%o -> %s", (problem, expected) => {
    expect(problemKey(problem)).toBe(expected);
  });
});

describe("fieldErrors", () => {
  it("takes the first code of every field", () => {
    expect(fieldErrors({ status: 400, errors: { email: ["invalid_email"], password: ["too_short", "weak"], empty: [] } })).toEqual({
      email: "invalid_email",
      password: "too_short",
    });
  });
});

describe("safeNext", () => {
  it.each([
    [null, "/ru/teacher"],
    ["/ru/settings/sessions", "/ru/settings/sessions"],
    ["/kk/teacher", "/ru/teacher"],
    ["https://evil.example/ru/", "/ru/teacher"],
    ["//evil.example/ru/", "/ru/teacher"],
    [String.raw`/ru/\evil.example`, "/ru/teacher"],
    ["/ru/x?u=https://evil.example", "/ru/teacher"],
  ])("%s -> %s", (next, expected) => {
    expect(safeNext(next, "ru")).toBe(expected);
  });
});

describe("fmt", () => {
  it("substitutes known values and keeps unknown placeholders", () => {
    expect(fmt("Сәлеметсіз бе, {name}! {other}", { name: "Айгерім" })).toBe("Сәлеметсіз бе, Айгерім! {other}");
  });
});
