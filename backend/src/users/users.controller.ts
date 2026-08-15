import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FirebaseService } from '../auth/firebase.service';
import { IsString, IsIn } from 'class-validator';

class SetRoleDto {
  @IsString()
  @IsIn(['admin', 'staff', 'tv', ''])
  role: string;
}

/**
 * Admin-only endpoints for managing Firebase Auth users.
 * No MongoDB users collection — Firebase is the SSOT for identity.
 */
@Controller('api/users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly firebaseService: FirebaseService) {}

  /**
   * GET /api/users?maxResults=100&pageToken=...
   * Paginated listing of all Firebase Auth users.
   */
  @Get()
  @Roles('admin')
  async listUsers(
    @Query('maxResults') maxResults?: string,
    @Query('pageToken') pageToken?: string,
  ) {
    const limit = maxResults ? parseInt(maxResults, 10) : 100;
    const result = await this.firebaseService.listUsers(limit, pageToken || undefined);

    return {
      users: result.users.map((user) => ({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        disabled: user.disabled,
        role: (user.customClaims as any)?.role || '',
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
      pageToken: result.pageToken || null,
    };
  }

  /**
   * PATCH /api/users/:uid/role
   * Sets custom claims (role) on a Firebase user.
   */
  @Patch(':uid/role')
  @Roles('admin')
  async setRole(@Param('uid') uid: string, @Body() dto: SetRoleDto) {
    if (!uid) {
      throw new BadRequestException('User UID is required.');
    }

    await this.firebaseService.setCustomClaims(uid, { role: dto.role });

    return {
      message: `Role '${dto.role}' assigned to user ${uid}.`,
      uid,
      role: dto.role,
    };
  }

  /**
   * DELETE /api/users/:uid
   * Permanently deletes a Firebase Auth user.
   */
  @Delete(':uid')
  @Roles('admin')
  async deleteUser(@Param('uid') uid: string) {
    if (!uid) {
      throw new BadRequestException('User UID is required.');
    }

    await this.firebaseService.deleteUser(uid);

    return { message: `User ${uid} deleted.`, uid };
  }
}
