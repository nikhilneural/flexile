import { PayRateType } from "@/db/enums";

export const calculateAnnualCompensation = ({
  role,
  application,
}: {
  role: { payRateType: PayRateType; payRateInSubunits: number };
  application: { hoursPerWeek: number | null; weeksPerYear: number | null };
}) => {
  switch (role.payRateType) {
    case PayRateType.ProjectBased:
      return 0;
    case PayRateType.Salary:
      return role.payRateInSubunits / 100;
    case PayRateType.Hourly:
      return application.hoursPerWeek && application.weeksPerYear
        ? (role.payRateInSubunits / 100) * application.hoursPerWeek * application.weeksPerYear
        : 0;
  }
};
