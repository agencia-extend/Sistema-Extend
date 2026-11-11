"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  client ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
