// src/common/decorators/shelter-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ShelterId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().shelterId as string;
});