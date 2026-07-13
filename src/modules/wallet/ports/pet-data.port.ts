// src/modules/wallet/ports/pet-data.port.ts
//
// wallet.service được phép phụ thuộc. Service KHÔNG biết dữ liệu đến từ Prisma,
// từ HTTP API hay từ mock test. Muốn tách Wallet thành service riêng sau này
// thì chỉ cần viết adapter mới cài đặt interface này — code service giữ nguyên.

// Giới tính dạng domain RIÊNG của Wallet — cố tình KHÔNG import PetGender từ
// '@prisma/client' để module không dính kiểu của BE lõi.
export type WalletPetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export interface WalletPetTag {
  id: string;
  status: 'ACTIVE' | 'LOST' | 'INACTIVE';
}

// Đúng-và-đủ dữ liệu Wallet cần để in lên thẻ. Đã làm phẳng (vd ảnh đầu tiên
// thành photoUrl) nên service không phải hiểu cấu trúc bảng/quan hệ của BE.
export interface PetWalletData {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  dob: Date | null;
  gender: WalletPetGender | null;
  microchipNumber: string | null;
  ownerId: string | null;
  shelterId: string | null;
  qrCodeUrl: string | null; 
  tags: WalletPetTag[]; 
  // URL ảnh đại diện (ảnh đầu tiên của pet) — null nếu pet chưa có ảnh
  photoUrl: string | null;
}

export interface PetDataProvider {
  getPetForWallet(petId: string, lang: 'vi' | 'en'): Promise<PetWalletData | null>;
}

// Token DI cho NestJS: interface biến mất sau khi compile nên cần một token
// runtime để inject. wallet.module dùng token này để bind adapter cụ thể.
export const PET_DATA_PROVIDER = Symbol('PET_DATA_PROVIDER');
