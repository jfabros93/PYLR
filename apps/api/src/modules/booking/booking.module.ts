import { Module } from "@nestjs/common";
import { BookingRequestsController } from "./booking-requests.controller";
import { BookingRequestsService } from "./booking-requests.service";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  controllers: [ResourcesController, BookingRequestsController],
  providers: [ResourcesService, BookingRequestsService],
})
export class BookingModule {}
