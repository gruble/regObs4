import { CreateRegistrationRequestDto } from '../../regobs-api/models';
import { GeoHazard } from '../../../core/models/geo-hazard.enum';
import { RegistrationStatus } from './registrationStatus.enum';

export interface IRegistration extends CreateRegistrationRequestDto {
    geoHazard: GeoHazard;
    changed: number;
    error?: { status: number, message: string };
    retryCount?: number;
    status: RegistrationStatus;
}