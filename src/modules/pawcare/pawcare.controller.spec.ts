import { Test, TestingModule } from '@nestjs/testing';
import { PawcareController } from './pawcare.controller';

describe('PawcareController', () => {
  let controller: PawcareController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PawcareController],
    }).compile();

    controller = module.get<PawcareController>(PawcareController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
