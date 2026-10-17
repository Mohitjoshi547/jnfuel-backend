
const fs = require("fs");
const path = require("path");

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

async function createAgreementPDF(application) {
  try {
    const agreementPath = path.join(
      __dirname,
      "../agreements/JN Fuel Agreement.pdf"
    );

    if (!fs.existsSync(agreementPath)) {
      throw new Error("JN Fuel Agreement.pdf file nahi mili.");
    }

    const existingPdfBytes = fs.readFileSync(agreementPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Custom TTF fonts support
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();

    if (!pages.length) {
      throw new Error("Agreement PDF mein koi page nahi mila.");
    }

    const firstPage = pages[0];

    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Signature font files
    const fontsDirectory = path.join(__dirname, "../fonts");

    const signatureFonts = {
      "signature-1": "signature-1.ttf",
      "signature-2": "signature-2.ttf",
      "signature-3": "signature-3.ttf",
    };

    const applicantSignatureFont =
      application?.agreement?.signatureFont || "signature-1";

    const selectedFontFile =
      signatureFonts[applicantSignatureFont] || signatureFonts["signature-1"];

    const selectedFontPath = path.join(fontsDirectory, selectedFontFile);

    if (!fs.existsSync(selectedFontPath)) {
      throw new Error(`Signature font file nahi mili: ${selectedFontPath}`);
    }

    const signatureFontBytes = fs.readFileSync(selectedFontPath);
    const signatureFont = await pdfDoc.embedFont(signatureFontBytes);

    const applicantName = String(application?.applicantName || "").trim();
    const fatherName = String(application?.fatherName || "").trim();

    const aadhaarNumber = String(
      application?.aadhaarNumber || application?.aadhaar || ""
    ).trim();

    const mobile = String(application?.mobile || "").trim();

    const applicationNumber = String(
      application?.applicationNumber || ""
    ).trim();

    const signedBy = String(
      application?.agreement?.signedBy || ""
    ).trim();

    const address = application?.address || {};

    const addressParts = [
      address.line,
      address.villageTownCity,
      address.district,
      address.state,
      address.pinCode ? `PIN - ${address.pinCode}` : "",
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    const drawText = ({
      text,
      x,
      y,
      size = 8,
      bold = false,
      page = firstPage,
      font,
    }) => {
      if (
        text === undefined ||
        text === null ||
        String(text).trim() === ""
      ) {
        return;
      }

      page.drawText(String(text), {
        x,
        y,
        size,
        font: font || (bold ? boldFont : normalFont),
        color: rgb(0, 0, 0),
      });
    };

    const textWidth = (text, size = 8, bold = false) => {
      const selectedFont = bold ? boldFont : normalFont;
      return selectedFont.widthOfTextAtSize(String(text), size);
    };

    const drawFitText = ({
      text,
      x,
      y,
      maxWidth,
      size = 8,
      minSize = 5,
      bold = false,
    }) => {
      if (
        text === undefined ||
        text === null ||
        String(text).trim() === ""
      ) {
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

    const wrapText = (text, maxWidth, size) => {
      if (!text) return [];

      const words = String(text).split(/\s+/);
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine
          ? `${currentLine} ${word}`
          : word;

        if (textWidth(testLine, size) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine) lines.push(currentLine);

      return lines;
    };

    // Date fields
    drawText({ text: day, x: 430, y: 765, size: 8 });
    drawText({ text: "/", x: 438, y: 765, size: 8 });
    drawText({ text: month, x: 440, y: 765, size: 8 });

    drawText({
      text: `${day}/${month}/${year}`,
      x: 185,
      y: 738,
      size: 8,
    });

    // Applicant details
    drawFitText({
      text: applicantName,
      x: 155,
      y: 560,
      maxWidth: 125,
      size: 9,
      minSize: 6,
      bold: true,
    });

    drawFitText({
      text: aadhaarNumber,
      x: 55,
      y: 557,
      maxWidth: 105,
      size: 8,
      minSize: 5,
    });

    drawFitText({
      text: fatherName,
      x: 75,
      y: 545,
      maxWidth: 105,
      size: 8,
      minSize: 5,
    });

    // Address
    if (fullAddress) {
      const addressFontSize = 7;
      const addressLines = wrapText(fullAddress, 525, addressFontSize);
      let addressY = 535;

      for (const line of addressLines) {
        if (addressY < 525) break;

        drawText({
          text: line,
          x: 90,
          y: addressY,
          size: addressFontSize,
        });

        addressY -= 10;
      }
    }

    // Application number
    if (applicationNumber) {
      drawText({
        text: `Application No: ${applicationNumber}`,
        x: 45,
        y: 25,
        size: 7,
      });
    }

    // Mobile number
    if (mobile) {
      drawText({
        text: `Mobile: ${mobile}`,
        x: 420,
        y: 25,
        size: 7,
      });
    }

    // Customer's typed signature in the selected font
    if (signedBy) {
      const signatureSize = 24;
      const signatureWidth = signatureFont.widthOfTextAtSize(
        signedBy,
        signatureSize
      );

      const signatureMarginRight = 35;
      const signatureMarginBottom = 35;

      for (const page of pages) {
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const maxWidth = Math.min(220, pageWidth - 70);
        const finalSize =
          signatureWidth > maxWidth
            ? signatureSize * (maxWidth / signatureWidth)
            : signatureSize;

        const finalWidth = signatureFont.widthOfTextAtSize(
          signedBy,
          finalSize
        );

        page.drawText(signedBy, {
          x: pageWidth - finalWidth - signatureMarginRight,
          y: Math.min(signatureMarginBottom, pageHeight - 60),
          size: finalSize,
          font: signatureFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    const finalPdfBytes = await pdfDoc.save();

    return Buffer.from(finalPdfBytes);
  } catch (error) {
    console.error("Agreement PDF generation error:", error);
    throw error;
  }
}

module.exports = { createAgreementPDF };
