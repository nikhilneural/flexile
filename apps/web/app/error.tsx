"use client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { linkClasses } from "@/components/Link";
import { ApiError } from "@/src/lib/api-client";
import { ResponseError } from "@/utils/request";

export default function Error({ error }: { error: Error }) {
  const code = (() => {
    if (error instanceof ApiError) {
      if (error.status === 404) return 404;
      if (error.status === 403) return 403;
      if (error.status === 401) throw redirect("/login");
      return 500;
    }
    if (error instanceof ResponseError) {
      const status = error.response?.status;
      if (status === 404 || status === 403) {
        if (error.response && !error.response.bodyUsed) {
          void error.response.json().then((body) => {
            const redirectData = z.object({ redirect_path: z.string() }).safeParse(body);
            if (redirectData.success) throw redirect(redirectData.data.redirect_path);
          });
        }
        return status;
      }
      if (status === 401) throw redirect("/login");
      return 500;
    }
    return 500;
  })();
  return <ErrorPage code={code} />;
}

export const ErrorPage = ({ code }: { code: 404 | 403 | 500 }) => {
  const heading = (() => {
    switch (code) {
      case 403:
        return "Access denied";
      case 404:
        return "Page not found";
      default:
        return "Something went wrong";
    }
  })();

  const text = (() => {
    switch (code) {
      case 403:
        return "You are not allowed to perform this action.";
      case 404:
        return "The thing you were looking for doesn't exist... Sorry!";
      default:
        return "Sorry about that. Please try again!";
    }
  })();

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-center text-white">
      <div className="text-6xl font-bold">{code}</div>
      <div className="text-3xl font-bold">{heading}</div>
      <div>{text}</div>
      <Link href="/dashboard" className={linkClasses}>
        Go home?
      </Link>
    </main>
  );
};
