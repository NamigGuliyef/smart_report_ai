import { AnalysController } from './analys.controller';
import { BadRequestException } from '@nestjs/common';

describe('AnalysController', () => {
  it('should allow prompt-only requests without uploaded files', async () => {
    const service = {
      processFiles: jest.fn().mockResolvedValue({ ok: true }),
    };

    const controller = new AnalysController(service as any);

    await expect(
      controller.uploadFiles(undefined, 'Mənə 3 sətirli satış cədvəli hazırlayın', 'claude-sonnet-4-6'),
    ).resolves.toEqual({ ok: true });

    expect(service.processFiles).toHaveBeenCalledWith(
      undefined,
      undefined,
      'Prompt-based Audit',
      'Test User',
      'Mənə 3 sətirli satış cədvəli hazırlayın',
      'claude-sonnet-4-6',
      undefined,
    );
  });

  it('should reject requests with neither files nor prompt', async () => {
    const service = { processFiles: jest.fn() };
    const controller = new AnalysController(service as any);

    await expect(controller.uploadFiles(undefined, '', undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});
