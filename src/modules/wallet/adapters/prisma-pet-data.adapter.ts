// src/modules/wallet/adapters/prisma-pet-data.adapter.ts
//
// Adapter nối port PetDataProvider vào DB hiện tại qua Prisma.
// ĐÂY LÀ NƠI DUY NHẤT trong module Wallet được phép chạm tới prisma.pet và
// '@prisma/client'. Khi nào tách Wallet ra service riêng, chỉ cần thay file
// này bằng HttpPetDataAdapter (gọi REST API của BE lõi) là xong — không đụng
// tới wallet.service hay wallet.controller.

import { Injectable } from '@nestjs/common';
import { PetGender } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  PetDataProvider,
  PetWalletData,
  WalletPetGender,
} from '../ports/pet-data.port';

@Injectable()
export class PrismaPetDataAdapter implements PetDataProvider {
  constructor(private readonly prisma: PrismaService) { }

  async getPetForWallet(petId: string, lang: 'vi' | 'en'): Promise<PetWalletData | null> {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        dob: true,
        gender: true,
        microchipNumber: true,
        ownerId: true,
        shelterId: true,
        qrCodeUrl: true,
        // Ảnh đầu tiên làm avatar tròn trên thẻ
        images: {
          select: { url: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!pet) return null;

    // Map sang domain của Wallet: làm phẳng images[] → photoUrl, đổi PetGender
    // của Prisma sang WalletPetGender để service không phụ thuộc '@prisma/client'.
    return {
      id: pet.id,
      name: pet.name,
      species: this.resolveBilingualText(pet.species, lang),
      breed: this.resolveBilingualText(pet.breed, lang),
      dob: pet.dob,
      gender: this.mapGender(pet.gender),
      microchipNumber: pet.microchipNumber,
      ownerId: pet.ownerId,
      shelterId: pet.shelterId,
      qrCodeUrl: pet.qrCodeUrl,     
      photoUrl: pet.images[0]?.url ?? null,
    };
  }
  private resolveBilingualText(field: unknown, lang: 'vi' | 'en'): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field !== null) {
      const obj = field as Record<string, unknown>;
      return String(obj[lang] ?? obj.en ?? obj.vi ?? '');
    }
    return String(field);
  }

  // Map tường minh từng giá trị: nếu BE đổi/ thêm enum PetGender thì TypeScript
  // báo lỗi ngay tại đây thay vì để giá trị lạ lọt xuống mặt thẻ.
  private mapGender(gender: PetGender | null): WalletPetGender | null {
    if (!gender) return null;
    switch (gender) {
      case PetGender.MALE:
        return 'MALE';
      case PetGender.FEMALE:
        return 'FEMALE';
      default:
        return 'UNKNOWN';
    }
  }
}
