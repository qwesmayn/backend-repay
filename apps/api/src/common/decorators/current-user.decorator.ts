import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest<{ user?: any }>();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    return request.user;
  },
);
