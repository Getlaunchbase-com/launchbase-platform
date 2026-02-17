/**
 * tRPC Client
 *
 * Provides a typed tRPC React Query client for communicating with the server.
 * Uses @trpc/react-query for React hooks (.useQuery, .useMutation, etc.).
 */

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers/_incoming_routers";

export const trpc = createTRPCReact<AppRouter>();

export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.PUBLIC_BASE_URL || "http://localhost:3000";
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

export default trpc;
