// scripts/get-google-refresh-token.js
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_MEET_CLIENT_ID,
  process.env.GOOGLE_MEET_CLIENT_SECRET,
  REDIRECT_URI,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

console.log('Mở link này bằng tài khoản Google sẽ dùng làm "organizer":\n', authUrl);

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) return;

  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  res.end('Đã nhận được code, bạn có thể đóng tab này và quay lại terminal.');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log('\nGOOGLE_MEET_REFRESH_TOKEN=', tokens.refresh_token);
});

server.listen(PORT, () => {
  console.log(`\nĐang chờ callback ở ${REDIRECT_URI} ...`);
});