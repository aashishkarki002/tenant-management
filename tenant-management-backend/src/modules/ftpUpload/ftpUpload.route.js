import multer from "multer";
import { Router } from "express";
import {
  ftpUploadController,
  listFilesController,
  deleteFileController,
} from "./ftpUpload.controller.js";

const router = Router();
const upload = multer({ dest: "temp/" });

router.post("/", upload.single("file"), ftpUploadController);
router.get("/list/:tenantId", listFilesController);
router.delete("/delete/:tenantId/:filename", deleteFileController);
export default router;
