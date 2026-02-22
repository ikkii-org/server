import { Hono } from "hono";
import {
    createPlayerHandler,
    getProfileHandler,
    updatePfpHandler,
} from "../controllers/user.controller";

export const userRoutes = new Hono();

userRoutes.post("/", createPlayerHandler);

userRoutes.get("/:username", getProfileHandler);

userRoutes.patch("/:username/pfp", updatePfpHandler);
