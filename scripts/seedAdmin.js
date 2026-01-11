import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../models/admin.js";
import readline from "readline";

dotenv.config();

// Superadmin password
// faculty@pedia.0258

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const seedAdmin = async () => {
  try {
    // Connect to database
    const mongoURI = process.env.MONGODB_URL;

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB\n");

    // Check if super admin already exists
    const existingSuperAdmin = await Admin.findOne({ isSuperAdmin: true });

    if (existingSuperAdmin) {
      console.log("⚠️  Super admin already exists:");
      console.log(`   Username: ${existingSuperAdmin.username}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Full Name: ${existingSuperAdmin.fullName}`);
      console.log(`   Status: ${existingSuperAdmin.status}`);

      const overwrite = await question(
        "\nDo you want to delete and recreate? (yes/no): "
      );

      if (overwrite.toLowerCase() !== "yes") {
        console.log("\n❌ Aborted. Existing super admin kept.");
        rl.close();
        process.exit(0);
      }

      await Admin.findByIdAndDelete(existingSuperAdmin._id);
      console.log("✅ Existing super admin deleted.\n");
    }

    // Get admin details from user
    console.log("=== Create Super Admin ===\n");

    const username = await question(
      "Enter username (lowercase, letters, numbers, underscore): "
    );
    const email = await question("Enter email: ");
    const fullName = await question("Enter full name: ");
    const password = await question("Enter password (min 8 characters): ");

    // Validate inputs
    if (!username || username.length < 3) {
      throw new Error("Username must be at least 3 characters");
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      throw new Error(
        "Username can only contain lowercase letters, numbers, and underscores"
      );
    }

    if (
      !email ||
      !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)
    ) {
      throw new Error("Invalid email format");
    }

    if (!fullName || fullName.length < 3) {
      throw new Error("Full name must be at least 3 characters");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Create super admin
    console.log("\nCreating super admin...");

    const admin = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      fullName,
      password,
      isSuperAdmin: true,
      status: "active",
      permissions: [
        "manage_educators",
        "manage_students",
        "manage_courses",
        "manage_webinars",
        "manage_tests",
        "view_analytics",
        "manage_payments",
      ],
    });

    await admin.save();

    console.log("\n✅ Super admin created successfully!");
    console.log("\n=== Admin Details ===");
    console.log(`Username: ${admin.username}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Full Name: ${admin.fullName}`);
    console.log(`Status: ${admin.status}`);
    console.log(`Permissions: ${admin.permissions.join(", ")}`);
    console.log("\n⚠️  Save these credentials securely!");
    console.log("\nYou can now login at: POST /api/auth/admin-login");
    console.log(
      `Body: { "email": "${admin.email}", "password": "YOUR_PASSWORD" }\n`
    );

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding admin:", error.message);
    rl.close();
    process.exit(1);
  }
};

// Run the seeder
seedAdmin();
