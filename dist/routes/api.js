"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const game_1 = require("../controllers/game");
const options_1 = require("../controllers/options");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Auth routes
router.post("/auth/signup", auth_1.signup);
router.post("/auth/login", auth_1.login);
router.get("/users", auth_2.authenticateToken, auth_1.getUsers);
// Match Entry routes (protected)
router.post("/matches", auth_2.authenticateToken, game_1.createMatchEntry);
router.get("/matches", auth_2.authenticateToken, game_1.getMatchEntries);
router.put("/matches/:id", auth_2.authenticateToken, game_1.updateMatchEntry);
router.delete("/matches/:id", auth_2.authenticateToken, game_1.deleteMatchEntry);
router.get("/export", auth_2.authenticateToken, game_1.exportData);
// Options routes (protected)
router.get("/options/drinks/hierarchy", auth_2.authenticateToken, options_1.getDrinkHierarchy);
router.get("/options/:collection", auth_2.authenticateToken, options_1.getOptions);
router.post("/options/:collection", auth_2.authenticateToken, options_1.addOption);
exports.default = router;
