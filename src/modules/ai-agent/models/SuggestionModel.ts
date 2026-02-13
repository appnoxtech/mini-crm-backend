import { prisma } from '../../../shared/prisma';

import { EmailSuggestion } from '../types';

export class SuggestionModel {
    constructor(_db?: any) { }

    private mapPrismaToSuggestion(s: any): EmailSuggestion {
        return {
            id: s.id,
            companyId: s.companyId,
            dealId: s.dealId || undefined,
            personId: s.personId || undefined,
            subjectLine: s.subjectLine,
            body: s.body,
            htmlBody: s.htmlBody || undefined,
            emailType: s.emailType as EmailSuggestion['emailType'],
            confidenceScore: s.confidenceScore || 0,
            reasoning: s.reasoning || '',
            qualityScore: s.qualityScore || 0,
            issues: s.issues ? (typeof s.issues === 'string' ? JSON.parse(s.issues) : s.issues) : [],
            status: s.status as EmailSuggestion['status'],
            userEdits: s.userEdits ? (typeof s.userEdits === 'string' ? JSON.parse(s.userEdits) : s.userEdits) : undefined,
            sentAt: s.sentAt ? new Date(s.sentAt) : undefined,
            createdAt: new Date(s.createdAt)
        };
    }

    async createSuggestion(data: Omit<EmailSuggestion, 'id'>): Promise<string> {
        const row = await prisma.emailSuggestion.create({
            data: {
                companyId: data.companyId,
                dealId: data.dealId || null,
                personId: data.personId || null,
                subjectLine: data.subjectLine,
                body: data.body,
                htmlBody: data.htmlBody || null,
                emailType: data.emailType,
                confidenceScore: data.confidenceScore || null,
                reasoning: data.reasoning || null,
                qualityScore: data.qualityScore || null,
                issues: data.issues as any || [],
                status: data.status || 'generated',
                userEdits: data.userEdits ? (typeof data.userEdits === 'object' ? JSON.stringify(data.userEdits) : data.userEdits) : null
            }
        });
        return row.id;
    }

    async findById(id: string, companyId: number): Promise<EmailSuggestion | null> {
        const row = await prisma.emailSuggestion.findFirst({
            where: { id, companyId }
        });
        return row ? this.mapPrismaToSuggestion(row) : null;
    }

    async findByDealId(dealId: number, companyId: number): Promise<EmailSuggestion[]> {
        const rows = await prisma.emailSuggestion.findMany({
            where: { dealId, companyId },
            orderBy: { createdAt: 'desc' }
        });
        return rows.map((row: any) => this.mapPrismaToSuggestion(row));
    }

    async findByPersonId(personId: number, companyId: number): Promise<EmailSuggestion[]> {
        const rows = await prisma.emailSuggestion.findMany({
            where: { personId, companyId },
            orderBy: { createdAt: 'desc' }
        });
        return rows.map((row: any) => this.mapPrismaToSuggestion(row));
    }

    async updateSuggestion(id: string, companyId: number, data: Partial<EmailSuggestion>): Promise<void> {
        const updateData: any = {};
        if (data.status) updateData.status = data.status;
        if (data.userEdits) updateData.userEdits = typeof data.userEdits === 'object' ? JSON.stringify(data.userEdits) : data.userEdits;
        if (data.sentAt) updateData.sentAt = new Date(data.sentAt);

        await prisma.emailSuggestion.updateMany({
            where: { id, companyId },
            data: updateData
        });
    }
}
