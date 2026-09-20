import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.disable("x-powered-by");

const configuredOrigins = new Set(
  [
    process.env.APP_ORIGIN,
    process.env.ALLOWED_ORIGINS,
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEV_DOMAIN,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      const origin = value.startsWith("http://") || value.startsWith("https://")
        ? value.replace(/\/+$/, "")
        : `https://${value.replace(/\/+$/, "")}`;
      return [origin];
    }),
);

function isAllowedOrigin(origin: string): boolean {
  if (configuredOrigins.has(origin.replace(/\/+$/, ""))) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  );
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  const origin = req.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    res.status(403).json({ error: "Origin is not allowed." });
    return;
  }
  next();
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      callback(null, !origin || isAllowedOrigin(origin));
    },
  }),
);
app.use(express.json({ limit: "64kb", strict: true }));
app.use(
  express.urlencoded({
    extended: false,
    limit: "8kb",
    parameterLimit: 50,
  }),
);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  const isPayloadTooLarge = status === 413;
  const isMalformedBody =
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "body" in error;

  const safeStatus = isPayloadTooLarge ? 413 : isMalformedBody ? 400 : 500;
  const message = isPayloadTooLarge
    ? "Rejected oversized request body"
    : isMalformedBody
      ? "Rejected malformed request body"
      : "Unhandled API error";

  if (isPayloadTooLarge || isMalformedBody) {
    logger.warn(
      {
        errorType: error instanceof Error ? error.name : typeof error,
        method: req.method,
        path: req.path,
        status: safeStatus,
      },
      message,
    );
  } else {
    logger.warn(
      { err: error, method: req.method, path: req.path, status: safeStatus },
      message,
    );
  }

  if (isPayloadTooLarge) {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }
  if (isMalformedBody) {
    res.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  res.status(500).json({ error: "The request could not be completed." });
};

app.use(errorHandler);

export default app;
