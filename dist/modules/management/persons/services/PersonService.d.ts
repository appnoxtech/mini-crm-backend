import { PersonModel, CreatePersonData, UpdatePersonData, Person } from '../models/Person';
import { OrganizationModel, Organization } from '../../organisations/models/Organization';
export declare class PersonService {
    private personModel;
    private organizationModel?;
    constructor(personModel: PersonModel, organizationModel?: OrganizationModel | undefined);
    createPerson(data: CreatePersonData): Promise<Person>;
    searchPersons(search?: string): Promise<Person[]>;
    getPersonsByOrganization(organizationId: number): Promise<Person[]>;
    updatePerson(id: number, data: UpdatePersonData): Promise<Person | null>;
    getPersonById(id: number, includeDeleted?: boolean): Promise<(Person & {
        organization?: Organization | null;
    }) | null>;
    getAllPersons(options?: {
        search?: string;
        organizationId?: number;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): Promise<{
        persons: Person[];
        count: number;
    }>;
    deletePerson(id: number): Promise<boolean>;
    restorePerson(id: number): Promise<Person | null>;
    permanentlyDeletePerson(id: number): Promise<boolean>;
}
//# sourceMappingURL=PersonService.d.ts.map