const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      unique: true,
      required: true,
    },

    applicantName: {
      type: String,
      required: true,
      trim: true,
    },

    fatherName: {
      type: String,
      default: "",
      trim: true,
    },

    dateOfBirth: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      default: "",
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    /* BUSINESS DETAILS */

    businessName: {
      type: String,
      default: "",
      trim: true,
    },

    businessModel: {
      type: String,
      enum: ["FDP", "Mini Pump", "Bowser", ""],
      default: "",
    },

    preferredLocation: {
      type: String,
      default: "",
      trim: true,
    },

    /* ADDRESS */

    address: {
      line: {
        type: String,
        default: "",
      },

      villageTownCity: {
        type: String,
        default: "",
      },

      district: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      pinCode: {
        type: String,
        default: "",
      },
    },

    remarks: {
      type: String,
      default: "",
    },

    /* APPLICATION STATUS */

    status: {
      type: String,
      enum: [
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
      ],
      default: "Submitted",
    },

    /* PAYMENT */

    payment: {
      amount: {
        type: Number,
        default: 0,
      },

      transactionId: {
        type: String,
        default: "",
        trim: true,
      },

      paymentDate: {
        type: Date,
        default: null,
      },

      paymentMethod: {
        type: String,
        default: "UPI",
      },

      screenshot: {
        type: String,
        default: "",
      },

      submittedAt: {
        type: Date,
        default: null,
      },

      verifiedAt: {
        type: Date,
        default: null,
      },

      rejectionReason: {
        type: String,
        default: "",
        trim: true,
      },
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Submitted", "Verified", "Rejected"],
      default: "Pending",
    },

    /* DOCUMENTS */

    documentStatus: {
      type: String,
      enum: ["Pending", "Under Verification", "Verified", "Rejected"],
      default: "Pending",
    },

    /* FIELD VERIFICATION */

    fieldVerificationStatus: {
      type: String,
      enum: ["Pending", "Scheduled", "Completed", "Rejected"],
      default: "Pending",
    },

    /* =========================================
       AGREEMENT
    ========================================= */

    agreementStatus: {
      type: String,
      enum: ["Pending", "Generated", "Sent", "Signed", "Completed"],
      default: "Pending",
    },

    agreement: {
      /* Admin ne agreement customer ko kab bheja */
      sentAt: {
        type: Date,
        default: null,
      },

      /* Customer ne kab sign kiya */
      signedAt: {
        type: Date,
        default: null,
      },

      /* Customer ka naam jisne sign kiya */
      signedBy: {
        type: String,
        default: "",
        trim: true,
      },
      /* Customer ne kaunsa signature style select kiya */
      signatureFont: {
        type: String,
        enum: ["signature-1", "signature-2", "signature-3"],
        default: "signature-1",
      },

      /* E-sign signature data */
      signature: {
        type: String,
        default: "",
      },

      /* Original agreement PDF */
      agreementPdfUrl: {
        type: String,
        default: "",
        trim: true,
      },

      /* Customer ke sign ke baad final PDF */
      signedAgreementPdfUrl: {
        type: String,
        default: "",
        trim: true,
      },
    },
    /* Secure email signing link */

signingTokenHash: {
  type: String,
  default: "",
  select: false,
},

signingTokenExpiresAt: {
  type: Date,
  default: null,
},

signingTokenUsedAt: {
  type: Date,
  default: null,
},

    /* =========================================
       CERTIFICATE
    ========================================= */

    certificateStatus: {
      type: String,
      enum: ["Pending", "Issued"],
      default: "Pending",
    },

    certificateNumber: {
      type: String,
      default: "",
      trim: true,
    },

    licenseNumber: {
      type: String,
      default: "",
      trim: true,
    },

    certificateDate: {
      type: Date,
      default: null,
    },

    certificateValidUpto: {
      type: Date,
      default: null,
    },

    certificateVerificationToken: {
      type: String,
      default: "",
      trim: true,
    },

    certificatePdfUrl: {
      type: String,
      default: "",
      trim: true,
    },

    certificateQrCode: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Application", applicationSchema);
