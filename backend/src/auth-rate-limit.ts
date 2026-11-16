import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import type { RateLimitInfo } from "express-rate-limit";

type AuthAction = "login" | "activation" | "password change";

/** Each credential operation owns its failed-attempt quota; successful use is not a failure. */
export function createAuthRateLimiter(action: AuthAction) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(req, res) {
      const resetTime = (req as Request & { rateLimit?: RateLimitInfo })
        .rateLimit?.resetTime;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          ((resetTime?.getTime() ?? Date.now() + 15 * 60 * 1000) - Date.now()) /
            1000,
        ),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: {
          code: "AUTH_RATE_LIMITED",
          message: `Too many unsuccessful ${action === "login" ? "sign-in" : action} attempts. Please wait before trying again.`,
          retryAfterSeconds,
          requestId: res.getHeader("X-Request-Id"),
        },
      });
    },
  });
}
