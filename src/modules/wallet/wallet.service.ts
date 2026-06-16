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
import Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
// Phụ thuộc DUY NHẤT vào port (hợp đồng dữ liệu) — không biết gì về Prisma/BE lõi.
// PET_DATA_PROVIDER là Symbol (giá trị runtime) → import thường để @Inject() dùng.
import { PET_DATA_PROVIDER } from './ports/pet-data.port';
// Các interface/type dùng trong constructor đã decorate → bắt buộc 'import type'
// (isolatedModules + emitDecoratorMetadata), nếu không sẽ lỗi TS1272.
import type { PetDataProvider, WalletPetGender } from './ports/pet-data.port';

// Bộ chứng chỉ ký pass — đọc từ đĩa 1 lần duy nhất rồi cache trong RAM
interface WalletCertificates {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  // Chỉ đặt khi signerKey.pem có mã hóa — passkit-generator CẤM chuỗi rỗng
  signerKeyPassphrase?: string;
}

@Injectable()
export class WalletService {
  private certificates: WalletCertificates | null = null;

  // Template nằm cạnh file build: dist/modules/wallet/templates/pawlife.pass
  // (nest-cli.json đã khai báo assets để copy thư mục này khi build)
  private readonly templatePath = path.join(
    __dirname,
    'templates',
    'pawlife.pass',
  );

  constructor(
    // Inject qua token vì PetDataProvider là interface (mất sau khi compile).
    // NestJS sẽ cắm PrismaPetDataAdapter vào đây (xem wallet.module.ts).
    @Inject(PET_DATA_PROVIDER)
    private readonly petData: PetDataProvider,
    private readonly configService: ConfigService,
  ) {}

  // Mã định danh hiển thị trên thẻ: PL-XXXXXXXX (8 ký tự đầu của UUID, viết hoa)
  // KHÔNG hiển thị UUID đầy đủ vì 36 ký tự sẽ bị cắt chữ trên mặt thẻ — UUID đầy đủ nằm ở mặt sau
  private toDisplayCode(petId: string): string {
    return `PL-${petId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  // Giới tính dạng song ngữ ngắn gọn (khớp style label "Giới tính/Gender" trên thẻ)
  private toGenderText(gender: WalletPetGender | null): string {
    switch (gender) {
      case 'MALE':
        return 'Đực/M';
      case 'FEMALE':
        return 'Cái/F';
      default:
        return '—';
    }
  }

  // Ngày sinh dạng dd/mm/yyyy — lấy theo UTC vì Prisma lưu DateTime mốc UTC,
  // tránh lệch sang ngày hôm trước khi server chạy ở múi giờ khác
  private toDobText(dob: Date | null): string {
    if (!dob) return '—';
    const day = String(dob.getUTCDate()).padStart(2, '0');
    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${dob.getUTCFullYear()}`;
  }

  // Tải ảnh đại diện pet từ R2 rồi crop thành hình tròn (PNG nền trong suốt)
  // → iOS chỉ bo nhẹ góc thumbnail, muốn avatar tròn như thẻ ID thì ảnh phải tròn sẵn
  // Trả về 3 độ phân giải theo chuẩn Apple: 90pt (@1x), 180px (@2x), 270px (@3x)
  private async buildCircleThumbnails(
    photoUrl: string,
  ): Promise<{ x1: Buffer; x2: Buffer; x3: Buffer }> {
    const response = await axios.get<ArrayBuffer>(photoUrl, {
      responseType: 'arraybuffer',
      timeout: 8000, // ảnh treo quá 8s thì bỏ thumbnail, không bắt user chờ
    });

    const image = await Jimp.read(Buffer.from(response.data));
    image.cover(270, 270); // crop vuông lấy tâm ảnh (như object-fit: cover)
    image.circle(); // bo tròn, phần ngoài hình tròn thành trong suốt

    return {
      x3: await image.getBufferAsync(Jimp.MIME_PNG),
      x2: await image.clone().resize(180, 180).getBufferAsync(Jimp.MIME_PNG),
      x1: await image.clone().resize(90, 90).getBufferAsync(Jimp.MIME_PNG),
    };
  }

  // Đọc bộ chứng chỉ từ thư mục certs/ (cấu hình qua env WALLET_CERTS_DIR, mặc định ./certs)
  private loadCertificates(): WalletCertificates {
    if (this.certificates) return this.certificates;

    const certsDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('WALLET_CERTS_DIR') ?? 'certs',
    );

    // signerKey.pem của PawLife có mã hóa → thiếu passphrase thì ký sẽ fail,
    // nhưng vẫn cho qua để hỗ trợ trường hợp key không mã hóa (vd: môi trường dev)
    const passphrase = this.configService.get<string>('WALLET_CERT_PASSPHRASE');

    try {
      this.certificates = {
        wwdr: fs.readFileSync(path.join(certsDir, 'wwdr.pem')),
        signerCert: fs.readFileSync(path.join(certsDir, 'signerCert.pem')),
        signerKey: fs.readFileSync(path.join(certsDir, 'signerKey.pem')),
        ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
      };
      console.log('✅ Đã nạp chứng chỉ Apple Wallet từ:', certsDir);
      return this.certificates;
    } catch (error) {
      console.error('❌ Không đọc được chứng chỉ Apple Wallet:', error);
      throw new InternalServerErrorException(
        'Hệ thống chưa cấu hình chứng chỉ Apple Wallet!',
      );
    }
  }

  // Sinh file .pkpass (Static Pass) cho 1 bé pet — trả về buffer để controller stream xuống client
  async generatePetPass(
    userId: string,
    petId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    // 1. Lấy thông tin pet qua port + kiểm tra quyền sở hữu.
    // Quyền sở hữu được kiểm Ở ĐÂY (tầng service), không phải trong adapter:
    // adapter chỉ trả dữ liệu, service mới quyết ai được tải thẻ.
    const pet = await this.petData.getPetForWallet(petId);
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng này!');
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException(
        'Bạn không có quyền thao tác trên thú cưng này!',
      );
    }

    // 2. Chuẩn bị dữ liệu động in lên thẻ
    const displayCode = this.toDisplayCode(pet.id);
    const profileBaseUrl =
      this.configService.get<string>('WALLET_PROFILE_BASE_URL') ??
      'https://pawlife.vn/profile';
    const profileUrl = `${profileBaseUrl}/${pet.id}`;

    // 3. Sinh pass từ template + ký số bằng chứng chỉ Pass Type ID
    try {
      const pass = await PKPass.from(
        {
          model: this.templatePath,
          certificates: this.loadCertificates(),
        },
        {
          // serialNumber = pet.id (UUID): mỗi bé 1 thẻ riêng trong ví — user nuôi nhiều pet
          // sẽ có nhiều thẻ, tải lại thẻ của cùng 1 bé thì Wallet tự THAY THẾ chứ không nhân đôi
          serialNumber: pet.id,
          passTypeIdentifier:
            this.configService.get<string>('WALLET_PASS_TYPE_IDENTIFIER') ??
            'pass.com.pawlife.petid',
          teamIdentifier:
            this.configService.get<string>('WALLET_TEAM_IDENTIFIER') ??
            'ZSUSA4XQ95',
        },
      );

      // Mặt trước thẻ (pass kiểu generic) — layout mô phỏng thẻ ID:
      //   góc phải trên : "Digital Pet ID" (tên loại giấy tờ)
      //   tên pet       : bên trái, avatar tròn bên phải (thumbnail)
      //   hàng 1        : Giống/Breed | PawLife ID       (secondary — font value TO)
      //   hàng 2        : Giới tính/Gender | Ngày sinh/DoB (auxiliary — font value NHỎ hơn, quy định iOS)
      //
      // ===== Trick "độn label" cho cột phải CANH TRÁI thẳng hàng (yêu cầu khách) =====
      // iOS neo ô cuối hàng vào mép phải, bề rộng ô = max(bề rộng label, value)
      // → mép trái 2 hàng chỉ trùng nhau khi 2 ô RỘNG BẰNG NHAU. Độn ký tự trắng
      // vô hình vào cuối label để cả 2 ô đạt ~415px@3x — vượt mã PL-XXXXXXXX rộng
      // nhất (~409px ở font secondary, đo với PL-DDDDDDDD) nên value không phá được ô.
      // Calibrate bằng đo pixel trên iOS 26 Simulator: 4 dòng cùng bắt đầu x=684±1.
      // Đơn vị đo @3x: \u2007 figure space ≈ 21.7px · \u2009 thin ≈ 5px ·
      // \u200A hair ≈ 2.5px · \u200B zero-width chốt đuôi chống trim.
      // Chi tiết: wiki components/wallet-module. KHÔNG xóa các ký tự này!
      const petCodeLabel =
        'PawLife ID' + '\u2007'.repeat(10) + '\u2009\u2009\u2009\u200B';
      const dobLabel =
        'Ngày sinh/DoB' + '\u2007'.repeat(6) + '\u2009\u2009\u2009\u2009\u200B';

      pass.headerFields.push({
        key: 'docType',
        value: 'Digital Pet ID',
      });
      pass.primaryFields.push({
        key: 'petName',
        label: 'Tên/Name',
        value: pet.name,
      });
      pass.secondaryFields.push(
        {
          key: 'breed',
          label: 'Giống/Breed',
          // Chưa rõ giống thì hiển thị loài (Dog/Cat) — ô này không bao giờ trống
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
          label: 'Giới tính/Gender',
          value: this.toGenderText(pet.gender),
        },
        {
          key: 'dob',
          label: dobLabel,
          value: this.toDobText(pet.dob),
          textAlignment: 'PKTextAlignmentLeft',
        },
      );

      // Avatar tròn bên phải tên pet — pet chưa có ảnh hoặc ảnh lỗi thì bỏ qua,
      // thẻ vẫn tạo bình thường (không vì cái ảnh mà chặn user tải thẻ)
      const photoUrl = pet.photoUrl;
      if (photoUrl) {
        try {
          const thumb = await this.buildCircleThumbnails(photoUrl);
          pass.addBuffer('thumbnail.png', thumb.x1);
          pass.addBuffer('thumbnail@2x.png', thumb.x2);
          pass.addBuffer('thumbnail@3x.png', thumb.x3);
        } catch (error) {
          console.warn(
            '⚠️ Bỏ qua thumbnail vì không tải/xử lý được ảnh pet:',
            error instanceof Error ? error.message : error,
          );
        }
      }

      // Mặt sau thẻ: thông tin tra cứu đầy đủ
      pass.backFields.push(
        { key: 'fullId', label: 'Pet ID (đầy đủ)', value: pet.id },
        { key: 'profile', label: 'Trang hồ sơ', value: profileUrl },
      );
      if (pet.microchipNumber) {
        pass.backFields.push({
          key: 'microchip',
          label: 'Số microchip',
          value: pet.microchipNumber,
        });
      }
      pass.backFields.push({
        key: 'guide',
        label: 'Hướng dẫn',
        value:
          'Quét mã QR trên thẻ để xem hồ sơ thú cưng. Nếu bạn nhặt được bé, vui lòng liên hệ chủ nuôi qua trang hồ sơ.',
      });

      // Mã QR trỏ thẳng về trang profile của bé trên web
      // (không đặt altText — mã định danh đã có ở ô "Mã số/ID #", tránh lặp)
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
      console.error('❌ Lỗi khi sinh thẻ Apple Wallet:', error);
      throw new InternalServerErrorException(
        'Không thể tạo thẻ Apple Wallet, vui lòng thử lại sau!',
      );
    }
  }
}
