import { ImportError, DealImportData, ProcessResult, DuplicateHandling } from '../../types';
import { DealModel } from '../../../pipelines/models/Deal';
import { PipelineModel } from '../../../pipelines/models/Pipeline';
import { PipelineStageModel } from '../../../pipelines/models/PipelineStage';
import { PersonModel } from '../../../management/persons/models/Person';
import { OrganizationModel } from '../../../management/organisations/models/Organization';

export class DealProcessor {
    private dealModel: DealModel;
    private pipelineModel: PipelineModel;
    private stageModel: PipelineStageModel;
    private personModel: PersonModel;
    private orgModel: OrganizationModel;

    constructor(_db?: any) {
        this.dealModel = new DealModel();
        this.pipelineModel = new PipelineModel();
        this.stageModel = new PipelineStageModel();
        this.personModel = new PersonModel();
        this.orgModel = new OrganizationModel();
    }

    /**
     * Validate deal data
     */
    validate(data: DealImportData, rowNumber: number): ImportError[] {
        const errors: ImportError[] = [];

        try {
            // Required field validation
            if (!data.title?.trim()) {
                errors.push({
                    row: rowNumber,
                    column: 'title',
                    errorType: 'validation',
                    message: 'Deal title is required',
                });
            } else if (data.title.length > 255) {
                errors.push({
                    row: rowNumber,
                    column: 'title',
                    value: data.title,
                    errorType: 'validation',
                    message: 'Deal title must be less than 255 characters',
                });
            }

            // Value validation (optional but must be valid if provided)
            if (data.value !== undefined && data.value !== null && data.value !== '') {
                const value = Number(data.value);
                if (isNaN(value) || value < 0) {
                    errors.push({
                        row: rowNumber,
                        column: 'value',
                        value: data.value,
                        errorType: 'validation',
                        message: 'Deal value must be a positive number',
                    });
                }
            }

            // Probability validation
            if (data.probability !== undefined && data.probability !== null && data.probability !== '') {
                const prob = Number(data.probability);
                if (isNaN(prob) || prob < 0 || prob > 100) {
                    errors.push({
                        row: rowNumber,
                        column: 'probability',
                        value: data.probability,
                        errorType: 'validation',
                        message: 'Probability must be between 0 and 100',
                    });
                }
            }

            // Status validation
            if (data.status && !['Open', 'Won', 'Lost', 'OPEN', 'WON', 'LOST'].includes(data.status)) {
                errors.push({
                    row: rowNumber,
                    column: 'status',
                    value: data.status,
                    errorType: 'validation',
                    message: 'Status must be one of: Open, Won, Lost',
                });
            }

            // Date validation
            if (data.expectedCloseDate && !this.isValidDate(data.expectedCloseDate)) {
                errors.push({
                    row: rowNumber,
                    column: 'expectedCloseDate',
                    value: data.expectedCloseDate,
                    errorType: 'validation',
                    message: 'Invalid expected close date format',
                });
            }

        } catch (error) {
            errors.push({
                row: rowNumber,
                errorType: 'system',
                message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }

        return errors;
    }

    /**
     * Check for duplicates by title
     */
    async checkDuplicate(data: DealImportData, companyId: number): Promise<{ isDuplicate: boolean; existingId?: number; field?: string; value?: string }> {
        try {
            if (!data.title?.trim()) return { isDuplicate: false };

            const existing = await this.dealModel.findExistingByTitle(data.title.trim(), companyId);
            if (existing) {
                return {
                    isDuplicate: true,
                    existingId: existing.dealId,
                    field: 'title',
                    value: existing.title,
                };
            }

            return { isDuplicate: false };
        } catch (error) {
            console.error('Error checking duplicates:', error);
            return { isDuplicate: false };
        }
    }

    /**
     * Process a single deal record
     */
    async process(
        data: DealImportData,
        userId: number,
        companyId: number,
        duplicateHandling: DuplicateHandling
    ): Promise<ProcessResult> {
        try {
            // Check for duplicates
            const duplicateCheck = await this.checkDuplicate(data, companyId);

            if (duplicateCheck.isDuplicate) {
                switch (duplicateHandling) {
                    case 'skip':
                        return { status: 'skipped' };
                    case 'update':
                        return this.updateExistingDeal(duplicateCheck.existingId!, data, userId, companyId);
                    case 'error':
                        throw new Error(`Duplicate deal title found: ${duplicateCheck.value}`);
                    case 'create':
                        // Fall through to create new
                        break;
                }
            }

            // Resolve pipeline and stage (required)
            const { pipelineId, stageId } = await this.resolvePipelineAndStage(
                data.pipelineName,
                data.stageName,
                userId,
                companyId
            );

            // Resolve person if provided
            let personId: number | undefined;
            if (data.personName?.trim()) {
                try {
                    personId = await this.resolvePerson(data.personName.trim(), companyId);
                } catch (error) {
                    console.error('Error resolving person:', error);
                    // Continue without person
                }
            }

            // Resolve organization if provided
            let organizationId: number | undefined;
            if (data.organizationName?.trim()) {
                try {
                    organizationId = await this.resolveOrganization(data.organizationName.trim(), companyId);
                } catch (error) {
                    console.error('Error resolving organization:', error);
                    // Continue without organization
                }
            }

            // Parse status
            const status = this.parseStatus(data.status);

            // Parse dates
            const expectedCloseDate = data.expectedCloseDate ? this.parseDate(data.expectedCloseDate) : undefined;
            const actualCloseDate = this.parseActualCloseDate(data, status);

            // Create new deal
            const deal = await this.dealModel.create({
                title: data.title.trim(),
                value: data.value ? Number(data.value) : 0,
                currency: data.currency?.trim() || 'USD',
                pipelineId,
                stageId,
                personId,
                organizationId,
                companyId,
                description: data.description?.trim(),
                expectedCloseDate,
                actualCloseDate,
                probability: data.probability ? Number(data.probability) : 0,
                status,
                lostReason: data.lostReason?.trim(),
                source: data.source?.trim() || 'Import',
                userId,
                isVisibleToAll: true,
            });

            return { status: 'created', id: deal.id };
        } catch (error) {
            throw new Error(`Failed to process deal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update existing deal
     */
    private async updateExistingDeal(
        dealId: number,
        data: DealImportData,
        userId: number,
        companyId: number
    ): Promise<ProcessResult> {
        const { pipelineId, stageId } = await this.resolvePipelineAndStage(
            data.pipelineName,
            data.stageName,
            userId,
            companyId
        );

        let personId: number | undefined;
        if (data.personName?.trim()) {
            personId = await this.resolvePerson(data.personName.trim(), companyId);
        }

        let organizationId: number | undefined;
        if (data.organizationName?.trim()) {
            organizationId = await this.resolveOrganization(data.organizationName.trim(), companyId);
        }

        const status = this.parseStatus(data.status);
        const expectedCloseDate = data.expectedCloseDate ? this.parseDate(data.expectedCloseDate) : undefined;
        const actualCloseDate = this.parseActualCloseDate(data, status);

        await this.dealModel.update(dealId, companyId, userId, {
            title: data.title.trim(),
            value: data.value ? Number(data.value) : 0,
            currency: data.currency?.trim() || 'USD',
            pipelineId,
            stageId,
            personId,
            organizationId,
            description: data.description?.trim(),
            expectedCloseDate,
            actualCloseDate,
            probability: data.probability ? Number(data.probability) : 0,
            status,
            lostReason: data.lostReason?.trim(),
            source: data.source?.trim() || 'Import',
        });

        return { status: 'updated', id: dealId };
    }

    /**
     * Resolve pipeline and stage (create default if not found)
     */
    private async resolvePipelineAndStage(
        pipelineName: string | undefined,
        stageName: string | undefined,
        userId: number,
        companyId: number
    ): Promise<{ pipelineId: number; stageId: number }> {
        // Get or create pipeline
        let pipelineId: number;

        if (pipelineName?.trim()) {
            const existing = await this.pipelineModel.searchByPipelineName(pipelineName.trim(), companyId);
            const exactMatch = existing.find(p => p.name.toLowerCase() === pipelineName.trim().toLowerCase());

            if (exactMatch) {
                pipelineId = exactMatch.id;
            } else {
                // Create new pipeline
                const pipeline = await this.pipelineModel.create({
                    companyId,
                    name: pipelineName.trim(),
                    userId,
                    isDefault: false,
                    isActive: true,
                    dealRotting: false,
                    rottenDays: 30,
                    ownerIds: [userId],
                });
                pipelineId = pipeline.id;
            }
        } else {
            // Use default pipeline
            const pipelines = await this.pipelineModel.findAccessiblePipelines(userId, companyId);
            const defaultPipeline = pipelines.find(p => p.isDefault);

            if (defaultPipeline) {
                pipelineId = defaultPipeline.id;
            } else if (pipelines.length > 0) {
                pipelineId = pipelines[0]!.id;
            } else {
                // Create default pipeline
                const pipeline = await this.pipelineModel.create({
                    companyId,
                    name: 'Default Pipeline',
                    userId,
                    isDefault: true,
                    isActive: true,
                    dealRotting: false,
                    rottenDays: 30,
                    ownerIds: [userId],
                });
                pipelineId = pipeline.id;
            }
        }

        // Get or create stage
        let stageId: number;
        const stages = await this.stageModel.findByPipelineId(pipelineId, companyId);

        if (stageName?.trim()) {
            const exactMatch = stages.find(s => s.name.toLowerCase() === stageName.trim().toLowerCase());

            if (exactMatch) {
                stageId = exactMatch.id;
            } else {
                // Create new stage
                const stage = await this.stageModel.create({
                    companyId,
                    pipelineId,
                    name: stageName.trim(),
                    orderIndex: stages.length,
                    probability: 50,
                });
                stageId = stage.id;
            }
        } else {
            // Use first stage or create default
            if (stages.length > 0) {
                stageId = stages[0]!.id;
            } else {
                const stage = await this.stageModel.create({
                    companyId,
                    pipelineId,
                    name: 'New',
                    orderIndex: 0,
                    probability: 10,
                });
                stageId = stage.id;
            }
        }

        return { pipelineId, stageId };
    }

    /**
     * Resolve person by name (create if doesn't exist)
     */
    private async resolvePerson(name: string, companyId: number): Promise<number> {
        // Try to find existing person
        const nameParts = name.split(/\s+/);
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(' ') || '';

        // Search by name
        const existing = await this.personModel.searchByPersonName(name, companyId);
        if (existing.length > 0) {
            return existing[0]!.id;
        }

        // Create new person
        const person = await this.personModel.create({
            firstName,
            lastName,
            companyId,
            emails: [],
            phones: [],
        });
        return person.id;
    }

    /**
     * Resolve organization by name (create if doesn't exist)
     */
    private async resolveOrganization(name: string, companyId: number): Promise<number> {
        const existing = await this.orgModel.searchByOrgName(name, companyId);
        const exactMatch = existing.find(org => org.name.toLowerCase() === name.toLowerCase());

        if (exactMatch) {
            return exactMatch.id;
        }

        // Create new organization
        const org = await this.orgModel.create({ name, companyId });
        return org.id;
    }

    /**
     * Parse status from import data
     */
    private parseStatus(status: string | undefined): 'OPEN' | 'WON' | 'LOST' {
        if (!status) return 'OPEN';

        const normalized = status.trim().toUpperCase();
        if (normalized === 'WON') return 'WON';
        if (normalized === 'LOST') return 'LOST';
        return 'OPEN';
    }

    /**
     * Parse actual close date based on status and provided dates
     */
    private parseActualCloseDate(data: DealImportData, status: 'OPEN' | 'WON' | 'LOST'): string | undefined {
        if (status === 'WON' && data.wonTime) {
            return this.parseDate(data.wonTime);
        }
        if (status === 'LOST' && data.lostTime) {
            return this.parseDate(data.lostTime);
        }
        return undefined;
    }

    /**
     * Parse date string to ISO format
     */
    private parseDate(dateStr: string): string | undefined {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return undefined;
            return date.toISOString();
        } catch {
            return undefined;
        }
    }

    /**
     * Validate date format
     */
    private isValidDate(dateStr: string): boolean {
        try {
            const date = new Date(dateStr);
            return !isNaN(date.getTime());
        } catch {
            return false;
        }
    }

    /**
     * Get field definitions for mapping suggestions
     */
    static getFieldDefinitions(): { name: string; type: string; required: boolean; aliases: string[] }[] {
        return [
            {
                name: 'title',
                type: 'string',
                required: true,
                aliases: ['title', 'deal title', 'name', 'deal name', 'Title']
            },
            {
                name: 'value',
                type: 'number',
                required: false,
                aliases: ['value', 'amount', 'deal value', 'price', 'Value']
            },
            {
                name: 'currency',
                type: 'string',
                required: false,
                aliases: ['currency', 'Currency of Value', 'Currency']
            },
            {
                name: 'pipelineName',
                type: 'string',
                required: false,
                aliases: ['pipeline', 'pipeline name', 'Pipeline']
            },
            {
                name: 'stageName',
                type: 'string',
                required: false,
                aliases: ['stage', 'stage name', 'deal stage', 'Stage']
            },
            {
                name: 'personName',
                type: 'string',
                required: false,
                aliases: ['person', 'contact person', 'contact', 'Contact person']
            },
            {
                name: 'organizationName',
                type: 'string',
                required: false,
                aliases: ['organization', 'company', 'org', 'Organization']
            },
            {
                name: 'status',
                type: 'string',
                required: false,
                aliases: ['status', 'deal status', 'Status']
            },
            {
                name: 'probability',
                type: 'number',
                required: false,
                aliases: ['probability', 'win probability', 'Probability']
            },
            {
                name: 'expectedCloseDate',
                type: 'string',
                required: false,
                aliases: ['expected close date', 'close date', 'Expected close date']
            },
            {
                name: 'wonTime',
                type: 'string',
                required: false,
                aliases: ['won time', 'won date', 'Won time']
            },
            {
                name: 'lostTime',
                type: 'string',
                required: false,
                aliases: ['lost time', 'lost date', 'Lost time']
            },
            {
                name: 'lostReason',
                type: 'string',
                required: false,
                aliases: ['lost reason', 'reason', 'Lost reason']
            },
            {
                name: 'description',
                type: 'string',
                required: false,
                aliases: ['description', 'notes', 'details', 'comments']
            },
            {
                name: 'source',
                type: 'string',
                required: false,
                aliases: ['source', 'lead source', 'Source origin']
            },
        ];
    }

    /**
     * Delete deal (for rollback)
     */
    async delete(id: number, companyId: number): Promise<boolean> {
        return this.dealModel.hardDelete(id, companyId);
    }
}
