import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';

export async function seedPets(prisma: PrismaClient) {
  console.log('Đang tạo Pets...');

  // 1. Lấy danh sách Shelter từ DB (Thay vì nhận từ tham số)
  const shelters = await prisma.shelter.findMany();
  if (shelters.length === 0) {
    throw new Error('❌ Không tìm thấy Shelter nào! Vui lòng chạy seed Shelters trước.');
  }

  // Lấy ra id của các shelter để dùng
  const shelter1Id = shelters[0].id;
  const shelter2Id = shelters.length > 1 ? shelters[1].id : shelter1Id;
  const shelter3Id = shelters.length > 2 ? shelters[2].id : shelter1Id;
  
  const petData = [
    // Shelter 1: Hà Nội Pet Rescue
    { name: 'Milo', species: 'Dog', breed: 'Golden Retriever', age: 2, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Vàng', shelterId: shelters.shelter1Id, imageUrl: 'https://loremflickr.com/400/400/dog' },
    { name: 'Miu', species: 'Cat', breed: 'Mèo mướp', age: 1, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Vằn', shelterId: shelters.shelter1Id, imageUrl: 'https://loremflickr.com/400/400/cat' },
    { name: 'Ki', species: 'Dog', breed: 'Corgi', age: 3, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Trắng Vàng', shelterId: shelters.shelter1Id, imageUrl: 'https://loremflickr.com/400/400/corgi' },
    { name: 'Bông', species: 'Cat', breed: 'Mèo Anh Lông Dài', age: 2, gender: PetGender.FEMALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelters.shelter1Id, imageUrl: 'https://loremflickr.com/400/400/kitten' },
    { name: 'Lu', species: 'Dog', breed: 'Chó cỏ', age: 4, gender: PetGender.UNKNOWN, size: PetSize.MEDIUM, color: 'Đen', shelterId: shelters.shelter1Id, imageUrl: 'https://loremflickr.com/400/400/puppy' },

    // Shelter 2: Sài Gòn Animal Rescue
    { name: 'Tomy', species: 'Cat', breed: 'Mèo Anh Lông Ngắn', age: 1, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Xám', shelterId: shelters.shelter2Id, imageUrl: 'https://loremflickr.com/400/400/cat,grey' },
    { name: 'Rex', species: 'Dog', breed: 'Becgie', age: 5, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Đen Vàng', shelterId: shelters.shelter2Id, imageUrl: 'https://loremflickr.com/400/400/germanshepherd' },
    { name: 'Na', species: 'Cat', breed: 'Mèo Xiêm', age: 3, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Trắng Đen', shelterId: shelters.shelter2Id, imageUrl: 'https://loremflickr.com/400/400/siamese' },
    { name: 'Bull', species: 'Dog', breed: 'Bulldog', age: 2, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelters.shelter2Id, imageUrl: 'https://loremflickr.com/400/400/bulldog' },
    { name: 'Đốm', species: 'Dog', breed: 'Dalmatian', age: 1, gender: PetGender.FEMALE, size: PetSize.LARGE, color: 'Trắng Đen', shelterId: shelters.shelter2Id, imageUrl: 'https://loremflickr.com/400/400/dalmatian' },

    // Shelter 3: Đà Nẵng Furry Friends
    { name: 'Cam', species: 'Cat', breed: 'Mèo vàng', age: 2, gender: PetGender.MALE, size: PetSize.SMALL, color: 'Cam', shelterId: shelters.shelter3Id, imageUrl: 'https://loremflickr.com/400/400/orange,cat' },
    { name: 'Husky', species: 'Dog', breed: 'Husky Sibir', age: 3, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Xám Trắng', shelterId: shelters.shelter3Id, imageUrl: 'https://loremflickr.com/400/400/husky' },
    { name: 'Mika', species: 'Cat', breed: 'Mèo Ba Tư', age: 4, gender: PetGender.FEMALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelters.shelter3Id, imageUrl: 'https://loremflickr.com/400/400/persian,cat' },
    { name: 'Gấu', species: 'Dog', breed: 'Poodle', age: 1, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Nâu', shelterId: shelters.shelter3Id, imageUrl: 'https://loremflickr.com/400/400/poodle' },
    { name: 'Béo', species: 'Cat', breed: 'Mèo Anh Lông Ngắn', age: 5, gender: PetGender.UNKNOWN, size: PetSize.LARGE, color: 'Xanh xám', shelterId: shelters.shelter3Id, imageUrl: 'https://loremflickr.com/400/400/fat,cat' },
  ];

  for (const pet of petData) {
    await prisma.pet.create({
      data: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        size: pet.size,
        color: pet.color,
        status: PetStatus.AVAILABLE,
        isVaccinated: true,
        isSpayedNeutered: false,
        shelterId: pet.shelterId,
        images: {
          create: [
            { url: pet.imageUrl },
            { url: `${pet.imageUrl}?random=1` },
            { url: `${pet.imageUrl}?random=2` }
          ],
        },
      },
    });
  }
}
