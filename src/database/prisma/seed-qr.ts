// prisma/seed-qr.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu quá trình seed 10,000 mã QR...');

  // 1. Chỉ định đường dẫn tới folder chứa 10,000 file .svg của bạn
  // Thay đổi đường dẫn này trỏ đúng vào thư mục của bạn trên máy tính
  const qrFolderPath = path.join(process.cwd(), 'src/database/QR_Codes'); // Ví dụ: src/QR_CODES chứa 10,000 file .svg

  // 2. Đọc toàn bộ tên file trong thư mục
  let files: string[] = [];
  try {
    files = fs.readdirSync(qrFolderPath);
  } catch (error: any) {
    console.error('Lỗi khi đọc thư mục QR:', error.message);
    return;
  }

  // 3. Lọc ra các file .svg và tạo mảng data
  const tagsToInsert: any = [];
  
  for (const file of files) {
    if (file.endsWith('.svg')) {
      // Tách đuôi .svg để lấy ID. Ví dụ: "123-abc.svg" -> "123-abc"
      const tagId = file.replace('.svg', '');

      tagsToInsert.push({
        id: tagId,
        status: 'INACTIVE', // Mặc định thẻ mới chưa gán cho pet nào sẽ là INACTIVE
        // petId sẽ để trống (null) mặc định theo schema
      });
    }
  }

  console.log(`Đã tìm thấy ${tagsToInsert.length} mã QR hợp lệ. Bắt đầu lưu vào DB...`);

  // 4. Chunking (Chia nhỏ data để insert)
  // Insert 10,000 record 1 lúc có thể làm quá tải DB, ta nên chia nhỏ ra (ví dụ: 1000 records/lần)
  const chunkSize = 1000;
  let insertedCount = 0;

  for (let i = 0; i < tagsToInsert.length; i += chunkSize) {
    const chunk = tagsToInsert.slice(i, i + chunkSize);
    
    // Sử dụng createMany với skipDuplicates: true để nếu bạn chạy lại script, 
    // nó sẽ không bị lỗi crash do trùng lặp (trùng ID).
    const result = await prisma.tag.createMany({
      data: chunk,
      skipDuplicates: true, 
    });

    insertedCount += result.count;
    console.log(`Đã insert thành công: ${i + chunk.length} / ${tagsToInsert.length}`);
  }

  console.log(`🎉 Hoàn tất! Đã thêm mới ${insertedCount} mã QR vào hệ thống.`);
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });