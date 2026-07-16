import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { UsersController } from "./users.controller.js";
import { SessionsController } from "./sessions.controller.js";

@Module({
  controllers: [AuthController, UsersController, SessionsController],
})
export class IdentityModule {}
