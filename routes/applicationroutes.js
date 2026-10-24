const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");

const Application = require("../models/Application");
const Customer = require("../models/Customer");

const { createCertificatePDF } = require("../utils/certificateGenerator");

const { createAgreementPDF } = require("../utils/AgreementGenerator");

const {
  requireAdmin,
  requireCustomer,
} = require("../middleware/authMiddleware");

const router = express.Router();

/* =====================================================
   APPLICATION STATUSES
===================================================== */
const APPLICATION_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Documents Pending",
  "Payment Pending",
  "Field Verification Pending",
  "Approved",
  "Rejected",
  "Agreement Pending",
  "Certificate Issued",
  "Completed",
];

/* =====================================================
   HELPERS
===================================================== */

function generateApplicationNumber() {
  return `JNF-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function generateCertificateNumber() {
  return `JNF-CERT-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function generateLicenseNumber() {
  return `JNF-DP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/* =====================================================
   ISSUE CERTIFICATE
===================================================== */

async function issueCertificate(application) {
  if (
    application.certificateStatus === "Issued" &&
    application.certificateNumber
  ) {
    return application;
  }

  const certificateDate = new Date();

  const certificateValidUpto = new Date(certificateDate);

  certificateValidUpto.setFullYear(certificateValidUpto.getFullYear() + 1);

  const verificationToken = crypto.randomUUID();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const verificationUrl = `${frontendUrl}/verify/${verificationToken}`;

  const certificateQrCode = await QRCode.toDataURL(verificationUrl, {
    width: 500,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  application.certificateNumber = generateCertificateNumber();

  application.licenseNumber = generateLicenseNumber();

  application.certificateDate = certificateDate;

  application.certificateValidUpto = certificateValidUpto;

  application.certificateVerificationToken = verificationToken;

  application.certificateQrCode = certificateQrCode;

  application.certificateStatus = "Issued";

  await application.save();

  return application;
}

/* =====================================================
   CUSTOMER
   CREATE APPLICATION
===================================================== */

/* =====================================================
   CUSTOMER
   CREATE APPLICATION — WITH AADHAAR VALIDATION
===================================================== */

router.post("/", requireCustomer, async (req, res) => {
  let createdApplication = null;

  try {
    const customer = req.customer;

    // Check whether the customer already has an application.
    if (customer.applicationNumber) {
      return res.status(409).json({
        success: false,
        message: "Aapki application pehle se submit ho chuki hai.",
        applicationNumber: customer.applicationNumber,
      });
    }

    const {
      applicantName,
      fatherName,
      dateOfBirth,
      gender,
      mobile,
      aadhaarNumber,
      email,
      businessName,
      businessModel,
      preferredLocation,
      address,
      remarks,
    } = req.body;

    // Validate required application fields.
    if (
      !applicantName ||
      !fatherName ||
      !dateOfBirth ||
      !gender ||
      !mobile ||
      !businessModel ||
      !address?.line ||
      !address?.district ||
      !address?.state ||
      !address?.pinCode
    ) {
      return res.status(400).json({
        success: false,
        message: "Please saare required fields fill karein.",
      });
    }

    // Normalize Aadhaar to digits only.
    const cleanAadhaar = String(aadhaarNumber || "").replace(/\D/g, "");

    // Aadhaar must contain exactly 12 digits.
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        message: "Please valid 12-digit Aadhaar number enter karein.",
      });
    }

    // Validate business model.
    const allowedBusinessModels = ["FDP", "Mini Pump", "Bowser"];

    if (!allowedBusinessModels.includes(businessModel)) {
      return res.status(400).json({
        success: false,
        message: "Please valid business plan select karein.",
      });
    }

    // Generate application number.
    const applicationNumber = generateApplicationNumber();

    // Create application in MongoDB.
    createdApplication = await Application.create({
      applicationNumber,

      applicantName: String(applicantName).trim(),

      fatherName: String(fatherName).trim(),

      dateOfBirth: String(dateOfBirth),

      gender: String(gender).trim(),

      mobile: String(mobile).trim(),

      aadhaarNumber: cleanAadhaar,

      email: email ? String(email).trim().toLowerCase() : "",

      businessName: businessName ? String(businessName).trim() : "",

      businessModel,

      preferredLocation: preferredLocation
        ? String(preferredLocation).trim()
        : "",

      address: {
        line: String(address.line).trim(),

        villageTownCity: address.villageTownCity
          ? String(address.villageTownCity).trim()
          : "",

        district: String(address.district).trim(),

        state: String(address.state).trim(),

        pinCode: String(address.pinCode).trim(),
      },

      remarks: remarks ? String(remarks).trim() : "",

      status: "Submitted",
    });

    // Link the application to the logged-in customer.
    const linkedCustomer = await Customer.findOneAndUpdate(
      {
        _id: customer._id,
        role: "customer",
        active: true,
        applicationNumber: {
          $in: ["", null],
        },
      },
      {
        $set: {
          applicationNumber,
        },
      },
      {
        new: true,
      },
    );

    // If linking fails, remove the newly created application.
    if (!linkedCustomer) {
      await Application.deleteOne({
        _id: createdApplication._id,
      });

      createdApplication = null;

      return res.status(409).json({
        success: false,
        message: "Application already linked hai. Page refresh karein.",
      });
    }

    // Return the application without exposing raw Aadhaar.
    const applicationResponse = createdApplication.toObject();

    delete applicationResponse.aadhaarNumber;

    return res.status(201).json({
      success: true,
      message: "Application successfully submit ho gayi.",
      application: applicationResponse,
    });
  } catch (error) {
    console.error("Create application error:", error);

    // Clean up an unlinked application if submission fails.
    if (createdApplication) {
      try {
        const linked = await Customer.exists({
          _id: req.customer._id,
          applicationNumber: createdApplication.applicationNumber,
        });

        if (!linked) {
          await Application.deleteOne({
            _id: createdApplication._id,
          });
        }
      } catch (cleanupError) {
        console.error("Application cleanup error:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Application submit nahi ho saki.",
    });
  }
});
/* =====================================================
   CUSTOMER
   GET OWN APPLICATION
===================================================== */

/* =====================================================
   CUSTOMER
   GET OWN APPLICATION — AADHAAR INCLUDED
===================================================== */

router.get("/number/:applicationNumber", requireCustomer, async (req, res) => {
  try {
    // Verify that the logged-in customer owns this application.
    if (
      req.customer.applicationNumber !== req.params.applicationNumber
    ) {
      return res.status(403).json({
        success: false,
        message: "Aapko is application ka access nahi hai.",
      });
    }

    // Explicitly include Aadhaar because the schema uses select: false.
    const application = await Application.findOne({
      applicationNumber: req.params.applicationNumber,
    }).select("+aadhaarNumber");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    // Mask Aadhaar before returning it to the frontend.
    const applicationResponse = application.toObject();

    const aadhaar = String(applicationResponse.aadhaarNumber || "");

    applicationResponse.aadhaarNumber =
      /^\d{12}$/.test(aadhaar)
        ? `XXXX-XXXX-${aadhaar.slice(-4)}`
        : "";

    return res.json({
      success: true,
      application: applicationResponse,
    });
  } catch (error) {
    console.error("Get customer application error:", error);

    return res.status(500).json({
      success: false,
      message: "Application load nahi ho saki.",
    });
  }
});

/* =====================================================
   CUSTOMER
   PAYMENT
===================================================== */

router.post("/:id/payment", requireCustomer, async (req, res) => {
  try {
    const { paymentTransactionId, paymentDate, paymentScreenshot } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    if (application.applicationNumber !== req.customer.applicationNumber) {
      return res.status(403).json({
        success: false,
        message: "Aapko is application ka access nahi hai.",
      });
    }

    if (!paymentTransactionId) {
      return res.status(400).json({
        success: false,
        message: "Payment Transaction ID / UTR required hai.",
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "Payment date required hai.",
      });
    }

    if (!paymentScreenshot) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot required hai.",
      });
    }

    const paymentAmounts = {
      FDP: 25000,
      "Mini Pump": 30000,
      Bowser: 50000,
    };

    const amount = paymentAmounts[application.businessModel];

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Invalid business plan.",
      });
    }

    application.paymentAmount = amount;

    application.paymentPlan = application.businessModel;

    application.paymentTransactionId = String(paymentTransactionId).trim();

    application.paymentDate = paymentDate;

    application.paymentScreenshot = String(paymentScreenshot).trim();

    application.paymentStatus = "Submitted";

    application.status = "Under Review";

    await application.save();

    return res.json({
      success: true,
      message: "Payment details successfully submit ho gayi hain.",
      application,
    });
  } catch (error) {
    console.error("Customer payment submit error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment submit nahi ho saka.",
    });
  }
});

/* =====================================================
   ADMIN
   GET ALL APPLICATIONS
===================================================== */

router.get("/", requireAdmin, async (req, res) => {
  try {
    const applications = await Application.find().sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("Get applications error:", error);

    return res.status(500).json({
      success: false,
      message: "Applications load nahi ho sakin.",
    });
  }
});
/* =====================================================
   ADMIN
   GENERATE AGREEMENT WITH SECURE SIGNING LINK
   EMAIL SENDING REMOVED
===================================================== */

router.post("/:id/agreement/send", requireAdmin, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    if (!application.applicantName || !application.mobile) {
      return res.status(400).json({
        success: false,
        message: "Customer details incomplete hain.",
      });
    }

    // Agreement PDF generate karo.
    await createAgreementPDF(application);

    // Secure signing token generate karo.
    const signingToken = crypto.randomBytes(32).toString("hex");

    const signingTokenHash = crypto
      .createHash("sha256")
      .update(signingToken)
      .digest("hex");

    // Signing link 7 din tak valid rahega.
    const signingTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const signingUrl = `${frontendUrl}/sign-agreement/${signingToken}`;

    // Token database mein save karo.
    application.signingTokenHash = signingTokenHash;
    application.signingTokenExpiresAt = signingTokenExpiresAt;
    application.signingTokenUsedAt = null;

    if (!application.agreement) {
      application.agreement = {};
    }

    application.agreement.sentAt = new Date();
    application.agreementStatus = "Sent";
    application.status = "Agreement Pending";

    await application.save();

    return res.json({
      success: true,
      message: "Agreement successfully generate ho gaya.",
      agreementAvailable: true,
      signingUrl,
      application,
    });
  } catch (error) {
    console.error("Generate agreement error:", error);

    return res.status(500).json({
      success: false,
      message: "Agreement generate nahi ho saka.",
    });
  }
});

/* =====================================================
   CUSTOMER
   VIEW AGREEMENT PDF
===================================================== */

router.get("/:id/agreement", requireCustomer, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    if (application.applicationNumber !== req.customer.applicationNumber) {
      return res.status(403).json({
        success: false,
        message: "Aapko is agreement ka access nahi hai.",
      });
    }

    if (
      application.agreementStatus !== "Sent" &&
      application.agreementStatus !== "Signed" &&
      application.agreementStatus !== "Completed"
    ) {
      return res.status(404).json({
        success: false,
        message: "Agreement abhi available nahi hai.",
      });
    }

    const pdf = await createAgreementPDF(application);

    const safeApplicationNumber = String(application.applicationNumber).replace(
      /[^a-zA-Z0-9-_]/g,
      "_",
    );

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `inline; filename="Agreement-${safeApplicationNumber}.pdf"`,
    );

    return res.send(pdf);
  } catch (error) {
    console.error("Customer agreement PDF error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Agreement PDF load nahi ho saka.",
    });
  }
});

/* =====================================================
   CUSTOMER
   SIGN AGREEMENT
===================================================== */

router.post("/:id/agreement/sign", requireCustomer, async (req, res) => {
  try {
    const { signedBy, signatureFont } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    /* =================================================
         CUSTOMER OWN APPLICATION CHECK
      ================================================= */

    if (application.applicationNumber !== req.customer.applicationNumber) {
      return res.status(403).json({
        success: false,
        message: "Aapko is application ka access nahi hai.",
      });
    }

    /* =================================================
         AGREEMENT STATUS CHECK
      ================================================= */

    if (application.agreementStatus !== "Sent") {
      return res.status(400).json({
        success: false,
        message: "Agreement abhi signing ke liye available nahi hai.",
      });
    }

    /* =================================================
         SIGNER NAME CHECK
      ================================================= */

    if (!signedBy || !String(signedBy).trim()) {
      return res.status(400).json({
        success: false,
        message: "Signer name required hai.",
      });
    }

    /* =================================================
         SIGNATURE CHECK
         
         Frontend se selected signature
         data:image/png;base64,... format mein aayega.
      ================================================= */

    const allowedSignatureFonts = ["signature-1", "signature-2", "signature-3"];

    if (!allowedSignatureFonts.includes(signatureFont)) {
      return res.status(400).json({
        success: false,
        message: "Please valid signature style select karein.",
      });
    }

    /* =================================================
         AGREEMENT OBJECT
      ================================================= */

    if (!application.agreement) {
      application.agreement = {};
    }

    /* =================================================
         SAVE SIGNATURE
      ================================================= */

    application.agreement.signedBy = String(signedBy).trim();

    application.agreement.signatureFont = signatureFont;

    application.agreement.signedAt = new Date();

    /* =================================================
         UPDATE STATUS
      ================================================= */

    application.agreementStatus = "Signed";

    application.status = "Agreement Pending";

    /* =================================================
         SAVE
      ================================================= */

    await application.save();

    /* =================================================
         RESPONSE
      ================================================= */

    return res.json({
      success: true,
      message: "Agreement successfully sign ho gaya.",
      application,
    });
  } catch (error) {
    console.error("Sign agreement error:", error);

    return res.status(500).json({
      success: false,
      message: "Agreement sign nahi ho saka.",
    });
  }
});

/* =====================================================
   PUBLIC AGREEMENT LINK HELPERS
===================================================== */

function getApplicationFromSigningToken(token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return {
    signingTokenHash: tokenHash,
    signingTokenExpiresAt: { $gt: new Date() },
    signingTokenUsedAt: null,
    agreementStatus: "Sent",
  };
}

/* =====================================================
   PUBLIC
   GET AGREEMENT DETAILS USING SECURE TOKEN
===================================================== */

router.get("/agreement-link/:token", async (req, res) => {
  try {
    const filter = getApplicationFromSigningToken(req.params.token);

    if (!filter) {
      return res.status(400).json({
        success: false,
        message: "Agreement link invalid hai.",
      });
    }

    const application = await Application.findOne(filter).select(
      "applicantName applicationNumber businessName agreementStatus signingTokenHash signingTokenExpiresAt signingTokenUsedAt",
    );

    if (!application) {
      return res.status(410).json({
        success: false,
        message:
          "Agreement link expire ho gaya hai ya pehle hi use ho chuka hai.",
      });
    }

    return res.json({
      success: true,
      application: {
        applicantName: application.applicantName,
        applicationNumber: application.applicationNumber,
        businessName: application.businessName,
      },
    });
  } catch (error) {
    console.error("Public agreement details error:", error);

    return res.status(500).json({
      success: false,
      message: "Agreement details load nahi ho sakin.",
    });
  }
});

/* =====================================================
   PUBLIC
   VIEW AGREEMENT PDF USING SECURE TOKEN
===================================================== */

router.get("/agreement-link/:token/pdf", async (req, res) => {
  try {
    const filter = getApplicationFromSigningToken(req.params.token);

    if (!filter) {
      return res.status(400).json({
        success: false,
        message: "Agreement link invalid hai.",
      });
    }

    const application = await Application.findOne(filter);

    if (!application) {
      return res.status(410).json({
        success: false,
        message: "Agreement link expire ho gaya hai ya use ho chuka hai.",
      });
    }

    const pdf = await createAgreementPDF(application);

    if (!pdf || !Buffer.isBuffer(pdf)) {
      throw new Error("Agreement PDF generate nahi hui.");
    }

    const safeNumber = String(
      application.applicationNumber || "Agreement",
    ).replace(/[^a-zA-Z0-9_-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Agreement-${safeNumber}.pdf"`,
    );
    res.setHeader("Cache-Control", "no-store");

    return res.send(pdf);
  } catch (error) {
    console.error("Public agreement PDF error:", error);

    return res.status(500).json({
      success: false,
      message: "Agreement PDF load nahi ho saki.",
    });
  }
});

/* =====================================================
   PUBLIC
   SIGN AGREEMENT USING SECURE TOKEN
===================================================== */

router.post("/agreement-link/:token/sign", async (req, res) => {
  try {
    const token = req.params.token;
    const { signedBy, signatureFont } = req.body;

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Agreement link invalid hai.",
      });
    }

    if (!signedBy || !String(signedBy).trim()) {
      return res.status(400).json({
        success: false,
        message: "Apna poora naam enter karein.",
      });
    }

    if (String(signedBy).trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Naam 100 characters se chhota hona chahiye.",
      });
    }

    const allowedSignatureFonts = ["signature-1", "signature-2", "signature-3"];

    if (!allowedSignatureFonts.includes(signatureFont)) {
      return res.status(400).json({
        success: false,
        message: "Valid signature style select karein.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    /*
     * Atomic update:
     * Only one request can consume this unused,
     * unexpired token while the agreement is Sent.
     */
    const application = await Application.findOneAndUpdate(
      {
        signingTokenHash: tokenHash,
        signingTokenExpiresAt: { $gt: new Date() },
        signingTokenUsedAt: null,
        agreementStatus: "Sent",
      },
      {
        $set: {
          signingTokenUsedAt: new Date(),
          agreementStatus: "Signed",
          status: "Agreement Pending",
          "agreement.signedBy": String(signedBy).trim(),
          "agreement.signatureFont": signatureFont,
          "agreement.signedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!application) {
      return res.status(410).json({
        success: false,
        message:
          "Agreement link expire ho gaya hai ya pehle hi use ho chuka hai.",
      });
    }

    return res.json({
      success: true,
      message: "Agreement successfully sign ho gaya.",
    });
  } catch (error) {
    console.error("Public agreement signing error:", error);

    return res.status(500).json({
      success: false,
      message: "Agreement sign nahi ho saka.",
    });
  }
});
/* =====================================================
   ADMIN
   GET SINGLE APPLICATION
===================================================== */

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    return res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error("Get single application error:", error);

    return res.status(500).json({
      success: false,
      message: "Application load nahi ho saki.",
    });
  }
});

/* =====================================================
   ADMIN
   UPDATE APPLICATION STATUS
===================================================== */

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status.",
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    application.status = status;

    if (status === "Approved") {
      await issueCertificate(application);
    } else {
      await application.save();
    }

    return res.json({
      success: true,

      message:
        status === "Approved"
          ? "Application approved and certificate issued."
          : "Application status updated.",

      application,
    });
  } catch (error) {
    console.error("Application status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Status update nahi ho saka.",
    });
  }
});

/* =====================================================
   PUBLIC
   CERTIFICATE VERIFICATION
===================================================== */

router.get("/certificate/verify/:token", async (req, res) => {
  try {
    const application = await Application.findOne({
      certificateVerificationToken: req.params.token,

      certificateStatus: "Issued",
    }).select(
      "applicantName businessName businessModel preferredLocation address certificateNumber licenseNumber certificateDate certificateValidUpto certificateStatus applicationNumber",
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: "Certificate not found or verification failed.",
      });
    }

    return res.json({
      success: true,
      verified: true,

      certificate: {
        certificateNumber: application.certificateNumber,

        licenseNumber: application.licenseNumber,

        applicationNumber: application.applicationNumber,

        applicantName: application.applicantName,

        businessName: application.businessName,

        businessModel: application.businessModel,

        preferredLocation: application.preferredLocation,

        address: application.address,

        certificateDate: application.certificateDate,

        certificateValidUpto: application.certificateValidUpto,

        status: application.certificateStatus,
      },
    });
  } catch (error) {
    console.error("Certificate verification error:", error);

    return res.status(500).json({
      success: false,
      verified: false,
      message: "Certificate verification failed.",
    });
  }
});

/* =====================================================
   CUSTOMER
   CERTIFICATE PDF
===================================================== */

router.get("/:id/certificate", requireCustomer, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili.",
      });
    }

    /* CUSTOMER OWN APPLICATION CHECK */

    if (application.applicationNumber !== req.customer.applicationNumber) {
      return res.status(403).json({
        success: false,
        message: "Certificate access denied.",
      });
    }

    /* CERTIFICATE CHECK */

    if (
      application.certificateStatus !== "Issued" ||
      !application.certificateNumber
    ) {
      return res.status(404).json({
        success: false,
        message: "Certificate abhi issue nahi hua hai.",
      });
    }

    /* FRONTEND URL */

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    /* =========================================
         GENERATE CERTIFICATE PDF
         createCertificatePDF BUFFER return karta hai
      ========================================= */

    const pdf = await createCertificatePDF(application, frontendUrl);

    /* BUFFER CHECK */

    if (!pdf || !Buffer.isBuffer(pdf)) {
      throw new Error("Certificate PDF buffer generate nahi hua.");
    }

    /* SAFE FILE NAME */

    const safeCertificateNumber = String(application.certificateNumber).replace(
      /[^a-zA-Z0-9-_]/g,
      "_",
    );

    /* =========================================
         PDF RESPONSE
      ========================================= */

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeCertificateNumber}.pdf"`,
    );

    res.setHeader("Content-Length", pdf.length);

    return res.send(pdf);
  } catch (error) {
    console.error("Certificate generation error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Certificate generate nahi ho saka.",
      });
    }

    return res.end();
  }
});

/* =====================================================
   EXPORT
===================================================== */

module.exports = router;
