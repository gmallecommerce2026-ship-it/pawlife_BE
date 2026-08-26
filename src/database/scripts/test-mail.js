// test-mail.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify()
  .then(() => console.log('✅ SMTP kết nối OK'))
  .catch((err) => console.error('❌ SMTP lỗi:', err));

transporter.sendMail({
  from: `"Test" <${process.env.MAIL_USER}>`,
  to: 'email-nhan-thu-cua-ban@gmail.com',
  subject: 'Test gửi mail',
  html: '<p>Nếu bạn nhận được email này, SMTP hoạt động bình thường.</p>',
})
  .then((info) => console.log('✅ Gửi thành công:', info.messageId))
  .catch((err) => console.error('❌ Gửi thất bại:', err));