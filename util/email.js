import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const transportOptions = {
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: Number(SMTP_PORT) === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
};

const transporter = nodemailer.createTransport(transportOptions);

const assertSmtpConfig = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is missing");
  }
};

export const sendPasswordResetEmail = async ({ to, otp, userType }) => {
  assertSmtpConfig();

  const from = SMTP_FROM || SMTP_USER;
  const subject = "Reset your FacultyPedia password";
  const text = `Hi,

We received a request to reset your ${userType} account password.

Your one-time password (OTP) is: ${otp}

This OTP expires in 5 minutes. If you did not request this, you can ignore this email.

Thanks,
FacultyPedia Team`;

  return transporter.sendMail({ from, to, subject, text });
};

export const sendInvoiceEmail = async ({ to, payout, educator, pdfBuffer }) => {
  assertSmtpConfig();

  const from = SMTP_FROM || SMTP_USER;
  const subject = `Payout Invoice - ${
    payout?.payoutCheckId || payout?._id || ""
  }`;

  const text = `Hi ${educator?.fullName || "Educator"},

Your payout has been processed successfully.
Reference: ${payout?.payoutCheckId || ""}
Period: ${payout?.month}/${payout?.year}
Amount: Rs ${(Number(payout?.amount || 0) / 100).toFixed(2)}

The invoice is attached for your records.

Thanks,
FacultyPedia Team`;

  const attachments = pdfBuffer
    ? [
        {
          filename: `${payout?.payoutCheckId || "payout"}-invoice.pdf`,
          content: pdfBuffer,
        },
      ]
    : [];

  return transporter.sendMail({ from, to, subject, text, attachments });
};
