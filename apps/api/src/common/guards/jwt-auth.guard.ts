// import {
//   ExecutionContext,
//   ForbiddenException,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   constructor(private readonly reflector: Reflector) {
//     super();
//   }

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     await super.canActivate(context);

//     const { user } = context
//       .switchToHttp()
//       .getRequest<{ user?: { roles?: { name: string }[] } }>();

//     return true;
//   }

//   handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
//     if (err instanceof Error) {
//       throw err;
//     }
//     if (err || !user) {
//       throw new UnauthorizedException(
//         'You are not authorized to access this resource',
//       );
//     }
//     return user;
//   }
// }
