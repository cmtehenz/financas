import { getDb, type DbClient } from "@/db";
import { auditEvents } from "@/db/schema";
import { createId } from "@/lib/ids";

type Db = DbClient;

export async function recordAudit(
  input: {
    householdId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    changedFields?: string[];
  },
  db: Db = getDb(),
) {
  await db.insert(auditEvents).values({
    id: createId(),
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changedFields: input.changedFields?.join(",") ?? null,
  });
}
