import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const POSITION_LABELS: Record<string, string> = {
  PL: "Project Lead",
  QUALITY_LEAD: "Quality Lead",
  TASKER: "FTE Tasker",
  INTERN_TASKER: "Intern Tasker",
  ENGINEERING_SUPPORT: "Engineering",
  RESEARCH_SUPPORT: "Research",
  TPM: "TPM"
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TPM: "TPM",
  PL: "Project Lead",
  QUALITY_LEAD: "Quality Lead",
  EMPLOYEE: "Employee"
};

export function titleCase(value: string) {
  if (POSITION_LABELS[value]) return POSITION_LABELS[value];
  if (ROLE_LABELS[value]) return ROLE_LABELS[value];
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(name?: string | null, email?: string | null) {
  const source = name || email || "U";
  return source
    .split(/[.\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
