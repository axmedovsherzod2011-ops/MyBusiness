import { Router, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { companies, roles, userRoles, users } from "../db/schema.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "./middleware.js";

export const authRouter: ReturnType<typeof Router> = Router();

function publicUser(user: {
  id: string;
  companyId: string;
  fullName: string;
  email: string | null;
  status: string;
}, firebaseUid: string) {
  return {
    id: user.id,
    firebaseUid,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    companyId: user.companyId,
  };
}

authRouter.get("/me", requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const firebaseUser = req.firebaseUser!;

  const existing = await db.query.users.findFirst({
    where: eq(users.authSubject, firebaseUser.uid),
  });

  if (existing) return res.json({ user: publicUser(existing, firebaseUser.uid) });

  const fullName =
    firebaseUser.name?.trim() ||
    firebaseUser.email?.split("@")[0] ||
    "Новый пользователь";
  const email = firebaseUser.email ?? null;

  try {
    const created = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        name: fullName + " — компания",
        slug: "user-" + firebaseUser.uid,
        email,
      }).returning({ id: companies.id });

      if (!company) throw new Error("Не удалось создать компанию");

      const [user] = await tx.insert(users).values({
        companyId: company.id,
        authSubject: firebaseUser.uid,
        fullName,
        email,
      }).returning({
        id: users.id,
        companyId: users.companyId,
        fullName: users.fullName,
        email: users.email,
        status: users.status,
      });

      if (!user) throw new Error("Не удалось создать пользователя");

      const [ownerRole] = await tx.insert(roles).values({
        companyId: company.id,
        name: "Владелец",
        description: "Владелец компании",
      }).returning({ id: roles.id });

      if (!ownerRole) throw new Error("Не удалось создать роль владельца");

      await tx.insert(userRoles).values({ userId: user.id, roleId: ownerRole.id });
      return user;
    });

    return res.status(201).json({ user: publicUser(created, firebaseUser.uid) });
  } catch (error) {
    const raced = await db.query.users.findFirst({
      where: eq(users.authSubject, firebaseUser.uid),
    });

    if (raced) return res.status(200).json({ user: publicUser(raced, firebaseUser.uid) });
    throw error;
  }
});
