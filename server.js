const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");

require("dotenv").config();

/* ================= DNS FIX ================= */

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

/* ================= ROUTES ================= */

const applicationRoutes = require("./routes/applicationroutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");

/* ================= APP ================= */

const app = express();

const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "JNFuel Backend is running",
  });
});

/* ================= ROUTES ================= */

app.use(
  "/api/applications",
  applicationRoutes
);

app.use(
  "/api/auth",
  authRoutes
);
app.use(
  "/api/admin",
  adminRoutes
);

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(
      "MongoDB connected successfully"
    );

    app.listen(PORT, () => {
      console.log(
        `JNFuel Backend running on port ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:"
    );

    console.error(error.message);
  });