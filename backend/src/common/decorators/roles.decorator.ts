import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare which roles are allowed to access a route.
 * Usage: @Roles('admin', 'staff')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
