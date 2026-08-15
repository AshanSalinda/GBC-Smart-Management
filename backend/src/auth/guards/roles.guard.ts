import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

/**
 * Guard that:
 * 1. Extracts the Firebase JWT from the Authorization header.
 * 2. Verifies it via Firebase Admin SDK.
 * 3. Checks the user's custom-claim role against the @Roles() decorator.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseService: FirebaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // ─── 1. Extract Bearer token ──────────────────────────────────
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const idToken = authHeader.split('Bearer ')[1];

    // ─── 2. Verify token ──────────────────────────────────────────
    let decodedToken;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired Firebase token.');
    }

    // Attach decoded user to the request for downstream use
    request.user = decodedToken;

    // ─── 3. Check role against @Roles() metadata ──────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator is set, allow any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRole = decodedToken?.role as string | undefined;
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Role '${userRole || 'none'}' is not authorized. Required: [${requiredRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
