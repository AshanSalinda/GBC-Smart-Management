import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [FirebaseService, RolesGuard],
  exports: [FirebaseService, RolesGuard],
})
export class AuthModule {}
