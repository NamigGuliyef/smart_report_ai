import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import { Analys } from './model/analys.schema';

@Injectable()
export class AnalysService {
  private ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
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

  // Excel-i müxtəlif layout-lardan oxuyur: title, boş sətir və çoxsəviyyəli başlıqları nəzərə alır.
  private async parseExcel(
    buffer: Buffer,
    requestedSheet?: string,
    forcedSheetName?: string,
  ) {
    const normalizeSheetText = (value: string) =>
      value
        .toLocaleLowerCase('az-AZ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
    const promptText = requestedSheet || '';
    const normalizedPrompt = normalizeSheetText(promptText);
    const sheetKeywords = /sheet|vərəq|vereq|səhifə|sehife|tab/i;
    const ordinalMatch =
      promptText.match(/(\d+)\s*[- ]?(?:ci|cı|cu|cü)?\s*(?:sheet|vərəq|vereq|səhifə|sehife|tab)/i) ||
      promptText.match(/(?:sheet|vərəq|vereq|səhifə|sehife|tab)\s*(\d+)/i);

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetNames = workbook.SheetNames;
    const mentionedSheetNames = sheetNames
      .filter((candidate) => normalizedPrompt.includes(normalizeSheetText(candidate)))
      .sort((first, second) => second.length - first.length);

    if (!forcedSheetName && mentionedSheetNames.length > 1) {
      const parsedSheets = await Promise.all(
        mentionedSheetNames.map((name) =>
          this.parseExcel(buffer, requestedSheet, name),
        ),
      );
      const mergedHeaders = [
        ...new Set(parsedSheets.flatMap((parsed) => parsed.headers)),
        '_source_sheet',
      ];
      const mergedData = parsedSheets.flatMap((parsed) =>
        parsed.data.map((row) => ({ ...row, _source_sheet: parsed.sheetName })),
      );
      return {
        data: mergedData,
        headers: mergedHeaders,
        sheetName: mentionedSheetNames.join(', '),
      };
    }

    let sheetName = forcedSheetName || sheetNames[0];
    if (!forcedSheetName && ordinalMatch) {
      const sheetIndex = Number(ordinalMatch[1]) - 1;
      if (sheetIndex >= 0 && sheetIndex < sheetNames.length) {
        sheetName = sheetNames[sheetIndex];
      }
    } else if (!forcedSheetName && requestedSheet) {
      const matchingSheets = sheetNames
        .filter((candidate) => {
          const normalizedName = normalizeSheetText(candidate);
          return normalizedName && normalizedPrompt.includes(normalizedName);
        })
        .sort((first, second) => second.length - first.length);

      if (matchingSheets.length > 0) {
        sheetName = matchingSheets[0];
      } else if (sheetKeywords.test(requestedSheet)) {
        throw new BadRequestException(
          `Promptda göstərilən sheet tapılmadı. Mövcud sheet-lər: ${sheetNames.join(', ')}`,
        );
      }
    }

    const allRows = XLSX.utils
      .sheet_to_json<any[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: '',
        blankrows: true,
      })
      .map((row) => row.map((value) => value ?? ''));

    if (allRows.length === 0) return { data: [], headers: [] };

    const isEmpty = (value: any) =>
      value === '' || value === null || value === undefined;
    const formatDateParts = (year: number, month: number, day: number) =>
      `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    const formatDate = (value: Date) =>
      formatDateParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    const cellText = (value: any) => {
      if (isEmpty(value)) return '';
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDate(value);
      }
      if (typeof value === 'string') {
        const isoDateMatch = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/);
        if (isoDateMatch) {
          const date = new Date(value.trim());
          if (!Number.isNaN(date.getTime())) return formatDate(date);
          const [year, month, day] = isoDateMatch[1].split('-');
          return `${day}.${month}.${year}`;
        }
      }
      return String(value).trim();
    };
    const parseDateOnly = (value: string) => {
      const match = value.trim().match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
      if (!match) return null;
      const [, day, month, year] = match;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const requestedDates = [...promptText.matchAll(/\b(\d{2}[./-]\d{2}[./-]\d{4})\b/g)]
      .map((match) => parseDateOnly(match[1]))
      .filter((date): date is Date => Boolean(date));
    const requestedDateFrom = requestedDates[0];
    const requestedDateTo = requestedDates[1] || requestedDates[0];
    const columnCount = Math.max(...allRows.map((row) => row.length), 0);

    // Başlıq üçün mətnli və təkrarsız sətrlərə üstünlük ver; title/data sətrini seçmə.
    const candidateLimit = Math.min(30, allRows.length);
    let headerRowIndex = 0;
    let bestHeaderScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < candidateLimit; i++) {
      const row = allRows[i] || [];
      const values = row.slice(0, columnCount).map(cellText);
      const nonEmptyValues = values.filter(Boolean);
      const textValues = nonEmptyValues.filter((value) => /[^\d\s.,/%()-]/.test(value));
      const uniqueValues = new Set(nonEmptyValues.map((value) => value.toLowerCase())).size;
      const nextRowValues = (allRows[i + 1] || []).filter((value) => !isEmpty(value));
      const score =
        textValues.length * 4 +
        uniqueValues * 1.5 +
        Math.min(nonEmptyValues.length, 12) +
        Math.min(nextRowValues.length, 8) -
        (nonEmptyValues.length === 1 ? 8 : 0);

      if (nonEmptyValues.length >= 2 && score > bestHeaderScore) {
        bestHeaderScore = score;
        headerRowIndex = i;
      }
    }

    const rawHeaders = (allRows[headerRowIndex] || []).slice(0, columnCount);
    const previousHeaderRow = allRows[headerRowIndex - 1] || [];
    const previousNonEmptyCount = previousHeaderRow.filter((value) => !isEmpty(value)).length;
    const currentNonEmptyCount = rawHeaders.filter((value) => !isEmpty(value)).length;
    const headers: string[] = [];

    rawHeaders.forEach((header, idx) => {
      let cleanHeader = cellText(header).replace(/\s+/g, ' ');
      const parentHeader = cellText(previousHeaderRow[idx]).replace(/\s+/g, ' ');
      if (!cleanHeader && previousNonEmptyCount >= 2 && currentNonEmptyCount >= previousNonEmptyCount) {
        cleanHeader = parentHeader;
      }
      if (!cleanHeader) cleanHeader = `Sütun_${idx + 1}`;

      const duplicateIndex = headers.filter((existing) => existing === cleanHeader).length;
      headers.push(duplicateIndex ? `${cleanHeader}_${duplicateIndex + 1}` : cleanHeader);
    });

    const dateColumnIndexes = headers
      .map((header, index) => ({ header: header.toLocaleLowerCase('az-AZ'), index }))
      .filter(({ header }) =>
        /(^|[^a-z])(tarix|date|tarixi)([^a-z]|$)/i.test(header),
      )
      .map(({ index }) => index);
    const formatCellValue = (value: any, isDateColumn = false) => {
      if (!isDateColumn) return cellText(value);
      if (typeof value === 'number' && Number.isFinite(value)) {
        const excelDate = XLSX.SSF.parse_date_code(value);
        if (excelDate) {
          return formatDateParts(excelDate.y, excelDate.m, excelDate.d);
        }
      }
      return cellText(value);
    };

    const data: any[] = [];
    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i] || [];
      const hasData = row.some((value) => !isEmpty(value));
      if (!hasData) continue;

      const rowValues = row.slice(0, columnCount).map((value, index) =>
        formatCellValue(value, dateColumnIndexes.includes(index)),
      );
      const matchingHeaderCells = rowValues.filter(
        (value, index) => value && value.toLowerCase() === headers[index]?.toLowerCase(),
      ).length;
      if (matchingHeaderCells >= Math.max(2, Math.ceil(headers.length / 2))) continue;

      const rowData: Record<string, any> = {};
      headers.forEach((header, colIdx) => {
        rowData[header] = formatCellValue(
          row[colIdx],
          dateColumnIndexes.includes(colIdx),
        );
      });

      if (requestedDateFrom && requestedDateTo && dateColumnIndexes.length > 0) {
        const rowDate = dateColumnIndexes
          .map((index) => parseDateOnly(formatCellValue(row[index], true)))
          .find((date): date is Date => Boolean(date));
        if (!rowDate || rowDate < requestedDateFrom || rowDate > requestedDateTo) {
          continue;
        }
      }

      data.push(rowData);
    }

    return { data, headers, sheetName };
  }

  private mapModelName(selectedModel?: string): string {
    const supportedModels = new Set([
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]);

    return selectedModel && supportedModels.has(selectedModel)
      ? selectedModel
      : 'gemini-3.6-flash';
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

  private normalizeOutputDates(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeOutputDates(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.normalizeOutputDates(item),
        ]),
      );
    }

    if (typeof value !== 'string') return value;

    const isoDateMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return `${day}.${month}.${year}`;
    }

    return value;
  }

  private removeInternalFields(result: any): any {
    if (Array.isArray(result)) {
      return result.map((item) => this.removeInternalFields(item));
    }
    if (!result || typeof result !== 'object') return result;

    return Object.fromEntries(
      Object.entries(result)
        .filter(([key]) => key !== '_source_sheet')
        .map(([key, item]) => [key, this.removeInternalFields(item)]),
    );
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
3. Cədvəlin sütun adlarını əvvəlcədən təxmin etmə və standart sütun sxemi qəbul etmə. Sütunlar istənilən adda, sayda və ardıcıllıqda ola bilər.
4. Başlıqdan əvvəlki title, izah, qeyd və boş sətrləri data kimi qəbul etmə; yekun və qeyd sətrlərini yalnız istifadəçi istədikdə nəzərə al.
5. Backend tərəfindən tarix aralığına görə əvvəlcədən süzülmüş bütün sətirləri, xüsusilə başlanğıc və son sərhəd tarixlərini, heç birini buraxmadan qaytar. Sənəddən istifadəçinin verdiyi filtrləməyə/istəyə uyğun GƏLƏN BÜTÜN SƏTİRLƏRİ Tap və mövcud bütün sütunları qoru.
6. "discrepancies" massivində hər sətri obyekt kimi qaytar. Sütun adlarını sənəddəki formada saxla; boş hüceyrələri başqa sütuna keçirmə və məlumat uydurma.
7. Məlumatları "audit_notes" və ya "status" adında tək sahədə birləşdirmə. Sənəddəki hər sütun ayrıca açar olmalıdır.
8. Tarix sütunlarındakı bütün tarixləri yalnız gün.ay.il formatında (DD.MM.YYYY) qaytar. ISO formatı, "T" simvolu, saat, dəqiqə və saniyə yazma.
9. Eyni inventar bir neçə sətrdədirsə, sətrləri birləşdirmə, cəmləmə və təkrarları silmə. Mənbədə neçə uyğun sətir varsa, nəticədə də eyni sayda ayrıca sətir qaytar.
10. _source_sheet daxili texniki sahədir; onu nəticə sütunu kimi qaytarma.
11. JSON strukturu nümunəsi:
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
    const configuredModels = (process.env.GEMINI_MODELS || '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
    const modelsToTry = [modelToUse, ...configuredModels];
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError: any;
    let quotaError: any;
    let unavailableError: any;
    for (const model of uniqueModels) {
      for (let attempt = 0; attempt < 1; attempt++) {
        try {
          const response = await this.ai.models.generateContent({
            model,
            contents,
            config,
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const message = err?.message || String(err);
          const isUnavailable = err?.status === 503 || message.includes('"code":503');
          const isNotFound = err?.status === 404 || message.includes('"code":404');
          const isQuotaExceeded =
            err?.status === 429 ||
            message.includes('"code":429') ||
            message.includes('RESOURCE_EXHAUSTED') ||
            message.includes('Quota exceeded');

          if (isQuotaExceeded) {
            quotaError = err;
            break;
          }

          if (isUnavailable) {
            unavailableError = err;
            console.warn(`Model ${model} əlçatmazdır, alternativ model yoxlanılır.`);
            break;
          }

          if (isNotFound || !isUnavailable) break;
        }
      }

      console.warn(`Model ${model} istifadə edilə bilmədi, növbəti model sınanılır.`);
    }

    if (quotaError) {
      throw new HttpException(
        'Gemini API kvotası bitib. Google AI Studio-da billing/quota limitlərini yoxlayın və ya Flash modelindən istifadə edin.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (unavailableError) {
      throw new HttpException(
        'Gemini modeli hazırda yüksək tələbat səbəbilə müvəqqəti əlçatmazdır. Bu quota xətası deyil; bir neçə dəqiqə sonra yenidən cəhd edin.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
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

    return this.removeInternalFields(
      this.normalizeOutputDates(this.parseGeminiJsonResponse(response.text)),
    );
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
    let sysSheetName = '';
    let sysIsPdf = false;
    let sysPdfText = '';

    if (sysBuffer) {
      if (this.isPdf(sysBuffer)) {
        sysIsPdf = true;
        sysPdfText = await this.parsePdf(sysBuffer);
      } else {
        const parsed = await this.parseExcel(sysBuffer, customPrompt);
        sysData = parsed.data || [];
        sysHeaders = parsed.headers || [];
        sysSheetName = parsed.sheetName || '';
      }
    }

    let physData: any[] = [];
    let physHeaders: string[] = [];
    let physSheetName = '';
    let physIsPdf = false;
    let physPdfText = '';

    if (physBuffer) {
      if (this.isPdf(physBuffer)) {
        physIsPdf = true;
        physPdfText = await this.parsePdf(physBuffer);
      } else {
        const parsed = await this.parseExcel(physBuffer, customPrompt);
        physData = parsed.data || [];
        physHeaders = parsed.headers || [];
        physSheetName = parsed.sheetName || '';
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
        : `Sistem (Excel, sheet: ${sysSheetName}): ${JSON.stringify(sysData)}`;
      const physStr = physIsPdf
        ? `Fiziki (PDF): ${physPdfText}`
        : `Fiziki (Excel, sheet: ${physSheetName}): ${JSON.stringify(physData)}`;
      userMessage = `${sysStr}\n\n${physStr}`;
    } else if (sysBuffer) {
      userMessage = sysIsPdf
        ? `Sistem (PDF): ${sysPdfText}`
        : `Sistem (Excel, sheet: ${sysSheetName}): ${JSON.stringify(sysData)}`;
    } else {
      userMessage = physIsPdf
        ? `Fiziki (PDF): ${physPdfText}`
        : `Fiziki (Excel, sheet: ${physSheetName}): ${JSON.stringify(physData)}`;
    }

    const response = await this.generateContentWithFallback(
      modelToUse,
      userMessage,
      {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      },
    );

    const aiResult = this.removeInternalFields(
      this.normalizeOutputDates(this.parseGeminiJsonResponse(response.text)),
    );

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
