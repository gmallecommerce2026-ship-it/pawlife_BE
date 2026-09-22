"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPets = seedPets;
const client_1 = require("@prisma/client");
const client_s3_1 = require("@aws-sdk/client-s3");
const xlsx = __importStar(require("xlsx"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const prisma = new client_1.PrismaClient();
const s3Client = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev';
function parseAgeToDob(ageStr) {
    if (!ageStr)
        return null;
    const str = String(ageStr).toLowerCase().trim();
    const now = new Date();
    const matchNum = str.match(/(\d+)/);
    if (!matchNum)
        return null;
    const num = parseInt(matchNum[1], 10);
    if (str.includes('tuổi') || str.includes('năm')) {
        now.setFullYear(now.getFullYear() - num);
        return now;
    }
    if (str.includes('tháng')) {
        now.setMonth(now.getMonth() - num);
        return now;
    }
    return null;
}
function parseGender(genderStr) {
    const str = String(genderStr || '').toLowerCase().trim();
    if (str === 'đực')
        return client_1.PetGender.MALE;
    if (str === 'cái')
        return client_1.PetGender.FEMALE;
    return client_1.PetGender.UNKNOWN;
}
function parseStatus(statusStr) {
    const str = String(statusStr || '').toLowerCase().trim();
    if (str.includes('đã được nhận nuôi'))
        return client_1.PetStatus.ADOPTED;
    return client_1.PetStatus.AVAILABLE;
}
async function getLocalImagesAndUpload(petId) {
    const safeId = String(petId || '').trim();
    if (!safeId)
        return [{ url: 'https://loremflickr.com/400/400/dog' }];
    const folderPath = path.join(process.cwd(), 'prisma/data/images', safeId);
    console.log(`\n🔍 Đang xử lý và UPLOAD ảnh cho ID: ${safeId}`);
    let results = [];
    try {
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            for (const file of files) {
                if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    const filePath = path.join(folderPath, file);
                    const fileBuffer = fs.readFileSync(filePath);
                    const r2Key = `pet-images/${safeId}/${file}`;
                    let contentType = 'image/jpeg';
                    if (file.toLowerCase().endsWith('.png'))
                        contentType = 'image/png';
                    else if (file.toLowerCase().endsWith('.webp'))
                        contentType = 'image/webp';
                    else if (file.toLowerCase().endsWith('.gif'))
                        contentType = 'image/gif';
                    await s3Client.send(new client_s3_1.PutObjectCommand({
                        Bucket: bucketName,
                        Key: r2Key,
                        Body: fileBuffer,
                        ContentType: contentType
                    }));
                    const imageUrl = `${publicDomain}/${r2Key}`;
                    results.push({ url: imageUrl });
                    process.stdout.write(' ⬆️(Đã up) ');
                }
            }
        }
    }
    catch (error) {
        console.log(`\n⚠️ Lỗi upload ảnh của ${safeId} lên R2: ${error}`);
    }
    if (results.length === 0) {
        results.push({ url: 'https://loremflickr.com/400/400/dog' });
    }
    return results;
}
const shelterCache = new Map();
async function getOrCreateShelter(khuName) {
    if (!khuName)
        return null;
    const name = String(khuName).trim();
    if (shelterCache.has(name))
        return shelterCache.get(name);
    let shelter = await prisma.shelter.findFirst({ where: { name } });
    if (!shelter) {
        shelter = await prisma.shelter.create({
            data: {
                name: name,
                address: 'Đang cập nhật',
                contactInfo: '0999999999',
                description: 'Trạm cứu hộ tự động',
                policy: 'Liên hệ trực tiếp để nhận nuôi.',
                avatarUrl: 'https://loremflickr.com/200/200/house',
                latitude: 21.028511,
                longitude: 105.804817,
            }
        });
    }
    shelterCache.set(name, shelter.id);
    return shelter.id;
}
async function processBatch(batch) {
    for (const row of batch) {
        const rawId = row['ID'] || row['ID '] || row[' ID'];
        const fallbackId = String(row['Ảnh'] || '').split('.')[0].trim();
        const petId = rawId ? String(rawId).trim() : fallbackId;
        const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || petId || 'Bé Không Tên';
        const loaiStr = String(row['Loài'] || row['Giống'] || '').toLowerCase();
        const speciesType = loaiStr.includes('mèo') ? 'CAT' : 'DOG';
        try {
            const status = parseStatus(row['Tình trạng']);
            const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
            const shelterId = await getOrCreateShelter(row['Khu']);
            const imagesData = await getLocalImagesAndUpload(petId);
            await prisma.pet.create({
                data: {
                    name: String(name),
                    species: speciesType,
                    breed: String(row['Giống'] || 'Chưa rõ'),
                    dob: parseAgeToDob(row['Độ tuổi']),
                    color: String(row['Màu lông'] || 'Đang cập nhật'),
                    gender: parseGender(row['Giới tính']),
                    size: client_1.PetSize.MEDIUM,
                    isSpayedNeutered: String(row['Triệt sản'] || '').toLowerCase().includes('đã triệt sản'),
                    isVaccinated: String(row['Tiêm phòng'] || '').toLowerCase().includes('đã tiêm đủ'),
                    status,
                    vetVerificationStatus: 'VERIFIED',
                    description,
                    shelterId,
                    images: { create: imagesData }
                }
            });
            process.stdout.write(`✅ ${name} | `);
        }
        catch (error) {
            console.log(`\n❌ [LỖI DB - Tên: ${name}]: ${error.message}`);
        }
    }
}
async function seedPets() {
    console.log('Bắt đầu dọn dẹp dữ liệu cũ (Xóa Database)...');
    await prisma.eventImage.deleteMany();
    await prisma.eventInterest.deleteMany();
    await prisma.event.deleteMany();
    await prisma.tagReport.deleteMany();
    await prisma.tag.updateMany({ where: { petId: { not: null } }, data: { petId: null } });
    await prisma.tag.deleteMany();
    await prisma.transferRequest.deleteMany();
    await prisma.adoptionApplication.deleteMany();
    await prisma.adoptionRequest.deleteMany();
    await prisma.petInteraction.deleteMany();
    await prisma.favoritePet.deleteMany();
    await prisma.petImage.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.followedShelter.deleteMany();
    await prisma.shelter.deleteMany();
    console.log('Đã xóa xong dữ liệu cũ!');
    const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');
    if (!fs.existsSync(excelPath)) {
        console.error(`❌ Không tìm thấy file Excel tại: ${excelPath}`);
        return;
    }
    console.log(`\n⏳ Đang nạp file Excel...`);
    let workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const allRecords = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        raw: false,
        defval: ''
    });
    workbook = null;
    if (global.gc) {
        global.gc();
    }
    const limitRecords = allRecords.slice(0, 15);
    console.log(`✅ Sẽ tiến hành seed đúng ${limitRecords.length} bé đầu tiên!`);
    await processBatch(limitRecords);
    console.log(`\n🎉 HOÀN TẤT! Đã upload ảnh lên R2 và seed thành công.`);
}
seedPets()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error('\n❌ Tiến trình seed thất bại:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed-pets.js.map