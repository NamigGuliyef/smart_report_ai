import { Test, TestingModule } from '@nestjs/testing';
import { AnalysController } from './analys.controller';
import { AnalysService } from './analys.service';

describe('AnalysController', () => {
  let controller: AnalysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysController],
      providers: [AnalysService],
    }).compile();

    controller = module.get<AnalysController>(AnalysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
