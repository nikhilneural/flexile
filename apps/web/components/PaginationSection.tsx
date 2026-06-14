import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSerializer, parseAsInteger, useQueryState } from "nuqs";
import React from "react";

const pageParser = parseAsInteger.withDefault(1);
export const usePage = () => useQueryState("page", pageParser);

const PaginationSection = ({ total, perPage }: { total: number; perPage: number }) => {
  const [page] = usePage();
  const searchParams = useSearchParams();
  const baseStyles = "size-10 flex items-center justify-center rounded-full";
  const inactiveStyles = "hover:bg-blue-50 hover:text-blue-600";
  const serialize = createSerializer({ page: pageParser });
  const createLink = (page: number) => `?${serialize(searchParams, { page }).slice(1)}` as const;

  if (total <= perPage) return null;

  const lastPage = Math.ceil(total / perPage);
  const series: (number | "gap")[] = [1];

  // Pages around current page
  if (page > 3) series.push("gap");
  if (page > 2) series.push(page - 1);
  if (page > 1 && page < lastPage) series.push(page);
  if (page < lastPage - 1) series.push(page + 1);
  if (page < lastPage - 2) series.push("gap");

  // Last page
  if (lastPage > 1) series.push(lastPage);

  return (
    <div className="flex items-center justify-between" aria-label="Pagination">
      <span>{`Showing ${(page - 1) * perPage + 1}-${Math.min(page * perPage, total)} of ${total.toLocaleString()}`}</span>
      <div className="flex gap-x-2">
        <Link
          href={createLink(page - 1)}
          aria-label="Previous"
          className={`${baseStyles} ${inactiveStyles}`}
          inert={page === 1}
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        {series.map((item, index) => {
          if (item === "gap") {
            return (
              <span key={`gap-${index}`} className={baseStyles}>
                &hellip;
              </span>
            );
          }

          return (
            <Link
              key={item}
              href={createLink(item)}
              className={`${baseStyles} ${item === page ? "bg-blue-600 text-white" : inactiveStyles}`}
            >
              {item}
            </Link>
          );
        })}
        <Link
          href={createLink(page + 1)}
          aria-label="Next"
          className={`${baseStyles} ${inactiveStyles}`}
          inert={page === lastPage}
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  );
};

export default PaginationSection;
