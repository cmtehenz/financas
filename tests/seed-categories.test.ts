import { describe, expect, it } from "vitest";

import { SEED_CATEGORIES, uniqueSeedCategoryKeys } from "@/domain/seed-categories";

describe("seed categories", () => {
  it("includes the required income and expense names", () => {
    const names = SEED_CATEGORIES.map((category) => category.name);

    expect(names).toContain("Salário");
    expect(names).toContain("Receita da esposa");
    expect(names).toContain("Moradia");
    expect(names).toContain("Outras despesas");
    expect(SEED_CATEGORIES).toHaveLength(23);
  });

  it("does not define duplicate type and slug pairs", () => {
    expect(uniqueSeedCategoryKeys().size).toBe(SEED_CATEGORIES.length);
  });
});
