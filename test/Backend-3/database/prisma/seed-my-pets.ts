import { PrismaClient, Role, PetGender, PetSize, PetStatus, TagStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu thêm dữ liệu My Pets cho hello@pawlife.vn...');

  const targetEmail = 'hello@pawlife.vn';

  const myUser = await prisma.user.upsert({
    where: { email: targetEmail },
    update: {}, 
    create: {
      email: targetEmail,
      name: 'Thiện Ân', 
      role: Role.USER,
    },
  });

  console.log(`Đã tìm thấy/tạo User: ${myUser.email} (ID: ${myUser.id})`);

  // =======================================================
  // BƯỚC MỚI: Dọn dẹp bản ghi cũ để tránh lỗi trùng Primary Key
  // =======================================================
  console.log('Đang dọn dẹp dữ liệu cũ của Luna và Piglet (nếu có)...');
  
  // Xóa Tag cũ
  await prisma.tag.deleteMany({
    where: {
      id: { in: ['luna-lost-tag-id', 'piglet-safe-tag-id'] }
    }
  });

  // Xóa Pet cũ mang tên LUNA hoặc Piglet của user này
  await prisma.pet.deleteMany({
    where: {
      ownerId: myUser.id,
      name: { in: ['LUNA', 'Piglet'] }
    }
  });


  // 2. Thêm bé Luna - Đang đi lạc (LOST)
  console.log('Đang tạo bé LUNA...');
  const luna = await prisma.pet.create({
    data: {
      name: 'LUNA',
      species: 'Dog',
      breed: 'Golden Retriever',
      age: 3,
      gender: PetGender.FEMALE,
      size: PetSize.LARGE,
      color: 'Vàng rơm',
      status: PetStatus.ADOPTED, 
      ownerId: myUser.id, 
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=600&auto=format&fit=crop' }
        ]
      },
      tags: {
        create: {
          id: 'luna-lost-tag-id', 
          status: TagStatus.LOST,  
        }
      }
    }
  });
  console.log(`Đã thêm thành công Pet: ${luna.name}`);

  // 3. Thêm bé Piglet - Đang an toàn ở nhà (ACTIVE)
  console.log('Đang tạo bé Piglet...');
  const piglet = await prisma.pet.create({
    data: {
      name: 'Piglet',
      species: 'Cat',
      breed: 'Tabby Cat',
      age: 2,
      gender: PetGender.MALE,
      size: PetSize.SMALL,
      color: 'Xám Trắng',
      status: PetStatus.ADOPTED, 
      ownerId: myUser.id, 
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1513245543132-31f507417b26?q=80&w=600&auto=format&fit=crop' }
        ]
      },
      tags: {
        create: {
          id: 'piglet-safe-tag-id', 
          status: TagStatus.ACTIVE,  
        }
      }
    }
  });
  console.log(`Đã thêm thành công Pet: ${piglet.name}`);

  console.log('✅ Đã thêm dữ liệu My Pets thành công!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed thêm dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });