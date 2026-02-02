import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import createMemoryStore from "memorystore";

type User = { email: string };

function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}
function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || "change-me";
}

export function setupAdminAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);

  app.use(
    session({
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
      store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 }),
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const adminEmail = getAdminEmail();
          const adminPassword = getAdminPassword();

          if (!adminEmail || !adminPassword) {
            return done(null, false, { message: "Admin credentials not configured" });
          }

          const e = (email || "").trim().toLowerCase();
          if (e !== adminEmail) return done(null, false, { message: "Invalid credentials" });
          if (password !== adminPassword) return done(null, false, { message: "Invalid credentials" });

          const user: User = { email: adminEmail };
          return done(null, user);
        } catch (err) {
          return done(err as any);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => done(null, user.email));
  passport.deserializeUser((email: any, done) => done(null, { email } as User));

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Login failed" });

      req.logIn(user, (err2) => {
        if (err2) return next(err2);
        return res.json({ email: user.email });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => res.json({ ok: true }));
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated?.() && req.user) return res.json(req.user);
    return res.status(401).json({ message: "Not authenticated" });
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.() && req.user) return next();
  return res.status(401).json({ message: "Unauthorized" });
}
