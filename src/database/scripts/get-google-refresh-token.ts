// scripts/get-google-refresh-token.js
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_MEET_CLIENT_ID,
  process.env.GOOGLE_MEET_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob', // redirect cho flow CLI, không cần domain thật
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // bắt buộc để Google trả về refresh_token (nếu không sẽ chỉ có access_token)
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

console.log('Mở link này bằng tài khoản Google sẽ dùng làm "organizer" (GOOGLE_MEET_ORGANIZER_EMAIL):\n', authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('\nDán mã code sau khi authorize vào đây: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('\nGOOGLE_MEET_REFRESH_TOKEN=', tokens.refresh_token);
  rl.close();
});