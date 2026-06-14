import React, { type ReactNode } from "react";

const Placeholder = ({ icon: Icon, children }: { icon?: React.ElementType; children: ReactNode }) => (
  <div className="grid justify-items-center gap-4 rounded-lg border border-dashed border-gray-100 p-6 text-center text-gray-500">
    {Icon ? <Icon className="size-10" /> : null}
    {children}
  </div>
);

export default Placeholder;
