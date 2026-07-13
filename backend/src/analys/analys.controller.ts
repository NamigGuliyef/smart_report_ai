import {
  Controller,
  Get,
  Post,
  UploadedFiles,
  UseInterceptors,
  Body,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AnalysService } from './analys.service';
import { Response } from 'express';

@Controller('analys')
export class AnalysController {
  constructor(private readonly analysService: AnalysService) {}

  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'systemFile', maxCount: 1 },
      { name: 'physicalFile', maxCount: 1 },
    ]),
  )
  async uploadFiles(
    @UploadedFiles() files: any,
    @Body('customPrompt') customPrompt?: string,
    @Body('model') model?: string,
    @Body('userId') userId?: string,
    @Body('userName') userName?: string,
  ) {
    const hasFiles = !!files?.systemFile?.length || !!files?.physicalFile?.length;
    const hasPrompt = !!customPrompt?.trim();

    if (!hasFiles && !hasPrompt) {
      throw new BadRequestException('Ən azı bir fayl yükləyin və ya xüsusi təlimat verin.');
    }

    const systemFile = files?.systemFile ? files.systemFile[0] : null;
    const physicalFile = files?.physicalFile ? files.physicalFile[0] : null;

    return await this.analysService.processFiles(
      systemFile?.buffer,
      physicalFile?.buffer,
      systemFile?.originalname || physicalFile?.originalname || 'Prompt-based Audit',
      userName || 'Test User',
      customPrompt,
      model,
      userId,
    );
  }

  @Get('download/:id')
  async downloadAudit(@Param('id') id: string, @Res() res: Response) {
    try {
      const buffer = await this.analysService.exportToExcel(id);
      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=audit_${id}.xlsx`,
        'Content-Length': buffer.byteLength,
      });
      res.end(buffer);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  @Get('all/:userId')
  async getAllAudits(@Param('userId') userId: string) {
    return await this.analysService.findAll(userId);
  }
}
