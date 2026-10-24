const express = require("express");
const bcrypt = require("bcryptjs");

const Customer = require("../models/Customer");
const Application = require("../models/Application");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

/* ================================================= */
/* CREATE CUSTOMER */
/* ================================================= */

router.post("/customers", requireAdmin, async (req, res) => {
  try {
    const { customerId, name, email, applicationNumber, temporaryPassword } =
      req.body;

    /* --------------------------------------------- */
    /* CLEAN VALUES */
    /* --------------------------------------------- */

    // Customer ID is the mobile number.
    // Both customerId and mobile will use this same value.
    const cleanCustomerId = String(customerId || "").trim();

    const cleanName = String(name || "").trim();

    const cleanEmail = String(email || "").trim();

    const cleanApplicationNumber = String(applicationNumber || "").trim();

    /* --------------------------------------------- */
    /* VALIDATION */
    /* --------------------------------------------- */

    if (!cleanCustomerId || !cleanName || !temporaryPassword) {
      return res.status(400).json({
        success: false,
        message: "Mobile number, name and temporary password are required",
      });
    }

    if (temporaryPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Temporary password must be at least 8 characters",
      });
    }

    /* --------------------------------------------- */
    /* CUSTOMER ID = MOBILE */
    /* --------------------------------------------- */

    const cleanMobile = cleanCustomerId;

    /* --------------------------------------------- */
    /* CHECK DUPLICATE CUSTOMER */
    /* --------------------------------------------- */

    const existingCustomer = await Customer.findOne({
      customerId: cleanCustomerId,
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "Customer ID / Mobile number already exists",
      });
    }

    /* --------------------------------------------- */
    /* VERIFY APPLICATION */
    /* --------------------------------------------- */

    if (cleanApplicationNumber) {
      const application = await Application.findOne({
        applicationNumber: cleanApplicationNumber,
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Selected application not found",
        });
      }
    }

    /* --------------------------------------------- */
    /* HASH PASSWORD */
    /* --------------------------------------------- */

    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    /* --------------------------------------------- */
    /* CREATE CUSTOMER */
    /* --------------------------------------------- */

    const customer = await Customer.create({
      // IMPORTANT:
      // customerId and mobile are exactly the same value.
      customerId: cleanCustomerId,
      mobile: cleanMobile,

      name: cleanName,
      email: cleanEmail,
      applicationNumber: cleanApplicationNumber,

      password: hashedPassword,
      mustChangePassword: true,
      role: "customer",
      active: true,
    });

    /* --------------------------------------------- */
    /* RESPONSE */
    /* --------------------------------------------- */

    res.status(201).json({
      success: true,
      message: "Customer created successfully",

      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        applicationNumber: customer.applicationNumber,
        mustChangePassword: customer.mustChangePassword,
        active: customer.active,
      },

      temporaryPassword,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    res.status(500).json({
      success: false,
      message: "Customer create nahi ho saka",
    });
  }
});

/* ================================================= */
/* GET ALL CUSTOMERS */
/* ================================================= */

router.get("/customers", requireAdmin, async (req, res) => {
  try {
    const customers = await Customer.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    res.status(500).json({
      success: false,
      message: "Customers load nahi ho sake",
    });
  }
});

/* ================================================= */
/* UPDATE CUSTOMER APPLICATION NUMBER */
/* ================================================= */

router.patch("/customers/:id/application", requireAdmin, async (req, res) => {
  try {
    const applicationNumber = String(req.body.applicationNumber || "").trim();

    if (!applicationNumber) {
      return res.status(400).json({
        success: false,
        message: "Application number is required",
      });
    }

    /* --------------------------------------------- */
    /* VERIFY APPLICATION EXISTS */
    /* --------------------------------------------- */

    const application = await Application.findOne({
      applicationNumber,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    /* --------------------------------------------- */
    /* FIND CUSTOMER */
    /* --------------------------------------------- */

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    /* --------------------------------------------- */
    /* UPDATE APPLICATION NUMBER */
    /* --------------------------------------------- */

    customer.applicationNumber = application.applicationNumber;

    await customer.save();

    res.json({
      success: true,
      message: "Customer application linked successfully",

      customer: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        applicationNumber: customer.applicationNumber,
      },
    });
  } catch (error) {
    console.error("Customer application update error:", error);

    res.status(500).json({
      success: false,
      message: "Application number update nahi ho saka",
    });
  }
});

/* ================================================= */
/* ACTIVATE / DEACTIVATE CUSTOMER */
/* ================================================= */

router.patch("/customers/:id/status", requireAdmin, async (req, res) => {
  try {
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Active value must be true or false",
      });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { active },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: active ? "Customer activated" : "Customer deactivated",
      customer,
    });
  } catch (error) {
    console.error("Customer status error:", error);

    res.status(500).json({
      success: false,
      message: "Customer status update nahi ho saka",
    });
  }
});
/* ================================================= */
/* DELETE CUSTOMER */
/* ================================================= */

router.delete("/customers/:id", requireAdmin, async (req, res) => {
  try {
    const customerId = req.params.id;

    // Validate MongoDB ObjectId
    if (!/^[a-fA-F0-9]{24}$/.test(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    // Find customer
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Prevent deleting admin accounts
    if (customer.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin account cannot be deleted here",
      });
    }

    // Permanently delete the customer account
    await Customer.findByIdAndDelete(customerId);

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      deletedCustomerId: customerId,
    });
  } catch (error) {
    console.error("Delete customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Customer delete nahi ho saka",
    });
  }
});

/* ================================================= */
/* EXPORT ROUTER */
/* ================================================= */

module.exports = router;
