import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { UserOut } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<UserOut>("/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useAIStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () => apiGet<{ enabled: boolean }>("/ai/status"),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
