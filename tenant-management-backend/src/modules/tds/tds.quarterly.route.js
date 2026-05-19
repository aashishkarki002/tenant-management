import { Router } from "express";
import multer from "multer";
import { protect } from "../../middleware/protect.js";
import { validateTdsDocumentMiddleware } from "../../utils/fileValidation.js";
import {
  listQuarterlyPaymentsController,
  getQuarterlyPaymentController,
  uploadCertificateController,
  verifyQuarterlyPaymentController,
} from "./tds.quarterly.controller.js";

const router = Router();
const upload = multer({ dest: "temp/" });

router.get("/quarterly", protect, listQuarterlyPaymentsController);
router.get("/quarterly/:id", protect, getQuarterlyPaymentController);
router.post(
  "/quarterly/:id/upload-certificate",
  protect,
  upload.single("tdsDocument"),
  validateTdsDocumentMiddleware,
  uploadCertificateController,
);
router.post("/quarterly/:id/verify", protect, verifyQuarterlyPaymentController);

export default router;
