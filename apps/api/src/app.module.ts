import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadEnv } from "./config/env";
import { DbModule } from "./common/db/db.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { PeopleModule } from "./modules/people/people.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: loadEnv }),
    DbModule,
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    PeopleModule,
    SchedulingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
