
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

module.exports = function authRoutes(Admin, auth) {
  const router = express.Router();

  // --------------------------------------------------
  // LOGIN RATE LIMITER
  // --------------------------------------------------

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many login attempts. Try again later.",
    },
  });

  // --------------------------------------------------
  // ADMIN LOGIN
  // POST /auth/login
  // --------------------------------------------------

  router.post("/login", loginLimiter, async (req, res, next) => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();

      const password = String(req.body?.password || "");

      if (
        !email ||
        !password ||
        password.length > 200
      ) {
        return res.status(400).json({
          error: "Enter your email and password.",
        });
      }

      // Find the administrator by email.
      const admin = await Admin.findOne({ email });

      // Use the same error message for both failure cases.
      if (
        !admin ||
        !(await bcrypt.compare(password, admin.passwordHash))
      ) {
        return res.status(401).json({
          error: "Email or password is incorrect.",
        });
      }

      // Ensure JWT configuration exists.
      if (!auth.jwtSecret) {
        return res.status(500).json({
          error: "Authentication is not configured correctly.",
        });
      }

      // Create an eight-hour authentication token.
      const token = jwt.sign(
        {
          sub: admin._id.toString(),
        },
        auth.jwtSecret,
        {
          expiresIn: "8h",
        }
      );

      // Store the token in an HTTP-only cookie.
      res.cookie("djs_admin", token, {
        ...auth.cookieOptions(),
        maxAge: 8 * 60 * 60 * 1000,
      });

      return res.json({
        admin: {
          name: admin.name,
          email: admin.email,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // ADMIN LOGOUT
  // POST /auth/logout
  // --------------------------------------------------

  router.post("/logout", (_req, res) => {
    const cookieOptions = {
      ...auth.cookieOptions(),
      maxAge: undefined,
      expires: new Date(0),
    };

    res.clearCookie("djs_admin", cookieOptions);

    return res.json({
      message: "Signed out.",
    });
  });

  // --------------------------------------------------
  // CURRENT ADMIN
  // GET /auth/me
  // --------------------------------------------------

  router.get("/me", auth.requireAuth, (req, res) => {
    if (!req.admin) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    return res.json({
      admin: {
        name: req.admin.name,
        email: req.admin.email,
      },
    });
  });

  // --------------------------------------------------
  // EXPORT ROUTER
  // --------------------------------------------------

  return router;
};