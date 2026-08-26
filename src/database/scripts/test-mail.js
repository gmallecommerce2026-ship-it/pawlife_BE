require('dotenv').config(); // ← thêm dòng này, load .env ở thư mục gốc project
const nodemailer = require('nodemailer');

console.log('MAIL_HOST =', process.env.MAIL_HOST);
console.log('MAIL_PORT =', process.env.MAIL_PORT);
console.log('MAIL_USER =', process.env.MAIL_USER);
console.log('MAIL_PASS =', process.env.MAIL_PASS ? '(đã set, ẩn giá trị)' : '(THIẾU!)');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: Number(process.env.MAIL_PORT) === 465,
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
  to: 'email-nhan-thu-cua-ban@gmail.com', // thay bằng email bạn kiểm tra được
  subject: 'Test gửi mail',
  html: '<p>Nếu bạn nhận được email này, SMTP hoạt động bình thường.</p>',
})
  .then((info) => console.log('✅ Gửi thành công:', info.messageId))
  .catch((err) => console.error('❌ Gửi thất bại:', err));