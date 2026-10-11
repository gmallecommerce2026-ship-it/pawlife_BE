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
import type { PetDataProvider, WalletPetGender, WalletPetTag } from './ports/pet-data.port';

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
  private toDisplayCode(sourceId: string): string {
    return `${sourceId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }
  private cardBgCache: string | null = null;

  // Đọc backgroundColor từ pass.json trong template → strip luôn trùng màu thẻ
  private getCardBackground(): string {
    if (this.cardBgCache) return this.cardBgCache;
    let hex = '#E89B5A'; // dự phòng nếu không đọc được
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(this.templatePath, 'pass.json'), 'utf8'),
      );
      const bg: string | undefined = raw.backgroundColor;
      const m = bg?.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (m) {
        hex =
          '#' +
          [m[1], m[2], m[3]]
            .map(n => Number(n).toString(16).padStart(2, '0'))
            .join('');
      } else if (bg && /^#[0-9a-f]{6}$/i.test(bg)) {
        hex = bg;
      }
    } catch (error) {
      console.warn('⚠️ Không đọc được backgroundColor, dùng màu mặc định');
    }
    this.cardBgCache = hex;
    return hex;
  }
  private async buildQrStrip(
    tagId: string,
    photoUrl: string | null,
  ): Promise<{ x1: Buffer; x2: Buffer; x3: Buffer }> {
    const base =
      this.configService.get<string>('R2_PUBLIC_URL') ??
      'https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev';

    const fetchBuf = async (url: string) =>
      Buffer.from(
        (await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 3000 })).data,
      );

    const [qrSrc, avatarSrc] = await Promise.all([
      fetchBuf(`${base}/qr-codes/${tagId}.png`),
      photoUrl ? fetchBuf(photoUrl).catch(() => null) : Promise.resolve(null),
    ]);

    const bg = this.getCardBackground();

    const make = async (s: number): Promise<Buffer> => {
      const W = 375 * s, H = 144 * s;
      const PAD = 20 * s;
      const AV = 124 * s;                // avatar to
      const RING = 4 * s;
      const TILE = 100 * s;              // ô QR nhỏ hơn avatar
      const TILE_R = 14 * s;
      const INNER = TILE - 12 * s;

      // --- Ô trắng bo góc chứa QR ---
      const qr = await sharp(qrSrc)
        .flatten({ background: '#ffffff' })
        .resize(INNER, INNER, { fit: 'contain', background: '#ffffff', kernel: 'nearest' })
        .png()
        .toBuffer();

      const tileMask = Buffer.from(
        `<svg width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" rx="${TILE_R}" ry="${TILE_R}"/></svg>`,
      );
      const tile = await sharp({
        create: { width: TILE, height: TILE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      })
        .composite([
          { input: qr, gravity: 'center' },
          { input: tileMask, blend: 'dest-in' },
        ])
        .png()
        .toBuffer();

      const layers: sharp.OverlayOptions[] = [
        { input: tile, left: W - PAD - TILE, top: Math.round((H - TILE) / 2) },
      ];

      // --- Avatar tròn có viền trắng, nằm thẳng trên nền cam ---
      if (avatarSrc) {
        const inner = AV - 2 * RING;
        const innerMask = Buffer.from(
          `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}"/></svg>`,
        );
        const avatarImg = await sharp(avatarSrc)
          .resize(inner, inner, { fit: 'cover' })
          .composite([{ input: innerMask, blend: 'dest-in' }])
          .png()
          .toBuffer();

        const ringBase = Buffer.from(
          `<svg width="${AV}" height="${AV}"><circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}" fill="#ffffff"/></svg>`,
        );
        const avatar = await sharp(ringBase)
          .composite([{ input: avatarImg, gravity: 'center' }])
          .png()
          .toBuffer();

        layers.push({ input: avatar, left: PAD, top: Math.round((H - AV) / 2) });
      }

      // Nền strip = đúng màu card
      return sharp({ create: { width: W, height: H, channels: 3, background: bg } })
        .composite(layers)
        .png()
        .toBuffer();
    };

    return { x1: await make(1), x2: await make(2), x3: await make(3) };
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
  private getActiveTagId(tags: WalletPetTag[] | undefined): string | null {
    if (!tags || tags.length === 0) return null;
    const activeTag = tags.find(t => t.status === 'ACTIVE') ?? tags[0];
    return activeTag.id;
  }
  private getActiveTag(tags: WalletPetTag[] | undefined): WalletPetTag | null {
    if (!tags || tags.length === 0) return null;
    return tags.find(t => t.status === 'ACTIVE') ?? tags[0];
  }

  // Trộn màu hex với màu khác theo tỉ lệ (0 = giữ nguyên, 1 = thành màu kia)
  private mixHex(hex: string, withHex: string, ratio: number): string {
    const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const a = p(hex), b = p(withHex);
    return (
      '#' +
      a
        .map((v, i) => Math.round(v + (b[i] - v) * ratio).toString(16).padStart(2, '0'))
        .join('')
    );
  }

  // Ảnh nền gradient: nửa trên đúng màu card (liền mạch với strip), nửa dưới nhạt dần
  private async buildBackground(): Promise<{ x1: Buffer; x2: Buffer; x3: Buffer }> {
    const top = this.getCardBackground();
    const bottom = this.mixHex(top, '#FFFFFF', 0.75);

    const make = (s: number): Promise<Buffer> => {
      const W = 180 * s, H = 220 * s;
      const svg =
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${top}"/>` +
        `<stop offset="50%" stop-color="${top}"/>` +
        `<stop offset="100%" stop-color="${bottom}"/>` +
        `</linearGradient></defs>` +
        `<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;
      return sharp(Buffer.from(svg)).png().toBuffer();
    };

    return { x1: await make(1), x2: await make(2), x3: await make(3) };
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
    const activeTag = this.getActiveTag(pet.tags);
    const displayCode = this.toDisplayCode(activeTag?.id ?? pet.id);

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
          // Serial ổn định theo pet.id: Wallet định danh thẻ bằng cặp
          // (passTypeIdentifier, serialNumber) nên tải lại thẻ của cùng một bé
          // sẽ GHI ĐÈ thẻ cũ thay vì tạo thêm bản trùng. Đây cũng là điều kiện
          // để FE hỏi hasPass(passTypeId, pet.id) → quyết định nút View hay Add.
          serialNumber: pet.id,
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
      const FIGURE_BASE = 10;
      // Spacer cuối PHẢI giống nhau tuyệt đối giữa mọi label cùng cột, không được lệch số lượng
      const TRAILING_SPACER = '\u2009\u2009\u2009\u200B';

      // petCode luôn dùng FIGURE_BASE làm chuẩn tham chiếu
      const petCodeLabel = t.pawLifeId + '\u2007'.repeat(FIGURE_BASE) + TRAILING_SPACER;

      // dob: bù trừ theo đúng số ký tự chênh lệch so với label petCode (không đoán mò theo ngôn ngữ nữa)
      const lengthDiff = t.pawLifeId.length - t.dob.length; // vi: 10-9=+1 | en: 10-13=-3
      const dobFigureCount = Math.max(FIGURE_BASE + lengthDiff, 0); // vi: 11 | en: 7
      const dobLabel = t.dob + '\u2007'.repeat(dobFigureCount) + TRAILING_SPACER;


      pass.headerFields.push({
        key: 'docType',
        value: t.docType,
        textAlignment: 'PKTextAlignmentRight',
      });

      // Hàng 1: tên | mã
      pass.secondaryFields.push(
        { key: 'petName', label: t.name, value: pet.name },
        { key: 'petCode', label: t.pawLifeId, value: displayCode, textAlignment: 'PKTextAlignmentRight' },
      );

      // Hàng 2: giống · giới tính | ngày sinh  (tổng đúng 4 field)
      const breedText = pet.breed ?? pet.species;
      const genderText = this.toGenderText(pet.gender, lang);
      pass.auxiliaryFields.push(
        {
          key: 'breedGender',
          label: isVi ? 'Giống · Giới tính' : 'Breed · Gender',
          value: genderText === '—' ? breedText : `${breedText} · ${genderText}`,
        },
        {
          key: 'dob',
          label: t.dob,
          value: this.toDobText(pet.dob),
          textAlignment: 'PKTextAlignmentRight',
        },
      );
      if (pet.microchipNumber) {
        pass.auxiliaryFields.push({
          key: 'microchipFront',
          label: t.microchip,
          value: pet.microchipNumber,
          textAlignment: 'PKTextAlignmentRight',
          row: 1,
        });
      }

      // (Phần Avatar và BackFields giữ nguyên format cũ, chỉ thay text t.*)
      // const photoUrl = pet.photoUrl;
      // if (photoUrl) {
      //   try {
      //     const thumb = await this.buildCircleThumbnails(photoUrl);
      //     pass.addBuffer('thumbnail.png', thumb.x1);
      //     pass.addBuffer('thumbnail@2x.png', thumb.x2);
      //     pass.addBuffer('thumbnail@3x.png', thumb.x3);
      //   } catch (error) {
      //     console.warn('⚠️ Skipping thumbnail...', error instanceof Error ? error.message : error);
      //   }
      // }
      if (activeTag) {
        try {
          const strip = await this.buildQrStrip(activeTag.id, pet.photoUrl);
          pass.addBuffer('strip.png', strip.x1);
          pass.addBuffer('strip@2x.png', strip.x2);
          pass.addBuffer('strip@3x.png', strip.x3);
        } catch (error) {
          console.warn('⚠️ Skipping QR strip...', error instanceof Error ? error.message : error);
        }
      }
      try {
        const bgImg = await this.buildBackground();
        pass.addBuffer('background.png', bgImg.x1);
        pass.addBuffer('background@2x.png', bgImg.x2);
        pass.addBuffer('background@3x.png', bgImg.x3);
      } catch (error) {
        console.warn('⚠️ Skipping background...', error instanceof Error ? error.message : error);
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

      // ✅ SỬA: trước đây dùng pet.qrCodeUrl (field tĩnh, không đồng bộ khi
      // user Replace/Transfer tag) → giờ lấy đúng tag ACTIVE giống FE


      const qrValue = activeTag?.qrPayload ?? activeTag?.id ?? profileUrl;

      // pass.setBarcodes({
      //   message: qrValue,
      //   format: 'PKBarcodeFormatQR',
      //   messageEncoding: 'iso-8859-1',
      //   altText: displayCode,
      // });


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