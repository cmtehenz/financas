if (process.env.NODE_ENV === "production") {
  console.error("Seed is disabled in production.");
  process.exit(1);
}

console.info("Development seed is not implemented in Phase 1.");
process.exit(0);
