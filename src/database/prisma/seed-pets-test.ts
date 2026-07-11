/**
 * prisma/seed.ts
 * ------------------------------------------------------------------
 * Seed script: tạo Pet từ danh sách ảnh có sẵn trong prisma/data/Breeds/...
 * Mỗi Pet được gán ngẫu nhiên vào 1 Shelter đang có sẵn trong DB.
 *
 * Chạy:
 *   npx ts-node prisma/seed.ts
 * hoặc cấu hình trong package.json:
 *   "prisma": { "seed": "ts-node prisma/seed.ts" }
 *   rồi chạy: npx prisma db seed
 * ------------------------------------------------------------------
 */

import { PrismaClient, PetGender, PetSize, PetStatus, VerificationStatus, TagStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// 0. CẤU HÌNH
// ============================================================

// Base URL public để truy cập ảnh (đổi lại theo domain R2/CDN thật của bạn).
// Ảnh gốc nằm ở prisma/data/Breeds/... nên ta build path tương ứng.
const IMAGE_BASE_URL = process.env.PET_IMAGE_BASE_URL || "https://r2.yourdomain.com/pet-images";

// Nếu true: xoá hết Pet cũ (và các bảng con cascade) trước khi seed lại cho sạch.
const RESET_PETS_BEFORE_SEED = true;

// ============================================================
// 1. DANH SÁCH ẢNH GỐC (relative path tính từ prisma/data/)
// ============================================================

const RAW_IMAGE_PATHS = `
Breeds/Dog/Bac-Ha-Dog/Frankie_BH/Frankie_BH_1.jpg
Breeds/Dog/Bac-Ha-Dog/Frankie_BH/Frankie_BH_2.jpg
Breeds/Dog/Bac-Ha-Dog/Frankie_BH/Frankie_BH_3.jpg
Breeds/Dog/Bac-Ha-Dog/Gasby_BH/Gasby_Bac-Ha-Dog_1.jpg
Breeds/Dog/Bac-Ha-Dog/Gasby_BH/Gasby_Bac-Ha-Dog_2.jpg
Breeds/Dog/Bac-Ha-Dog/Gasby_BH/Gasby_Bac-Ha-Dog_3.jpg
Breeds/Dog/Bac-Ha-Dog/Kyle_BH/Kyle_BH_1.jpg
Breeds/Dog/Bac-Ha-Dog/Kyle_BH/Kyle_BH_2.jpg
Breeds/Dog/Bac-Ha-Dog/Kyle_BH/Kyle_BH_3.jpg
Breeds/Dog/Corgi/Adam_Corgi/Adam_Corgi_1.jpg
Breeds/Dog/Corgi/Adam_Corgi/Adam_Corgi_2.jpg
Breeds/Dog/Corgi/Adam_Corgi/Adam_Corgi_3.jpg
Breeds/Dog/Corgi/Cross_Corgi/Cross_Corgi_1.jpg
Breeds/Dog/Corgi/Cross_Corgi/Cross_Corgi_2.jpg
Breeds/Dog/Corgi/Cross_Corgi/Cross_Corgi_3.jpg
Breeds/Dog/Corgi/Jane_Corgi/Jane_Corgi_1.jpg
Breeds/Dog/Corgi/Jane_Corgi/Jane_Corgi_2.jpg
Breeds/Dog/Corgi/Jane_Corgi/Jane_Corgi_3.jpg
Breeds/Dog/Dachshund/Simba_Dachshund/Simba_Dachshund_1.webp
Breeds/Dog/Dachshund/Simba_Dachshund/Simba_Dachshund_2.webp
Breeds/Dog/Dachshund/Simba_Dachshund/Simba_Dachshund_3.webp
Breeds/Dog/Dachshund/Terra_Dachshund/Terra_Dachshund_1.webp
Breeds/Dog/Dachshund/Terra_Dachshund/Terra_Dachshund_2.webp
Breeds/Dog/Dachshund/Terra_Dachshund/Terra_Dachshund_3.webp
Breeds/Dog/Dachshund/Won_Dachshund/Won_Dachshund_1.webp
Breeds/Dog/Dachshund/Won_Dachshund/Won_Dachshund_2.webp
Breeds/Dog/Dachshund/Won_Dachshund/Won_Dachshund_3.webp
Breeds/Dog/French-Bulldog/Bailey_FB/Bailey_FB_1.webp
Breeds/Dog/French-Bulldog/Bailey_FB/Bailey_FB_2.webp
Breeds/Dog/French-Bulldog/Bailey_FB/Bailey_FB_3.webp
Breeds/Dog/French-Bulldog/Coco_FB/Coco_FB_1.jpg
Breeds/Dog/French-Bulldog/Coco_FB/Coco_FB_2.jpg
Breeds/Dog/French-Bulldog/Coco_FB/Coco_FB_3.jpg
Breeds/Dog/French-Bulldog/Teddy_FB/Teddy_FB_1.webp
Breeds/Dog/French-Bulldog/Teddy_FB/Teddy_FB_2.webp
Breeds/Dog/French-Bulldog/Teddy_FB/Teddy_FB_3.webp
Breeds/Dog/GermanSheperd/Kim_GermanSheperd/Kim_GermanSheperd_1.png
Breeds/Dog/GermanSheperd/Kim_GermanSheperd/Kim_GermanSheperd_2.png
Breeds/Dog/GermanSheperd/Kim_GermanSheperd/Kim_GermanSheperd_3.png
Breeds/Dog/GermanSheperd/Lucy_Germansheperd/Lucy_Germansheperd_1.png
Breeds/Dog/GermanSheperd/Lucy_Germansheperd/Lucy_Germansheperd_2.png
Breeds/Dog/GermanSheperd/Lucy_Germansheperd/Lucy_Germansheperd_3.png
Breeds/Dog/GermanSheperd/Tim_Germansherperd/Tim_Germansherperd_1.png
Breeds/Dog/GermanSheperd/Tim_Germansherperd/Tim_Germansherperd_2.png
Breeds/Dog/GermanSheperd/Tim_Germansherperd/Tim_Germansherperd_3.png
Breeds/Dog/H'Mong-Bobtail/Beo_H'Mong-Bobtail/Beo_H'Mong-Bobtail_1.jpg
Breeds/Dog/H'Mong-Bobtail/Beo_H'Mong-Bobtail/Beo_H'Mong-Bobtail_2.jpg
Breeds/Dog/H'Mong-Bobtail/Beo_H'Mong-Bobtail/Beo_H'Mong-Bobtail_3.jpg
Breeds/Dog/H'Mong-Bobtail/Sam_H'Mong-Bobtail/Sam_H'Mong-Bobtail_1.jpeg
Breeds/Dog/H'Mong-Bobtail/Sam_H'Mong-Bobtail/Sam_H'Mong-Bobtail_2.jpeg
Breeds/Dog/H'Mong-Bobtail/Sam_H'Mong-Bobtail/Sam_H'Mong-Bobtail_3.jpeg
Breeds/Dog/H'Mong-Bobtail/Tom_H'Mong-Bobtail/Tom_H'Mong-Bobtail_1.jpg
Breeds/Dog/H'Mong-Bobtail/Tom_H'Mong-Bobtail/Tom_H'Mong-Bobtail_2.jpg
Breeds/Dog/H'Mong-Bobtail/Tom_H'Mong-Bobtail/Tom_H'Mong-Bobtail_3.jpg
Breeds/Dog/Husky/Buddy_Husky/Buddy_Husky_1.jpg
Breeds/Dog/Husky/Buddy_Husky/Buddy_Husky_2.jpg
Breeds/Dog/Husky/Buddy_Husky/Buddy_Husky_3.jpg
Breeds/Dog/Husky/Leo_Husky/Leo_Husky_1.jpg
Breeds/Dog/Husky/Leo_Husky/Leo_Husky_2.jpg
Breeds/Dog/Husky/Leo_Husky/Leo_Husky_3.jpg
Breeds/Dog/Husky/Lola_Husky/Lola_Husky_1.jpg
Breeds/Dog/Husky/Lola_Husky/Lola_Husky_2.jpg
Breeds/Dog/Husky/Lola_Husky/Lola_Husky_3.jpg
Breeds/Dog/Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback_1.png
Breeds/Dog/Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback_2.png
Breeds/Dog/Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback/Freedom_Phu-Quoc-Ridgeback_3.png
Breeds/Dog/Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback_1.png
Breeds/Dog/Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback_2.png
Breeds/Dog/Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback/Justin_Phu-Quoc-Ridgeback_3.png
Breeds/Dog/Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback_1.png
Breeds/Dog/Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback_2.png
Breeds/Dog/Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback/Moto_Phu-Quoc-Ridgeback_3.png
Breeds/Dog/Pomeranian/Daisy_Pomeranian/Daisy_Pomeranian_1.jpg
Breeds/Dog/Pomeranian/Daisy_Pomeranian/Daisy_Pomeranian_2.jpg
Breeds/Dog/Pomeranian/Daisy_Pomeranian/Daisy_Pomeranian_3.jpg
Breeds/Dog/Pomeranian/Milo_Pomeranian/Milo_Pomeranian_1.webp
Breeds/Dog/Pomeranian/Milo_Pomeranian/Milo_Pomeranian_2.webp
Breeds/Dog/Pomeranian/Milo_Pomeranian/Milo_Pomeranian_3.webp
Breeds/Dog/Pomeranian/Rocky_Pomeranian/Rocky_Pomeranian_1.webp
Breeds/Dog/Pomeranian/Rocky_Pomeranian/Rocky_Pomeranian_2.webp
Breeds/Dog/Pomeranian/Rocky_Pomeranian/Rocky_Pomeranian_3.webp
Breeds/Dog/Poodle/Cooper-Poodle-Brown/Cooper_Poodle_1.webp
Breeds/Dog/Poodle/Cooper-Poodle-Brown/Cooper_Poodle_2.webp
Breeds/Dog/Poodle/Cooper-Poodle-Brown/Cooper_Poodle_3.webp
Breeds/Dog/Poodle/Lucy-Poodle-White/Lucy_Poodle_1.webp
Breeds/Dog/Poodle/Lucy-Poodle-White/Lucy_Poodle_2.webp
Breeds/Dog/Poodle/Lucy-Poodle-White/Lucy_Poodle_3.webp
Breeds/Dog/Poodle/Luna-Poodle-Yellow/Luna_Poodle__1.jpg
Breeds/Dog/Poodle/Luna-Poodle-Yellow/Luna_Poodle__2.jpg
Breeds/Dog/Poodle/Luna-Poodle-Yellow/Luna_Poodle__3.jpg
Breeds/Dog/Samoyed/Bear_Samoyed/Bear_Samoyed_1.jpg
Breeds/Dog/Samoyed/Bear_Samoyed/Bear_Samoyed_2.jpg
Breeds/Dog/Samoyed/Bear_Samoyed/Bear_Samoyed_3.jpg
Breeds/Dog/Samoyed/Erin _Samoyed/Erin _Samoyed_1.jpg
Breeds/Dog/Samoyed/Erin _Samoyed/Erin _Samoyed_2.jpg
Breeds/Dog/Samoyed/Erin _Samoyed/Erin _Samoyed_3.jpg
Breeds/Dog/Samoyed/Evan_Samoyed/Evan_Samoyed_1.jpg
Breeds/Dog/Samoyed/Evan_Samoyed/Evan_Samoyed_2.jpg
Breeds/Dog/Samoyed/Evan_Samoyed/Evan_Samoyed_3.jpg
Breeds/Dog/ShibaInu/Duke_ShibaInu/Duke_ShibaInu_1.jpg
Breeds/Dog/ShibaInu/Duke_ShibaInu/Duke_ShibaInu_2.jpg
Breeds/Dog/ShibaInu/Duke_ShibaInu/Duke_ShibaInu_3.jpg
Breeds/Dog/ShibaInu/Ruby_ShibaInu/Ruby_ShibaInu_1.jpg
Breeds/Dog/ShibaInu/Ruby_ShibaInu/Ruby_ShibaInu_2.jpg
Breeds/Dog/ShibaInu/Ruby_ShibaInu/Ruby_ShibaInu_3.jpg
Breeds/Dog/ShibaInu/Simon_ShibaInu/Simon_ShibaInu_1.jpg
Breeds/Dog/ShibaInu/Simon_ShibaInu/Simon_ShibaInu_2.jpg
Breeds/Dog/ShibaInu/Simon_ShibaInu/Simon_ShibaInu_3.jpg
Breeds/Cat/Bengal/Fendi_Bengal/Fendi_Bengal_1.jpg
Breeds/Cat/Bengal/Fendi_Bengal/Fendi_Bengal_2.jpg
Breeds/Cat/Bengal/Fendi_Bengal/Fendi_Bengal_3.jpg
Breeds/Cat/Bengal/Quint_Bengal/Quint_Bengal_1.jpg
Breeds/Cat/Bengal/Quint_Bengal/Quint_Bengal_2.jpg
Breeds/Cat/Bengal/Quint_Bengal/Quint_Bengal_3.jpg
Breeds/Cat/Bengal/Wendy_Bengal/Wendy_Bengal_1.jpg
Breeds/Cat/Bengal/Wendy_Bengal/Wendy_Bengal_2.jpg
Breeds/Cat/Bengal/Wendy_Bengal/Wendy_Bengal_3.jpg
Breeds/Cat/Bristish-Shorthair/Edwin_BS/Edwin_BS_1.webp
Breeds/Cat/Bristish-Shorthair/Edwin_BS/Edwin_BS_2.webp
Breeds/Cat/Bristish-Shorthair/Edwin_BS/Edwin_BS_3.webp
Breeds/Cat/Bristish-Shorthair/Quentin_BS/Quentin_BS_1.webp
Breeds/Cat/Bristish-Shorthair/Quentin_BS/Quentin_BS_2.webp
Breeds/Cat/Bristish-Shorthair/Quentin_BS/Quentin_BS_3.webp
Breeds/Cat/Bristish-Shorthair/Ukki_BS/Ukki_BS_1.webp
Breeds/Cat/Bristish-Shorthair/Ukki_BS/Ukki_BS_2.webp
Breeds/Cat/Bristish-Shorthair/Ukki_BS/Ukki_BS_3.webp
Breeds/Cat/Exotic-Shorthair/Bourbon_Exotic-Shorthair/Bourbon_Exotic Shorthair_1.webp
Breeds/Cat/Exotic-Shorthair/Bourbon_Exotic-Shorthair/Bourbon_Exotic Shorthair_2.webp
Breeds/Cat/Exotic-Shorthair/Bourbon_Exotic-Shorthair/Bourbon_Exotic Shorthair_3.webp
Breeds/Cat/Exotic-Shorthair/Candy_Exotic-Shorthair/Candy_Exotic Shorthair_1.webp
Breeds/Cat/Exotic-Shorthair/Candy_Exotic-Shorthair/Candy_Exotic Shorthair_2.webp
Breeds/Cat/Exotic-Shorthair/Candy_Exotic-Shorthair/Candy_Exotic Shorthair_3.webp
Breeds/Cat/Exotic-Shorthair/Havier_Exotic-Shorthair/Havier_Exotic Shorthair_1.webp
Breeds/Cat/Exotic-Shorthair/Havier_Exotic-Shorthair/Havier_Exotic Shorthair_2.webp
Breeds/Cat/Exotic-Shorthair/Havier_Exotic-Shorthair/Havier_Exotic Shorthair_3.webp
Breeds/Cat/Maine-Coon/Ilyusha_Maine-Coon/Ilyusha_Maine Coon_1.jpg
Breeds/Cat/Maine-Coon/Ilyusha_Maine-Coon/Ilyusha_Maine Coon_2.jpg
Breeds/Cat/Maine-Coon/Ilyusha_Maine-Coon/Ilyusha_Maine Coon_3.jpg
Breeds/Cat/Maine-Coon/Iris_Maine-Coon/Iris_Maine Coon_1.webp
Breeds/Cat/Maine-Coon/Iris_Maine-Coon/Iris_Maine Coon_2.webp
Breeds/Cat/Maine-Coon/Iris_Maine-Coon/Iris_Maine Coon_3.webp
Breeds/Cat/Maine-Coon/Louis_Maine-Coon/Louis_Maine Coon_1.webp
Breeds/Cat/Maine-Coon/Louis_Maine-Coon/Louis_Maine Coon_2.webp
Breeds/Cat/Maine-Coon/Louis_Maine-Coon/Louis_Maine Coon_3.webp
Breeds/Cat/Muchkin/Balu_MK/BALU_MK_1.webp
Breeds/Cat/Muchkin/Balu_MK/BALU_MK_2.webp
Breeds/Cat/Muchkin/Balu_MK/BALU_MK_3.webp
Breeds/Cat/Muchkin/Hugo_MK/Hugo_MK_1.webp
Breeds/Cat/Muchkin/Hugo_MK/Hugo_MK_2.webp
Breeds/Cat/Muchkin/Hugo_MK/Hugo_MK_3.webp
Breeds/Cat/Muchkin/Maya_MK/Maya_MK_1.webp
Breeds/Cat/Muchkin/Maya_MK/Maya_MK_2.webp
Breeds/Cat/Muchkin/Maya_MK/Maya_MK_3.webp
Breeds/Cat/Persian/King_Persian/King_Persian_1.jpg
Breeds/Cat/Persian/King_Persian/King_Persian_2.jpg
Breeds/Cat/Persian/King_Persian/King_Persian_3.jpg
Breeds/Cat/Persian/Ming_Persian/Ming_Persian_1.jpg
Breeds/Cat/Persian/Ming_Persian/Ming_Persian_2.jpg
Breeds/Cat/Persian/Ming_Persian/Ming_Persian_3.jpg
Breeds/Cat/Persian/Xena_Persian/Xena_Persian_1.webp
Breeds/Cat/Persian/Xena_Persian/Xena_Persian_2.webp
Breeds/Cat/Persian/Xena_Persian/Xena_Persian_3.webp
Breeds/Cat/Ragdoll/Tiffany_Ragdoll/Tiffany_Ragdoll_1.webp
Breeds/Cat/Ragdoll/Tiffany_Ragdoll/Tiffany_Ragdoll_2.webp
Breeds/Cat/Ragdoll/Tiffany_Ragdoll/Tiffany_Ragdoll_3.webp
Breeds/Cat/Ragdoll/Tiramisu_Ragdoll/Tiramisu_Ragdoll_1.webp
Breeds/Cat/Ragdoll/Tiramisu_Ragdoll/Tiramisu_Ragdoll_2.webp
Breeds/Cat/Ragdoll/Tiramisu_Ragdoll/Tiramisu_Ragdoll_3.webp
Breeds/Cat/Ragdoll/Yulik_Ragdoll/Yulik_Ragdoll_1.webp
Breeds/Cat/Ragdoll/Yulik_Ragdoll/Yulik_Ragdoll_2.webp
Breeds/Cat/Ragdoll/Yulik_Ragdoll/Yulik_Ragdoll_3.webp
Breeds/Cat/Russian-Blue/EVE_RB/EVE_RB_1.jpg
Breeds/Cat/Russian-Blue/EVE_RB/EVE_RB_2.jpg
Breeds/Cat/Russian-Blue/EVE_RB/EVE_RB_3.jpg
Breeds/Cat/Russian-Blue/Nik_RB/Nik_RB_1.jpg
Breeds/Cat/Russian-Blue/Nik_RB/Nik_RB_2.jpg
Breeds/Cat/Russian-Blue/Nik_RB/Nik_RB_3.jpg
Breeds/Cat/Russian-Blue/Zola_RB/Zola_RB_1.jpg
Breeds/Cat/Russian-Blue/Zola_RB/Zola_RB_2.jpg
Breeds/Cat/Russian-Blue/Zola_RB/Zola_RB_3.jpg
Breeds/Cat/Scottish-Fold/Diego_SF/Diego_SF_1.webp
Breeds/Cat/Scottish-Fold/Diego_SF/Diego_SF_2.webp
Breeds/Cat/Scottish-Fold/Diego_SF/Diego_SF_3.webp
Breeds/Cat/Scottish-Fold/Kent_SF/Kent_SF_1.webp
Breeds/Cat/Scottish-Fold/Kent_SF/Kent_SF_2.webp
Breeds/Cat/Scottish-Fold/Kent_SF/Kent_SF_3.webp
Breeds/Cat/Scottish-Fold/Yara_SF/Yara_SF_1.webp
Breeds/Cat/Scottish-Fold/Yara_SF/Yara_SF_2.webp
Breeds/Cat/Scottish-Fold/Yara_SF/Yara_SF_3.webp
Breeds/Cat/Siamese/Kent_Siamese/Kent_Siamese_1.jpg
Breeds/Cat/Siamese/Kent_Siamese/Kent_Siamese_2.jpg
Breeds/Cat/Siamese/Kent_Siamese/Kent_Siamese_3.jpg
Breeds/Cat/Siamese/Pepper_Siamese/Pepper_Siamese_1.jpg
Breeds/Cat/Siamese/Pepper_Siamese/Pepper_Siamese_2.jpg
Breeds/Cat/Siamese/Pepper_Siamese/Pepper_Siamese_3.jpg
Breeds/Cat/Siamese/Tito_Siamese/Tito_Siamese_1.png
Breeds/Cat/Siamese/Tito_Siamese/Tito_Siamese_2.png
Breeds/Cat/Siamese/Tito_Siamese/Tito_Siamese_3.png
Breeds/Cat/Sphynx/Candy_Sphynx/Candy_Sphynx_1.jpg
Breeds/Cat/Sphynx/Candy_Sphynx/Candy_Sphynx_2.jpg
Breeds/Cat/Sphynx/Candy_Sphynx/Candy_Sphynx_3.jpg
Breeds/Cat/Sphynx/Leo_Sphynx/Leo_Sphynx_1.jpg
Breeds/Cat/Sphynx/Leo_Sphynx/Leo_Sphynx_2.jpg
Breeds/Cat/Sphynx/Leo_Sphynx/Leo_Sphynx_3.jpg
Breeds/Cat/Sphynx/Mindy_Sphynx/Mindy_Sphynx_1.jpg
Breeds/Cat/Sphynx/Mindy_Sphynx/Mindy_Sphynx_2.jpg
Breeds/Cat/Sphynx/Mindy_Sphynx/Mindy_Sphynx_3.jpg
Breeds/Cat/Tabby/Angus_Tabby/Angus_Tabby_1.jpg
Breeds/Cat/Tabby/Angus_Tabby/Angus_Tabby_2.jpg
Breeds/Cat/Tabby/Angus_Tabby/Angus_Tabby_3.jpg
Breeds/Cat/Tabby/Blaire_Tabby/Blaire_Tabby_1.jpeg
Breeds/Cat/Tabby/Blaire_Tabby/Blaire_Tabby_2.jpeg
Breeds/Cat/Tabby/Blaire_Tabby/Blaire_Tabby_3.jpeg
Breeds/Cat/Tabby/Fiyero_Tabby/Fiyero_Tabby_1.jpg
Breeds/Cat/Tabby/Fiyero_Tabby/Fiyero_Tabby_2.jpg
Breeds/Cat/Tabby/Fiyero_Tabby/Fiyero_Tabby_3.jpg
`
  .trim()
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

// ============================================================
// 2. TỪ ĐIỂN SONG NGỮ CHO TỪNG GIỐNG LOÀI
// ============================================================

type Bilingual = { vi: string; en: string };

const BREED_DICT: Record<string, Bilingual> = {
  // Dogs
  "Bac-Ha-Dog": { vi: "Chó Bắc Hà", en: "Bac Ha Dog" },
  Corgi: { vi: "Corgi", en: "Corgi" },
  Dachshund: { vi: "Dachshund (Chó Xúc Xích)", en: "Dachshund" },
  "French-Bulldog": { vi: "Bulldog Pháp", en: "French Bulldog" },
  GermanSheperd: { vi: "Chó Becgie Đức", en: "German Shepherd" },
  "H'Mong-Bobtail": { vi: "Chó Cộc H'Mông", en: "H'Mong Bobtail" },
  Husky: { vi: "Husky Siberia", en: "Siberian Husky" },
  "Phu-Quoc-Ridgeback": { vi: "Chó Xoáy Phú Quốc", en: "Phu Quoc Ridgeback" },
  Pomeranian: { vi: "Phốc Sóc (Pomeranian)", en: "Pomeranian" },
  Poodle: { vi: "Poodle", en: "Poodle" },
  Samoyed: { vi: "Samoyed", en: "Samoyed" },
  ShibaInu: { vi: "Shiba Inu", en: "Shiba Inu" },
  // Cats
  Bengal: { vi: "Mèo Bengal", en: "Bengal" },
  "Bristish-Shorthair": { vi: "Mèo Anh Lông Ngắn", en: "British Shorthair" },
  "Exotic-Shorthair": { vi: "Mèo Ba Tư Lông Ngắn (Exotic)", en: "Exotic Shorthair" },
  "Maine-Coon": { vi: "Mèo Maine Coon", en: "Maine Coon" },
  Muchkin: { vi: "Mèo Munchkin", en: "Munchkin" },
  Persian: { vi: "Mèo Ba Tư", en: "Persian" },
  Ragdoll: { vi: "Mèo Ragdoll", en: "Ragdoll" },
  "Russian-Blue": { vi: "Mèo Nga Lông Xanh", en: "Russian Blue" },
  "Scottish-Fold": { vi: "Mèo Tai Cụp Scotland", en: "Scottish Fold" },
  Siamese: { vi: "Mèo Xiêm (Siamese)", en: "Siamese" },
  Sphynx: { vi: "Mèo Sphynx (Không Lông)", en: "Sphynx" },
  Tabby: { vi: "Mèo Tabby (Mèo Vằn)", en: "Tabby" },
};

const COLOR_OPTIONS: Bilingual[] = [
  { vi: "Vàng trắng", en: "Yellow White" },
  { vi: "Nâu đen", en: "Brown Black" },
  { vi: "Xám tro", en: "Grey" },
  { vi: "Trắng tuyền", en: "Pure White" },
  { vi: "Vàng nâu", en: "Tan" },
  { vi: "Đen tuyền", en: "Solid Black" },
  { vi: "Vằn nâu", en: "Brown Tabby" },
  { vi: "Kem", en: "Cream" },
  { vi: "Vện xám", en: "Grey Brindle" },
  { vi: "Đốm nâu trắng", en: "Brown & White Spotted" },
];

const TRAIT_POOL: Bilingual[] = [
  { vi: "Thân thiện", en: "Friendly" },
  { vi: "Hòa đồng", en: "Sociable" },
  { vi: "Năng động", en: "Active" },
  { vi: "Trung thành", en: "Loyal" },
  { vi: "Thông minh", en: "Intelligent" },
  { vi: "Nhút nhát", en: "Shy" },
  { vi: "Điềm tĩnh", en: "Calm" },
  { vi: "Tinh nghịch", en: "Playful" },
  { vi: "Quấn chủ", en: "Affectionate" },
  { vi: "Độc lập", en: "Independent" },
  { vi: "Cảnh giác", en: "Alert" },
  { vi: "Dễ huấn luyện", en: "Easy to train" },
  { vi: "Tò mò", en: "Curious" },
  { vi: "Ít sủa/kêu", en: "Low-noise" },
];

const GOOD_WITH_POOL: Bilingual[] = [
  { vi: "Trẻ em", en: "Kids" },
  { vi: "Chó khác", en: "Other dogs" },
  { vi: "Mèo khác", en: "Other cats" },
  { vi: "Người lớn tuổi", en: "Seniors" },
];

const BAD_WITH_POOL: Bilingual[] = [
  { vi: "Mèo", en: "Cats" },
  { vi: "Chó", en: "Dogs" },
  { vi: "Vật nuôi nhỏ", en: "Small pets" },
];

const VACCINE_NAMES: Bilingual[] = [
  { vi: "Tiêm phòng dại", en: "Rabies Vaccine" },
  { vi: "Tiêm phòng 5 bệnh", en: "5-in-1 Vaccine" },
  { vi: "Tiêm phòng 7 bệnh", en: "7-in-1 Vaccine" },
];

const DEWORMING_NAMES: Bilingual[] = [
  { vi: "Tẩy giun định kỳ", en: "Routine Deworming" },
  { vi: "Tẩy giun sán toàn diện", en: "Comprehensive Deworming" },
];

const CHECKUP_NAMES: Bilingual[] = [
  { vi: "Khám sức khỏe tổng quát", en: "General Health Checkup" },
  { vi: "Kiểm tra sức khỏe định kỳ", en: "Routine Health Screening" },
];

const SPAY_NEUTER_NAMES: Bilingual[] = [
  { vi: "Triệt sản", en: "Spay/Neuter Surgery" },
];

const BOOSTER_NAME: Bilingual = { vi: "Tái chủng ngừa", en: "Booster Shot" };

// Danh sách nhân viên trạm cứu hộ dùng làm người liên hệ, tạo cảm giác đa dạng hơn là hard-code 1 tên.
const CONTACT_NAMES = [
  "Trạm Cứu Hộ PawLife",
  "Chị Hương - PawLife Shelter",
  "Anh Minh - PawLife Rescue",
  "Chị Lan - Tình nguyện viên PawLife",
  "Anh Đức - Quản lý trạm PawLife",
  "Chị Ngọc - PawLife Foster Care",
];

// ============================================================
// 3. HỒ SƠ GIỐNG LOÀI (kích thước, cân nặng, mức năng lượng thực tế)
// ============================================================

type EnergyLevel = "low" | "medium" | "high";

interface BreedProfile {
  sizeOptions: PetSize[];
  weightMin: number;
  weightMax: number;
  energy: EnergyLevel;
}

const BREED_PROFILE: Record<string, BreedProfile> = {
  // Dogs
  "Bac-Ha-Dog": { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 15, weightMax: 25, energy: "medium" },
  Corgi: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 10, weightMax: 14, energy: "medium" },
  Dachshund: { sizeOptions: [PetSize.SMALL], weightMin: 6, weightMax: 10, energy: "medium" },
  "French-Bulldog": { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 8, weightMax: 13, energy: "low" },
  GermanSheperd: { sizeOptions: [PetSize.LARGE], weightMin: 25, weightMax: 40, energy: "high" },
  "H'Mong-Bobtail": { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 15, weightMax: 25, energy: "high" },
  Husky: { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 16, weightMax: 27, energy: "high" },
  "Phu-Quoc-Ridgeback": { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 18, weightMax: 25, energy: "high" },
  Pomeranian: { sizeOptions: [PetSize.SMALL], weightMin: 1.8, weightMax: 3.5, energy: "medium" },
  Poodle: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 4, weightMax: 15, energy: "medium" },
  Samoyed: { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 16, weightMax: 30, energy: "medium" },
  ShibaInu: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 8, weightMax: 11, energy: "medium" },
  // Cats
  Bengal: { sizeOptions: [PetSize.MEDIUM], weightMin: 3.5, weightMax: 6.5, energy: "high" },
  "Bristish-Shorthair": { sizeOptions: [PetSize.MEDIUM], weightMin: 3.5, weightMax: 7, energy: "low" },
  "Exotic-Shorthair": { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 6, energy: "low" },
  "Maine-Coon": { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 4.5, weightMax: 8.5, energy: "medium" },
  Muchkin: { sizeOptions: [PetSize.SMALL], weightMin: 2.5, weightMax: 4, energy: "medium" },
  Persian: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 5.5, energy: "low" },
  Ragdoll: { sizeOptions: [PetSize.MEDIUM, PetSize.LARGE], weightMin: 4, weightMax: 9, energy: "low" },
  "Russian-Blue": { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 5.5, energy: "medium" },
  "Scottish-Fold": { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 6, energy: "low" },
  Siamese: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 2.5, weightMax: 5, energy: "high" },
  Sphynx: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 5, energy: "high" },
  Tabby: { sizeOptions: [PetSize.SMALL, PetSize.MEDIUM], weightMin: 3, weightMax: 6, energy: "medium" },
};

// ============================================================
// 4. HÀM TIỆN ÍCH NGẪU NHIÊN
// ============================================================

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function randomBool(probabilityTrue: number): boolean {
  return Math.random() < probabilityTrue;
}

function randomDateBetweenYearsAgo(minYearsAgo: number, maxYearsAgo: number): Date {
  const now = Date.now();
  const minMs = minYearsAgo * 365 * 24 * 60 * 60 * 1000;
  const maxMs = maxYearsAgo * 365 * 24 * 60 * 60 * 1000;
  const offset = randomInt(minMs, maxMs);
  return new Date(now - offset);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function weightedRandomStatus(): PetStatus {
  // Đa số AVAILABLE, ít PENDING/ADOPTED để dữ liệu đa dạng.
  const roll = Math.random();
  if (roll < 0.75) return PetStatus.AVAILABLE;
  if (roll < 0.9) return PetStatus.PENDING;
  return PetStatus.ADOPTED;
}

// ============================================================
// 5. BỘ SINH NỘI DUNG SONG NGỮ THỰC TẾ (description / idealHome)
// ============================================================

interface ContentContext {
  name: string;
  isDog: boolean;
  isMale: boolean;
  breedVi: string;
  breedEn: string;
  energy: EnergyLevel;
  trait1: Bilingual;
  trait2: Bilingual;
  goodWith: Bilingual[];
  badWith: Bilingual[];
}

// Mỗi fragment trả về 1 câu hoàn chỉnh (có dấu chấm), song ngữ đồng bộ theo cùng ngữ cảnh.
type Fragment = (ctx: ContentContext) => Bilingual;

const ORIGIN_FRAGMENTS: Fragment[] = [
  (c) => ({
    vi: `${c.name} được đội cứu hộ tìm thấy khi đang lang thang một mình ngoài đường và được đưa về trạm để chăm sóc.`,
    en: `${c.name} was found wandering alone on the street and was brought to the shelter for care.`,
  }),
  (c) => ({
    vi: `${c.name} được chủ cũ gửi đến trạm vì hoàn cảnh gia đình thay đổi và không thể tiếp tục chăm sóc.`,
    en: `${c.name} was surrendered by a previous owner whose family circumstances changed, making it impossible to continue caring for ${c.isMale ? "him" : "her"}.`,
  }),
  (c) => ({
    vi: `${c.name} sinh ra tại trạm cứu hộ và đã được chăm sóc, tiêm phòng đầy đủ ngay từ nhỏ.`,
    en: `${c.name} was born at the shelter and has received full care and vaccinations since birth.`,
  }),
  (c) => ({
    vi: `${c.name} được một người tốt bụng phát hiện và giải cứu khi còn rất nhỏ, sau đó được đưa về trạm để tìm một mái ấm mới.`,
    en: `${c.name} was rescued as a young pet by a kind passerby and brought to the shelter to look for a new home.`,
  }),
  (c) => ({
    vi: `${c.name} từng sống lang thang một thời gian dài trước khi được tình nguyện viên của trạm đưa về chăm sóc và phục hồi sức khỏe.`,
    en: `${c.name} lived as a stray for a long time before a shelter volunteer brought ${c.isMale ? "him" : "her"} in for care and recovery.`,
  }),
];

const PERSONALITY_FRAGMENTS: Fragment[] = [
  (c) => ({
    vi: `Là một bé ${c.breedVi.toLowerCase()} điển hình, ${c.name} rất ${c.trait1.vi.toLowerCase()} và ${c.trait2.vi.toLowerCase()}.`,
    en: `As a typical ${c.breedEn}, ${c.name} is ${c.trait1.en.toLowerCase()} and ${c.trait2.en.toLowerCase()}.`,
  }),
  (c) => ({
    vi: `${c.name} mang đậm nét tính cách của giống ${c.breedVi.toLowerCase()}: ${c.trait1.vi.toLowerCase()}, đồng thời cũng khá ${c.trait2.vi.toLowerCase()}.`,
    en: `${c.name} carries the classic ${c.breedEn} temperament: ${c.trait1.en.toLowerCase()}, while also being quite ${c.trait2.en.toLowerCase()}.`,
  }),
  (c) => ({
    vi: `Ai từng tiếp xúc với ${c.name} đều nhận xét bé ${c.trait1.vi.toLowerCase()} và ${c.trait2.vi.toLowerCase()} hơn hẳn những bé cùng lứa.`,
    en: `Everyone who has met ${c.name} agrees ${c.isMale ? "he" : "she"} is more ${c.trait1.en.toLowerCase()} and ${c.trait2.en.toLowerCase()} than most littermates.`,
  }),
];

const DOG_HABIT_FRAGMENTS: Fragment[] = [
  (c) => ({
    vi: `${c.name} thích đi dạo mỗi buổi chiều và luôn vẫy đuôi mừng rỡ mỗi khi có người ghé thăm.`,
    en: `${c.name} loves afternoon walks and always wags happily whenever visitors come by.`,
  }),
  (c) => ({
    vi: `${c.name} rất mê chơi bóng và có thể chơi cả buổi mà không biết mệt.`,
    en: `${c.name} is obsessed with ball games and can play for hours without getting tired.`,
  }),
  (c) => ({
    vi: `${c.name} ngủ khá nhiều vào buổi trưa nhưng lại tràn đầy năng lượng vào mỗi buổi chiều tối.`,
    en: `${c.name} naps a lot around noon but becomes full of energy every evening.`,
  }),
  (c) => ({
    vi: `${c.name} có thói quen canh cửa và sủa báo hiệu mỗi khi nghe thấy tiếng động lạ.`,
    en: `${c.name} has a habit of guarding the door and barking to alert whenever there's an unfamiliar noise.`,
  }),
  (c) => ({
    vi: `${c.name} rất thích được vuốt ve và có thể nằm im hàng giờ bên cạnh người mình yêu quý.`,
    en: `${c.name} loves being petted and can lie still for hours next to someone ${c.isMale ? "he" : "she"} trusts.`,
  }),
];

const CAT_HABIT_FRAGMENTS: Fragment[] = [
  (c) => ({
    vi: `${c.name} thích nằm cuộn tròn bên cửa sổ để đón nắng vào mỗi buổi sáng.`,
    en: `${c.name} loves curling up by a sunny window every morning.`,
  }),
  (c) => ({
    vi: `${c.name} rất mê các loại đồ chơi có lông vũ và có thể đuổi theo quả bóng lăn suốt cả ngày.`,
    en: `${c.name} is obsessed with feather toys and can chase a rolling ball all day long.`,
  }),
  (c) => ({
    vi: `${c.name} có thói quen nhào chăn (kneading) mỗi khi chuẩn bị đi ngủ, một dấu hiệu cho thấy bé đang rất thoải mái.`,
    en: `${c.name} kneads blankets before falling asleep, a sign of true contentment.`,
  }),
  (c) => ({
    vi: `${c.name} thích trốn trong hộp giấy hoặc túi giấy bất cứ khi nào tìm thấy chúng trong nhà.`,
    en: `${c.name} loves hiding in cardboard boxes or paper bags whenever ${c.isMale ? "he" : "she"} finds one around the house.`,
  }),
  (c) => ({
    vi: `${c.name} khá kén ăn nhưng lại rất thích được chải lông mỗi ngày.`,
    en: `${c.name} can be a picky eater but really enjoys a daily brushing session.`,
  }),
];

const SOCIAL_FRAGMENTS: Fragment[] = [
  (c) =>
    c.badWith.length
      ? {
          vi: `${c.name} hòa đồng tốt với ${c.goodWith.map((g) => g.vi.toLowerCase()).join(" và ")}, nhưng cần thêm thời gian làm quen trước khi gặp ${c.badWith.map((b) => b.vi.toLowerCase()).join(" và ")}.`,
          en: `${c.name} gets along well with ${c.goodWith.map((g) => g.en.toLowerCase()).join(" and ")}, but needs a proper introduction period before meeting ${c.badWith.map((b) => b.en.toLowerCase()).join(" and ")}.`,
        }
      : {
          vi: `${c.name} hòa đồng tốt với ${c.goodWith.map((g) => g.vi.toLowerCase()).join(" và ")} và hầu như không kén chọn bạn chơi.`,
          en: `${c.name} gets along well with ${c.goodWith.map((g) => g.en.toLowerCase()).join(" and ")} and is generally easygoing with new companions.`,
        },
];

const CLOSING_FRAGMENTS: Fragment[] = [
  (c) => ({
    vi: `Hiện tại, ${c.name} đang chờ được một gia đình yêu thương nhận nuôi để bắt đầu một cuộc sống hạnh phúc hơn.`,
    en: `Right now, ${c.name} is waiting for a loving family to give ${c.isMale ? "him" : "her"} a fresh start to a happier life.`,
  }),
  (c) => ({
    vi: `${c.name} rất mong chờ được gặp gỡ và trở thành một thành viên mới trong ngôi nhà của bạn.`,
    en: `${c.name} is eager to meet you and become the newest member of your household.`,
  }),
  (c) => ({
    vi: `Nếu bạn đang tìm một người bạn đồng hành trung thành, ${c.name} chính là một lựa chọn đáng để cân nhắc.`,
    en: `If you're looking for a loyal companion, ${c.name} could be a wonderful match for your family.`,
  }),
];

function buildDescription(ctx: ContentContext): Bilingual {
  const origin = randomItem(ORIGIN_FRAGMENTS)(ctx);
  const personality = randomItem(PERSONALITY_FRAGMENTS)(ctx);
  const habitPool = ctx.isDog ? DOG_HABIT_FRAGMENTS : CAT_HABIT_FRAGMENTS;
  const habit = randomItem(habitPool)(ctx);
  const social = randomItem(SOCIAL_FRAGMENTS)(ctx);
  const closing = randomItem(CLOSING_FRAGMENTS)(ctx);

  return {
    vi: [origin.vi, personality.vi, habit.vi, social.vi, closing.vi].join(" "),
    en: [origin.en, personality.en, habit.en, social.en, closing.en].join(" "),
  };
}

const IDEAL_HOME_SPACE_FRAGMENTS: Record<EnergyLevel, Fragment> = {
  high: (c) => ({
    vi: `Phù hợp với gia đình có sân vườn rộng rãi hoặc thường xuyên có thời gian đưa bé ra ngoài vận động, chạy nhảy để giải phóng năng lượng.`,
    en: `Best suited for a family with a spacious yard, or owners who can regularly take ${c.name} out for exercise and playtime.`,
  }),
  medium: (c) => ({
    vi: `Phù hợp với nhà có không gian vừa phải và có thể duy trì thói quen đi dạo, vui chơi cùng bé mỗi ngày.`,
    en: `Suited for a home with moderate space where owners can keep up a daily routine of walks and play with ${c.name}.`,
  }),
  low: (c) => ({
    vi: `Phù hợp với căn hộ hoặc nhà có diện tích nhỏ, không đòi hỏi quá nhiều không gian vận động.`,
    en: `Well suited for an apartment or smaller home, as ${c.name} doesn't require much exercise space.`,
  }),
};

function buildIdealHome(ctx: ContentContext): Bilingual {
  const spaceFragment = IDEAL_HOME_SPACE_FRAGMENTS[ctx.energy](ctx);

  const companionFragment: Bilingual = ctx.badWith.length
    ? {
        vi: `Gia đình có ${ctx.goodWith.map((g) => g.vi.toLowerCase()).join(" hoặc ")} sẽ là môi trường lý tưởng, tuy nhiên nên hạn chế nuôi chung với ${ctx.badWith.map((b) => b.vi.toLowerCase()).join(" hoặc ")} trong giai đoạn đầu.`,
        en: `A household with ${ctx.goodWith.map((g) => g.en.toLowerCase()).join(" or ")} would be ideal, though it's best to avoid pairing with ${ctx.badWith.map((b) => b.en.toLowerCase()).join(" or ")} early on.`,
      }
    : {
        vi: `Gia đình có ${ctx.goodWith.map((g) => g.vi.toLowerCase()).join(" hoặc ")} sẽ là môi trường rất lý tưởng cho bé.`,
        en: `A household with ${ctx.goodWith.map((g) => g.en.toLowerCase()).join(" or ")} would make an ideal environment.`,
      };

  const commitmentFragment: Bilingual = {
    vi: `Người nhận nuôi cần sẵn sàng dành thời gian chăm sóc lâu dài và đưa bé đi khám thú y định kỳ.`,
    en: `Adopters should be ready to commit to long-term care and regular veterinary check-ups.`,
  };

  return {
    vi: [spaceFragment.vi, companionFragment.vi, commitmentFragment.vi].join(" "),
    en: [spaceFragment.en, companionFragment.en, commitmentFragment.en].join(" "),
  };
}

// ============================================================
// 6. PARSE DANH SÁCH ẢNH -> GOM NHÓM THEO TỪNG PET
// ============================================================

interface ParsedPet {
  species: "Dog" | "Cat";
  breedFolder: string;
  petFolder: string;
  petName: string;
  images: string[]; // relative paths
}

function parseImagePaths(paths: string[]): ParsedPet[] {
  const map = new Map<string, ParsedPet>();

  for (const relPath of paths) {
    const parts = relPath.split("/");
    // parts: ["Breeds", "Dog"|"Cat", breedFolder, petFolder, filename]
    if (parts.length !== 5) continue;
    const [, species, breedFolder, petFolder] = parts;
    const key = `${species}/${breedFolder}/${petFolder}`;

    if (!map.has(key)) {
      // Tên pet = phần trước dấu "_" đầu tiên của tên thư mục, viết hoa chữ cái đầu.
      const rawName = petFolder.split("_")[0].trim();
      const petName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      map.set(key, {
        species: species as "Dog" | "Cat",
        breedFolder,
        petFolder,
        petName,
        images: [],
      });
    }
    map.get(key)!.images.push(relPath);
  }

  return Array.from(map.values());
}

// ============================================================
// 7. SINH DỮ LIỆU PET TỪ 1 PARSED PET + 1 SHELTER NGẪU NHIÊN
// ============================================================

function buildMedicalRecords(dob: Date, isSpayedNeutered: boolean) {
  const records: Array<{
    type: string;
    recordName: Bilingual;
    recordDate: Date;
    hasNextDueDate?: boolean;
    nextDueDate?: Date;
    nextDueName?: Bilingual;
    verificationStatus: VerificationStatus;
  }> = [];

  // Vaccine đầu đời (luôn có), một phần có lịch tái chủng sắp tới.
  const vaccineDate = randomDateBetweenYearsAgo(0.1, 1.5);
  const hasBooster = randomBool(0.4);
  records.push({
    type: "Vaccine",
    recordName: randomItem(VACCINE_NAMES),
    recordDate: vaccineDate,
    hasNextDueDate: hasBooster,
    nextDueDate: hasBooster ? addDays(new Date(), randomInt(30, 180)) : undefined,
    nextDueName: hasBooster ? BOOSTER_NAME : undefined,
    verificationStatus: VerificationStatus.VERIFIED,
  });

  // Tẩy giun (thường xuyên, xác suất cao).
  if (randomBool(0.8)) {
    records.push({
      type: "Deworming",
      recordName: randomItem(DEWORMING_NAMES),
      recordDate: randomDateBetweenYearsAgo(0.05, 1),
      verificationStatus: VerificationStatus.VERIFIED,
    });
  }

  // Khám sức khỏe tổng quát.
  if (randomBool(0.5)) {
    records.push({
      type: "Checkup",
      recordName: randomItem(CHECKUP_NAMES),
      recordDate: randomDateBetweenYearsAgo(0.1, 1),
      verificationStatus: randomBool(0.85) ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
    });
  }

  // Triệt sản, chỉ thêm record nếu isSpayedNeutered = true.
  if (isSpayedNeutered) {
    records.push({
      type: "Surgery",
      recordName: SPAY_NEUTER_NAMES[0],
      recordDate: randomDateBetweenYearsAgo(0.2, 3),
      verificationStatus: VerificationStatus.VERIFIED,
    });
  }

  return records;
}

function buildPetCreateData(parsed: ParsedPet, shelterId: string) {
  const isDog = parsed.species === "Dog";
  const breed = BREED_DICT[parsed.breedFolder] || {
    vi: parsed.breedFolder,
    en: parsed.breedFolder,
  };
  const profile: BreedProfile = BREED_PROFILE[parsed.breedFolder] || {
    sizeOptions: [PetSize.MEDIUM],
    weightMin: isDog ? 8 : 3,
    weightMax: isDog ? 20 : 6,
    energy: "medium",
  };
  const speciesJson: Bilingual = isDog
    ? { vi: "Chó", en: "Dog" }
    : { vi: "Mèo", en: "Cat" };

  const color = randomItem(COLOR_OPTIONS);
  const gender = randomItem([PetGender.MALE, PetGender.FEMALE]);
  const size = randomItem(profile.sizeOptions);
  const weight = randomFloat(profile.weightMin, profile.weightMax, 1);
  const dob = randomDateBetweenYearsAgo(0.5, 7);
  const isVaccinated = randomBool(0.85);
  const isSpayedNeutered = randomBool(0.6);
  const status = weightedRandomStatus();

  const goodWith = randomItems(GOOD_WITH_POOL, randomInt(1, 2));
  const badWith = randomItems(
    BAD_WITH_POOL.filter((b) => !goodWith.some((g) => g.en === b.en)),
    randomInt(0, 1)
  );
  const traits = randomItems(TRAIT_POOL, randomInt(2, 3));
  const personalityTags = traits.map((t) => t.en);

  const ctx: ContentContext = {
    name: parsed.petName,
    isDog,
    isMale: gender === PetGender.MALE,
    breedVi: breed.vi,
    breedEn: breed.en,
    energy: profile.energy,
    trait1: traits[0],
    trait2: traits[1] || traits[0],
    goodWith,
    badWith,
  };

  const description = buildDescription(ctx);
  const idealHome = buildIdealHome(ctx);

  const images = parsed.images.map((relPath) => ({
    url: `${IMAGE_BASE_URL}/${encodeURI(relPath)}`,
  }));

  return {
    name: parsed.petName,
    species: speciesJson,
    breed,
    color,
    description,
    idealHome,
    goodWith: goodWith.length
      ? { vi: goodWith.map((g) => g.vi), en: goodWith.map((g) => g.en) }
      : undefined,
    badWith: badWith.length
      ? { vi: badWith.map((b) => b.vi), en: badWith.map((b) => b.en) }
      : undefined,
    personalityTags,
    // Lưu thêm bản sao traits dạng JSON trực tiếp trên Pet để tiện tìm kiếm/filter,
    // song song với relation traitsList bên dưới.
    traits: traits.length ? { vi: traits.map((t) => t.vi), en: traits.map((t) => t.en) } : undefined,

    dob,
    gender,
    size,
    weight,
    status,

    isVaccinated,
    isSpayedNeutered,
    microchipNumber: String(randomInt(900000000000000, 999999999999999)),

    contactName: randomItem(CONTACT_NAMES),
    contactPhone: `09${randomInt(10000000, 99999999)}`,
    shelterId,
    vetVerificationStatus: randomBool(0.9) ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,

    idSetByShelter: `${parsed.species}-${parsed.breedFolder}-${parsed.petFolder}`,

    images: { create: images },

    medicalRecords: {
      create: buildMedicalRecords(dob, isSpayedNeutered),
    },

    traitsList: {
      create: traits.map((t) => ({ name: t })),
    },

    tags: {
      create: [{ status: TagStatus.ACTIVE, linkedAt: new Date() }],
    },
  };
}

// ============================================================
// 8. MAIN
// ============================================================

async function ensureShelters(): Promise<{ id: string }[]> {
  const existing = await prisma.shelter.findMany({ select: { id: true } });
  if (existing.length > 0) return existing;

  console.log("⚠️  Không tìm thấy Shelter nào, đang tạo 3 shelter mẫu...");
  const defaults = [
    {
      name: "Trạm Cứu Hộ PawLife Hà Nội",
      address: "Nam Từ Liêm, Hà Nội",
      contactInfo: "0999123456",
      isVerified: true,
    },
    {
      name: "Trạm Cứu Hộ PawLife Sài Gòn",
      address: "Quận 7, TP. Hồ Chí Minh",
      contactInfo: "0999123457",
      isVerified: true,
    },
    {
      name: "Mái Ấm Thú Cưng Đà Nẵng",
      address: "Hải Châu, Đà Nẵng",
      contactInfo: "0999123458",
      isVerified: false,
    },
  ];

  const created = [];
  for (const s of defaults) {
    created.push(await prisma.shelter.create({ data: s }));
  }
  return created;
}

async function main() {
  console.log("🌱 Bắt đầu seed Pet từ dữ liệu ảnh...");

  if (RESET_PETS_BEFORE_SEED) {
    console.log("🧹 Xoá dữ liệu Pet cũ (cascade)...");
    await prisma.pet.deleteMany({});
  }

  const shelters = await ensureShelters();
  console.log(`🏠 Có ${shelters.length} shelter khả dụng để gán ngẫu nhiên.`);

  const parsedPets = parseImagePaths(RAW_IMAGE_PATHS);
  console.log(`🐾 Tìm thấy ${parsedPets.length} pet cần seed.`);

  let count = 0;
  for (const parsed of parsedPets) {
    const shelter = randomItem(shelters);
    const data = buildPetCreateData(parsed, shelter.id);

    try {
      await prisma.pet.create({ data });
      count++;
      console.log(`  ✅ [${count}/${parsedPets.length}] ${parsed.petName} (${parsed.breedFolder}) -> shelter ${shelter.id}`);
    } catch (err) {
      console.error(`  ❌ Lỗi khi tạo pet ${parsed.petName} (${parsed.breedFolder}):`, err);
    }
  }

  console.log(`🎉 Hoàn tất! Đã seed ${count}/${parsedPets.length} pet.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });