import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

// 1. Cấu hình Cloudflare R2 Client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: 'https://c9d5f5eea00514a9996556bae3e098d8.r2.cloudflarestorage.com', // Endpoint của bạn
  credentials: {
    accessKeyId: 'abd4d87e215fef71990e437e5e60a714',
    secretAccessKey: '4a21a869e74605e6506d7357c6ee9b1cff2b23a2df88e831129acebbab20d4fa',
  },
});

const BUCKET_NAME = 'pawcare';

async function main() {
  console.log('🚀 Bắt đầu quá trình DỌN DẸP và ĐỒNG BỘ QR code mới...');

  // =========================================================================
  // BƯỚC 1: XÓA TOÀN BỘ MÃ QR CŨ BẮT ĐẦU BẰNG "PLT_" HOẶC "PLT-" TRONG DB
  // =========================================================================
  console.log('🗑️ Đang tiến hành xóa các mã QR cũ khỏi Database...');
  try {
    const deleteResult = await prisma.tag.deleteMany({
      where: {
        OR: [
          { id: { startsWith: 'PLT_' } },
          { id: { startsWith: 'PLT-' } },
          { id: { startsWith: 'plt_' } },
          { id: { startsWith: 'plt-' } }
        ]
      }
    });
    console.log(`✅ Đã dọn dẹp sạch sẽ [ ${deleteResult.count} ] bản ghi mã QR cũ khỏi Database.`);
  } catch (deleteError: any) {
    // Nếu có lỗi do khóa ngoại (ví dụ mã đã gán cho Pet), nó sẽ in lỗi ra nhưng không làm sập script
    console.error('❌ Lỗi khi xóa mã QR cũ (Có thể do mã đã được gán cho Pet):', deleteError.message);
    console.log('⚠️ Vẫn tiếp tục quá trình tạo mã mới...');
  }

  // =========================================================================
  // BƯỚC 2: TIẾN HÀNH ĐỌC FILE VÀ SEED MÃ MỚI NHƯ HIỆN TẠI
  // =========================================================================
  const qrFolderPath = path.join(process.cwd(), 'src/database/QR_Codes');
  let files: string[] = [];

  try {
    files = fs.readdirSync(qrFolderPath).filter(f => f.endsWith('.svg'));
  } catch (error: any) {
    console.error('❌ Lỗi khi đọc thư mục QR:', error.message);
    return;
  }

  console.log(`📦 Tìm thấy ${files.length} file SVG mới. Bắt đầu xử lý upload lên R2 và lưu DB...`);

  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    
    // Tách phần mở rộng .svg, trim khoảng trắng và ép CHỮ HOA ngay từ lúc seed để chống lỗi
    const tagId = fileName.replace('.svg', '').trim().toUpperCase(); 
    const filePath = path.join(qrFolderPath, fileName);

    try {
      // A. ĐỌC NỘI DUNG FILE
      const fileContent = fs.readFileSync(filePath);

      // B. UPLOAD LÊN CLOUDFLARE R2
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `qr-codes/${fileName}`,
        Body: fileContent,
        ContentType: 'image/svg+xml',
        ACL: 'public-read',
      }));

      // C. LƯU VÀO DATABASE PRISMA
      await prisma.tag.upsert({
        where: { id: tagId },
        update: { status: 'INACTIVE' },
        create: {
          id: tagId,
          status: 'INACTIVE',
        },
      });

      successCount++;
      
      // Log tiến độ mỗi 100 file
      if (successCount % 100 === 0) {
        console.log(`✅ Đã xong: ${successCount}/${files.length} mã.`);
      }

    } catch (err: any) {
      console.error(`⚠️ Lỗi tại file ${fileName}:`, err.message);
    }
  }

  console.log(`\n🎉 HOÀN TẤT QUÁ TRÌNH SEED!`);
  console.log(`- Đã xóa sạch mã cũ.`);
  console.log(`- Tổng số file mới đã xử lý thành công: ${successCount}`);
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
