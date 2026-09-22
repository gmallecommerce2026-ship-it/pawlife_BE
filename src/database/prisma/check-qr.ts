import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Đang quét Database để tìm các mã QR (PLT_, PLT-)...');

  try {
    // Truy vấn tất cả các Tag có tiền tố PLT
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { id: { startsWith: 'PLT_' } },
          { id: { startsWith: 'PLT-' } },
          { id: { startsWith: 'plt_' } },
          { id: { startsWith: 'plt-' } },
        ]
      },
      select: {
        id: true,
        status: true,
        petId: true, // Xem mã này đã được gán cho Pet nào chưa
      },
      orderBy: {
        id: 'asc' // Sắp xếp A-Z cho dễ nhìn
      }
    });

    console.log(`\n📊 KẾT QUẢ: Tìm thấy TỔNG CỘNG [ ${tags.length} ] mã QR hợp lệ trong hệ thống.`);

    if (tags.length > 0) {
      console.log(`📋 Danh sách TOÀN BỘ ${tags.length} mã trong Database:`);
      
      // In toàn bộ danh sách ra bảng (không dùng slice nữa)
      console.table(tags); 
      
    } else {
      console.log('✅ Hệ thống hiện tại sạch sẽ, KHÔNG CÓ bất kỳ mã QR nào bắt đầu bằng PLT_ hay PLT-.');
    }

  } catch (error: any) {
    console.error('❌ Có lỗi xảy ra trong quá trình truy vấn:', error.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });