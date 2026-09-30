import { Router } from "express";
import { capturarFoto, transmitirVideo } from "../controllers/camera.controller.js";

export const cameraRouter = Router();

cameraRouter.get("/captura", capturarFoto);
cameraRouter.get("/stream", transmitirVideo);
