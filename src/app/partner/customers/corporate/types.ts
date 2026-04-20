export type PipelineStage =
  | "LEAD"
  | "PROPOSED"
  | "NEGOTIATING"
  | "CONTRACTED"
  | "ACTIVE"
  | "RENEWAL"
  | "CHURNED";

export const PIPELINE_STAGES: PipelineStage[] = [
  "LEAD",
  "PROPOSED",
  "NEGOTIATING",
  "CONTRACTED",
  "ACTIVE",
  "RENEWAL",
  "CHURNED",
];

export type ContactRole =
  | "HR"
  | "ESG"
  | "FINANCE"
  | "CEO"
  | "MARKETING"
  | "OTHER";
