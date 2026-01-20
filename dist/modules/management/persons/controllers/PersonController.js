"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonController = void 0;
const responses_1 = require("../../../../shared/responses/responses");
class PersonController {
    personService;
    constructor(personService) {
        this.personService = personService;
    }
    async searchPersons(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { searchQuery } = req.query;
            const result = await this.personService.searchPersons(searchQuery);
            return responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('Error fetching persons:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch persons');
        }
    }
    async getAll(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { q, organizationId, limit = 100, offset = 0, includeDeleted } = req.query;
            const result = await this.personService.getAllPersons({
                search: q,
                organizationId: organizationId ? Number(organizationId) : undefined,
                limit: Number(limit),
                offset: Number(offset),
                includeDeleted: includeDeleted === 'true'
            });
            return responses_1.ResponseHandler.success(res, result);
        }
        catch (error) {
            console.error('Error fetching persons:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch persons');
        }
    }
    async getById(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const person = await this.personService.getPersonById(Number(id));
            if (!person) {
                return responses_1.ResponseHandler.notFound(res, 'Person not found');
            }
            return responses_1.ResponseHandler.success(res, person);
        }
        catch (error) {
            console.error('Error fetching person:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch person');
        }
    }
    async create(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { firstName, lastName, emails, phones, organizationId } = req.body;
            const person = await this.personService.createPerson({
                firstName: firstName || "",
                lastName: lastName || "",
                emails: emails || [],
                phones: phones || [],
                organizationId: organizationId || undefined
            });
            return responses_1.ResponseHandler.created(res, person, 'Person created successfully');
        }
        catch (error) {
            console.error('Error creating person:', error);
            if (error.message === 'Organisation not found') {
                return responses_1.ResponseHandler.validationError(res, 'Organisation not found');
            }
            if (error.message === 'Person already exists') {
                return responses_1.ResponseHandler.validationError(res, 'Person already exists');
            }
            return responses_1.ResponseHandler.internalError(res, 'Failed to create person');
        }
    }
    async update(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
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
                return responses_1.ResponseHandler.notFound(res, 'Person not found');
            }
            return responses_1.ResponseHandler.success(res, person, 'Person updated successfully');
        }
        catch (error) {
            console.error('Error updating person:', error);
            if (error.message === 'Organisation not found') {
                return responses_1.ResponseHandler.validationError(res, 'Organisation not found');
            }
            if (error.message === 'Person already exists') {
                return responses_1.ResponseHandler.validationError(res, 'Person already exists');
            }
            return responses_1.ResponseHandler.internalError(res, 'Failed to update person');
        }
    }
    async delete(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const success = await this.personService.deletePerson(Number(id));
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'Person not found');
            }
            return responses_1.ResponseHandler.success(res, null, 'Person deleted successfully');
        }
        catch (error) {
            console.error('Error deleting person:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete person');
        }
    }
    async restore(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const { id } = req.params;
            const person = await this.personService.restorePerson(Number(id));
            if (!person) {
                return responses_1.ResponseHandler.notFound(res, 'Person not found or not deleted');
            }
            return responses_1.ResponseHandler.success(res, person, 'Person restored successfully');
        }
        catch (error) {
            console.error('Error restoring person:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to restore person');
        }
    }
}
exports.PersonController = PersonController;
//# sourceMappingURL=PersonController.js.map