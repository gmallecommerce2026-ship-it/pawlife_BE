"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipProfileCheck = exports.IS_SKIP_PROFILE_CHECK = void 0;
const common_1 = require("@nestjs/common");
exports.IS_SKIP_PROFILE_CHECK = 'isSkipProfileCheck';
const SkipProfileCheck = () => (0, common_1.SetMetadata)(exports.IS_SKIP_PROFILE_CHECK, true);
exports.SkipProfileCheck = SkipProfileCheck;
//# sourceMappingURL=skip-profile-check.decorator.js.map