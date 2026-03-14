import { Test, TestingModule } from '@nestjs/testing';
import { PawcareService } from './pawcare.service';

describe('PawcareService', () => {
  let service: PawcareService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PawcareService],
    }).compile();

    service = module.get<PawcareService>(PawcareService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
