// src/database/prisma/seed-paw-history.ts
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Helper 1: Random ngày trong khoảng start -> end
function getRandomDateBetween(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper 2: Đảo lộn mảng để lấy ngẫu nhiên
function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

async function main() {
  console.log('🌱 Bắt đầu seeding Paw History (Tiến trình ngẫu nhiên) cho toàn bộ Pets...');

  const pets = await prisma.pet.findMany({
    include: { tags: true, transferRequests: true }
  });

  // Lấy nhiều user để giả lập lịch sử qua tay nhiều người
  const users = await prisma.user.findMany({ take: 20 }); 
  if (users.length < 2) {
    console.log("⚠️ Cần ít nhất 2 user trong Database để chạy kịch bản Transfer. Hãy seed thêm User.");
    return;
  }

  let updatedCount = 0;

  for (const pet of pets) {
    const updates: any = {};
    const petCreatedAt = pet.createdAt || new Date(); // Lấy mốc thời gian pet tạo hồ sơ

    // ==========================================
    // 1. RANDOM NGÀY SINH (DOB)
    // 80% có ngày sinh rõ ràng, khoảng 2 tháng - 5 năm TRƯỚC KHI tạo hồ sơ
    // ==========================================
    if (!pet.dob && Math.random() < 0.8) {
      const maxAgeMs = 5 * 365 * 24 * 60 * 60 * 1000; // 5 năm
      const minAgeMs = 60 * 24 * 60 * 60 * 1000; // 60 ngày
      const randomAgeMs = minAgeMs + Math.random() * (maxAgeMs - minAgeMs);
      updates.dob = new Date(petCreatedAt.getTime() - randomAgeMs);
    }

    // ==========================================
    // 2. RANDOM LỊCH SỬ VACCINE
    // Mỗi pet có từ 0 đến 3 tờ giấy chứng nhận
    // ==========================================
    if (!pet.vaccinationRecordUrls || (Array.isArray(pet.vaccinationRecordUrls) && pet.vaccinationRecordUrls.length === 0)) {
      const numVaccines = Math.floor(Math.random() * 4); // Random 0, 1, 2, 3
      if (numVaccines > 0) {
        const fakeUrls = [];
        for (let i = 1; i <= numVaccines; i++) {
          fakeUrls.push(`https://example.com/fake-vaccine-${pet.id.substring(0, 5)}-${i}.jpg`);
        }
        updates.vaccinationRecordUrls = fakeUrls;
        
        // Random updatedAt để timeline vắc xin nảy lên ở các thời điểm khác nhau
        updates.updatedAt = getRandomDateBetween(petCreatedAt, new Date());
      }
    }

    // ==========================================
    // 3. RANDOM VÒNG CỔ THÔNG MINH (TAG)
    // Khoảng 65% pet được chủ mua vòng cổ
    // ==========================================
    if (pet.tags.length === 0 && Math.random() < 0.65) {
      const newTagId = uuidv4();
      await prisma.tag.create({
        data: {
          id: newTagId,
          status: 'ACTIVE',
          petId: pet.id,
        }
      });
      updates.qrCodeUrl = `https://pawcare.app/tag/${newTagId}`;
      updates.qrVerificationStatus = 'VERIFIED';
      
      if (!updates.updatedAt) updates.updatedAt = getRandomDateBetween(petCreatedAt, new Date());
    }

    // ==========================================
    // LƯU CẬP NHẬT PET TRƯỚC KHI TẠO TRANSFER
    // ==========================================
    if (Object.keys(updates).length > 0) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: updates
      });
    }

    // ==========================================
    // 4. RANDOM LỊCH SỬ ĐỔI CHỦ (TRANSFER REQUEST)
    // ==========================================
    const transferChance = Math.random();
    let numTransfers = 0;
    
    // Tỉ lệ: 10% 2 lần đổi chủ | 30% 1 lần đổi chủ | 60% chưa từng đổi chủ
    if (transferChance > 0.9) numTransfers = 2;
    else if (transferChance > 0.6) numTransfers = 1;

    // Chỉ áp dụng cho các pet đang có owner
    if (pet.transferRequests.length === 0 && numTransfers > 0 && pet.ownerId) {
      // Bắt buộc: Người nhận cuối cùng (hiện tại) phải là pet.ownerId
      let currentReceiverId = pet.ownerId; 
      let timeUpperLimit = new Date(); // Lần đổi chủ cuối phải diễn ra trước hiện tại

      for (let i = 0; i < numTransfers; i++) {
        // Lấy ngẫu nhiên 1 người cũ làm Sender (Không được trùng với Receiver)
        const availableSenders = users.filter(u => u.id !== currentReceiverId);
        const sender = shuffle(availableSenders)[0];

        // Random thời gian request tạo và hoàn thành sao cho logic
        const transferCreatedAt = getRandomDateBetween(petCreatedAt, timeUpperLimit);
        const transferUpdatedAt = getRandomDateBetween(transferCreatedAt, timeUpperLimit);

        await prisma.transferRequest.create({
          data: {
            petId: pet.id,
            senderId: sender.id,
            receiverId: currentReceiverId,
            status: 'COMPLETED',
            createdAt: transferCreatedAt,
            updatedAt: transferUpdatedAt,
          }
        });

        // Đi lùi về quá khứ (Cho vòng lặp nếu có 2 lần chuyển nhượng)
        // Chủ cũ của lần này sẽ trở thành Người nhận của lần trước đó
        currentReceiverId = sender.id; 
        timeUpperLimit = transferCreatedAt; 
      }
    }

    updatedCount++;
    if (updatedCount % 50 === 0) {
      console.log(`...Đã xử lý ${updatedCount}/${pets.length} pets`);
    }
  }

  console.log(`✅ Hoàn tất seed Paw History ĐA DẠNG. Đã làm phong phú ${updatedCount} hồ sơ!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });