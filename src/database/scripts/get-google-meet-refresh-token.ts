// scripts/get-google-meet-refresh-token.ts
import { google } from 'googleapis';
import * as http from 'http';
import { URL } from 'url';

const CLIENT_ID = process.env.GOOGLE_MEET_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_MEET_CLIENT_SECRET!;
const PORT = 4444;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
// Thêm CHÍNH XÁC URI này vào "Authorized redirect URIs" của OAuth Client trong Cloud Console.

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // bắt buộc để chắc chắn nhận được refresh_token
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

console.log('Mở link này, đăng nhập bằng tài khoản Google DÙNG CHUNG của hệ thống:\n');
console.log(authUrl, '\n');

const server = http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '', REDIRECT_URI);
    const code = url.searchParams.get('code');
    if (!code) return;

    const { tokens } = await oauth2Client.getToken(code);
    res.end('Xong! Quay lại terminal để lấy refresh_token, có thể đóng tab này.');
    server.close();

    console.log('\n✅ Lưu giá trị này vào biến môi trường GOOGLE_MEET_REFRESH_TOKEN:\n');
    console.log(tokens.refresh_token);
  })
  .listen(PORT);