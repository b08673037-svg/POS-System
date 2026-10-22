import express from "express";
import { getReports } from "../controllers/reportController.js";

const router = express.Router();

router.get("/", getReports); // GET /api/reports

export default router;