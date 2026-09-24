import { PrismaClient, Role, ShelterStaffRole } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs'; // Cần cài đặt thêm: npm i bcryptjs & npm i -D @types/bcryptjs

dotenv.config();

const prisma = new PrismaClient();

// Thiết lập R2 Client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

// Hàm hỗ trợ upload ảnh lên R2
async function uploadLocalFileToR2(fileName: string, contentType: string) {
  const filePath = path.join(process.cwd(), 'prisma', 'data', 'images', fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`✅ Đã upload ${fileName} lên Cloudflare R2`);

    return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error(`❌ Lỗi upload ${fileName} lên R2:`, error);
    return null;
  }
}

// ============================================================
// DỮ LIỆU SEED — SHELTER & SHELTER ADMIN USER
// Mật khẩu mặc định cho tất cả tài khoản: Pawlife@2026
// ============================================================

interface ShelterSeedData {
  // Thông tin User (Admin của trạm)
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  
  // Thông tin Shelter
  shelterName: string;
  address: string;
  contactInfo: string;
  description: string;
  lat: number;
  lng: number;
  
  // File ảnh lưu trong prisma/data/images/
  avatarFileName: string;
  coverFileName: string;
}

const shelterAccountsData: ShelterSeedData[] = [
  {
    adminName: 'Phúc Lê',
    adminEmail: 'phuc.le@havepaws.org',
    adminPhone: '0912345678',
    
    shelterName: 'havepaws',
    address: 'Hà Nội',
    contactInfo: '0912345678',
    description: 'Trạm cứu hộ chó mèo Hà Nội. Nơi cưu mang và tìm mái ấm mới cho các bé chó mèo bị bỏ rơi, bạo hành hoặc đi lạc.',
    lat: 21.036237,
    lng: 105.790583,
    
    // Bạn nhớ chuẩn bị 2 file ảnh này trong thư mục prisma/data/images/
    // hoặc đổi tên lại cho khớp với file bạn đang có
    avatarFileName: 'havepaws-avatar.png',
    coverFileName: 'havepaws-cover.png',
  }
];

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu Shelter & Admin User...');

  // Mã hóa mật khẩu chung cho tất cả các tài khoản được seed
  const DEFAULT_PASSWORD = 'Pawlife@2026';
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const data of shelterAccountsData) {
    console.log(`\n--- Đang xử lý Trạm: [${data.shelterName}] ---`);

    // 1. Upload ảnh avatar + cover lên R2
    const avatarUrl = await uploadLocalFileToR2(data.avatarFileName, 'image/png');
    const coverUrl = await uploadLocalFileToR2(data.coverFileName, 'image/png');

    // 2. Tạo hoặc Cập nhật bảng Shelter
    // Chú ý: Bảng Shelter hiện không có trường unique nào rõ ràng ngoài ID, 
    // nên ta có thể check theo tên trước để tránh tạo trùng khi chạy seed nhiều lần.
    let shelter = await prisma.shelter.findFirst({
      where: { name: data.shelterName }
    });

    if (shelter) {
      shelter = await prisma.shelter.update({
        where: { id: shelter.id },
        data: {
          address: data.address,
          contactInfo: data.contactInfo,
          emailAddress: data.adminEmail,
          description: data.description,
          latitude: data.lat,
          longitude: data.lng,
          isVerified: true, // Auto verify cho data seed
          ...(avatarUrl && { avatarUrl }),
          ...(coverUrl && { coverUrl }),
        }
      });
      console.log(`♻️ Đã cập nhật Shelter: ${shelter.name}`);
    } else {
      shelter = await prisma.shelter.create({
        data: {
          name: data.shelterName,
          address: data.address,
          contactInfo: data.contactInfo,
          emailAddress: data.adminEmail,
          description: data.description,
          latitude: data.lat,
          longitude: data.lng,
          isVerified: true,
          verifiedAt: new Date(),
          avatarUrl: avatarUrl || undefined,
          coverUrl: coverUrl || undefined,
        }
      });
      console.log(`✅ Đã tạo mới Shelter: ${shelter.name}`);
    }

    // 3. Upsert bảng User (Tài khoản đăng nhập)
    // Liên kết với Shelter vừa tạo thông qua trường `shelterId`
    const user = await prisma.user.upsert({
      where: { email: data.adminEmail },
      update: {
        name: data.adminName,
        phone: data.adminPhone,
        role: Role.SHELTER, // Enum từ Prisma
        shelterRole: ShelterStaffRole.ADMIN, // Enum từ Prisma
        shelterId: shelter.id,
        avatarUrl: avatarUrl || undefined,
      },
      create: {
        email: data.adminEmail,
        password: hashedPassword, // Lưu mật khẩu đã mã hóa
        name: data.adminName,
        phone: data.adminPhone,
        role: Role.SHELTER,
        shelterRole: ShelterStaffRole.ADMIN,
        shelterId: shelter.id, // Liên kết quan trọng nhất
        avatarUrl: avatarUrl || undefined,
      },
    });

    console.log(`👤 Đã cấu hình tài khoản Admin: ${user.email} (Mật khẩu: ${DEFAULT_PASSWORD})`);
  }

  console.log('\n🎉 Hoàn tất seed dữ liệu Shelter & Admin User!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });