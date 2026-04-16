import { Router } from "express";
import { signup, login, getUsers } from "../controllers/auth";
import { 
  createMatchEntry, 
  updateMatchEntry, 
  deleteMatchEntry, 
  getMatchEntries, 
  exportData 
} from "../controllers/game";
import { getOptions, addOption, getDrinkHierarchy } from "../controllers/options";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Auth routes
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/users", authenticateToken, getUsers);

// Match Entry routes (protected)
router.post("/matches", authenticateToken, createMatchEntry);
router.get("/matches", authenticateToken, getMatchEntries);
router.put("/matches/:id", authenticateToken, updateMatchEntry);
router.delete("/matches/:id", authenticateToken, deleteMatchEntry);
router.get("/export", authenticateToken, exportData);

// Options routes (protected)
router.get("/options/drinks/hierarchy", authenticateToken, getDrinkHierarchy);
router.get("/options/:collection", authenticateToken, getOptions);
router.post("/options/:collection", authenticateToken, addOption);

export default router;
