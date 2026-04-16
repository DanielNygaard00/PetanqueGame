"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exports.getMatchEntries = exports.deleteMatchEntry = exports.updateMatchEntry = exports.createMatchEntry = void 0;
const firebase_1 = require("../lib/firebase");
const sync_1 = require("csv-stringify/sync");
const createMatchEntry = async (req, res) => {
    const data = req.body;
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const docRef = await firebase_1.db.collection("match_entries").add({
            ...data,
            createdById: userId,
            createdAt: firebase_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        res.status(201).json({ id: docRef.id, ...data });
    }
    catch (error) {
        console.error("Create match entry error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createMatchEntry = createMatchEntry;
const updateMatchEntry = async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    try {
        await firebase_1.db.collection("match_entries").doc(id).update({
            ...data,
            updatedAt: firebase_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ id, ...data });
    }
    catch (error) {
        res.status(500).json({ message: "Error updating match entry" });
    }
};
exports.updateMatchEntry = updateMatchEntry;
const deleteMatchEntry = async (req, res) => {
    const id = req.params.id;
    try {
        await firebase_1.db.collection("match_entries").doc(id).delete();
        res.json({ message: "Match entry deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting match entry" });
    }
};
exports.deleteMatchEntry = deleteMatchEntry;
const getMatchEntries = async (req, res) => {
    try {
        const snapshot = await firebase_1.db.collection("match_entries").orderBy("Dato", "desc").get();
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Fetched ${entries.length} match entries`);
        res.json(entries);
    }
    catch (error) {
        console.error("Get match entries error details:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMatchEntries = getMatchEntries;
const exportData = async (req, res) => {
    try {
        const snapshot = await firebase_1.db.collection("match_entries").orderBy("Dato", "asc").get();
        const entries = snapshot.docs.map(doc => doc.data());
        // CSV format columns as per requirement
        const columns = [
            "Dato", "Gruppe_Bool", "Gruppe_medlemmer", "Konsekutive spil", "Spiller",
            "Arena", "Modstander", "Vundet", "Point", "Drik_Type", "Drik_Kategori",
            "Drik_Brand", "Drik_Land", "Drik_Navn", "Vin_Region", "Spillets genstande"
        ];
        const exportRows = entries.map(entry => {
            return columns.map(col => {
                const val = entry[col];
                if (val === undefined || val === null)
                    return "";
                return val;
            });
        });
        const csvContent = (0, sync_1.stringify)([columns, ...exportRows]);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=petanque_data.csv");
        res.send("\uFEFF" + csvContent); // Add BOM for Excel UTF-8 support
    }
    catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.exportData = exportData;
