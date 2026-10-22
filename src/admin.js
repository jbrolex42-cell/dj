
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

module.exports = function adminRoutes({
  Room,
  Inquiry,
  GalleryItem,
  Post,
  auth,
  uploadsDir,
}) {
  const router = express.Router();

  // Protect all admin routes.
  router.use(auth.requireAuth);

  // --------------------------------------------------
  // IMAGE UPLOAD CONFIGURATION
  // --------------------------------------------------

  const allowedImageTypes = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadsDir);
    },

    filename: (_req, file, callback) => {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

      callback(null, filename);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },

    fileFilter: (_req, file, callback) => {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      if (
        !allowedImageTypes[file.mimetype] ||
        allowedImageTypes[file.mimetype] !== extension
      ) {
        return callback(
          new Error("Upload a JPG, PNG, WEBP, or GIF image.")
        );
      }

      callback(null, true);
    },
  });

  // --------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------

  const isValidId = (id) => mongoose.isValidObjectId(id);

  const isValidUploadedImage = (imageUrl) =>
    typeof imageUrl === "string" &&
    imageUrl.startsWith("/uploads/");

  const handleUploadError = (error, res) => {
    if (!error) return false;

    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "Image must be 5 MB or smaller.",
      });
      return true;
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        error: "Upload only one image at a time.",
      });
      return true;
    }

    res.status(400).json({
      error: error.message || "Image upload failed.",
    });

    return true;
  };

  // --------------------------------------------------
  // IMAGE UPLOAD
  // POST /admin/upload
  // --------------------------------------------------

  router.post("/upload", (req, res, next) => {
    upload.single("image")(req, res, (error) => {
      if (error) {
        if (handleUploadError(error, res)) return;
        return next(error);
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Choose an image to upload.",
        });
      }

      return res.status(201).json({
        imageUrl: `/uploads/${req.file.filename}`,
      });
    });
  });

  // --------------------------------------------------
  // INQUIRIES
  // --------------------------------------------------

  // GET /admin/inquiries
  router.get("/inquiries", async (_req, res, next) => {
    try {
      const inquiries = await Inquiry.find()
        .sort({ createdAt: -1 })
        .limit(300)
        .lean();

      return res.json(inquiries);
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /admin/inquiries/:id
  router.patch("/inquiries/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid inquiry ID.",
        });
      }

      const allowedStatuses = [
        "New",
        "Contacted",
        "Tour requested",
        "Closed",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid inquiry status.",
        });
      }

      const inquiry = await Inquiry.findByIdAndUpdate(
        id,
        { status },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!inquiry) {
        return res.status(404).json({
          error: "Inquiry not found.",
        });
      }

      return res.json(inquiry);
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // ROOMS
  // --------------------------------------------------

  // GET /admin/rooms
  router.get("/rooms", async (_req, res, next) => {
    try {
      const rooms = await Room.find()
        .sort({ createdAt: -1 })
        .lean();

      return res.json(rooms);
    } catch (error) {
      return next(error);
    }
  });

  // POST /admin/rooms
  router.post("/rooms", async (req, res, next) => {
    try {
      const {
        title,
        description = "",
        roomType = "Private room",
        availability = "Contact us",
        imageUrl = "",
        active = true,
      } = req.body || {};

      if (
        typeof title !== "string" ||
        title.trim().length < 2
      ) {
        return res.status(400).json({
          error: "Enter a room title.",
        });
      }

      if (
        typeof description !== "string" ||
        typeof roomType !== "string" ||
        typeof availability !== "string" ||
        typeof imageUrl !== "string"
      ) {
        return res.status(400).json({
          error: "Invalid room details.",
        });
      }

      if (imageUrl && !isValidUploadedImage(imageUrl)) {
        return res.status(400).json({
          error: "Upload an image using the admin uploader first.",
        });
      }

      const room = await Room.create({
        title: title.trim(),
        description: description.trim(),
        roomType: roomType.trim(),
        availability: availability.trim(),
        imageUrl,
        active: active === true || active === "true",
      });

      return res.status(201).json(room);
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /admin/rooms/:id
  router.patch("/rooms/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid room ID.",
        });
      }

      const allowedFields = [
        "title",
        "description",
        "roomType",
        "availability",
        "imageUrl",
        "active",
      ];

      const updates = {};

      for (const field of allowedFields) {
        if (req.body?.[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (
        Object.keys(updates).length === 0
      ) {
        return res.status(400).json({
          error: "Provide at least one room field to update.",
        });
      }

      if (
        updates.title !== undefined &&
        (
          typeof updates.title !== "string" ||
          updates.title.trim().length < 2
        )
      ) {
        return res.status(400).json({
          error: "Enter a valid room title.",
        });
      }

      if (
        updates.imageUrl !== undefined &&
        updates.imageUrl !== "" &&
        !isValidUploadedImage(updates.imageUrl)
      ) {
        return res.status(400).json({
          error: "Upload an image using the admin uploader first.",
        });
      }

      if (updates.active !== undefined) {
        if (
          updates.active !== true &&
          updates.active !== false &&
          updates.active !== "true" &&
          updates.active !== "false"
        ) {
          return res.status(400).json({
            error: "Invalid room active status.",
          });
        }

        updates.active =
          updates.active === true ||
          updates.active === "true";
      }

      for (const field of [
        "title",
        "description",
        "roomType",
        "availability",
      ]) {
        if (updates[field] !== undefined) {
          if (typeof updates[field] !== "string") {
            return res.status(400).json({
              error: `Invalid ${field}.`,
            });
          }

          updates[field] = updates[field].trim();
        }
      }

      const room = await Room.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!room) {
        return res.status(404).json({
          error: "Room not found.",
        });
      }

      return res.json(room);
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /admin/rooms/:id
  router.delete("/rooms/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid room ID.",
        });
      }

      const room = await Room.findByIdAndDelete(id);

      if (!room) {
        return res.status(404).json({
          error: "Room not found.",
        });
      }

      return res.json({
        message: "Room deleted.",
      });
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // GALLERY
  // --------------------------------------------------

  // GET /admin/gallery
  router.get("/gallery", async (_req, res, next) => {
    try {
      const gallery = await GalleryItem.find()
        .sort({ createdAt: -1 })
        .lean();

      return res.json(gallery);
    } catch (error) {
      return next(error);
    }
  });

  // POST /admin/gallery
  router.post("/gallery", async (req, res, next) => {
    try {
      const {
        title,
        caption = "",
        imageUrl,
      } = req.body || {};

      if (
        typeof title !== "string" ||
        title.trim().length < 2
      ) {
        return res.status(400).json({
          error: "Enter a gallery photo title.",
        });
      }

      if (
        typeof caption !== "string" ||
        typeof imageUrl !== "string" ||
        !isValidUploadedImage(imageUrl)
      ) {
        return res.status(400).json({
          error: "Add a title and upload an image first.",
        });
      }

      const item = await GalleryItem.create({
        title: title.trim(),
        caption: caption.trim(),
        imageUrl,
      });

      return res.status(201).json(item);
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /admin/gallery/:id
  router.delete("/gallery/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid photo ID.",
        });
      }

      const item = await GalleryItem.findByIdAndDelete(id);

      if (!item) {
        return res.status(404).json({
          error: "Photo not found.",
        });
      }

      return res.json({
        message: "Photo deleted.",
      });
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // BLOG POSTS
  // --------------------------------------------------

  // GET /admin/posts
  router.get("/posts", async (_req, res, next) => {
    try {
      const posts = await Post.find()
        .sort({ createdAt: -1 })
        .lean();

      return res.json(posts);
    } catch (error) {
      return next(error);
    }
  });

  // POST /admin/posts
  router.post("/posts", async (req, res, next) => {
    try {
      const {
        title,
        content,
        imageUrl = "",
      } = req.body || {};

      if (
        typeof title !== "string" ||
        title.trim().length < 2 ||
        typeof content !== "string" ||
        content.trim().length < 5
      ) {
        return res.status(400).json({
          error: "Add a title and a little more detail.",
        });
      }

      if (typeof imageUrl !== "string") {
        return res.status(400).json({
          error: "Invalid image URL.",
        });
      }

      if (
        imageUrl &&
        !isValidUploadedImage(imageUrl)
      ) {
        return res.status(400).json({
          error: "Upload an image using the admin uploader first.",
        });
      }

      const post = await Post.create({
        title: title.trim(),
        content: content.trim(),
        imageUrl,
      });

      return res.status(201).json(post);
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /admin/posts/:id
  router.patch("/posts/:id", async (req, res, next) => {
    try {
      const { id } = req.params;
      const { active } = req.body || {};

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid post ID.",
        });
      }

      if (typeof active !== "boolean") {
        return res.status(400).json({
          error: "Post active status must be true or false.",
        });
      }

      const post = await Post.findByIdAndUpdate(
        id,
        { active },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!post) {
        return res.status(404).json({
          error: "Post not found.",
        });
      }

      return res.json(post);
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /admin/posts/:id
  router.delete("/posts/:id", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: "Invalid post ID.",
        });
      }

      const post = await Post.findByIdAndDelete(id);

      if (!post) {
        return res.status(404).json({
          error: "Post not found.",
        });
      }

      return res.json({
        message: "Post deleted.",
      });
    } catch (error) {
      return next(error);
    }
  });

  // --------------------------------------------------
  // EXPORT ROUTER
  // --------------------------------------------------

  return router;
};