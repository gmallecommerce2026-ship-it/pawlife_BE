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
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const SOURCE_EMAIL = 'hello@pawlife.vn';
    const TARGET_EMAIL = 'sannhanhieucho@gmail.com';
    const TARGET_PASSWORD = 'Sannhanhieucho@2026';
    console.log(`🚀 Bắt đầu nhân bản dữ liệu từ [${SOURCE_EMAIL}] sang [${TARGET_EMAIL}]...`);
    const existingTargetUser = await prisma.user.findUnique({
        where: { email: TARGET_EMAIL },
    });
    if (existingTargetUser) {
        console.log(`⚠️ User [${TARGET_EMAIL}] đã tồn tại trong DB. Vui lòng xóa trước hoặc chọn email khác!`);
        return;
    }
    const sourceUser = await prisma.user.findUnique({
        where: { email: SOURCE_EMAIL }
    });
    if (!sourceUser) {
        console.error(`❌ Không tìm thấy user gốc với email: ${SOURCE_EMAIL}`);
        return;
    }
    const hashedPassword = await bcrypt.hash(TARGET_PASSWORD, 10);
    const { id, createdAt, updatedAt, email, password, phone, ...baseUserData } = sourceUser;
    const newPhone = phone ? `${phone.slice(0, -2)}99` : null;
    const newUser = await prisma.user.create({
        data: {
            ...baseUserData,
            email: TARGET_EMAIL,
            password: hashedPassword,
            phone: newPhone,
        }
    });
    console.log(`✨ Đã tạo thành công User mới: ${newUser.id}`);
    const sourcePets = await prisma.pet.findMany({
        where: { ownerId: sourceUser.id }
    });
    let petsCount = 0;
    for (const pet of sourcePets) {
        const { id, createdAt, updatedAt, ownerId, ...petData } = pet;
        await prisma.pet.create({
            data: {
                ...petData,
                ownerId: newUser.id
            }
        });
        petsCount++;
    }
    console.log(`   👉 Đã copy ${petsCount} bé thú cưng`);
    const sourceApps = await prisma.adoptionApplication.findMany({
        where: { userId: sourceUser.id }
    });
    let appsCount = 0;
    for (const app of sourceApps) {
        const { id, createdAt, updatedAt, userId, ...appData } = app;
        await prisma.adoptionApplication.create({
            data: {
                ...appData,
                userId: newUser.id
            }
        });
        appsCount++;
    }
    console.log(`   👉 Đã copy ${appsCount} đơn nhận nuôi`);
    console.log(`✅ HOÀN TẤT QUÁ TRÌNH NHÂN BẢN!`);
}
main()
    .catch((e) => {
    console.error("❌ Có lỗi xảy ra trong quá trình seed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=cloneUser.js.map