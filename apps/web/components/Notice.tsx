import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import React from "react";

const Notice = ({
  variant,
  hideIcon = false,
  children,
  className,
}: {
  variant?: "success" | "critical" | undefined;
  hideIcon?: boolean;
  children: React.ReactNode;
  className?: string;
}) => {
  const colorClasses = (() => {
    switch (variant) {
      case "success":
        return "bg-green text-white";
      case "critical":
        return "bg-red text-white";
      default:
        return "bg-gray-100 text-black";
    }
  })();

  const IconComponent = (() => {
    switch (variant) {
      case "critical":
        return ExclamationTriangleIcon;
      case "success":
        return CheckCircleIcon;
      default:
        return InformationCircleIcon;
    }
  })();

  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${colorClasses} ${className}`} role="status">
      {!hideIcon && (
        <div className="size-5 shrink-0">
          <IconComponent />
        </div>
      )}
      <div className="grow">{children}</div>
    </div>
  );
};

export default Notice;
