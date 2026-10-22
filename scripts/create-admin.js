require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });
const Admin = mongoose.model("Admin", schema);

(async () => {
  const uri = process.env.MONGODB_URI;
  const name = process.env.ADMIN_NAME;
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!uri || !email || !name || password.length < 12 || password === "change_this_to_a_long_unique_password") {
    console.error("Configure MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters in .env first.");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    if (await Admin.findOne({ email })) {
      console.error("An admin with that email already exists. No changes made.");
      process.exitCode = 1;
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await Admin.create({ name, email, passwordHash });
      console.log(`Admin created: ${email}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
