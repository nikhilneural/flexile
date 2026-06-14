import React from "react";

export default function Sheet({
  primary = false,
  children,
  actions,
}: {
  primary?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`px-3 py-6 md:px-16 ${primary ? "bg-blue-50" : "bg-gray-100"}`}>
      <div className="flex max-w-(--breakpoint-xl) flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="grow">{children}</div>
        {actions ? <div className="flex flex-row flex-wrap gap-3 sm:flex-row-reverse">{actions}</div> : null}
      </div>
    </div>
  );
}
