import { PrismaClient, PetSize } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Hàm tạo số thập phân ngẫu nhiên trong khoảng [min, max]
 * Sẽ làm tròn đến 1 chữ số thập phân (VD: 4.5, 12.3)
 */
function getRandomWeight(min: number, max: number): number {
  const weight = Math.random() * (max - min) + min;
  return Math.round(weight * 10) / 10;
}

async function main() {
  console.log('🚀 Bắt đầu cập nhật cân nặng (weight) ngẫu nhiên cho thú cưng...');

  // 1. Tìm tất cả thú cưng đang bị thiếu weight (null)
  const petsWithoutWeight = await prisma.pet.findMany({
    where: {
      weight: null,
    },
    select: {
      id: true,
      size: true,
    },
  });

  if (petsWithoutWeight.length === 0) {
    console.log('✅ Tất cả thú cưng trong hệ thống đều đã có cân nặng. Không cần cập nhật.');
    return;
  }

  console.log(`🔍 Tìm thấy ${petsWithoutWeight.length} thú cưng chưa có cân nặng. Tiến hành cập nhật...`);

  let updatedCount = 0;

  // 2. Duyệt qua danh sách và update cân nặng ngẫu nhiên dựa trên Size
  for (const pet of petsWithoutWeight) {
    let randomWeight = 0;

    // Random theo size để dữ liệu hợp lý (hợp lệ với cả chó và mèo)
    switch (pet.size) {
      case PetSize.SMALL:
        randomWeight = getRandomWeight(2.0, 7.0); // 2kg - 7kg
        break;
      case PetSize.MEDIUM:
        randomWeight = getRandomWeight(7.5, 18.0); // 7.5kg - 18kg
        break;
      case PetSize.LARGE:
        randomWeight = getRandomWeight(19.0, 45.0); // 19kg - 45kg
        break;
      default:
        randomWeight = getRandomWeight(3.0, 20.0); // Mặc định nếu không có size
    }

    // 3. Cập nhật vào cơ sở dữ liệu
    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        weight: randomWeight, 
        // Nếu schema của bạn định nghĩa weight là String, hãy dùng: weight: `${randomWeight}`
      },
    });

    updatedCount++;

    // In log tiến độ mỗi 50 bản ghi để dễ theo dõi trong Terminal
    if (updatedCount % 50 === 0) {
      console.log(`⏳ Đã cập nhật ${updatedCount}/${petsWithoutWeight.length} thú cưng...`);
    }
  }

  console.log(`🎉 HOÀN TẤT: Đã cập nhật thành công cân nặng cho ${updatedCount} thú cưng!`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình cập nhật:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });