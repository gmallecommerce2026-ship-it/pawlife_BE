import { UserInteractionsService } from './user-interactions.service';
import { SwipeAction } from '@prisma/client';
export declare class UserInteractionsController {
    private readonly interactionsService;
    constructor(interactionsService: UserInteractionsService);
    swipe(req: any, petId: string, action: SwipeAction): Promise<{
        success: boolean;
        data: {
            id: string;
            action: import("@prisma/client").$Enums.SwipeAction;
            createdAt: Date;
            userId: string;
            petId: string;
        };
    }>;
    toggleFavorite(req: any, petId: string): Promise<{
        success: boolean;
        data: {
            favorited: boolean;
        };
    }>;
    toggleFollow(req: any, shelterId: string): Promise<{
        success: boolean;
        data: {
            followed: boolean;
        };
    }>;
}
