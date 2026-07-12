// src/modules/wallet/wallet.service.ts
import {
  Injectable,
  Inject,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PKPass } from 'passkit-generator';
import axios from 'axios';
import sharp from 'sharp';
import Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
// DEPENDS ONLY on the port (data contract) — knows nothing about Prisma/Core BE.
// PET_DATA_PROVIDER is a Symbol (runtime value) → regular import for @Inject() to use.
import { PET_DATA_PROVIDER } from './ports/pet-data.port';
// Interfaces/types used in decorated constructor → must 'import type'
// (isolatedModules + emitDecoratorMetadata), otherwise TS1272 error will occur.
import type { PetDataProvider, WalletPetGender } from './ports/pet-data.port';

// Pass signing certificates — read from disk once and cached in RAM
interface WalletCertificates {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  // Set only when signerKey.pem is encrypted — passkit-generator FORBIDS empty strings
  signerKeyPassphrase?: string;
}

@Injectable()
export class WalletService {
  private certificates: WalletCertificates | null = null;

  // Template located next to build file: dist/modules/wallet/templates/pawlife.pass
  // (nest-cli.json declared assets to copy this folder during build)
  private readonly templatePath = path.join(
    __dirname,
    'templates',
    'pawlife.pass',
  );

  constructor(
    // Inject via token because PetDataProvider is an interface (lost after compilation).
    // NestJS will plug PrismaPetDataAdapter here (see wallet.module.ts).
    @Inject(PET_DATA_PROVIDER)
    private readonly petData: PetDataProvider,
    private readonly configService: ConfigService,
  ) { }

  // Display ID on card: PL-XXXXXXXX (first 8 chars of UUID, uppercase)
  // DO NOT display full UUID because 36 chars will be cut off on the card face — full UUID is on the back
  private toDisplayCode(petId: string): string {
    return `PL-${petId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  // Bilingual short gender (matches label style "Gender" on card)
  private toGenderText(gender: WalletPetGender | null, lang: 'vi' | 'en'): string {
    if (lang === 'vi') {
      switch (gender) {
        case 'MALE':
          return 'Đực';
        case 'FEMALE':
          return 'Cái';
        default:
          return '—';
      }
    }
    switch (gender) {
      case 'MALE':
        return 'Male';
      case 'FEMALE':
        return 'Female';
      default:
        return '—';
    }
  }

  // DoB formatted as dd/mm/yyyy — fetched in UTC because Prisma stores UTC DateTime,
  // preventing shift to the previous day when server runs in different timezones
  private toDobText(dob: Date | null): string {
    if (!dob) return '—';
    const day = String(dob.getUTCDate()).padStart(2, '0');
    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${dob.getUTCFullYear()}`;
  }

  // Download pet avatar from R2 and crop to circle (transparent PNG)
  // → iOS only slightly rounds thumbnail corners, if we want circular avatar like an ID card, image must be pre-rounded
  // Returns 3 resolutions per Apple standard: 90pt (@1x), 180px (@2x), 270px (@3x)
  private async buildCircleThumbnails(photoUrl: string): Promise<{ x1: Buffer; x2: Buffer; x3: Buffer }> {
    const response = await axios.get<ArrayBuffer>(photoUrl, {
      responseType: 'arraybuffer',
      timeout: 3000, // Reduce to 3s to avoid Load Balancer timeout
    });

    const buffer = Buffer.from(response.data);

    // Create circular SVG mask
    const circleSvg = Buffer.from('<svg><circle cx="135" cy="135" r="135" /></svg>');

    const x3 = await sharp(buffer)
      .resize(270, 270, { fit: 'cover' })
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const x2 = await sharp(x3).resize(180, 180).toBuffer();
    const x1 = await sharp(x3).resize(90, 90).toBuffer();

    return { x1, x2, x3 };
  }

  // Load certificates from certs/ folder (configured via WALLET_CERTS_DIR env, default ./certs)
  private loadCertificates(): WalletCertificates {
    if (this.certificates) return this.certificates;

    const certsDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('WALLET_CERTS_DIR') ?? 'certs',
    );

    // PawLife's signerKey.pem is encrypted → missing passphrase causes signing to fail,
    // but we still let it pass to support unencrypted key scenarios (e.g.: dev environment)
    const passphrase = this.configService.get<string>('WALLET_CERT_PASSPHRASE');

    try {
      this.certificates = {
        wwdr: fs.readFileSync(path.join(certsDir, 'wwdr.pem')),
        signerCert: fs.readFileSync(path.join(certsDir, 'signerCert.pem')),
        signerKey: fs.readFileSync(path.join(certsDir, 'signerKey.pem')),
        ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
      };
      console.log('✅ Apple Wallet certificates loaded from:', certsDir);
      return this.certificates;
    } catch (error) {
      console.error('❌ Failed to read Apple Wallet certificates:', error);
      throw new InternalServerErrorException(
        'System has not configured Apple Wallet certificates!',
      );
    }
  }

  // Generate .pkpass (Static Pass) for a pet — returns buffer for controller to stream to client
  async generatePetPass(
    userId: string,
    petId: string,
    lang: 'vi' | 'en' = 'en',
  ): Promise<{ buffer: Buffer; fileName: string }> {
    // 1. Get pet info (Giữ nguyên)
    const pet = await this.petData.getPetForWallet(petId, lang);
    if (!pet) throw new NotFoundException('Pet not found!');
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException(
        'You do not have permission to perform actions on this pet!',
      );
    }

    // 2. Prepare dynamic data (Giữ nguyên)
    const displayCode = this.toDisplayCode(pet.id);
    const profileBaseUrl =
      this.configService.get<string>('WALLET_PROFILE_BASE_URL') ??
      'https://pawlife.vn/profile';
    const profileUrl = `${profileBaseUrl}/${pet.id}`;

    // --- CẤU HÌNH ĐA NGÔN NGỮ CHO THẺ ---
    const isVi = lang === 'vi';
    const t = {
      docType: isVi ? 'Thẻ ID Thú Cưng' : 'Digital Pet ID',
      name: isVi ? 'Tên' : 'Name',
      breed: isVi ? 'Giống' : 'Breed',
      gender: isVi ? 'Giới tính' : 'Gender',
      pawLifeId: isVi ? 'Mã PawLife' : 'PawLife ID',
      dob: isVi ? 'Ngày sinh' : 'Date of Birth',
      fullId: isVi ? 'Mã đầy đủ' : 'Full Pet ID',
      profilePage: isVi ? 'Trang hồ sơ' : 'Profile Page',
      microchip: isVi ? 'Số Microchip' : 'Microchip Number',
      guideLabel: isVi ? 'Hướng dẫn' : 'Instructions',
      guideValue: isVi
        ? 'Quét mã QR trên thẻ để xem hồ sơ thú cưng. Nếu bạn tìm thấy bé, vui lòng liên hệ với chủ nuôi qua trang hồ sơ.'
        : 'Scan the QR code on the card to view the pet profile. If you found this pet, please contact the owner via the profile page.'
    };

    // 3. Generate pass from template + digitally sign
    try {
      const pass = await PKPass.from(
        {
          model: this.templatePath,
          certificates: this.loadCertificates(),
        },
        {
          serialNumber: `${pet.id}_${Math.floor(Date.now() / 1000)}`,
          passTypeIdentifier:
            this.configService.get<string>('WALLET_PASS_TYPE_IDENTIFIER') ??
            'pass.com.pawlife.petid',
          teamIdentifier:
            this.configService.get<string>('WALLET_TEAM_IDENTIFIER') ??
            'ZSUSA4XQ95',
        },
      );

      // Label padding trick:
      // - "PawLife ID" (10 chars) và "Mã PawLife" (10 chars) -> Dùng chung padding
      // - "Date of Birth" (13 chars) và "Ngày sinh" (9 chars) -> Bản Tiếng Việt cần nhiều padding hơn một chút để cân bằng
      const petCodeLabel = t.pawLifeId + '\u2007'.repeat(10) + '\u2009\u2009\u2009\u200B';
      const dobPadding = isVi ? '\u2007'.repeat(10) : '\u2007'.repeat(6);
      const dobLabel = t.dob + dobPadding + '\u2009\u2009\u2009\u2009\u200B';

      pass.headerFields.push({
        key: 'docType',
        value: t.docType,
      });

      pass.primaryFields.push({
        key: 'petName',
        label: t.name,
        value: pet.name,
      });

      pass.secondaryFields.push(
        {
          key: 'breed',
          label: t.breed,
          value: pet.breed ?? pet.species,
        },
        {
          key: 'petCode',
          label: petCodeLabel,
          value: displayCode,
          textAlignment: 'PKTextAlignmentLeft',
        },
      );

      pass.auxiliaryFields.push(
        {
          key: 'gender',
          label: t.gender,
          value: this.toGenderText(pet.gender, lang), // Truyền lang vào đây
        },
        {
          key: 'dob',
          label: dobLabel,
          value: this.toDobText(pet.dob),
          textAlignment: 'PKTextAlignmentLeft',
        },
      );

      // (Phần Avatar và BackFields giữ nguyên format cũ, chỉ thay text t.*)
      const photoUrl = pet.photoUrl;
      if (photoUrl) {
        try {
          const thumb = await this.buildCircleThumbnails(photoUrl);
          pass.addBuffer('thumbnail.png', thumb.x1);
          pass.addBuffer('thumbnail@2x.png', thumb.x2);
          pass.addBuffer('thumbnail@3x.png', thumb.x3);
        } catch (error) {
          console.warn('⚠️ Skipping thumbnail...', error instanceof Error ? error.message : error);
        }
      }

      // Back of card
      pass.backFields.push(
        { key: 'fullId', label: t.fullId, value: pet.id },
        { key: 'profile', label: t.profilePage, value: profileUrl },
      );
      if (pet.microchipNumber) {
        pass.backFields.push({
          key: 'microchip',
          label: t.microchip,
          value: pet.microchipNumber,
        });
      }
      pass.backFields.push({
        key: 'guide',
        label: t.guideLabel,
        value: t.guideValue,
      });

      pass.setBarcodes({
        message: profileUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      });

      return {
        buffer: pass.getAsBuffer(),
        fileName: `pawlife-${displayCode}.pkpass`,
      };
    } catch (error) {
      console.error('❌ Error generating Apple Wallet card:', error);
      throw new InternalServerErrorException(
        'Cannot generate Apple Wallet card, please try again later!',
      );
    }
  }
}