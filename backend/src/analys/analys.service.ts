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
    private anthropic = new Anthropic({ apiKey: "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" });

    constructor(
        @InjectModel(Analys.name) private readonly analysModel: Model<Analys>,
    ) { }

    // Helper to check if a buffer is a PDF
    private isPdf(buffer: Buffer): boolean {
        return buffer && buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
    }

    // Helper to parse PDF text content
    private async parsePdf(buffer: Buffer): Promise<string> {
        try {
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            return result.text || '';
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('PDF faylı oxunarkən xəta baş verdi: ' + error.message);
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
    async processFiles(sysBuffer?: Buffer, physBuffer?: Buffer, fileName?: string, user?: string, customPrompt?: string, selectedModel?: string, userId?: string) {
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
            systemInstruction =
                `Sən peşəkar bir inventar auditorusan. Sənə ${isComparison ? 'iki cədvəl/sənəd (Sistem və Fiziki)' : 'bir inventar sənədi'} verilir.
         İstifadəçinin xüsusi tələbi var. Sən standart qarşılaşdırma alqoritmini və qaydalarını kənara qoyaraq, YALNIZ və YALNIZ bu tələbə uyğun olaraq sənəd və ya cədvəlləri analiz etməlisən:
         Tələb: "${customPrompt}"

         Göstərişlər:
         1. Cavabın YALNIZ və YALNIZ təmiz JSON formatında olmalıdır.
         2. Cavabın əvvəlində və ya sonunda heç bir Markdown bloku (məsələn: \`\`\`json və ya \`\`\`) istifadə etmə.
         3. Analizdən sonrakı çıxış mətni "Təbriklər, təhlil bitdi." sözü ilə bitsin.
         4. Analiz nəticəsini bu JSON strukturunda qaytar:
  {
    "context": "Analizin mövzusu (məs: '${customPrompt}' tələbi üzrə analiz)",
    "discrepancies": [
      {
        // ƏGƏR İSTİFADƏÇİ ÖZ PROMPTUNDA XÜSUSİ SÜTUNLAR TƏLƏB EDİBSƏ (məsələn: yalnız kod, məhsul və sayı), 
        // OBYEKTLƏRİN AÇARLARINI (SÜTUN ADLARINI) HƏMİN TƏLƏBƏ UYĞUN OLARAQ SƏRBƏST FORMALAŞDIR (məsələn: "Kod", "Məhsul", "Sayı").
        // Əlavə, lazımsız və ya tələb olunmayan heç bir sütun (məs: vahid, fərq, status) daxil etmə.
      }
    ],
    "recommendations": ["Tələbə uyğun ümumi tövsiyə 1", "Tələbə uyğun ümumi tövsiyə 2"],
    "data_quality_score": 0-100 arası dəqiqlik dərəcəsi
  }
             `;
        } else {
            if (isComparison) {
                systemInstruction =
                    `Sən peşəkar bir inventar auditorusan. İki sənədi (Sistem vs Fiziki) qarşılaşdırıb hər bir fərqli olan element üçün uyğunsuzluq cədvəli yaradırsan. Sənədlər Excel cədvəli və ya PDF mətn formatında ola bilər.
           1. Cavabın YALNIZ və YALNIZ təmiz JSON formatında olmalıdır.
           2. Cavabın əvvəlində və ya sonunda heç bir Markdown bloku (məsələn: \`\`\`json və ya \`\`\`) istifadə etmə.
           3. Analizdən sonrakı çıxış mətni "Təbriklər, təhlil bitdi." sözü ilə bitsin.
           4. Məlumatı analiz etdikdən sonra fərqli elementləri tapıb bu strukturu tam qoru:
  {
    "context": "Məlumatın mövzusu",
    "discrepancies": [
      {
        "code": "SKU kodu və ya İdentifikator (məs: CB-00047256)",
        "product_file1": "Baza/Sistem sənədindəki məhsulun adı",
        "product_file2": "Fiziki sayım sənədindəki məhsulun adı",
        "unit": "ölçü vahidi (məs: əd)",
        "qty_file1": Sistem sənədindəki miqdar (rəqəm),
        "qty_file2": Fiziki sənədindəki miqdar (rəqəm),
        "diff": İki miqdar arasındakı fərq (rəqəm),
        "status_recommendation": "Bu uyğunsuzluq üçün tövsiyə və status mətni (məs: HP çanta üzrə 2 əd artıqlıq sistemə daxil edilməlidir)"
      }
    ],
    "recommendations": ["Ümumi Tövsiyə 1", "Ümumi Tövsiyə 2"],
    "data_quality_score": 0-100 arası dəqiqlik dərəcəsi. Bunu bu düsturla hesabla: Math.round(((ümumi_sətirlərin_sayı - fərqli_elementlərin_sayı) / ümumi_sətirlərin_sayı) * 100)
  }
              `;
            } else {
                systemInstruction =
                    `Sən peşəkar bir inventar auditorusan. Sənə verilən tək sənədi (Excel və ya PDF mətni) analiz edib hər hansı bir uyğunsuzluq, anomaliya və ya təkmilləşdirmə imkanı tapmalısan.
           1. Cavabın YALNIZ və YALNIZ təmiz JSON formatında olmalıdır.
           2. Cavabın əvvəlində və ya sonunda heç bir Markdown bloku (məsələn: \`\`\`json və ya \`\`\`) istifadə etmə.
           3. Analizdən sonrakı çıxış mətni "Təbriklər, təhlil bitdi." sözü ilə bitsin.
           4. Məlumatı analiz etdikdən sonra bu strukturu tam qoru:
  {
    "context": "Məlumatın mövzusu (məs: Tək sənəd üzrə anomaliya analizi)",
    "discrepancies": [
      {
        "code": "SKU kodu və ya İdentifikator",
        "item": "Məhsulun adı",
        "issue": "Tapılan problem və ya anomaliya",
        "qty": "Mövcud miqdar",
        "severity": "Ciddilik dərəcəsi (Yüksək, Orta, Aşağı)",
        "recommendation": "Tövsiyə"
      }
    ],
    "recommendations": ["Ümumi Tövsiyə 1", "Ümumi Tövsiyə 2"],
    "data_quality_score": 0-100 arası məlumat keyfiyyəti dərəcəsi.
  }
              `;
            }
        }

        // User payload content
        let userMessage = '';
        if (sysBuffer && physBuffer) {
            const sysStr = sysIsPdf ? `Sistem (PDF): ${sysPdfText}` : `Sistem (Excel): ${JSON.stringify(sysData)}`;
            const physStr = physIsPdf ? `Fiziki (PDF): ${physPdfText}` : `Fiziki (Excel): ${JSON.stringify(physData)}`;
            userMessage = `${sysStr}\n\n${physStr}`;
        } else if (sysBuffer) {
            userMessage = sysIsPdf ? `Sistem (PDF): ${sysPdfText}` : `Sistem (Excel): ${JSON.stringify(sysData)}`;
        } else {
            userMessage = physIsPdf ? `Fiziki (PDF): ${physPdfText}` : `Fiziki (Excel): ${JSON.stringify(physData)}`;
        }

        // Dəstəklənən modellər:
        // 1. Claude Haiku: "claude-haiku-4-5-20251001"
        // 2. Claude Sonnet 4.5: "claude-sonnet-4-5-20250929"
        // 3. Claude Sonnet 4.6: "claude-sonnet-4-6"
        const allowedModels = ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929", "claude-sonnet-4-6"];
        const modelToUse = allowedModels.includes(selectedModel) ? selectedModel : "claude-sonnet-4-6";

        const response = await this.anthropic.messages.create({
            model: modelToUse,
            max_tokens: 16000,
            system: systemInstruction,
            messages: [
                { role: "user", content: userMessage }
            ],
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
        const sysRowsCount = sysIsPdf ? (sysPdfText.split('\n').filter(l => l.trim()).length || 1) : (sysData?.length || 0);
        const physRowsCount = physIsPdf ? (physPdfText.split('\n').filter(l => l.trim()).length || 1) : (physData?.length || 0);
        const totalRows = Math.max(sysRowsCount, physRowsCount, 1);
        const discrepanciesCount = aiResult.discrepancies?.length || 0;
        aiResult.data_quality_score = Math.max(0, Math.min(100, Math.round(((totalRows - discrepanciesCount) / totalRows) * 100)));

        // 3. MongoDB-yə yaz
        const auditEntry = new this.analysModel({
            fileName: `${fileName}`,
            dataContent: aiResult,
            metadata: {
                columnNames: [...new Set([...sysHeaders, ...physHeaders])],
                user,
                userId,
                customPrompt,
                model: modelToUse
            },
            status: 'Təsdiqləndi'
        });

        return await auditEntry.save();
    }


    async findAll(userId?: string) {
        const query = userId ? { "metadata.userId": userId } : {};
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
            'code': 'Kod',
            'product_file1': 'Məhsul (Sistem)',
            'product_file2': 'Məhsul (Fiziki)',
            'unit': 'Vahid',
            'qty_file1': 'Miqdar (Sistem)',
            'qty_file2': 'Miqdar (Fiziki)',
            'diff': 'Fərq',
            'status_recommendation': 'Status / Tövsiyə',
            'item': 'Məhsul',
            'issue': 'Problem/Uyğunsuzluq',
            'qty': 'Miqdar',
            'severity': 'Ciddilik',
            'recommendation': 'Tövsiyə'
        };

        const discrepancies = audit.dataContent.discrepancies;
        if (discrepancies.length > 0) {
            const rawHeaders = Object.keys(discrepancies[0]);
            // Azərbaycan dilində başlıqları yaradırıq
            const azHeaders = rawHeaders.map(h => headerMap[h] || h.charAt(0).toUpperCase() + h.slice(1));

            worksheet.addRow(azHeaders);

            discrepancies.forEach((item) => {
                const row = rawHeaders.map((h) => item[h]);
                worksheet.addRow(row);
            });

            // Sütunların stilini düzəldirik
            worksheet.getRow(1).font = { bold: true };
            worksheet.columns.forEach(column => {
                column.width = 25;
            });
        }

        return await workbook.xlsx.writeBuffer();
    }
}