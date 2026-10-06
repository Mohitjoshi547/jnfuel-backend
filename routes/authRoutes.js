
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Customer = require("../models/Customer");
const { requireCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

/* ================================================= */
/* ADMIN LOGIN */
/* ================================================= */

router.post("/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminUsername || !adminPassword || !jwtSecret) {
      console.error("Admin or JWT environment variables missing");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    if (
      username.trim() !== adminUsername ||
      password !== adminPassword
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin username or password",
      });
    }

    const token = jwt.sign(
      {
        username: adminUsername,
        role: "admin",
      },
      jwtSecret,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        username: adminUsername,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin login failed",
    });
  }
});

/* ================================================= */
/* CUSTOMER LOGIN */
/* ================================================= */

router.post("/login", async (req, res) => {
  try {
    const { customerId, password } = req.body;

    if (!customerId || !password) {
      return res.status(400).json({
        success: false,
        message: "Customer ID and password are required",
      });
    }

    const customer = await Customer.findOne({
      customerId: customerId.trim(),
      role: "customer",
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid Customer ID or password",
      });
    }

    if (!customer.active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      customer.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid Customer ID or password",
      });
    }

    const token = jwt.sign(
      {
        customerId: customer._id,
        customerLoginId: customer.customerId,
        role: "customer",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,

      mustChangePassword: customer.mustChangePassword,

      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        applicationNumber: customer.applicationNumber || null,
      },
    });
  } catch (error) {
    console.error("Customer login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ================================================= */
/* CHANGE PASSWORD */
/* ================================================= */

router.post("/change-password", async (req, res) => {
  try {
    const { token, currentPassword, newPassword } = req.body;

    if (!token || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Token, current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    if (decoded.role !== "customer" || !decoded.customerId) {
      return res.status(403).json({
        success: false,
        message: "Customer session required",
      });
    }

    const customer = await Customer.findById(decoded.customerId);

    if (!customer || customer.role !== "customer") {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (!customer.active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      customer.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    customer.password = hashedPassword;
    customer.mustChangePassword = false;

    await customer.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Password change failed",
    });
  }
});

/* ================================================= */
/* GET LOGGED-IN CUSTOMER */
/* ================================================= */

router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer._id)
      .select("-password");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Get customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Customer data load failed",
    });
  }
});

module.exports = router;