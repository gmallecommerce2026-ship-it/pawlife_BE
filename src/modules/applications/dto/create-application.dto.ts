// src/modules/applications/dto/create-application.dto.ts
import { IsString, IsNotEmpty, IsObject, IsOptional, IsEmail } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty({ message: 'petId không được để trống' })
  petId: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Số Zalo/Điện thoại không được để trống' })
  zalo: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @IsNotEmpty()
  adoptFor: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng cung cấp địa chỉ sinh sống' })
  location: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn loại nhà ở' })
  housing: string;

  @IsString()
  @IsNotEmpty()
  children: string;

  @IsString()
  @IsNotEmpty()
  cage: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn kinh nghiệm nuôi' })
  petExperience: string;

  @IsOptional()
  @IsString()
  prevPetHistory?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn tình trạng việc làm' })
  employmentStatus: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn lý do nhận nuôi' })
  adoptionReason: string;

  @IsObject()
  @IsNotEmpty()
  commitments: Record<string, any>;

  @IsOptional()
  @IsString()
  otherQuestion?: string;
}