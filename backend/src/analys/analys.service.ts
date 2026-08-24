import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';
import { Analys } from './model/analys.schema';

@Injectable()
export class AnalysService {
  private ai = new GoogleGenAI({
    apiKey:
      process.env.GEMINI_API_KEY ||
      'AQ.Ab8RN6J60CMBobzz9SpnYLgVRfBXC_6aeFG94wkrSEBN0bwbUw',
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
      if (typeof globalThis.DOMMatrix === 'undefined') {
        (globalThis as any).DOMMatrix = class DOMMatrix {
          a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
          m11 = 1; m12 = 0; m13 = 0; m14 = 0;
          m21 = 0; m22 = 1; m23 = 0; m24 = 0;
          m31 = 0; m32 = 0; m33 = 1; m34 = 0;
          m41 = 0; m42 = 0; m43 = 0; m44 = 1;
          is2D = true;
          isIdentity = true;
          multiply() { return this; }
          translate() { return this; }
          scale() { return this; }
          rotate() { return this; }
          inverse() { return this; }
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = require('pdf-parse');
      let textContent = '';

      if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        textContent = data?.text || '';
      } else if (pdfParseModule?.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        textContent = result?.text || '';
      }

      return textContent;
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      throw new BadRequestException(
        'PDF faylı oxunarkən xəta baş verdi: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  private getCellValue(cell: ExcelJS.Cell): any {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    const val = cell.value;
    if (typeof val === 'object') {
      if ('result' in val) return (val as any).result ?? '';
      if ('text' in val) return (val as any).text ?? '';
      if ('richText' in val && Array.isArray((val as any).richText)) {
        return (val as any).richText.map((rt: any) => rt.text).join('');
      }
      return String(val);
    }
    return val;
  }

  // Köməkçi funksiya: Excel-i dinamik olaraq JSON-a çevirir (başlıq sətrini avtomatik aşkar edir)
  private async parseExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    const allRows: any[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowValues: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowValues[colNumber - 1] = this.getCellValue(cell);
      });
      allRows.push(rowValues);
    });

    if (allRows.length === 0) return { data: [], headers: [] };

    // Ən çox dolu sütunu olan sətri tapaq (ilk 15 sətir daxilində)
    let headerRowIndex = 0;
    let maxCols = 0;

    for (let i = 0; i < Math.min(15, allRows.length); i++) {
      const row = allRows[i];
      const nonEmptyCols = row.filter((val) => val !== '' && val !== null && val !== undefined).length;
      if (nonEmptyCols > maxCols) {
        maxCols = nonEmptyCols;
        headerRowIndex = i;
      }
    }

    const rawHeaders = allRows[headerRowIndex] || [];
    const headers: string[] = [];
    
    rawHeaders.forEach((h, idx) => {
      const cleanHeader = h ? String(h).trim() : `Sütun_${idx + 1}`;
      if (headers.includes(cleanHeader)) {
        headers.push(`${cleanHeader}_${idx + 1}`);
      } else {
        headers.push(cleanHeader);
      }
    });

    const data: any[] = [];
    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i];
      const hasData = row.some((val) => val !== '' && val !== null && val !== undefined);
      if (!hasData) continue;

      const rowData: Record<string, any> = {};
      headers.forEach((header, colIdx) => {
        const val = row[colIdx];
        if (val !== undefined && val !== null && val !== '') {
          rowData[header] = val;
        }
      });

      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    }

    return { data, headers };
  }

  private mapModelName(selectedModel?: string): string {
    if (!selectedModel) return 'gemini-3.7-flash';
    if (selectedModel.includes('3.7')) return 'gemini-3.7-flash';
    if (selectedModel.includes('pro')) return 'gemini-3.6-pro';
    if (selectedModel.includes('3.6')) return 'gemini-3.6-flash';
    return 'gemini-3.7-flash';
  }

  private parseGeminiJsonResponse(rawText: string) {
    if (!rawText) {
      throw new NotFoundException('Gemini cavabında mətn tapılmadı');
    }

    let cleanText = rawText.trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new NotFoundException('Gemini cavabında düzgün JSON formatı tapılmadı');
    }

    const cleanJson = cleanText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanJson);
  }

  private buildTableOutputInstructions(
    customPrompt: string,
    sourceHeaders: string[] = [],
  ): string {
    const headersHint =
      sourceHeaders.length > 0
        ? `Mənbə sənədindəki mövcud sütunlar: [${sourceHeaders.join(', ')}].`
        : '';

    return `İstifadəçinin tələbi: "${customPrompt}"

QAYDALAR:
1. Cavabın YALNIZ və YALNIZ təmiz JSON formatında olmalıdır.
2. ${headersHint}
3. Sənəddən istifadəçinin verdiyi filtrləməyə/istəyə uyğun GƏLƏN BÜTÜN SƏTİRLƏRİ Tap.
4. "discrepancies" massivində hər bir sətiri obyekt kimi qaytar. Hər obyektdə istifadəçinin istədiyi (və ya sənəddəki) BÜTÜN SÜTUNLAR (məsələn: "Kod", "Nomenklatura", "Vahid", "Miqdar", "Qutu" və s.) ayrı-ayrı açarlar kimi yer almalıdır.
5. Məlumatları "audit_notes" və ya "status" adında tək sahədə BİRLƏŞDİRMƏ. Hər sütunun öz adı olmalıdır.
6. JSON strukturu nümunəsi:
{
  "context": "Filtirlənmiş Hesabat",
  "discrepancies": [
    {
      "Kod": "...",
      "Nomenklatura": "...",
      "Vahid": "...",
      "Miqdar": 0,
      "Qutu": 0
    }
  ],
  "recommendations": ["Analiz tövsiyəsi"],
  "data_quality_score": 100
}`;
  }

  private async generateContentWithFallback(
    modelToUse: string,
    contents: any,
    config: any,
  ) {
    const modelsToTry = [modelToUse, 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError: any;
    for (const model of uniqueModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents,
          config,
        });
        return response;
      } catch (err: any) {
        console.warn(`Model ${model} ilə xəta baş verdi, növbəti model sınanılır:`, err?.message || err);
        lastError = err;
      }
    }
    throw lastError;
  }

  private async createPromptOnlyTable(customPrompt: string, selectedModel: string) {
    const modelToUse = this.mapModelName(selectedModel);
    const response = await this.generateContentWithFallback(
      modelToUse,
      this.buildTableOutputInstructions(customPrompt),
      {
        systemInstruction:
          'Sən peşəkar bir hesabat və cədvəl yaradıcısan. İstifadəçinin istəyinə uyğun təmiz, oxunaqlı və strukturlaşdırılmış cədvəl hazırlamalısan.',
        responseMimeType: 'application/json',
      },
    );

    return this.parseGeminiJsonResponse(response.text);
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
    const hasAnyFiles = Boolean(sysBuffer || physBuffer);
    const hasPrompt = Boolean(customPrompt && customPrompt.trim());

    if (!hasAnyFiles && !hasPrompt) {
      throw new BadRequestException('Ən azı bir fayl yükləyin və ya xüsusi təlimat verin.');
    }

    const modelToUse = this.mapModelName(selectedModel);

    if (!hasAnyFiles && hasPrompt) {
      const aiResult = await this.createPromptOnlyTable(customPrompt, modelToUse);
      aiResult.data_quality_score = Math.max(0, Math.min(100, aiResult.data_quality_score ?? 100));

      const auditEntry = new this.analysModel({
        fileName: fileName || 'Prompt-based Audit',
        dataContent: aiResult,
        metadata: {
          columnNames: aiResult.discrepancies?.length ? Object.keys(aiResult.discrepancies[0]) : ['Sütun 1'],
          user,
          userId,
          customPrompt,
          model: modelToUse,
        },
        status: 'Təsdiqləndi',
      });

      return await auditEntry.save();
    }

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
      const allHeaders = [...new Set([...sysHeaders, ...physHeaders])];
      systemInstruction = `Sən peşəkar bir hesabat və məlumat analitikisans. Sənə ${isComparison ? 'iki cədvəl/sənəd (Sistem və Fiziki)' : 'bir sənəd'} verilir.
Yüklənmiş sənəddən istifadəçinin tələbinə uyğun məlumatları filter et, strukturlaşdır və cədvəl sətirləri kimi qaytar.

${this.buildTableOutputInstructions(customPrompt, allHeaders)}
7. Cavabın sonu "Təbriklər, təhlil bitdi." ilə bitsin.`;
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

    const response = await this.generateContentWithFallback(
      modelToUse,
      userMessage,
      {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      },
    );

    const aiResult = this.parseGeminiJsonResponse(response.text);

    // Mütləq determinizm və dəqiqlik üçün faiz dərəcəsini proqramlaşdırılmış düsturla yenidən hesablayırıq
    const sysRowsCount = sysIsPdf
      ? sysPdfText.split('\n').filter((l) => l.trim()).length || 1
      : sysData?.length || 0;
    const physRowsCount = physIsPdf
      ? physPdfText.split('\n').filter((l) => l.trim()).length || 1
      : physData?.length || 0;
    const totalRows = Math.max(sysRowsCount, physRowsCount, 1);
    const discrepanciesCount = aiResult.discrepancies?.length || 0;
    if (customPrompt && customPrompt.trim()) {
      aiResult.data_quality_score = Math.max(
        0,
        Math.min(100, aiResult.data_quality_score ?? 100),
      );
    } else {
      aiResult.data_quality_score = Math.max(
        0,
        Math.min(
          100,
          Math.round(((totalRows - discrepanciesCount) / totalRows) * 100),
        ),
      );
    }

    const outputColumnNames =
      customPrompt && customPrompt.trim() && aiResult.discrepancies?.length
        ? Object.keys(aiResult.discrepancies[0])
        : [...new Set([...sysHeaders, ...physHeaders])];

    // 3. MongoDB-yə yaz
    const auditEntry = new this.analysModel({
      fileName: `${fileName}`,
      dataContent: aiResult,
      metadata: {
        columnNames: outputColumnNames,
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
      throw new NotFoundException('Audit tapılmadı və ya məlumat yoxdur');
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
