import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const tables = await sql`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'neon_auth')
    AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name
`;

console.log(
  JSON.stringify({
    tables: tables.map((table) => `${table.table_schema}.${table.table_name}`),
  }),
);

const [users, sessions, accounts, verifications] = await Promise.all([
  sql`SELECT count(*)::int AS n FROM "user"`,
  sql`SELECT count(*)::int AS n FROM "session"`,
  sql`SELECT count(*)::int AS n FROM "account"`,
  sql`SELECT count(*)::int AS n FROM "verification"`,
]);

console.log(
  JSON.stringify({
    row_counts: {
      user: users[0]?.n ?? null,
      session: sessions[0]?.n ?? null,
      account: accounts[0]?.n ?? null,
      verification: verifications[0]?.n ?? null,
    },
  }),
);
