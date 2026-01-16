import { Response } from 'express';
import { PersonService } from '../services/PersonService';
import { AuthenticatedRequest } from '../../../../shared/types';
import { ResponseHandler } from '../../../../shared/responses/responses';

export class PersonController {
    constructor(private personService: PersonService) { }

    async searchPersons(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { searchQuery } = req.query as any;

            const result = await this.personService.searchPersons(searchQuery as string);

            return ResponseHandler.success(res, result);
        } catch (error) {
            console.error('Error fetching persons:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch persons');
        }
    }

    async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { q, organisationId, limit = 100, offset = 0, includeDeleted } = req.query as any;

            const result = await this.personService.getAllPersons({
                search: q as string,
                organizationId: organisationId ? Number(organisationId) : undefined,
                limit: Number(limit),
                offset: Number(offset),
                includeDeleted: includeDeleted === 'true'
            });

            return ResponseHandler.success(res, result);
        } catch (error) {
            console.error('Error fetching persons:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch persons');
        }
    }

    async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const person = await this.personService.getPersonById(Number(id));

            if (!person) {
                return ResponseHandler.notFound(res, 'Person not found');
            }

            return ResponseHandler.success(res, person);
        } catch (error) {
            console.error('Error fetching person:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch person');
        }
    }

    async create(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { firstName, lastName, emails, phones, organisationId } = req.body;

            const person = await this.personService.createPerson({
                firstName,
                lastName,
                emails,
                phones: phones || [],
                organizationId: organisationId || undefined
            });

            return ResponseHandler.created(res, person, 'Person created successfully');
        } catch (error: any) {
            console.error('Error creating person:', error);
            if (error.message === 'Organisation not found') {
                return ResponseHandler.validationError(res, 'Organisation not found');
            }
            if (error.message === 'Person already exists') {
                return ResponseHandler.validationError(res, 'Person already exists');
            }
            return ResponseHandler.internalError(res, 'Failed to create person');
        }
    }

    async update(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const { firstName, lastName, emails, phones, organizationId } = req.body;

            console.log("Req body", req.body);

            const person = await this.personService.updatePerson(Number(id), {
                firstName,
                lastName,
                emails,
                phones,
                organizationId: organizationId || undefined
            });

            if (!person) {
                return ResponseHandler.notFound(res, 'Person not found');
            }

            return ResponseHandler.success(res, person, 'Person updated successfully');
        } catch (error: any) {
            console.error('Error updating person:', error);
            if (error.message === 'Organisation not found') {
                return ResponseHandler.validationError(res, 'Organisation not found');
            }
            if (error.message === 'Person already exists') {
                return ResponseHandler.validationError(res, 'Person already exists');
            }
            return ResponseHandler.internalError(res, 'Failed to update person');
        }
    }

    async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const success = await this.personService.deletePerson(Number(id));

            if (!success) {
                return ResponseHandler.notFound(res, 'Person not found');
            }

            return ResponseHandler.success(res, null, 'Person deleted successfully');
        } catch (error) {
            console.error('Error deleting person:', error);
            return ResponseHandler.internalError(res, 'Failed to delete person');
        }
    }

    async restore(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const { id } = req.params;
            const person = await this.personService.restorePerson(Number(id));

            if (!person) {
                return ResponseHandler.notFound(res, 'Person not found or not deleted');
            }

            return ResponseHandler.success(res, person, 'Person restored successfully');
        } catch (error) {
            console.error('Error restoring person:', error);
            return ResponseHandler.internalError(res, 'Failed to restore person');
        }
    }
}
