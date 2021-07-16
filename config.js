require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DB_URL || "",
  secretKey: process.env.SECRET_KEY || "root",
  smpt_host: process.env.SMTP_HOST,
  smpt_port: process.env.SMTP_PORT,
  smpt_user: process.env.SMTP_USER,
  smpt_pass: process.env.SMTP_PASS,
  smpt_email: process.env.SMTP_EMAIL,
  verify_address: process.env.VERIFY_ADDRESS,
};
