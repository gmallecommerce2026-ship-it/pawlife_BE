"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignUpDto = exports.SendOtpDto = exports.OtpType = void 0;
const class_validator_1 = require("class-validator");
var OtpType;
(function (OtpType) {
    OtpType["SIGNUP"] = "SIGNUP";
    OtpType["FORGOT_PASSWORD"] = "FORGOT_PASSWORD";
})(OtpType || (exports.OtpType = OtpType = {}));
class SendOtpDto {
    email;
    type;
}
exports.SendOtpDto = SendOtpDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendOtpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OtpType),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendOtpDto.prototype, "type", void 0);
class SignUpDto {
    email;
    otp;
    password;
}
exports.SignUpDto = SignUpDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], SignUpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SignUpDto.prototype, "otp", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SignUpDto.prototype, "password", void 0);
//# sourceMappingURL=send-otp.dto.js.map