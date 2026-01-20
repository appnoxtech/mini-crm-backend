"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonService = void 0;
class PersonService {
    personModel;
    organizationModel;
    constructor(personModel, organizationModel) {
        this.personModel = personModel;
        this.organizationModel = organizationModel;
    }
    async createPerson(data) {
        // Validate organization exists if provided
        if (data.organizationId && this.organizationModel) {
            const org = this.organizationModel.findById(data.organizationId);
            if (!org) {
                throw new Error('Organization not found');
            }
        }
        return this.personModel.create(data);
    }
    async searchPersons(search) {
        return this.personModel.searchByPersonName(search || '');
    }
    async getPersonsByOrganization(organizationId) {
        return this.personModel.findByorganizationId(organizationId);
    }
    async updatePerson(id, data) {
        console.log(data);
        if (data.organizationId !== undefined && this.organizationModel) {
            const organizationId = Number(data.organizationId);
            const org = this.organizationModel.findById(organizationId, false);
            if (!org) {
                throw new Error('Organization not found');
            }
        }
        if (data.emails) {
            if (data.emails.length === 0) {
                throw new Error('At least one email is required');
            }
            for (const email of data.emails) {
                if (!email.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.email)) {
                    throw new Error('Invalid email format');
                }
            }
        }
        return this.personModel.update(id, data);
    }
    async getPersonById(id, includeDeleted = false) {
        const person = this.personModel.findById(id, includeDeleted);
        if (!person) {
            return null;
        }
        const organization = person.organizationId && this.organizationModel
            ? this.organizationModel.findById(person.organizationId)
            : null;
        return {
            ...person,
            organization: organization || null
        };
    }
    async getAllPersons(options = {}) {
        return this.personModel.findAll(options);
    }
    async deletePerson(id) {
        return this.personModel.softDelete(id);
    }
    async restorePerson(id) {
        return this.personModel.restore(id);
    }
    async permanentlyDeletePerson(id) {
        return this.personModel.hardDelete(id);
    }
}
exports.PersonService = PersonService;
//# sourceMappingURL=PersonService.js.map