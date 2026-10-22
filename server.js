
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

// --------------------------------------------------
// APPLICATION CONFIGURATION
// --------------------------------------------------

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/djs-adult-family-home";

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (
  !Number.isInteger(PORT) ||
  PORT < 1 ||
  PORT > 65535
) {
  throw new Error("PORT must be a valid TCP port.");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must contain at least 32 characters. Configure it in .env."
  );
}

if (!process.env.MONGODB_URI && IS_PRODUCTION) {
  throw new Error(
    "MONGODB_URI must be configured in production."
  );
}

// Create the uploads directory before accepting uploads.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Disable Express fingerprinting.
app.disable("x-powered-by");

// If deploying behind a reverse proxy, configure trust proxy
// explicitly for your hosting provider before using IP rate limits.
// Example for a known single trusted proxy:
// app.set("trust proxy", 1);

// --------------------------------------------------
// SECURITY AND MIDDLEWARE
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
        ],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
  })
);

app.use(compression());

app.use(
  express.json({
    limit: "20kb",
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "20kb",
  })
);

app.use(cookieParser());

// General API rate limiter.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// Serve website assets.
app.use(
  express.static(PUBLIC_DIR, {
    index: "index.html",
  })
);

// Serve uploaded images.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "7d",
    immutable: true,
    dotfiles: "deny",
    index: false,
  })
);

// --------------------------------------------------
// DATABASE SCHEMAS
// --------------------------------------------------

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },

    icon: {
      type: String,
      default: "heart",
      maxlength: 30,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 600,
      default: "",
    },

    roomType: {
      type: String,
      enum: ["Private room", "Shared room", "Other"],
      default: "Private room",
    },

    availability: {
      type: String,
      enum: [
        "Available",
        "Limited availability",
        "Currently occupied",
        "Contact us",
      ],
      default: "Contact us",
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    caption: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    imageUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const inquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },

    careFor: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: ["New", "Contacted", "Tour requested", "Closed"],
      default: "New",
    },

    consent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },

    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },

    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// --------------------------------------------------
// DATABASE MODELS
// --------------------------------------------------

const Service = mongoose.model("Service", serviceSchema);
const Room = mongoose.model("Room", roomSchema);
const Inquiry = mongoose.model("Inquiry", inquirySchema);
const GalleryItem = mongoose.model("GalleryItem", gallerySchema);
const Post = mongoose.model("Post", postSchema);
const Admin = mongoose.model("Admin", adminSchema);
const User = mongoose.model("User", userSchema);

// --------------------------------------------------
// AUTHENTICATION AND ROUTE MODULES
// --------------------------------------------------

const auth = require("./src/auth")(Admin);

const adminRoutes = require("./src/admin")({
  Room,
  Inquiry,
  GalleryItem,
  Post,
  auth,
  uploadsDir: UPLOADS_DIR,
});

// --------------------------------------------------
// HEALTH CHECK
// GET /api/health
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected",
  });
});

// --------------------------------------------------
// PUBLIC WEBSITE CONTENT
// GET /api/public/site
// --------------------------------------------------

const defaultServices = [
  {
    title: "Personalized Daily Support",
    description:
      "Thoughtful assistance shaped around each resident's routines, preferences and dignity.",
    icon: "heart",
  },
  {
    title: "Meals & Nutrition",
    description:
      "Welcoming mealtimes and nourishing food planned around individual needs.",
    icon: "utensils",
  },
  {
    title: "Medication Support",
    description:
      "Support with medication routines based on the home's actual capabilities and care plan.",
    icon: "shield-check",
  },
  {
    title: "Housekeeping & Laundry",
    description:
      "A comfortable, tidy living environment with help for everyday household needs.",
    icon: "house",
  },
  {
    title: "Companionship & Activities",
    description:
      "Meaningful conversation, activities and opportunities to feel connected.",
    icon: "users",
  },
  {
    title: "Family Communication",
    description:
      "Open communication with families to help them stay informed and involved.",
    icon: "message-circle",
  },
];

app.get("/api/public/site", async (_req, res, next) => {
  try {
    let services = await Service.find({
      active: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (services.length === 0) {
      services = defaultServices;
    }

    const [rooms, gallery, posts] = await Promise.all([
      Room.find({ active: true })
        .sort({ createdAt: -1 })
        .lean(),

      GalleryItem.find({ active: true })
        .sort({ createdAt: -1 })
        .limit(18)
        .lean(),

      Post.find({ active: true })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    return res.json({
      business: {
        name: "DJ's Adult Family Home",
        tagline: "Compassionate care. A place to feel at home.",
        description:
          "A warm, respectful home environment where every person deserves to feel safe, valued and cared for.",
        phone: "",
        email: "",
        address: "",
        location: "",
      },

      services,
      rooms,
      gallery,
      posts,
    });
  } catch (error) {
    return next(error);
  }
});

// --------------------------------------------------
// PUBLIC INQUIRY FORM
// POST /api/inquiries
// --------------------------------------------------

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many submissions. Please try again later.",
  },
});

app.post(
  "/api/inquiries",
  inquiryLimiter,
  async (req, res, next) => {
    try {
      const {
        name,
        email,
        phone = "",
        careFor = "",
        message,
        consent = false,
        website = "",
      } = req.body || {};

      // Honeypot: silently accept bot submissions without saving.
      if (website) {
        return res.status(201).json({
          message: "Thank you. Your message has been received.",
        });
      }

      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          error: "Please enter your name.",
        });
      }

      const normalizedEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      if (
        normalizedEmail.length > 200 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return res.status(400).json({
          error: "Please enter a valid email address.",
        });
      }

      if (
        typeof message !== "string" ||
        message.trim().length < 10 ||
        message.trim().length > 3000
      ) {
        return res.status(400).json({
          error: "Your message must contain 10–3000 characters.",
        });
      }

      if (
        typeof phone !== "string" ||
        phone.length > 40 ||
        typeof careFor !== "string" ||
        careFor.length > 100
      ) {
        return res.status(400).json({
          error: "Please check your contact information.",
        });
      }

      if (typeof consent !== "boolean") {
        return res.status(400).json({
          error: "Invalid consent value.",
        });
      }

      const inquiry = await Inquiry.create({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        careFor: careFor.trim(),
        message: message.trim(),
        consent,
      });

      return res.status(201).json({
        message: "Thank you. Your inquiry has been received.",
        id: inquiry._id,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// --------------------------------------------------
// AUTHENTICATION ROUTES
// --------------------------------------------------

app.use(
  "/api/auth",
  require("./src/auth-routes")(Admin, auth)
);

// --------------------------------------------------
// RESIDENT ACCOUNT ROUTES
// --------------------------------------------------

app.use(
  "/api/accounts",
  require("./src/user-routes")(User, auth)
);

// --------------------------------------------------
// ADMIN ROUTES
// --------------------------------------------------

app.use("/api/admin", adminRoutes);

// --------------------------------------------------
// NOT FOUND AND FRONTEND FALLBACK
// --------------------------------------------------

app.use((req, res, next) => {
  // Never serve the frontend for an unknown API endpoint.
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API endpoint not found.",
    });
  }

  // Only GET requests should fall back to the frontend.
  if (req.method !== "GET") {
    return next();
  }

  return res.sendFile(
    path.join(PUBLIC_DIR, "index.html"),
    (error) => {
      if (error) {
        next(error);
      }
    }
  );
});

// --------------------------------------------------
// CENTRAL ERROR HANDLER
// --------------------------------------------------

app.use((error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  // Invalid or oversized request bodies.
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large.",
    });
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    Object.prototype.hasOwnProperty.call(error, "body")
  ) {
    return res.status(400).json({
      error: "Invalid JSON request body.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Please check the submitted information.",
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      error: "Invalid resource ID.",
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      error: "An account with that email already exists.",
    });
  }

  // Log server-side details without exposing them to clients.
  console.error("Application error:", error);

  return res.status(500).json({
    error: "Something went wrong. Please try again.",
  });
});

// --------------------------------------------------
// DATABASE CONNECTION AND SERVER STARTUP
// --------------------------------------------------

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error.message);
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("Connected to MongoDB");

    const server = app.listen(PORT, () => {
      console.log(
        `DJ's Adult Family Home website running on port ${PORT}`
      );
    });

    server.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(
      "Could not connect to MongoDB:",
      error.message
    );

    process.exitCode = 1;
  }
}

startServer();

module.exports = app;