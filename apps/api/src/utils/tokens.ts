import jwt, { JwtPayload } from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "../lib/app-error.js";
import type { AuthContext } from "../types/auth.js";

type TokenPayload = JwtPayload & {
  companyId?: string;
  email?: string;
  roles?: string[];
};

export function createTokenPair(context: AuthContext): { accessToken: string; refreshToken: string } {
  const tokenPayload = {
    sub: context.userId,
    companyId: context.companyId,
    email: context.email,
    roles: context.roles
  };

  const accessToken = jwt.sign(tokenPayload, env.jwtAccessSecret, { expiresIn: "1h" });
  const refreshToken = jwt.sign(tokenPayload, env.jwtRefreshSecret, { expiresIn: "7d" });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthContext {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as string | TokenPayload;

  if (typeof decoded === "string") {
    throw new AppError(401, "INVALID_TOKEN", "Invalid access token");
  }

  const userId = typeof decoded.sub === "string" ? decoded.sub : undefined;
  const companyId = decoded.companyId;
  const email = decoded.email;
  const roles = Array.isArray(decoded.roles) ? decoded.roles.filter((role): role is string => typeof role === "string") : [];

  if (!userId || !companyId || !email) {
    throw new AppError(401, "INVALID_TOKEN", "Access token is missing required claims");
  }

  return {
    userId,
    companyId,
    email,
    roles
  };
}
