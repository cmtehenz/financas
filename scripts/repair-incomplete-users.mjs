import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const deleted = await sql`
  DELETE FROM "user" u
  WHERE NOT EXISTS (
    SELECT 1
    FROM "account" a
    WHERE a.user_id = u.id
  )
  RETURNING 1
`;

console.log(JSON.stringify({ removedIncompleteUsers: deleted.length }));
