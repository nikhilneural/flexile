"use client";
import { useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import { policies } from "@/access";
import { apiClient, setAuthTokenGetter } from "@/src/lib/api-client";

const GetUserData = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn, userId, getToken } = useAuth();
  const { user, login, logout } = useUserStore();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  const { data } = useQuery({
    queryKey: ["currentUser", userId],
    queryFn: async (): Promise<unknown> => {
      return apiClient.get("/api/users/me");
    },
    enabled: !!isSignedIn,
  });

  useEffect(() => {
    if (isSignedIn && data) login(data);
    else if (!isSignedIn) logout();
  }, [isSignedIn, data]);

  if (isSignedIn == null || (isSignedIn && !user)) return null;
  return children;
};

export const useCanAccess = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  return (policy: keyof typeof policies) =>
    policies[policy]({
      company,
      user,
      companyAdministrator: !!user.roles.administrator,
      companyContractor: user.roles.worker
        ? {
            ...user.roles.worker,
            endedAt: user.roles.worker.endedAt ? parseISO(user.roles.worker.endedAt).toISOString() : null,
          }
        : undefined,
      companyInvestor: !!user.roles.investor,
      companyLawyer: !!user.roles.lawyer,
    });
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  return (browserQueryClient ??= makeQueryClient());
}

export function AppProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <GetUserData>{children}</GetUserData>
    </QueryClientProvider>
  );
}
