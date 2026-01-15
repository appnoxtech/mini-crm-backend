import { PersonModel, CreatePersonData, UpdatePersonData, Person } from '../models/Person';
import { OrganizationModel } from '../../organisations/models/Organisation';

export class PersonService {
    constructor(
        private personModel: PersonModel,
        private organizationModel?: OrganizationModel
    ) { }

    async createPerson(data: CreatePersonData): Promise<Person> {
        // Validate organization exists if provided
        if (data.organizationId && this.organizationModel) {
            const org = this.organizationModel.findById(data.organizationId);
            if (!org) {
                throw new Error('Organization not found');
            }
        }

        // Validate at least one email
        if (!data.emails || data.emails.length === 0) {
            throw new Error('At least one email is required');
        }

        // Validate email format
        for (const email of data.emails) {
            if (!email.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.email)) {
                throw new Error('Invalid email format');
            }
        }

        return this.personModel.create(data);
    }

    async searchPersons(search?: string): Promise<Person[]> {
        return this.personModel.searchByPersonName(search || '');
    }

    async getPersonsByOrganization(organizationId: number): Promise<Person[]> {
        return this.personModel.findByorganizationId(organizationId);
    }

    async updatePerson(id: number, data: UpdatePersonData): Promise<Person | null> {
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


    async getPersonById(id: number, includeDeleted = false): Promise<Person | undefined> {
        return this.personModel.findById(id, includeDeleted);
    }

    async getAllPersons(options: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        return this.personModel.findAll(options);
    }

    async deletePerson(id: number): Promise<boolean> {
        return this.personModel.softDelete(id);
    }

    async restorePerson(id: number): Promise<Person | null> {
        return this.personModel.restore(id);
    }

    async permanentlyDeletePerson(id: number): Promise<boolean> {
        return this.personModel.hardDelete(id);
    }
}