import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "./firebase.js";

export interface AuthenticatedRequest extends Request {
  firebaseUser?: DecodedIdToken;
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "A Firebase ID token is required.",
    });
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "A Firebase ID token is required.",
    });
  }

  try {
    req.firebaseUser = await getFirebaseAdminAuth().verifyIdToken(token);
    return next();
  } catch (error) {
    console.warn("Firebase token verification failed", error);
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "The Firebase ID token is invalid or expired.",
    });
  }
}
