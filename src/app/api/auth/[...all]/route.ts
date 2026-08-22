import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

function getHandler() {
  return toNextJsHandler(getAuth());
}

export async function GET(request: NextRequest) {
  return getHandler().GET(request);
}

export async function POST(request: NextRequest) {
  return getHandler().POST(request);
}
