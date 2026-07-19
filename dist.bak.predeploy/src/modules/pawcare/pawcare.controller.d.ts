import { PawcareService } from './pawcare.service';
export declare class PawcareController {
    private readonly pawcareService;
    constructor(pawcareService: PawcareService);
    getVideos(category: string): Promise<any[]>;
    getPlaylists(category: string): Promise<any[]>;
}
