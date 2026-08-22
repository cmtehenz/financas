import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const [publicUsers, publicAccounts, neonUsers] = await Promise.all([
  sql`SELECT count(*)::int AS n FROM "user"`,
  sql`SELECT count(*)::int AS n FROM "account"`,
  sql`SELECT count(*)::int AS n FROM neon_auth."user"`,
]);

const orphans = await sql`
  SELECT count(*)::int AS n
  FROM "user" u
  LEFT JOIN "account" a ON a.user_id = u.id
  WHERE a.id IS NULL
`;

console.log(
  JSON.stringify({
    publicUsers: publicUsers[0]?.n ?? 0,
    publicAccounts: publicAccounts[0]?.n ?? 0,
    neonAuthUsers: neonUsers[0]?.n ?? 0,
    usersWithoutPasswordAccount: orphans[0]?.n ?? 0,
  }),
);
