import { describe, expect, it } from "vitest";
import { kspErrorKey } from "@/lib/ksp";

describe("kspErrorKey", () => {
  it.each([
    ["credits.insufficient", undefined, "insufficient"],
    ["ai.too_many_active", 429, "tooMany"],
    ["ai.idempotency_conflict", 409, "conflict"],
    ["ai.provider_unavailable", undefined, "provider"],
    ["ai.invalid_output", undefined, "invalid"],
    ["ai.timeout", undefined, "timeout"],
    ["ai.interrupted", undefined, "interrupted"],
    ["ai.busy", undefined, "busy"],
    ["ai.budget_exceeded", undefined, "budget"],
    ["feature.disabled", 404, "disabled"],
    [undefined, 403, "forbidden"],
    [undefined, 429, "tooMany"],
    [undefined, 500, "unknown"],
    ["<script>", undefined, "unknown"],
  ])("%s (%s) → %s", (code, status, expected) => {
    expect(kspErrorKey(code, status)).toBe(expected);
  });
});
