import { Router, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { companies, roles, userRoles, users } from "../db/schema.js";
import {
  requireFirebaseAuth,
  type AuthenticatedRequest,
} from "./middleware.js";

export const authRouter: ReturnType<typeof Router> = Router();

authRouter.get(
  "/me",
  requireFirebaseAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const firebaseUser = req.firebaseUser!;

    const existing = await db.query.users.findFirst({
      where: eq(users.authSubject, firebaseUser.uid),
    });

    if (existing) {
      return res.json({
        user: {
          id: existing.id,
          firebaseUid: firebaseUser.uid,
          fullName: existing.fullName,
          email: existing.email,
          status: existing.status,
          companyId: existing.companyId,
        },
      });
    }

    const fullName =
      firebaseUser.name?.trim() ||
      firebaseUser.email?.split("@")[0] ||
      "New user";

    const email = firebaseUser.email ?? null;

    const result = await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          name: fullName + "'s Business",
          slug: `user-${firebaseUser.uid}`,
          email,
        })
        .returning({ id: companies.id });

      if (!company) {
        throw new Error("Failed to create company");
      }

      const [user] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          authSubject: firebaseUser.uid,
          fullName,
          email,
        })
        .returning({
          id: users.id,
          companyId: users.companyId,
          fullName: users.fullName,
          email: users.email,
          status: users.status,
        });

      if (!user) {
        throw new Error("Failed to create user");
      }

      const [ownerRole] = await tx
        .insert(roles)
        .values({
          companyId: company.id,
          name: "Owner",
          description: "Initial company owner",
        })
        .returning({ id: roles.id });

      if (!ownerRole) {
        throw new Error("Failed to create owner role");
      }

      await tx.insert(userRoles).values({
        userId: user.id,
        roleId: ownerRole.id,
      });

      return user;
    });

    return res.status(201).json({
      user: {
        id: result.id,
        firebaseUid: firebaseUser.uid,
        fullName: result.fullName,
        email: result.email,
        status: result.status,
        companyId: result.companyId,
      },
    });
  },
);
