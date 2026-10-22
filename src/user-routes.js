
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

module.exports = function userRoutes(User, auth) {
  const router = express.Router();

  // --------------------------------------------------
  // RATE LIMITING
  // --------------------------------------------------

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many attempts. Please try again in 15 minutes.",
    },
  });

  // --------------------------------------------------
  // VALIDATION HELPERS
  // --------------------------------------------------

  function isValidEmail(email) {
    return (
      typeof email === "string" &&
      email.length <= 200 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
  }

  function getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    };
  }

  function clearUserCookie(res) {
    const { maxAge, ...options } = getCookieOptions();
    res.clearCookie("djs_user", options);
  }

  function setUserCookie(res, userId) {
    const token = jwt.sign(
      {
        sub: userId,
        type: "resident",
      },
      auth.jwtSecret,
      {
        expiresIn: "8h",
        algorithm: "HS256",
      }
    );

    res.cookie("djs_user", token, getCookieOptions());
  }

  // --------------------------------------------------
  // REGISTER
  // POST /users/register
  // --------------------------------------------------

  router.post("/register", limiter, async (req, res, next) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || "");

      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({
          error: "Enter your full name (2–100 characters).",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          error: "Enter a valid email address.",
        });
      }

      if (password.length < 6 || password.length > 200) {
        return res.status(400).json({
          error: "Password must be between 6 and 200 characters.",
        });
      }

      const passwordHash = await bcrypt.hash(password, 6);

      const user = await User.create({
        name,
        email,
        passwordHash,
      });

      setUserCookie(res, user._id.toString());

      return res.status(201).json({
        user: {
          name: user.name,
          email: user.email,
        },
        message: "Your account has been created.",
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          error: "An account with this email already exists.",
        });
      }

      return next(error);
    }
  });

  // --------------------------------------------------
  // LOGIN
  // POST /users/login
  // --------------------------------------------------

  router.post("/login", limiter, async (req, res, next) => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || "");

      if (
        !isValidEmail(email) ||
        !password ||
        password.length > 200
      ) {
        return res.status(400).json({
          error: "Enter a valid email and password.",
        });
      }

      const user = await User.findOne({ email });

      if (
        !user ||
        !(await bcrypt.compare(password, user.passwordHash))
      ) {
        return res.status(401).json({
          error: "Email or password is incorrect.",
        });
      }

      setUserCookie(res, user._id.toString());

      return res.json({
        user: {
          name: user.name,
          email: user.email,
        },
        message: "Signed in successfully.",
      });
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // LOGOUT
  // POST /users/logout
  // --------------------------------------------------

  router.post("/logout", (_req, res) => {
    clearUserCookie(res);

    return res.json({
      message: "Signed out.",
    });
  });

  // --------------------------------------------------
  // CURRENT RESIDENT
  // GET /users/me
  // --------------------------------------------------

  router.get("/me", async (req, res, next) => {
    try {
      const token = req.cookies?.djs_user;

      if (!token) {
        return res.status(401).json({
          error: "Please sign in.",
        });
      }

      const payload = jwt.verify(token, auth.jwtSecret, {
        algorithms: ["HS256"],
      });

      if (
        !payload ||
        typeof payload === "string" ||
        payload.type !== "resident" ||
        typeof payload.sub !== "string"
      ) {
        clearUserCookie(res);

        return res.status(401).json({
          error: "Invalid session. Please sign in again.",
        });
      }

      const user = await User.findById(payload.sub)
        .select("_id name email")
        .lean();

      if (!user) {
        clearUserCookie(res);

        return res.status(401).json({
          error: "Session expired. Please sign in again.",
        });
      }

      return res.json({
        user: {
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError" ||
        error.name === "NotBeforeError" ||
        error.name === "CastError"
      ) {
        clearUserCookie(res);

        return res.status(401).json({
          error: "Session expired. Please sign in again.",
        });
      }

      return next(error);
    }
  });

  // --------------------------------------------------
  // EXPORT ROUTER
  // --------------------------------------------------

  return router;
};
