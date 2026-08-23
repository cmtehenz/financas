import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/require-household";
import { getHouseholdDocument } from "@/services/documents";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { session, household } = await requireHouseholdMembership();
    const document = await getHouseholdDocument({
      userId: session.user.id,
      householdId: household.id,
      documentId: id,
    });

    if (!document) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }

    return new NextResponse(Buffer.from(document.content), {
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": contentDisposition(document.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
}
