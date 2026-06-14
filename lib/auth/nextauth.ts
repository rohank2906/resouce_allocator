import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare, hash } from "bcryptjs";
import { Role, Position } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { defaultPasswordFor } from "@/lib/auth/passwords";

const ALLOWED_DOMAIN = "ethara.ai";
const PRIMARY_ADMIN_EMAIL = "rohan.khatri@ethara.ai";
const PRIMARY_ADMIN_PASSWORD = "rohan@123";
const SUB_ADMIN_POSITIONS = new Set<Position>([Position.TPM, Position.PL]);

export type ExpectedRole = "admin" | "tpm" | "pl";

export class AuthError extends Error {
  constructor(code:
    | "DOMAIN_NOT_ALLOWED"
    | "ROLE_MISMATCH"
    | "ACCOUNT_INACTIVE"
    | "INVALID_CREDENTIALS"
  ) {
    super(code);
    this.name = code;
  }
}

function legacyDomain(email: string): boolean {
  return email.endsWith("@company.com");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        expectedRole: { label: "Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;
        const expectedRole = (credentials.expectedRole as ExpectedRole | undefined) ?? "admin";

        if (!email.endsWith(`@${ALLOWED_DOMAIN}`) && !legacyDomain(email)) {
          throw new AuthError("DOMAIN_NOT_ALLOWED");
        }

        const auth = await tryAuthorize(email, password);
        if (!auth) throw new AuthError("INVALID_CREDENTIALS");

        if (auth.user.isActive === false) {
          throw new AuthError("ACCOUNT_INACTIVE");
        }

        const actualPosition = auth.user.employee?.position;
        if (expectedRole === "admin" && auth.resolvedRole !== Role.ADMIN) {
          throw new AuthError("ROLE_MISMATCH");
        }
        if (expectedRole === "tpm" && actualPosition !== Position.TPM) {
          throw new AuthError("ROLE_MISMATCH");
        }
        if (expectedRole === "pl" && actualPosition !== Position.PL) {
          throw new AuthError("ROLE_MISMATCH");
        }

        await prisma.user.update({
          where: { id: auth.user.id },
          data: { lastLogin: new Date() }
        });

        return {
          id: auth.user.id,
          email: auth.user.email,
          name: auth.user.name,
          role: auth.resolvedRole,
          mustChangePassword: auth.mustChangePassword
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role: Role; mustChangePassword?: boolean };
        token.id = u.id;
        token.role = u.role;
        token.mustChangePassword = u.mustChangePassword ?? false;
      }
      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            mustChangePassword: true,
            role: true,
            name: true,
            email: true,
            isActive: true
          }
        });
        if (fresh && fresh.isActive) {
          token.mustChangePassword = fresh.mustChangePassword;
          token.role = fresh.role;
          token.name = fresh.name;
          token.email = fresh.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const target = session.user as Record<string, unknown>;
        target.id = token.id;
        target.role = token.role;
        target.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    }
  }
};

type AuthorizeOutcome = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
    employee: { position: Position } | null;
  };
  resolvedRole: Role;
  mustChangePassword: boolean;
} | null;

async function tryAuthorize(email: string, password: string): Promise<AuthorizeOutcome> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: { select: { id: true, name: true, position: true } } }
  });

  if (user?.passwordHash) {
    if (await compare(password, user.passwordHash)) {
      const resolvedRole = resolveRole(user.email, user.role, user.employee?.position);
      return {
        user: pickUser(user),
        resolvedRole,
        mustChangePassword: user.mustChangePassword
      };
    }
    return null;
  }

  if (email === PRIMARY_ADMIN_EMAIL) {
    if (password !== PRIMARY_ADMIN_PASSWORD) return null;
    const created = await ensureUser(email, "Rohan Khatri", password, Role.ADMIN, undefined, false);
    return {
      user: pickUser({ ...created, employee: null }),
      resolvedRole: Role.ADMIN,
      mustChangePassword: false
    };
  }

  const employee = user?.employee ?? (await prisma.employee.findUnique({
    where: { email },
    select: { id: true, name: true, position: true }
  }));

  if (!employee || !SUB_ADMIN_POSITIONS.has(employee.position)) {
    return null;
  }

  if (password !== defaultPasswordFor(email)) return null;

  const created = await ensureUser(email, employee.name, password, Role.SUB_ADMIN, employee.id, true);
  return {
    user: pickUser({ ...created, employee: { position: employee.position } }),
    resolvedRole: Role.SUB_ADMIN,
    mustChangePassword: true
  };
}

function pickUser<T extends { id: string; email: string; name: string | null; isActive: boolean }>(
  u: T & { employee: { position: Position } | null }
) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    employee: u.employee
  };
}

function resolveRole(
  email: string,
  storedRole: Role,
  position: Position | undefined
): Role {
  if (email === PRIMARY_ADMIN_EMAIL) return Role.ADMIN;
  if (storedRole === Role.ADMIN) return Role.ADMIN;
  if (position && SUB_ADMIN_POSITIONS.has(position)) return Role.SUB_ADMIN;
  return storedRole;
}

async function ensureUser(
  email: string,
  name: string,
  password: string,
  role: Role,
  employeeId: string | undefined,
  mustChangePassword: boolean
) {
  const passwordHash = await hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash, role, mustChangePassword, isActive: true }
    });
  }
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role, mustChangePassword, isActive: true }
  });
  if (employeeId) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { userId: user.id }
    });
  }
  return user;
}
