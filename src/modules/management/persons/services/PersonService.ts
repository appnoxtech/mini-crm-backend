import { Person, PersonModel, CreatePersonData, UpdatePersonData } from '../models/Person';
import { OrganisationModel } from '../../organisations/models/Organisation';

export class PersonService {
    constructor(
        private personModel: PersonModel,
        private organisationModel?: OrganisationModel
    ) { }

    async create(data: CreatePersonData): Promise<Person> {
        // Validate organisation exists if provided
        if (data.organisationId && this.organisationModel) {
            const org = this.organisationModel.findById(data.organisationId);
            if (!org) {
                throw new Error('Organisation not found');
            }
        }

        return this.personModel.create(data);
    }

    async getById(id: number): Promise<Person | null> {
        const person = this.personModel.findById(id);
        return person || null;
    }

    async getAll(options: {
        search?: string;
        organisationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ persons: Person[]; count: number }> {
        return this.personModel.findAll(options);
    }

    async getByOrganisationId(organisationId: number): Promise<Person[]> {
        return this.personModel.findByOrganisationId(organisationId);
    }

    async update(id: number, data: UpdatePersonData): Promise<Person | null> {
        // Validate organisation exists if provided
        if (data.organisationId && this.organisationModel) {
            const org = this.organisationModel.findById(data.organisationId);
            if (!org) {
                throw new Error('Organisation not found');
            }
        }

        return this.personModel.update(id, data);
    }

    async delete(id: number): Promise<boolean> {
        return this.personModel.softDelete(id);
    }

    async restore(id: number): Promise<Person | null> {
        return this.personModel.restore(id);
    }
}
