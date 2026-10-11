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
import * as opentype from 'opentype.js';
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
    const raw = sourceId.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `PL-${raw}`;
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
  // Dấu chân (SVG, không phụ thuộc font)
  private pawSvg(cx: number, cy: number, r: number, fill: string, opacity: number): string {
    const e = (x: number, y: number, rx: number, ry: number) =>
      `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" fill-opacity="${opacity}"/>`;
    return (
      e(cx, cy + r * 0.25, r * 0.55, r * 0.45) +
      e(cx - r * 0.65, cy - r * 0.15, r * 0.2, r * 0.27) +
      e(cx - r * 0.22, cy - r * 0.6, r * 0.2, r * 0.27) +
      e(cx + r * 0.22, cy - r * 0.6, r * 0.2, r * 0.27) +
      e(cx + r * 0.65, cy - r * 0.15, r * 0.2, r * 0.27)
    );
  }
  private fonts: { bold: opentype.Font; medium: opentype.Font } | null = null;

  private getFonts() {
    if (this.fonts) return this.fonts;
    const load = (file: string): opentype.Font => {
      const b = fs.readFileSync(path.join(__dirname, 'assets', 'fonts', file));
      return opentype.parse(
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      );
    };
    this.fonts = {
      bold: load('BeVietnamPro-Bold.ttf'),
      medium: load('BeVietnamPro-Medium.ttf'),
    };
    return this.fonts;
  }

  // Chữ → <path> vector. Tự thu nhỏ cho vừa maxWidth, vẫn dài quá thì cắt bằng "…"
  private textPath(
    font: opentype.Font,
    text: string,
    x: number,
    baseline: number,
    size: number,
    minSize: number,
    maxWidth: number,
    fill: string,
  ): string {
    let sz = size;
    while (sz > minSize && font.getAdvanceWidth(text, sz) > maxWidth) sz -= 1;
    let t = text;
    if (font.getAdvanceWidth(t, sz) > maxWidth) {
      while (t.length > 1 && font.getAdvanceWidth(t + '…', sz) > maxWidth) {
        t = t.slice(0, -1);
      }
      t = t.trimEnd() + '…';
    }
    const d = font.getPath(t, x, baseline, sz).toPathData(2);
    return `<path d="${d}" fill="${fill}"/>`;
  }
  // Strip hero: nền trùng màu thẻ + họa tiết mờ + avatar tròn lớn bên phải.
  // Bên trái để trống cho primary field (tên pet) đè lên.
  private async buildHeroStrip(
    photoUrl: string | null,
    title: string,
    subtitle: string,
  ): Promise<{ x1: Buffer; x2: Buffer; x3: Buffer }> {
    const avatarSrc = photoUrl
      ? await axios
        .get<ArrayBuffer>(photoUrl, { responseType: 'arraybuffer', timeout: 3000 })
        .then(r => Buffer.from(r.data))
        .catch(() => null)
      : null;

    const bg = this.getCardBackground();
    const deep = this.mixHex(bg, '#C2662B', 0.25);
    const light = this.mixHex(bg, '#FFFFFF', 0.45);
    const { bold, medium } = this.getFonts();

    // ===== Chỉnh nhanh tại đây (đơn vị pt, ở @1x) =====
    const TEXT_COLOR = '#E89B5A';
    const TITLE_SIZE = 40, TITLE_MIN = 24;
    const SUB_SIZE = 15, SUB_MIN = 11;
    const TITLE_BASELINE = 70;
    const SUB_BASELINE = 100;      // tăng số này để giống·giới tính cách tên xa hơn
    const LEFT = 22, GAP_TO_AVATAR = 16;
    // ===================================================

    const make = async (s: number): Promise<Buffer> => {
      const W = 375 * s, H = 144 * s;
      const AV = 118 * s;
      const RING = 5 * s;
      const PAD = 22 * s;
      const cx = W - PAD - AV / 2;
      const cy = H / 2;
      const textMaxW = cx - AV / 2 - GAP_TO_AVATAR * s - LEFT * s;

      const decor = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feGaussianBlur stdDeviation="${5 * s}"/></filter></defs>` +
        `<circle cx="${W * 0.55}" cy="${cy}" r="${H * 0.95}" fill="${light}" fill-opacity="0.35"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${AV * 0.82}" fill="#ffffff" fill-opacity="0.22"/>` +
        // dấu chân đặt tránh vùng chữ
        this.pawSvg(W * 0.06, H * 0.9, 12 * s, deep, 0.16) +
        this.pawSvg(W * 0.4, H * 0.9, 14 * s, deep, 0.14) +
        this.pawSvg(W * 0.56, H * 0.14, 10 * s, deep, 0.14) +
        `<circle cx="${cx}" cy="${cy + 4 * s}" r="${AV / 2}" fill="#000" fill-opacity="0.22" filter="url(#b)"/>` +
        `</svg>`,
      );

      const textLayer = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
        this.textPath(bold, title, LEFT * s, TITLE_BASELINE * s, TITLE_SIZE * s, TITLE_MIN * s, textMaxW, TEXT_COLOR) +
        this.textPath(medium, subtitle, LEFT * s, SUB_BASELINE * s, SUB_SIZE * s, SUB_MIN * s, textMaxW, TEXT_COLOR) +
        `</svg>`,
      );

      const layers: sharp.OverlayOptions[] = [
        { input: decor, left: 0, top: 0 },
        { input: textLayer, left: 0, top: 0 },
      ];

      const ringBase = Buffer.from(
        `<svg width="${AV}" height="${AV}"><circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}" fill="#ffffff"/></svg>`,
      );

      let avatarLayer: Buffer;
      if (avatarSrc) {
        const inner = AV - 2 * RING;
        const mask = Buffer.from(
          `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}"/></svg>`,
        );
        const img = await sharp(avatarSrc)
          .resize(inner, inner, { fit: 'cover' })
          .composite([{ input: mask, blend: 'dest-in' }])
          .png()
          .toBuffer();
        avatarLayer = await sharp(ringBase)
          .composite([{ input: img, gravity: 'center' }])
          .png()
          .toBuffer();
      } else {
        const paw = Buffer.from(
          `<svg width="${AV}" height="${AV}" xmlns="http://www.w3.org/2000/svg">` +
          `<circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}" fill="#ffffff"/>` +
          this.pawSvg(AV / 2, AV / 2, AV * 0.28, bg, 1) +
          `</svg>`,
        );
        avatarLayer = await sharp(paw).png().toBuffer();
      }
      layers.push({ input: avatarLayer, left: Math.round(cx - AV / 2), top: Math.round(cy - AV / 2) });

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
      // Spacer cuối PHẢI giống nhau tuyệt đối giữa mọi label cùng cột, không được lệch số lượng

      // petCode luôn dùng FIGURE_BASE làm chuẩn tham chiếu

      // dob: bù trừ theo đúng số ký tự chênh lệch so với label petCode (không đoán mò theo ngôn ngữ nữa)


      pass.headerFields.push({
        key: 'docType',
        value: t.docType,
        textAlignment: 'PKTextAlignmentRight',
      });

      // Tên pet to, nằm đè lên strip (bên trái avatar)
      // pass.primaryFields.push({ key: 'petName', label: t.name, value: pet.name });

      // Hàng 1: mã | ngày sinh
      // pass.secondaryFields.push(
      //   { key: 'petCode', label: t.pawLifeId, value: displayCode },
      //   {
      //     key: 'dob',
      //     label: t.dob,
      //     value: this.toDobText(pet.dob),
      //     textAlignment: 'PKTextAlignmentRight',
      //   },
      // );

      // Hàng 2: giống · giới tính | microchip
      const breedText = pet.breed ?? pet.species;
      const genderText = this.toGenderText(pet.gender, lang);
      const breedGender =
        genderText === '—' ? breedText : `${breedText} · ${genderText}`;

      // Primary: label = giống · giới tính, value = tên pet
      // pass.primaryFields.push({
      //   key: 'petName',
      //   label: breedGender,
      //   value: pet.name,
      // });

      // Hàng 1: mã | ngày sinh (giữ nguyên)
      pass.secondaryFields.push(
        { key: 'petCode', label: t.pawLifeId, value: displayCode },
        {
          key: 'dob',
          label: t.dob,
          value: this.toDobText(pet.dob),
          textAlignment: 'PKTextAlignmentRight',
        },
      );

      // Hàng 2: chỉ còn microchip (giống · giới tính đã chuyển lên trên)
      if (pet.microchipNumber) {
        pass.auxiliaryFields.push({
          key: 'microchipFront',
          label: t.microchip,
          value: pet.microchipNumber,
        });
      }

      // Strip hero (avatar)
      try {
        const strip = await this.buildHeroStrip(pet.photoUrl, pet.name, breedGender);
        pass.addBuffer('strip.png', strip.x1);
        pass.addBuffer('strip@2x.png', strip.x2);
        pass.addBuffer('strip@3x.png', strip.x3);
      } catch (error) {
        console.warn('⚠️ Skipping hero strip...', error instanceof Error ? error.message : error);
      }

      // Background gradient (giữ nguyên)
      try {
        const bgImg = await this.buildBackground();
        pass.addBuffer('background.png', bgImg.x1);
        pass.addBuffer('background@2x.png', bgImg.x2);
        pass.addBuffer('background@3x.png', bgImg.x3);
      } catch (error) {
        console.warn('⚠️ Skipping background...', error instanceof Error ? error.message : error);
      }

      // Mặt sau (giữ nguyên)
      pass.backFields.push(
        { key: 'petName', label: t.name, value: pet.name },
        { key: 'fullId', label: t.fullId, value: pet.id },
        { key: 'profile', label: t.profilePage, value: profileUrl },
        { key: 'guide', label: t.guideLabel, value: t.guideValue },
      );

      // QR native ở cuối thẻ → lấp khoảng trống, Wallet tự tăng sáng khi quét
      const qrValue = activeTag?.qrPayload ?? activeTag?.id ?? profileUrl;
      pass.setBarcodes({
        message: qrValue,
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