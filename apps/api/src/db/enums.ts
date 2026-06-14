export enum PayRateType {
  Hourly = 0,
  ProjectBased,
  Salary,
}

export enum DocumentType {
  ConsultingContract = 0,
  EquityPlanContract,
  ShareCertificate,
  TaxDocument,
  ExerciseNotice,
}

export enum DocumentTemplateType {
  ConsultingContract = 0,
  EquityPlanContract,
}

export enum RoleApplicationStatus {
  Pending = 0,
  Accepted,
  Denied,
}

export enum BusinessType {
  LLC = 0,
  CCorporation,
  SCorporation,
  Partnership,
}

export enum TaxClassification {
  CCorporation = 0,
  SCorporation,
  Partnership,
}
