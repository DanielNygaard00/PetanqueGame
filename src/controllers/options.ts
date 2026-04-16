import { Request, Response } from "express";
import { db } from "../lib/firebase";

export const getOptions = async (req: Request, res: Response) => {
  const collection = req.params.collection as string;
  try {
    const snapshot = await db.collection(collection).get();
    const options = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Fetched ${options.length} options from ${collection}`);
    res.json(options);
  } catch (error) {
    console.error(`Error fetching options from ${collection}:`, error);
    res.status(500).json({ message: "Error fetching options" });
  }
};

export const addOption = async (req: Request, res: Response) => {
  const collection = req.params.collection as string;
  const data = req.body;
  try {
    const docRef = await db.collection(collection).add({
      ...data,
      createdAt: new Date().toISOString()
    });
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    console.error(`Error adding option to ${collection}:`, error);
    res.status(500).json({ message: "Error adding option" });
  }
};

export const getDrinkHierarchy = async (req: Request, res: Response) => {
  try {
    const [types, categories, brands, names] = await Promise.all([
      db.collection("drink_types").get(),
      db.collection("drink_categories").get(),
      db.collection("drink_brands").get(),
      db.collection("drink_names").get(),
    ]);

    console.log("Fetched drink hierarchy successfully");
    res.json({
      types: types.docs.map(d => ({ id: d.id, ...d.data() })),
      categories: categories.docs.map(d => ({ id: d.id, ...d.data() })),
      brands: brands.docs.map(d => ({ id: d.id, ...d.data() })),
      names: names.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch (error) {
    console.error("Error fetching drink hierarchy:", error);
    res.status(500).json({ message: "Error fetching drink hierarchy" });
  }
};
