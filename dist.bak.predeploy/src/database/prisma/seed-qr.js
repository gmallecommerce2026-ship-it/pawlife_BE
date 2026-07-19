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
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const prisma = new client_1.PrismaClient();
const s3Client = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: 'https://c9d5f5eea00514a9996556bae3e098d8.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: 'abd4d87e215fef71990e437e5e60a714',
        secretAccessKey: '4a21a869e74605e6506d7357c6ee9b1cff2b23a2df88e831129acebbab20d4fa',
    },
});
const BUCKET_NAME = 'pawcare';
async function main() {
    console.log('🚀 Bắt đầu quá trình đồng bộ 10,000 mã QR lên R2 và DB...');
    const qrFolderPath = path.join(process.cwd(), 'src/database/QR_Codes');
    let files = [];
    try {
        files = fs.readdirSync(qrFolderPath).filter(f => f.endsWith('.svg'));
    }
    catch (error) {
        console.error('❌ Lỗi khi đọc thư mục QR:', error.message);
        return;
    }
    console.log(`📦 Tìm thấy ${files.length} file SVG. Bắt đầu xử lý...`);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        const tagId = fileName.replace('.svg', '').trim();
        const filePath = path.join(qrFolderPath, fileName);
        try {
            const fileContent = fs.readFileSync(filePath);
            await s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: `qr-codes/${fileName}`,
                Body: fileContent,
                ContentType: 'image/svg+xml',
                ACL: 'public-read',
            }));
            await prisma.tag.upsert({
                where: { id: tagId },
                update: { status: 'INACTIVE' },
                create: {
                    id: tagId,
                    status: 'INACTIVE',
                },
            });
            successCount++;
            if (successCount % 100 === 0) {
                console.log(`✅ Đã xong: ${successCount}/${files.length} mã.`);
            }
        }
        catch (err) {
            console.error(`⚠️ Lỗi tại file ${fileName}:`, err.message);
        }
    }
    console.log(`\n🎉 HOÀN TẤT!`);
    console.log(`- Tổng số file xử lý: ${successCount}`);
    console.log(`- Địa chỉ Public: https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev/qr-codes/{tagId}.svg`);
}
main()
    .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-qr.js.map