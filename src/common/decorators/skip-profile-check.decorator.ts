import { SetMetadata } from '@nestjs/common';

export const IS_SKIP_PROFILE_CHECK = 'isSkipProfileCheck';
export const SkipProfileCheck = () => SetMetadata(IS_SKIP_PROFILE_CHECK, true);