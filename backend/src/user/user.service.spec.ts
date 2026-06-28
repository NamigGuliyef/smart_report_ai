import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { Analys } from '../analys/model/analys.schema';

describe('UserService', () => {
  let service: UserService;
  let findByIdAndDeleteSpy: jest.Mock;

  beforeEach(async () => {
    findByIdAndDeleteSpy = jest.fn().mockResolvedValue({ _id: 'analysis-123' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(Analys.name),
          useValue: {
            findByIdAndDelete: findByIdAndDeleteSpy,
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delete an analysis by id', async () => {
    await service.deleteAnalysis('analysis-123');

    expect(findByIdAndDeleteSpy).toHaveBeenCalledWith('analysis-123');
  });
});
