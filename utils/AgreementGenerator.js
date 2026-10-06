const fs = require("fs");
const path = require("path");

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/* =====================================================
   CREATE AGREEMENT PDF
===================================================== */

async function createAgreementPDF(application) {
  try {
    // =====================================================
    // LOAD ORIGINAL PDF TEMPLATE
    // =====================================================

    const agreementPath = path.join(
      __dirname,
      "../agreements/JN Fuel Agreement.pdf",
    );

    if (!fs.existsSync(agreementPath)) {
      throw new Error("JN Fuel Agreement.pdf file nahi mili.");
    }

    const existingPdfBytes = fs.readFileSync(agreementPath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();

    if (!pages.length) {
      throw new Error("Agreement PDF mein koi page nahi mila.");
    }

    const firstPage = pages[0];

    // =====================================================
    // FONTS
    // =====================================================

    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // =====================================================
    // APPLICATION DATA
    // =====================================================

    const applicantName = String(application?.applicantName || "").trim();

    const fatherName = String(application?.fatherName || "").trim();

    const aadhaarNumber = String(
      application?.aadhaarNumber || application?.aadhaar || "",
    ).trim();

    const mobile = String(application?.mobile || "").trim();

    const applicationNumber = String(
      application?.applicationNumber || "",
    ).trim();

    // =====================================================
    // ADDRESS
    // =====================================================

    const address = application?.address || {};

    const addressParts = [
      address.line,
      address.villageTownCity,
      address.district,
      address.state,
      address.pinCode ? `PIN - ${address.pinCode}` : "",
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");

    // =====================================================
    // DATE
    // =====================================================

    const today = new Date();

    const day = String(today.getDate()).padStart(2, "0");

    const month = String(today.getMonth() + 1).padStart(2, "0");

    const year = today.getFullYear();

    // =====================================================
    // DRAW TEXT
    // =====================================================

    const drawText = ({
      text,
      x,
      y,
      size = 8,
      bold = false,
      page = firstPage,
    }) => {
      if (text === undefined || text === null || String(text).trim() === "") {
        return;
      }

      page.drawText(String(text), {
        x,
        y,
        size,
        font: bold ? boldFont : normalFont,
        color: rgb(0, 0, 0),
      });
    };

    // =====================================================
    // TEXT WIDTH
    // =====================================================

    const textWidth = (text, size = 8, bold = false) => {
      const selectedFont = bold ? boldFont : normalFont;

      return selectedFont.widthOfTextAtSize(String(text), size);
    };

    // =====================================================
    // FIT TEXT
    // =====================================================

    const drawFitText = ({
      text,
      x,
      y,
      maxWidth,
      size = 8,
      minSize = 5,
      bold = false,
    }) => {
      if (text === undefined || text === null || String(text).trim() === "") {
        return;
      }

      let currentSize = size;

      while (
        currentSize > minSize &&
        textWidth(text, currentSize, bold) > maxWidth
      ) {
        currentSize -= 0.5;
      }

      drawText({
        text,
        x,
        y,
        size: currentSize,
        bold,
      });
    };

    // =====================================================
    // WRAP ADDRESS
    // =====================================================

    const wrapText = (text, maxWidth, size) => {
      if (!text) {
        return [];
      }

      const words = String(text).split(/\s+/);

      const lines = [];

      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine.length ? `${currentLine} ${word}` : word;

        if (textWidth(testLine, size) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }

          currentLine = word;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    };

    // =====================================================
    // PAGE 1 ALIGNMENT
    // =====================================================

    // =====================================================
    // 1. EXECUTION DATE - DAY
    // =====================================================

    drawText({
      text: day,
      x: 430,
      y: 765,
      size: 8,
    });
    drawText({
      text: "/",
      x: 438,
      y: 765,
      size: 8,
    });
    // =====================================================
    // 2. EXECUTION DATE - MONTH
    // =====================================================

    drawText({
      text: month,
      x: 440,
      y: 765,
      size: 8,
    });

    // =====================================================
    // 3. EFFECTIVE DATE
    // =====================================================

    drawText({
      text: `${day}/${month}/${year}`,
      x: 185,
      y: 738,
      size: 8,
    });

    // =====================================================
    // 4. APPLICANT NAME
    // =====================================================

    drawFitText({
      text: applicantName,
      x: 155,
      y: 560,
      maxWidth: 125,
      size: 9,
      minSize: 6,
      bold: true,
    });

    // =====================================================
    // 5. AADHAAR NUMBER
    // =====================================================

    drawFitText({
      text: aadhaarNumber,
      x: 55,
      y: 557,
      maxWidth: 105,
      size: 8,
      minSize: 5,
      bold: false,
    });

    // =====================================================
    // 6. FATHER NAME
    // =====================================================

    drawFitText({
      text: fatherName,
      x: 75,
      y: 545,
      maxWidth: 105,
      size: 8,
      minSize: 5,
      bold: false,
    });

    // =====================================================
    // 7. ADDRESS
    // =====================================================

    if (fullAddress) {
      const addressFontSize = 7;

      const addressLines = wrapText(fullAddress, 525, addressFontSize);

      let addressY = 535;

      for (let i = 0; i < addressLines.length; i++) {
        drawText({
          text: addressLines[i],
          x: 90,
          y: addressY,
          size: addressFontSize,
        });

        addressY -= 10;

        if (addressY < 525) {
          break;
        }
      }
    }

    // =====================================================
    // 8. APPLICATION NUMBER
    // =====================================================

    if (applicationNumber) {
      drawText({
        text: `Application No: ${applicationNumber}`,
        x: 45,
        y: 25,
        size: 7,
      });
    }

    // =====================================================
    // 9. MOBILE
    // =====================================================

    if (mobile) {
      drawText({
        text: `Mobile: ${mobile}`,
        x: 420,
        y: 25,
        size: 7,
      });
    }

    // =====================================================
    // ACTUAL CUSTOMER SIGNATURE
    // =====================================================

    const signatureData = String(
      application?.agreement?.signature || "",
    ).trim();

    if (signatureData) {
      try {
        // Remove PNG data URL prefix
        const base64Data = signatureData.replace(
          /^data:image\/png;base64,/,
          "",
        );

        // Convert Base64 to Buffer
        const signatureBytes = Buffer.from(base64Data, "base64");

        // Embed actual customer signature PNG
        const signatureImage = await pdfDoc.embedPng(signatureBytes);

        // Original image dimensions
        const originalWidth = signatureImage.width;

        const originalHeight = signatureImage.height;

        // Maximum signature width
        const maxSignatureWidth = 150;

        const signatureWidth = Math.min(originalWidth, maxSignatureWidth);

        // Keep aspect ratio
        const scale = signatureWidth / originalWidth;

        const signatureHeight = originalHeight * scale;

        // Put signature bottom-right
        const signatureMarginRight = 35;

        const signatureMarginBottom = 35;

        for (const page of pages) {
          const pageWidth = page.getWidth();

          const signatureX = pageWidth - signatureWidth - signatureMarginRight;

          const signatureY = signatureMarginBottom;

          page.drawImage(signatureImage, {
            x: signatureX,
            y: signatureY,
            width: signatureWidth,
            height: signatureHeight,
          });
        }
      } catch (signatureError) {
        console.error("Customer signature PDF embed error:", signatureError);
      }
    }

    // =====================================================
    // SAVE PDF
    // =====================================================

    const finalPdfBytes = await pdfDoc.save();

    return Buffer.from(finalPdfBytes);
  } catch (error) {
    console.error("Agreement PDF generation error:", error);

    throw error;
  }
}

module.exports = {
  createAgreementPDF,
};
