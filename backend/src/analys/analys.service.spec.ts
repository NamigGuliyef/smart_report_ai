import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AnalysService } from './analys.service';
import { Analys } from './model/analys.schema';

describe('AnalysService', () => {
  let service: AnalysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysService,
        {
          provide: getModelToken(Analys.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalysService>(AnalysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
