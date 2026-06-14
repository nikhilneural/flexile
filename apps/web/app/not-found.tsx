import { ErrorPage } from "@/app/error";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return <ErrorPage code={404} />;
}
