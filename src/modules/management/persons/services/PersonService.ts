import { PersonModel, CreatePersonData, UpdatePersonData, Person } from '../models/Person';
import { OrganizationModel, Organization } from '../../organisations/models/Organization';

export class PersonService {
    constructor(
        private personModel: PersonModel,
        private organizationModel?: OrganizationModel
    ) { }

    private async populateOrganizations(persons: Person[], companyId: number): Promise<Person[]> {
        if (!this.organizationModel) return persons;

        const organizationIds = Array.from(new Set(
            persons
                .map(p => p.organizationId)
                .filter((id): id is number => !!id)
        ));

        if (organizationIds.length === 0) return persons;

        const organizations = await this.organizationModel.findByIds(organizationIds, companyId);
        const orgMap = new Map(organizations.map((org: any) => [org.id, org]));

        return persons.map(person => ({
            ...person,
            organization: person.organizationId ? orgMap.get(person.organizationId) || null : null
        }));
    }

    async createPerson(data: CreatePersonData): Promise<Person> {
        // Validate organization exists if provided
        if (data.organizationId && this.organizationModel) {
            const org = await this.organizationModel.findById(data.organizationId, data.companyId);
            if (!org) {
                throw new Error('Organization not found');
            }
        }

        return await this.personModel.create(data);
    }

    async searchPersons(search: string, companyId: number): Promise<Person[]> {
        const persons = await this.personModel.searchByPersonName(search || '', companyId);
        return this.populateOrganizations(persons, companyId);
    }

    async getPersonsByOrganization(organizationId: number, companyId: number): Promise<Person[]> {
        const persons = await this.personModel.findByorganizationId(organizationId, companyId);
        return this.populateOrganizations(persons, companyId);
    }

    async updatePerson(id: number, companyId: number, data: UpdatePersonData): Promise<Person | null> {
        if (data.organizationId !== undefined && this.organizationModel) {
            const organizationId = Number(data.organizationId);
            const org = await this.organizationModel.findById(organizationId, companyId, false);
            if (!org) {
                throw new Error('Organization not found');
            }
        }

        return await this.personModel.update(id, companyId, data);
    }

    async getPersonById(id: number, companyId: number, includeDeleted = false): Promise<Person | null> {
        const person = await this.personModel.findById(id, companyId, includeDeleted);

        if (!person) {
            return null;
        }

        const populated = await this.populateOrganizations([person], companyId);
        return populated[0] || null;
    }

    async getAllPersons(options: {
        companyId: number;
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): Promise<{ persons: Person[]; count: number }> {
        const { persons, count } = await this.personModel.findAll(options);
        const populatedPersons = await this.populateOrganizations(persons, options.companyId);
        return { persons: populatedPersons, count };
    }

    async deletePerson(id: number, companyId: number): Promise<boolean> {
        return this.personModel.softDelete(id, companyId);
    }

    async restorePerson(id: number, companyId: number): Promise<Person | null> {
        return this.personModel.restore(id, companyId);
    }

    async permanentlyDeletePerson(id: number, companyId: number): Promise<boolean> {
        return this.personModel.hardDelete(id, companyId);
    }
}