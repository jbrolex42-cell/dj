
const jwt = require("jsonwebtoken");

module.exports = function createAuth(Admin) {
  // --------------------------------------------------
  // JWT CONFIGURATION
  // --------------------------------------------------

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a secure random value of at least 32 characters."
    );
  }

  // --------------------------------------------------
  // COOKIE CONFIGURATION
  // --------------------------------------------------

  function cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    };
  }

  // --------------------------------------------------
  // AUTHENTICATION MIDDLEWARE
  // --------------------------------------------------

  async function requireAuth(req, res, next) {
    try {
      const token = req.cookies?.djs_admin;

      if (!token) {
        return res.status(401).json({
          error: "Please sign in to continue.",
        });
      }

      // Verify the token signature, expiry, and expected algorithm.
      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ["HS256"],
      });

      if (
        !payload ||
        typeof payload === "string" ||
        typeof payload.sub !== "string"
      ) {
        res.clearCookie("djs_admin", cookieOptions());

        return res.status(401).json({
          error: "Session expired. Please sign in again.",
        });
      }

      // Load the administrator from the database.
      const admin = await Admin.findById(payload.sub)
        .select("_id name email")
        .lean();

      if (!admin) {
        res.clearCookie("djs_admin", cookieOptions());

        return res.status(401).json({
          error: "Session expired. Please sign in again.",
        });
      }

      // Make the authenticated administrator available to routes.
      req.admin = admin;

      return next();
    } catch (error) {
      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError" ||
        error.name === "NotBeforeError" ||
        error.name === "CastError"
      ) {
        res.clearCookie("djs_admin", cookieOptions());

        return res.status(401).json({
          error: "Session expired. Please sign in again.",
        });
      }

      // Database and unexpected errors go to Express error handling.
      return next(error);
    }
  }

  // --------------------------------------------------
  // EXPORT AUTH UTILITIES
  // --------------------------------------------------

  return {
    requireAuth,
    jwtSecret,
    cookieOptions,
  };
};