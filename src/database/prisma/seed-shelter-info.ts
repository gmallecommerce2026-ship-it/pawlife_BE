import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load biến môi trường từ file .env
dotenv.config();

const prisma = new PrismaClient();

// Thiết lập R2 Client giống hệt r2.service.ts của bạn
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

// Hàm hỗ trợ đọc file local và đẩy lên R2
async function uploadLocalFileToR2(fileName: string, contentType: string) {
  const filePath = path.join(process.cwd(), 'prisma', 'data', 'images', fileName); // Trỏ tới prisma/data/images/
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName, // Lưu trên R2 với tên gốc
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`✅ Đã upload ${fileName} lên Cloudflare R2`);
    
    return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error(`❌ Lỗi upload ${fileName} lên R2:`, error);
    return null;
  }
}

async function main() {
  console.log('Bắt đầu cập nhật thông tin Shelters...');

  // 1. Upload ảnh local lên R2 trước
  console.log('Đang tải ảnh lên Cloudflare R2...');
  const avatarUrl = await uploadLocalFileToR2('shelter-avatar.jpg', 'image/jpeg');
  const coverUrl = await uploadLocalFileToR2('shelter-cover.jpg', 'image/jpeg');

  if (!avatarUrl || !coverUrl) {
    console.error('Không thể upload ảnh, dừng tiến trình!');
    return;
  }

  // 2. Lấy danh sách các shelter
  const shelters = await prisma.shelter.findMany({
    where: { NOT: { name: { contains: 'foster' } } },
    take: 3,
    orderBy: { createdAt: 'asc' }
  });

  if (shelters.length === 0) {
    console.log('❌ Không tìm thấy shelter nào phù hợp để cập nhật.');
    return;
  }

  const shelterNames = ['Pawlife (HN)', 'Pawlife (HCM)', 'Pawlife (ĐN)'];
  const addresses = ['Ha Noi, Viet Nam', 'HCM, Viet Nam', 'Da Nang, Viet Nam'];
  const bio = `Walking alongside every four-legged friend's journey home.`;
  const intro = 'PawLife builds a bridge between shelters and adopters within a transparent ecosystem. From digital identity to medical history, every detail is recorded to ensure each adoption decision is informed and responsible.';

  // 3. Cập nhật Database
  for (let i = 0; i < shelters.length; i++) {
    const shelter = shelters[i];
    const shelterName = shelterNames[i] || shelterNames[0];
    const shelterAddress = addresses[i] || addresses[0];

    await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        name: shelterName,
        emailAddress: 'hello@pawlife.vn',
        contactInfo: '0913884409',
        address: shelterAddress,
        bio: bio,
        description: intro,
        avatarUrl: avatarUrl, // Dùng link thực tế trả về từ hàm upload
        coverUrl: coverUrl,
      }
    });

    console.log(`✅ Đã cập nhật DB cho: [${shelterName}]`);
  }

  console.log('🎉 Hoàn tất quá trình!');
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });