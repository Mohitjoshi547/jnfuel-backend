const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const TEMPLATE_PATH = path.join(
  __dirname,
  "../assets/certificate-template.jpeg",
);

/* =====================================================
   HELPERS
===================================================== */

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function formatDate(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getFullAddress(application) {
  const address = application?.address || {};

  return [
    address.line,
    address.villageTownCity,
    address.district,
    address.state,
    address.pinCode,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

/*
 * IMPORTANT:
 * Certificate ke sentence mein selected PLAN aayega.
 *
 * Example:
 * FDP
 * Mini Pump
 * Bowser
 */
function getPlanName(application) {
  return cleanText(application?.businessModel) || "Delivery Partner";
}

/* =====================================================
   CREATE CERTIFICATE PDF
===================================================== */

async function createCertificatePDF(application, frontendUrl) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("Certificate template not found: " + TEMPLATE_PATH);
  }

  if (!application?.certificateNumber) {
    throw new Error("Certificate number missing.");
  }

  if (!application?.certificateVerificationToken) {
    throw new Error("Certificate verification token missing.");
  }

  /* ===================================================
     VERIFICATION URL
  =================================================== */

  const baseUrl =
    frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";

  const verificationUrl = `${baseUrl}/verify/${application.certificateVerificationToken}`;

  /* ===================================================
     QR
  =================================================== */

  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    type: "png",
    width: 300,
    margin: 1,
    errorCorrectionLevel: "H",
  });

  /* ===================================================
     PDF
  =================================================== */

  const doc = new PDFDocument({
    size: [1536, 1024],
    margin: 0,
    autoFirstPage: false,
    compress: true,
  });

  doc.addPage({
    size: [1536, 1024],
    margin: 0,
  });

  /* ===================================================
     TEMPLATE
  =================================================== */

  doc.image(TEMPLATE_PATH, 0, 0, {
    width: 1536,
    height: 1024,
  });

  /* ===================================================
     DATA
  =================================================== */

  const customerName = cleanText(application.applicantName);

  const businessPlan = getPlanName(application);

  const fullAddress = getFullAddress(application);

  const mobile = cleanText(application.mobile);

  const email = cleanText(application.email);

  const dpId = cleanText(application.licenseNumber);

  const certificateNumber = cleanText(application.certificateNumber);

  const issueDate = formatDate(application.certificateDate || new Date());

  const validUpto = formatDate(application.certificateValidUpto);

  /* ===================================================
     GLOBAL FONT
  =================================================== */

  doc.font("Helvetica-Bold");

  doc.fillColor("#071B45");

  /* ===================================================
     LABEL / VALUE SETTINGS
  =================================================== */

  /*
   * IMPORTANT:
   *
   * Y positions ko same row mein rakha hai.
   *
   * Label left side:
   * VALUE uske immediately saamne.
   *
   * Right side:
   * LABEL -> VALUE
   */

  const leftLabelX = 210;
  const leftValueX = 405;

  const rightLabelX = 900;
  const rightValueX = 1085;

  const row1Y = 390;
  const row2Y = 440;
  const row3Y = 490;
  const row4Y = 540;
  const row5Y = 590;

  /* ===================================================
     LEFT SIDE
  =================================================== */

  /*
   * CUSTOMER NAME
   */

  doc.fontSize(22).text(customerName, leftValueX, row1Y + 36, {
    width: 390,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * BUSINESS ADDRESS
   */

  doc.fontSize(22).text(fullAddress, leftValueX, row2Y + 36, {
    width: 390,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * ADDRESS
   *
   * Agar template mein "Address" alag field hai,
   * to yahan same full address use ho raha hai.
   */

  doc.fontSize(22).text(fullAddress, leftValueX, row3Y + 36, {
    width: 390,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * CONTACT NUMBER
   */

  doc.fontSize(22).text(mobile, leftValueX, row4Y + 36, {
    width: 390,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * EMAIL
   */

  doc.fontSize(22).text(email, leftValueX, row5Y + 36, {
    width: 390,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /* ===================================================
     RIGHT SIDE
  =================================================== */

  /*
   * DP ID
   */

  doc.fontSize(22).text(dpId, rightValueX + 36, row1Y + 36, {
    width: 330,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * CERTIFICATE NUMBER
   */

  doc.fontSize(22).text(certificateNumber, rightValueX + 36, row2Y + 42, {
    width: 330,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * ISSUE DATE
   */

  doc.fontSize(22).text(issueDate, rightValueX + 36, row3Y + 60, {
    width: 330,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /*
   * VALID UPTO
   */

  doc.fontSize(22).text(validUpto, rightValueX + 36, row4Y + 64, {
    width: 330,
    height: 24,
    align: "left",
    ellipsis: true,
    lineBreak: false,
  });

  /* ===================================================
   CERTIFICATE MAIN SENTENCE
   ONLY CUSTOMER NAME + SELECTED PLAN
=================================================== */

  /* CUSTOMER NAME */

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#071B45")
    .text(customerName, 270,710, {
      width: 850,
      height: 30,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });

  /* SELECTED BUSINESS PLAN */

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#071B45")
    .text(businessPlan, 100, 750, {
      width: 850,
      height: 30,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });

  /* ===================================================
     QR CODE
  =================================================== */

  /*
   * RIGHT SIDE DYNAMIC QR
   *
   * Pehle existing QR area ko white cover.
   */

  doc.save().rect(1350, 795, 105, 105).fill("#FFFFFF").restore();

  /*
   * Dynamic QR
   */

  doc.image(qrBuffer, 1350, 795, {
    width: 105,
    height: 105,
  });

  /* ===================================================
     PDF -> BUFFER
  =================================================== */

  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);

        resolve(pdfBuffer);
      } catch (error) {
        reject(error);
      }
    });

    doc.on("error", (error) => {
      reject(error);
    });

    doc.end();
  });
}

/* =====================================================
   EXPORT
===================================================== */

module.exports = {
  createCertificatePDF,
};
