import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors.js";
import { ApiErrorResponse } from "../types.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  console.error("Unexpected error:", err);

  return res.status(500).json({
    success: false,
    error: {
      message: "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
