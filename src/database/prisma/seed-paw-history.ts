// // src/database/prisma/seed-paw-history.ts
// import { PrismaClient } from '@prisma/client';
// import { v4 as uuidv4 } from 'uuid';

// const prisma = new PrismaClient();

// function getRandomDateBetween(start: Date, end: Date) {
//   return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
// }

// async function main() {
//   console.log('🌱 Bắt đầu seeding Paw History cho toàn bộ Pets...');

//   const pets = await prisma.pet.findMany({
//     include: { tags: true, transferRequests: true }
//   });

//   const users = await prisma.user.findMany({ take: 5 }); // Lấy vài user làm data fake

//   let updatedCount = 0;

//   for (const pet of pets) {
//     const updates: any = {};

//     // 1. Tạo ngẫu nhiên ngày sinh (dob) nếu chưa có
//     if (!pet.dob) {
//       // Pet sinh ra cách đây 1 đến 5 năm
//       const dob = getRandomDateBetween(new Date(2019, 0, 1), new Date(2023, 11, 31));
//       updates.dob = dob;
//     }

//     // 2. Thêm giả lập giấy tờ tiêm chủng
//     if (!pet.vaccinationRecordUrls || (Array.isArray(pet.vaccinationRecordUrls) && pet.vaccinationRecordUrls.length === 0)) {
//       updates.vaccinationRecordUrls = [
//         "https://example.com/fake-vaccine-1.jpg",
//         "https://example.com/fake-vaccine-2.jpg"
//       ];
//     }

//     // 3. Nếu pet chưa có Tag, gắn cho nó 1 cái
//     if (pet.tags.length === 0) {
//       const newTagId = uuidv4();
//       await prisma.tag.create({
//         data: {
//           id: newTagId,
//           status: 'ACTIVE',
//           petId: pet.id,
//           reports: { create: [] } // Tạo quan hệ rỗng cho chắc chắn
//         }
//       });
//       updates.qrCodeUrl = `https://pawcare.app/tag/${newTagId}`;
//       updates.qrVerificationStatus = 'VERIFIED';
//     }

//     // Update Pet
//     if (Object.keys(updates).length > 0) {
//       await prisma.pet.update({
//         where: { id: pet.id },
//         data: updates
//       });
//     }

//     // 4. Giả lập lịch sử Transfer (Chuyển nhượng) cho 30% số lượng pet
//     if (pet.transferRequests.length === 0 && Math.random() > 0.7 && users.length > 1) {
//       const sender = users[0];
//       const receiver = pet.ownerId === users[1].id ? users[2] : users[1]; // Đảm bảo người nhận khác chủ hiện tại
      
//       await prisma.transferRequest.create({
//         data: {
//           petId: pet.id,
//           senderId: sender.id,
//           receiverId: receiver.id,
//           status: 'COMPLETED',
//           createdAt: getRandomDateBetween(new Date(2023, 0, 1), new Date(2024, 0, 1)), // Fake ngày tạo
//           updatedAt: getRandomDateBetween(new Date(2024, 1, 1), new Date()), // Fake ngày hoàn thành
//         }
//       });
//     }

//     updatedCount++;
//     if (updatedCount % 50 === 0) {
//       console.log(`...Đã xử lý ${updatedCount}/${pets.length} pets`);
//     }
//   }

//   // XÓA REDIS CACHE ĐỂ API GET LẠI DATA MỚI
//   // Nếu có thư viện Redis ở đây thì gọi command flushdb, nếu không thì cứ kệ, đợi hết TTL.

//   console.log(`✅ Hoàn tất seed Paw History. Đã cập nhật ${updatedCount} hồ sơ!`);
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });