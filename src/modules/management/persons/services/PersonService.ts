import { PersonModel, CreatePersonData, UpdatePersonData, Person } from '../models/Person';
import { OrganizationModel, Organization } from '../../organisations/models/Organization';

export class PersonService {
    constructor(
        private personModel: PersonModel,
        private organizationModel?: OrganizationModel
    ) { }

    private async populateOrganizations(persons: Person[]): Promise<Person[]> {
        if (!this.organizationModel) return persons;

        const organizationIds = Array.from(new Set(
            persons
                .map(p => p.organizationId)
                .filter((id): id is number => !!id)
        ));

        if (organizationIds.length === 0) return persons;

        const organizations = this.organizationModel.findByIds(organizationIds);
        const orgMap = new Map(organizations.map(org => [org.id, org]));

        return persons.map(person => ({
            ...person,
            organization: person.organizationId ? orgMap.get(person.organizationId) || null : null
        }));
    }

    async createPerson(data: CreatePersonData): Promise<Person> {
        // Validate organization exists if provided
        if (data.organizationId && this.organizationModel) {
            const org = this.organizationModel.findById(data.organizationId);
            if (!org) {
                throw new Error('Organization not found');
            }
        }

        return this.personModel.create(data);
    }

    async searchPersons(search?: string): Promise<Person[]> {
        const persons = await this.personModel.searchByPersonName(search || '');
        return this.populateOrganizations(persons);
    }

    async getPersonsByOrganization(organizationId: number): Promise<Person[]> {
        const persons = await this.personModel.findByorganizationId(organizationId);
        return this.populateOrganizations(persons);
    }

    async updatePerson(id: number, data: UpdatePersonData): Promise<Person | null> {


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


    async getPersonById(id: number, includeDeleted = false): Promise<Person | null> {
        const person = this.personModel.findById(id, includeDeleted);

        if (!person) {
            return null;
        }

        const populated = await this.populateOrganizations([person]);
        return populated[0] || null;
    }

    async getAllPersons(options: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        const { persons, count } = await this.personModel.findAll(options);
        const populatedPersons = await this.populateOrganizations(persons);
        return { persons: populatedPersons, count };
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