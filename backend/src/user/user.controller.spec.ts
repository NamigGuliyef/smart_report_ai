import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let deleteAnalysisSpy: jest.Mock;

  beforeEach(async () => {
    deleteAnalysisSpy = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            getLastComparisonStats: jest.fn(),
            deleteAnalysis: deleteAnalysisSpy,
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate deletion to the user service', async () => {
    await controller.deleteAnalysis('analysis-123');

    expect(deleteAnalysisSpy).toHaveBeenCalledWith('analysis-123');
  });
});
