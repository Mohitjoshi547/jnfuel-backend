
const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

function getToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

/* ADMIN AUTHENTICATION */

function requireAdmin(req, res, next) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin session",
    });
  }
}

/* CUSTOMER AUTHENTICATION */

async function requireCustomer(req, res, next) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      decoded.role !== "customer" ||
      !decoded.customerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Customer access required",
      });
    }

    const customer = await Customer.findById(
      decoded.customerId
    );

    if (!customer || customer.role !== "customer") {
      return res.status(401).json({
        success: false,
        message: "Customer account not found",
      });
    }

    if (!customer.active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired customer session",
    });
  }
}

module.exports = {
  requireAdmin,
  requireCustomer,
};