import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);
const [users, accounts] = await Promise.all([
  sql`SELECT count(*)::int AS n FROM "user"`,
  sql`SELECT count(*)::int AS n FROM "account"`,
]);

console.log(JSON.stringify({ users: users[0]?.n ?? 0, accounts: accounts[0]?.n ?? 0 }));
