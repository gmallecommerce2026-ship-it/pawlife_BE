import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

// 1. Cấu hình Cloudflare R2 Client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: 'https://c9d5f5eea00514a9996556bae3e098d8.r2.cloudflarestorage.com', // Endpoint bạn đã cung cấp
  credentials: {
    accessKeyId: 'ĐIỀN_ACCESS_KEY_ID_CỦA_BẠN_VÀO_ĐÂY',
    secretAccessKey: 'ĐIỀN_SECRET_ACCESS_KEY_CỦA_BẠN_VÀO_ĐÂY',
  },
});

const BUCKET_NAME = 'pawcare';

async function main() {
  console.log('🚀 Bắt đầu quá trình đồng bộ 10,000 mã QR lên R2 và DB...');

  const qrFolderPath = path.join(process.cwd(), 'src/database/QR_Codes');
  let files: string[] = [];

  try {
    files = fs.readdirSync(qrFolderPath).filter(f => f.endsWith('.svg'));
  } catch (error: any) {
    console.error('❌ Lỗi khi đọc thư mục QR:', error.message);
    return;
  }

  console.log(`📦 Tìm thấy ${files.length} file SVG. Bắt đầu xử lý...`);

  let successCount = 0;

  // Xử lý từng file một (hoặc chia nhỏ theo batch nếu muốn nhanh hơn)
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const tagId = fileName.replace('.svg', '').trim();
    const filePath = path.join(qrFolderPath, fileName);

    try {
      // A. ĐỌC NỘI DUNG FILE
      const fileContent = fs.readFileSync(filePath);

      // B. UPLOAD LÊN CLOUDFLARE R2
      // Lưu vào thư mục 'qr-codes' trên R2
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `qr-codes/${fileName}`,
        Body: fileContent,
        ContentType: 'image/svg+xml',
        // Cấu hình để file có thể truy cập công khai nếu cần
        ACL: 'public-read',
      }));

      // C. LƯU VÀO DATABASE PRISMA
      // Dùng upsert để nếu ID đã tồn tại thì nó chỉ cập nhật, không bị lỗi crash
      await prisma.tag.upsert({
        where: { id: tagId },
        update: { status: 'INACTIVE' },
        create: {
          id: tagId,
          status: 'INACTIVE',
        },
      });

      successCount++;
      
      // Log tiến độ mỗi 100 file để tránh làm rối màn hình console
      if (successCount % 100 === 0) {
        console.log(`✅ Đã xong: ${successCount}/${files.length} mã.`);
      }

    } catch (err: any) {
      console.error(`⚠️ Lỗi tại file ${fileName}:`, err.message);
    }
  }

  console.log(`\n🎉 HOÀN TẤT!`);
  console.log(`- Tổng số file xử lý: ${successCount}`);
  console.log(`- Địa chỉ Public: https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev/qr-codes/{tagId}.svg`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });