import { describe, expect, it } from "vitest";
import { copyTitle, libraryHref, parseLibraryQuery } from "@/lib/library";

describe("library query", () => {
  it("parses known values and drops unknown ones", () => {
    expect(parseLibraryQuery({ q: "  Телеграмма ", kind: "ksp", page: "3" })).toEqual({ q: "Телеграмма", kind: "ksp", page: 3 });
    expect(parseLibraryQuery({ kind: "game", page: "-1" })).toEqual({ q: "", kind: undefined, page: 1 });
    expect(parseLibraryQuery({ q: ["a", "b"], page: "x" })).toEqual({ q: "a", kind: undefined, page: 1 });
    expect(parseLibraryQuery({ q: "я".repeat(300) }).q).toHaveLength(200);
  });

  it("builds a link that keeps search and filter", () => {
    expect(libraryHref("/ru/teacher/documents", { q: "", page: 1 })).toBe("/ru/teacher/documents");
    expect(libraryHref("/ru/teacher/documents", { q: "100% готово", kind: "text", page: 2 })).toBe(
      "/ru/teacher/documents?q=100%25+%D0%B3%D0%BE%D1%82%D0%BE%D0%B2%D0%BE&kind=text&page=2",
    );
  });
});

describe("copy title", () => {
  it("adds the localized suffix and stays within 200 characters", () => {
    expect(copyTitle("КСП: Телеграмма", "{title} (копия)")).toBe("КСП: Телеграмма (копия)");
    const long = copyTitle("а".repeat(200), "{title} (көшірме)");
    expect(long.length).toBeLessThanOrEqual(200);
    expect(long.endsWith("… (көшірме)")).toBe(true);
  });
});
