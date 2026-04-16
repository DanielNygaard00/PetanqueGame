import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db, admin } from "../lib/firebase";
import { stringify } from "csv-stringify/sync";

export const createMatchEntry = async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const docRef = await db.collection("match_entries").add({
      ...data,
      createdById: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    console.error("Create match entry error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMatchEntry = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const data = req.body;

  try {
    await db.collection("match_entries").doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id, ...data });
  } catch (error) {
    res.status(500).json({ message: "Error updating match entry" });
  }
};

export const deleteMatchEntry = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.collection("match_entries").doc(id).delete();
    res.json({ message: "Match entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting match entry" });
  }
};

export const getMatchEntries = async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db.collection("match_entries").orderBy("Dato", "desc").get();
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Fetched ${entries.length} match entries`);
    res.json(entries);
  } catch (error) {
    console.error("Get match entries error details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const exportData = async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db.collection("match_entries").orderBy("Dato", "asc").get();
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
        if (val === undefined || val === null) return "";
        return val;
      });
    });

    const csvContent = stringify([columns, ...exportRows]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=petanque_data.csv");
    res.send("\uFEFF" + csvContent); // Add BOM for Excel UTF-8 support
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
