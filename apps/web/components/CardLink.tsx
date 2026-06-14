import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type { Route } from "next";
import Link from "next/link";
import React from "react";

interface CardLinkProps<T extends string> {
  href: Route<T>;
  title: string;
  description?: string;
}

const CardLink = <T extends string>({ title, description, href }: CardLinkProps<T>) => (
  <Link href={href} className="grid grid-cols-[1fr_auto] items-center rounded-xl border p-4 no-underline">
    <div className="grid gap-4">
      <h4 className="text-xl font-bold">{title}</h4>
      {description ? <p className="line-clamp-2">{description}</p> : null}
    </div>
    <ArrowRightIcon className="size-7" />
  </Link>
);

export default CardLink;
