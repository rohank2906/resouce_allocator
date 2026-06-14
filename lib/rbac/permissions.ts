import { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  SUB_ADMIN: "Sub Admin",
  TPM: "TPM",
  PL: "Project Lead",
  QUALITY_LEAD: "Quality Lead",
  EMPLOYEE: "Employee"
};

const permissions = {
  manageUsers: [Role.ADMIN],
  manageProjects: [Role.ADMIN],
  manageEmployees: [Role.ADMIN],
  manageSync: [Role.ADMIN],
  viewSyncHistory: [Role.ADMIN, Role.SUB_ADMIN],
  changeOwnPassword: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM, Role.PL, Role.QUALITY_LEAD, Role.EMPLOYEE],
  resetOtherPassword: [Role.ADMIN],
  viewAllProjects: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM],
  importSheets: [Role.ADMIN],
  overrideApprovals: [Role.ADMIN],
  viewAnalytics: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM, Role.PL],
  createRequests: [Role.ADMIN, Role.SUB_ADMIN, Role.PL],
  decideRequests: [Role.ADMIN, Role.SUB_ADMIN, Role.PL],
  selectTransferEmployees: [Role.ADMIN, Role.SUB_ADMIN, Role.PL],
  escalateRequests: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM],
  viewAudit: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM],
  viewOwnAssignment: [Role.ADMIN, Role.SUB_ADMIN, Role.TPM, Role.PL, Role.QUALITY_LEAD, Role.EMPLOYEE]
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof permissions;

export function can(role: Role | undefined, permission: Permission) {
  return Boolean(role && (permissions[permission] as Role[]).includes(role));
}

export function assertCan(role: Role | undefined, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
