import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import Anthropic from '@anthropic-ai/sdk';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');
import { Analys } from './model/analys.schema';

@Injectable()
export class AnalysService {
  private anthropic = new Anthropic({
    apiKey:
      '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',
  });

  constructor(
    @InjectModel(Analys.name) private readonly analysModel: Model<Analys>,
  ) {}

  // Helper to check if a buffer is a PDF
  private isPdf(buffer: Buffer): boolean {
    return (
      buffer &&
      buffer.length > 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ); // %PDF
  }

  // Helper to parse PDF text content
  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text || '';
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      throw new Error(
        'PDF faylı oxunarkən xəta baş verdi: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // Köməkçi funksiya: Excel-i JSON-a çevirir
  private async parseExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    const headers = [];
    worksheet.getRow(1).eachCell((cell) => headers.push(cell.value));

    const data = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      let rowData = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber - 1]] = cell.value;
      });
      data.push(rowData);
    });
    return { data, headers };
  }

  // Əsas funksiya: Faylları emal edir
  async processFiles(
    sysBuffer?: Buffer,
    physBuffer?: Buffer,
    fileName?: string,
    user?: string,
    customPrompt?: string,
    selectedModel?: string,
    userId?: string,
  ) {
    // 1. Faylları parçala
    let sysData: any[] = [];
    let sysHeaders: string[] = [];
    let sysIsPdf = false;
    let sysPdfText = '';

    if (sysBuffer) {
      if (this.isPdf(sysBuffer)) {
        sysIsPdf = true;
        sysPdfText = await this.parsePdf(sysBuffer);
      } else {
        const parsed = await this.parseExcel(sysBuffer);
        sysData = parsed.data || [];
        sysHeaders = parsed.headers || [];
      }
    }

    let physData: any[] = [];
    let physHeaders: string[] = [];
    let physIsPdf = false;
    let physPdfText = '';

    if (physBuffer) {
      if (this.isPdf(physBuffer)) {
        physIsPdf = true;
        physPdfText = await this.parsePdf(physBuffer);
      } else {
        const parsed = await this.parseExcel(physBuffer);
        physData = parsed.data || [];
        physHeaders = parsed.headers || [];
      }
    }

    const isComparison = sysBuffer && physBuffer;

    // 2. Claude-a göndəriləcək prompt
    let systemInstruction = '';

    if (customPrompt && customPrompt.trim()) {
      systemInstruction = `Sən peşəkar bir inventar auditorusan. Sənə ${isComparison ? 'iki cədvəl/sənəd (Sistem və Fiziki)' : 'bir inventar sənədi'} verilir.
İstifadəçinin xüsusi tələbi var: "${customPrompt}".

Göstərişlər:
1. Cavabın YALNIZ və YALNIZ təmiz JSON formatında olmalıdır (Markdown blokları olmadan).
2. Analiz nəticəsini bu JSON strukturunda qaytar:
{
  "context": "Analizin mövzusu",
  "discrepancies": [
    {
      "audit_notes": "Burada uyğunsuzluqla bağlı detallı qeydlər mütləq qeyd olunmalıdır."
    }
  ],
  "recommendations": ["Tələbə uyğun tövsiyə 1"],
  "data_quality_score": 100
}
3. Cavabın sonu "Təbriklər, təhlil bitdi." ilə bitsin.`;
    } else {
      if (isComparison) {
        systemInstruction = `Sən peşəkar bir inventar auditorusan. İki sənədi (Sistem vs Fiziki) qarşılaşdırıb uyğunsuzluqları aşkar etməlisən.

QAYDALAR VƏ İŞ PROSESİ:
1. MƏLUMATIN EMALI: Müqayisəyə başlamazdan əvvəl hər iki sənəddəki eyni SKU/Kodlu məhsulları topla (cəmlə). 
2. ANALİZ: Toplanmış yekun rəqəmləri Sistem və Fiziki sənədlər arasında qarşılaşdır.
3. FİLTR QAYDASI: Yalnız Sistem və Fiziki sayları BƏRABƏR OLMAYAN sətirləri "discrepancies" massivinə daxil et. Saylar bərabərdirsə, həmin məhsulu siyahıya salma.
4. Əgər heç bir uyğunsuzluq yoxdursa, "discrepancies" massivini boş qoy ([]) və "status" sahəsində "Bu hesabatda fərq tapılmadı." qeydini yaz.
5. YALNIZ JSON formatında cavab ver. Markdown blokları (json) istifadə etmə.
6. Hər bir "discrepancies" obyektində mütləq "audit_notes" sahəsi olmalıdır.
7. Cavabın sonu "Təbriklər, təhlil bitdi." ilə bitsin.

JSON Strukturu:
{
  "context": "Sistem vs Fiziki sayım müqayisəsi",
  "status": "...",
  "discrepancies": [
    {
      "code": "SKU kodu",
      "qty_file1": 0,
      "qty_file2": 0,
      "diff": 0,
      "audit_notes": "Toplanmış yekun rəqəmlər və fərqin izahı"
    }
  ],
  "recommendations": ["Ümumi Tövsiyə 1"],
  "data_quality_score": 100
}`;
      } else {
        systemInstruction = `Sən peşəkar bir inventar auditorusan. Sənə verilən tək sənədi analiz edib uyğunsuzluq və ya anomaliya tapmalısan.
1. Cavabın YALNIZ JSON formatında olmalıdır.
2. JSON strukturu:
{
  "context": "Tək sənəd üzrə analiz",
  "discrepancies": [
    {
      "code": "SKU",
      "item": "Məhsul",
      "issue": "Problem",
      "qty": 0,
      "severity": "Yüksək/Orta/Aşağı",
      "recommendation": "Tövsiyə",
      "audit_notes": "Analiz qeydləri"
    }
  ],
  "recommendations": ["..."],
  "data_quality_score": 100
}
3. Cavabın sonu "Təbriklər, təhlil bitdi." ilə bitsin.`;
      }
    }

    // User payload content
    let userMessage = '';
    if (sysBuffer && physBuffer) {
      const sysStr = sysIsPdf
        ? `Sistem (PDF): ${sysPdfText}`
        : `Sistem (Excel): ${JSON.stringify(sysData)}`;
      const physStr = physIsPdf
        ? `Fiziki (PDF): ${physPdfText}`
        : `Fiziki (Excel): ${JSON.stringify(physData)}`;
      userMessage = `${sysStr}\n\n${physStr}`;
    } else if (sysBuffer) {
      userMessage = sysIsPdf
        ? `Sistem (PDF): ${sysPdfText}`
        : `Sistem (Excel): ${JSON.stringify(sysData)}`;
    } else {
      userMessage = physIsPdf
        ? `Fiziki (PDF): ${physPdfText}`
        : `Fiziki (Excel): ${JSON.stringify(physData)}`;
    }

    // Dəstəklənən modellər:
    // 1. Claude Haiku: "claude-haiku-4-5-20251001"
    // 2. Claude Sonnet 4.5: "claude-sonnet-4-5-20250929"
    // 3. Claude Sonnet 4.6: "claude-sonnet-4-6"
    const allowedModels = [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-6',
    ];
    const modelToUse = allowedModels.includes(selectedModel)
      ? selectedModel
      : 'claude-sonnet-4-6';

    const response = await this.anthropic.messages.create({
      model: modelToUse,
      max_tokens: 16000,
      system: systemInstruction,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');

    // Claude cavabını alandan sonra JSON hissəsini tapıb təmizlə
    let rawText = textBlock['text'].trim();
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error('Claude cavabında düzgün JSON formatı tapılmadı');
    }
    const cleanJson = rawText.substring(firstBrace, lastBrace + 1);
    const aiResult = JSON.parse(cleanJson);

    // Mütləq determinizm və dəqiqlik üçün faiz dərəcəsini proqramlaşdırılmış düsturla yenidən hesablayırıq
    const sysRowsCount = sysIsPdf
      ? sysPdfText.split('\n').filter((l) => l.trim()).length || 1
      : sysData?.length || 0;
    const physRowsCount = physIsPdf
      ? physPdfText.split('\n').filter((l) => l.trim()).length || 1
      : physData?.length || 0;
    const totalRows = Math.max(sysRowsCount, physRowsCount, 1);
    const discrepanciesCount = aiResult.discrepancies?.length || 0;
    aiResult.data_quality_score = Math.max(
      0,
      Math.min(
        100,
        Math.round(((totalRows - discrepanciesCount) / totalRows) * 100),
      ),
    );

    // 3. MongoDB-yə yaz
    const auditEntry = new this.analysModel({
      fileName: `${fileName}`,
      dataContent: aiResult,
      metadata: {
        columnNames: [...new Set([...sysHeaders, ...physHeaders])],
        user,
        userId,
        customPrompt,
        model: modelToUse,
      },
      status: 'Təsdiqləndi',
    });

    return await auditEntry.save();
  }

  async findAll(userId?: string) {
    const query = userId ? { 'metadata.userId': userId } : {};
    return await this.analysModel.find(query).sort({ createdAt: -1 });
  }

  async exportToExcel(id: string) {
    const audit = await this.analysModel.findById(id);
    if (!audit || !audit.dataContent || !audit.dataContent.discrepancies) {
      throw new Error('Audit tapılmadı və ya məlumat yoxdur');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Audit Nəticələri');

    // Sütun adlarını Azərbaycan dilinə çevirmək üçün xəritə
    const headerMap = {
      code: 'Kod',
      product_file1: 'Məhsul (Sistem)',
      product_file2: 'Məhsul (Fiziki)',
      unit: 'Vahid',
      qty_file1: 'Miqdar (Sistem)',
      qty_file2: 'Miqdar (Fiziki)',
      diff: 'Fərq',
      status_recommendation: 'Status / Tövsiyə',
      item: 'Məhsul',
      issue: 'Problem/Uyğunsuzluq',
      qty: 'Miqdar',
      severity: 'Ciddilik',
      recommendation: 'Tövsiyə',
    };

    const discrepancies = audit.dataContent.discrepancies;
    if (discrepancies.length > 0) {
      const rawHeaders = Object.keys(discrepancies[0]);
      // Azərbaycan dilində başlıqları yaradırıq
      const azHeaders = rawHeaders.map(
        (h) => headerMap[h] || h.charAt(0).toUpperCase() + h.slice(1),
      );

      worksheet.addRow(azHeaders);

      discrepancies.forEach((item) => {
        const row = rawHeaders.map((h) => item[h]);
        worksheet.addRow(row);
      });

      // Sütunların stilini düzəldirik
      worksheet.getRow(1).font = { bold: true };
      worksheet.columns.forEach((column) => {
        column.width = 25;
      });
    }

    return await workbook.xlsx.writeBuffer();
  }
}
