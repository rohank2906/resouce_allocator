import { prisma } from "@/lib/db/prisma";

export async function getDashboardMetrics() {
  const [
    totalEmployees,
    employeesByProject,
    employeesByPosition,
    employeesByAttendance,
    unsyncedCount,
    requestsByStatus,
    activeRequests,
    recentRequests,
    lastRsSync
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.groupBy({ by: ["projectId"], _count: true }),
    prisma.employee.groupBy({ by: ["position"], _count: true }),
    prisma.employee.groupBy({ by: ["attendanceStatus"], _count: true }),
    prisma.employee.count({ where: { attendanceStatus: null } }),
    prisma.resourceRequest.groupBy({ by: ["status"], _count: true }),
    prisma.resourceRequest.count({ where: { status: "PENDING" } }),
    prisma.resourceRequest.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { requestingProject: true, sourceProject: true }
    }),
    prisma.syncHistory.findFirst({
      where: { source: "RS_SHEET", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true }
    })
  ]);

  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const attendanceCounts = {
    PRESENT: 0,
    LEAVE: 0,
    ABSENT: 0,
    UNKNOWN: 0,
    UNSYNCED: unsyncedCount
  };
  for (const row of employeesByAttendance) {
    if (row.attendanceStatus === null) continue;
    attendanceCounts[row.attendanceStatus] = row._count;
  }

  return {
    totalEmployees,
    activeRequests,
    attendance: {
      present: attendanceCounts.PRESENT,
      leave: attendanceCounts.LEAVE,
      absent: attendanceCounts.ABSENT,
      unknown: attendanceCounts.UNKNOWN,
      unsynced: attendanceCounts.UNSYNCED,
      lastSyncedAt: lastRsSync?.completedAt ?? null
    },
    employeesByProject: employeesByProject.map((item) => ({
      project: projectNames.get(item.projectId) ?? "Unknown",
      employees: item._count
    })),
    employeesByPosition: employeesByPosition.map((item) => ({
      position: item.position,
      employees: item._count
    })),
    requestsByStatus: requestsByStatus.map((item) => ({
      status: item.status,
      requests: item._count
    })),
    recentRequests
  };
}

export async function getProjectAttendance(projectId: string) {
  const [grouped, total, byPosition] = await Promise.all([
    prisma.employee.groupBy({
      by: ["attendanceStatus"],
      where: { projectId },
      _count: true
    }),
    prisma.employee.count({ where: { projectId } }),
    prisma.employee.groupBy({
      by: ["position"],
      where: { projectId },
      _count: true
    })
  ]);

  const counts = { PRESENT: 0, LEAVE: 0, ABSENT: 0, UNKNOWN: 0, UNSYNCED: 0 };
  for (const row of grouped) {
    if (row.attendanceStatus === null) counts.UNSYNCED = row._count;
    else counts[row.attendanceStatus] = row._count;
  }

  return {
    total,
    ...counts,
    positions: byPosition.map((p) => ({ position: p.position, count: p._count }))
  };
}
