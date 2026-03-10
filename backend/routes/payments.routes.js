import express from "express";
import { protect } from "../middleware/auth.js";
import {
  initZaincashTopup,
  zaincashRedirect,
  zaincashStatus,
} from "../controllers/zaincash.controller.js";

const router = express.Router();

router.post("/zaincash/topup/init", protect, initZaincashTopup);

router.get("/zaincash/redirect", zaincashRedirect);
router.get("/zaincash/callback", zaincashRedirect);
router.get("/zaincash/status/:orderId", protect, zaincashStatus);

export default router;
