export declare enum OtpType {
    SIGNUP = "SIGNUP",
    FORGOT_PASSWORD = "FORGOT_PASSWORD"
}
export declare class SendOtpDto {
    email: string;
    type: OtpType;
}
export declare class SignUpDto {
    email: string;
    otp: string;
    password: string;
}
