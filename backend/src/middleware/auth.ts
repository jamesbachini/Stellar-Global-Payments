import { Request, Response, NextFunction } from "express";
import { appConfig } from "../config.js";
import { UnauthorizedError } from "../errors.js";

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("Authorization header is required");
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Invalid authorization header format. Expected: Bearer <token>");
  }

  if (token !== appConfig.adminAuthToken) {
    throw new UnauthorizedError("Invalid authorization token");
  }

  next();
}
