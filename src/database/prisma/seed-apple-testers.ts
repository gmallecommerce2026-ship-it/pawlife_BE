import { PrismaClient, Role, PetGender, PetSize, PetStatus, TagStatus, VerificationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper: Format JSON Song Ngữ để tránh lỗi Schema mới
function biObj(viText: string, enText: string): any {
  return { vi: viText, en: enText };
}

async function main() {
  console.log('🚀 Bắt đầu tạo 5 tài khoản Tester cho Apple Reviewer...');

  // Mật khẩu chung cho tất cả các tester
  const rawPassword = 'Pawlife@2026';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // Danh sách 5 tài khoản Tester theo yêu cầu
  const testers = [
    { email: 'nguyenngocduc260504@gmail.com', name: 'Ngọc Đức (Tester)' },
    { email: 'an.nguyenthien112802@gmail.com', name: 'Thiên Ân (Tester)' },
    { email: 'apple.reviewer1@pawlife.vn', name: 'Apple Reviewer 1' },
    { email: 'apple.reviewer2@pawlife.vn', name: 'Apple Reviewer 2' },
    { email: 'apple.reviewer3@pawlife.vn', name: 'Apple Reviewer 3' },
  ];

  for (const tester of testers) {
    console.log(`\n===========================================`);
    console.log(`⏳ Đang xử lý tài khoản: ${tester.email}`);

    // 1. Khởi tạo hoặc Cập nhật User
    const myUser = await prisma.user.upsert({
      where: { email: tester.email },
      update: { 
        password: hashedPassword, // Reset lại mật khẩu nếu account đã tồn tại
      }, 
      create: {
        email: tester.email,
        password: hashedPassword,
        name: tester.name,
        role: Role.USER,
      },
    });

    console.log(`👤 Đã tìm thấy/tạo User ID: ${myUser.id}`);

    // =======================================================
    // BƯỚC DỌN DẸP AN TOÀN TRÁNH TRÙNG LẶP KHI CHẠY LẠI
    // =======================================================
    const oldPets = await prisma.pet.findMany({
      where: { 
        ownerId: myUser.id, 
        name: { in: ['LUNA', 'Piglet a'] } 
      },
      select: { id: true }
    });
    
    if (oldPets.length > 0) {
        const oldPetIds = oldPets.map(p => p.id);
        // Xoá Tag của các Pet cũ
        await prisma.tag.deleteMany({ where: { petId: { in: oldPetIds } } });
        // Xoá Pet
        await prisma.pet.deleteMany({ where: { id: { in: oldPetIds } } });
        console.log(`🗑 Đã dọn dẹp xong dữ liệu cũ của Tester này.`);
    }

    // =======================================================
    // 2. Thêm bé Luna - Đang đi lạc (LOST)
    // =======================================================
    const lunaTagId = `luna-tag-${myUser.id}`; // Mã QR độc nhất cho từng User
    const luna = await prisma.pet.create({
      data: {
        name: 'LUNA',
        // Áp dụng định dạng JSON Song Ngữ cho Schema mới
        species: biObj('Chó', 'Dog'),
        breed: biObj('Golden Retriever', 'Golden Retriever'),
        color: biObj('Vàng rơm', 'Straw yellow'),
        gender: PetGender.FEMALE,
        size: PetSize.LARGE,
        status: PetStatus.ADOPTED, 
        ownerId: myUser.id, 
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/${lunaTagId}`,
        qrVerificationStatus: VerificationStatus.VERIFIED,
        images: {
          create: [
            { url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=600&auto=format&fit=crop' }
          ]
        },
        tags: {
          create: {
            id: lunaTagId, 
            status: TagStatus.LOST,  
          }
        }
      }
    });
    console.log(`🐾 Đã thêm thành công: LUNA (Trạng thái: LOST)`);

    // =======================================================
    // 3. Thêm bé Piglet - Đang an toàn ở nhà (ACTIVE)
    // =======================================================
    const pigletTagId = `piglet-tag-${myUser.id}`; // Mã QR độc nhất cho từng User
    const piglet = await prisma.pet.create({
      data: {
        name: 'Piglet a',
        species: biObj('Mèo', 'Cat'),
        breed: biObj('Mèo mướp', 'Tabby Cat'),
        color: biObj('Xám Trắng', 'Grey & White'),
        gender: PetGender.MALE,
        size: PetSize.SMALL,
        status: PetStatus.ADOPTED, 
        ownerId: myUser.id,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/${pigletTagId}`,
        qrVerificationStatus: VerificationStatus.VERIFIED,
        images: {
          create: [
            { url: 'https://images.unsplash.com/photo-1513245543132-31f507417b26?q=80&w=600&auto=format&fit=crop' }
          ]
        },
        tags: {
          create: {
            id: pigletTagId, 
            status: TagStatus.ACTIVE,  
          }
        }
      }
    });
    console.log(`🐾 Đã thêm thành công: Piglet (Trạng thái: ACTIVE)`);
  }

  console.log('\n🎉 HOÀN TẤT TẠO 5 TÀI KHOẢN TESTER CHO APPLE!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed tài khoản tester:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0); // Lệnh chống treo tiến trình
  });