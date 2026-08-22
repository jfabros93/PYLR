import { Module } from "@nestjs/common";
import { OccurrencePlansController, PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";
import { ServingRolesController } from "./serving-roles.controller";
import { ServingRolesService } from "./serving-roles.service";
import { SongsController } from "./songs.controller";
import { SongsService } from "./songs.service";

@Module({
  controllers: [
    ServicesController,
    OccurrencePlansController,
    PlansController,
    SongsController,
    ServingRolesController,
  ],
  providers: [ServicesService, PlansService, SongsService, ServingRolesService],
})
export class SchedulingModule {}
