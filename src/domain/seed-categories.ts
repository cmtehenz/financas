export type CategoryType = "INCOME" | "EXPENSE";
export type CategoryKind = "FIXED" | "VARIABLE" | "DEBT" | "INVESTMENT" | "OTHER";

export type SeedCategory = {
  name: string;
  slug: string;
  type: CategoryType;
  kind: CategoryKind;
  color: string;
  icon: string;
};

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { name: "Salário", slug: "salario", type: "INCOME", kind: "FIXED", color: "#1d4ed8", icon: "wallet" },
  {
    name: "Receita profissional",
    slug: "receita-profissional",
    type: "INCOME",
    kind: "VARIABLE",
    color: "#2563eb",
    icon: "briefcase",
  },
  {
    name: "Receita da esposa",
    slug: "receita-da-esposa",
    type: "INCOME",
    kind: "FIXED",
    color: "#7c3aed",
    icon: "heart",
  },
  {
    name: "Rendimentos",
    slug: "rendimentos",
    type: "INCOME",
    kind: "INVESTMENT",
    color: "#0f766e",
    icon: "trending-up",
  },
  {
    name: "Outras receitas",
    slug: "outras-receitas",
    type: "INCOME",
    kind: "OTHER",
    color: "#475569",
    icon: "plus-circle",
  },
  { name: "Moradia", slug: "moradia", type: "EXPENSE", kind: "FIXED", color: "#b45309", icon: "home" },
  { name: "Mercado", slug: "mercado", type: "EXPENSE", kind: "VARIABLE", color: "#c2410c", icon: "shopping-cart" },
  { name: "Energia", slug: "energia", type: "EXPENSE", kind: "FIXED", color: "#ca8a04", icon: "zap" },
  { name: "Água", slug: "agua", type: "EXPENSE", kind: "FIXED", color: "#0284c7", icon: "droplets" },
  { name: "Internet", slug: "internet", type: "EXPENSE", kind: "FIXED", color: "#4f46e5", icon: "wifi" },
  { name: "Condomínio", slug: "condominio", type: "EXPENSE", kind: "FIXED", color: "#7c2d12", icon: "building" },
  {
    name: "Transporte",
    slug: "transporte",
    type: "EXPENSE",
    kind: "VARIABLE",
    color: "#0f766e",
    icon: "bus",
  },
  {
    name: "Combustível",
    slug: "combustivel",
    type: "EXPENSE",
    kind: "VARIABLE",
    color: "#b45309",
    icon: "fuel",
  },
  { name: "Saúde", slug: "saude", type: "EXPENSE", kind: "VARIABLE", color: "#be123c", icon: "heart-pulse" },
  {
    name: "Restaurantes",
    slug: "restaurantes",
    type: "EXPENSE",
    kind: "VARIABLE",
    color: "#c2410c",
    icon: "utensils",
  },
  { name: "Lazer", slug: "lazer", type: "EXPENSE", kind: "VARIABLE", color: "#7c3aed", icon: "smile" },
  { name: "Viagens", slug: "viagens", type: "EXPENSE", kind: "VARIABLE", color: "#0369a1", icon: "plane" },
  { name: "Compras", slug: "compras", type: "EXPENSE", kind: "VARIABLE", color: "#db2777", icon: "shopping-bag" },
  {
    name: "Assinaturas",
    slug: "assinaturas",
    type: "EXPENSE",
    kind: "FIXED",
    color: "#4338ca",
    icon: "repeat",
  },
  { name: "Dívidas", slug: "dividas", type: "EXPENSE", kind: "DEBT", color: "#b91c1c", icon: "landmark" },
  {
    name: "Investimentos",
    slug: "investimentos",
    type: "EXPENSE",
    kind: "INVESTMENT",
    color: "#047857",
    icon: "line-chart",
  },
  { name: "Impostos", slug: "impostos", type: "EXPENSE", kind: "FIXED", color: "#334155", icon: "file-text" },
  {
    name: "Outras despesas",
    slug: "outras-despesas",
    type: "EXPENSE",
    kind: "OTHER",
    color: "#64748b",
    icon: "circle",
  },
] as const;

export function uniqueSeedCategoryKeys(categories = SEED_CATEGORIES) {
  return new Set(categories.map((category) => `${category.type}:${category.slug}`));
}
