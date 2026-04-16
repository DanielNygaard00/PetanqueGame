"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDrinkHierarchy = exports.addOption = exports.getOptions = void 0;
const firebase_1 = require("../lib/firebase");
const getOptions = async (req, res) => {
    const collection = req.params.collection;
    try {
        const snapshot = await firebase_1.db.collection(collection).get();
        const options = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Fetched ${options.length} options from ${collection}`);
        res.json(options);
    }
    catch (error) {
        console.error(`Error fetching options from ${collection}:`, error);
        res.status(500).json({ message: "Error fetching options" });
    }
};
exports.getOptions = getOptions;
const addOption = async (req, res) => {
    const collection = req.params.collection;
    const data = req.body;
    try {
        const docRef = await firebase_1.db.collection(collection).add({
            ...data,
            createdAt: new Date().toISOString()
        });
        res.status(201).json({ id: docRef.id, ...data });
    }
    catch (error) {
        console.error(`Error adding option to ${collection}:`, error);
        res.status(500).json({ message: "Error adding option" });
    }
};
exports.addOption = addOption;
const getDrinkHierarchy = async (req, res) => {
    try {
        const [types, categories, brands, names] = await Promise.all([
            firebase_1.db.collection("drink_types").get(),
            firebase_1.db.collection("drink_categories").get(),
            firebase_1.db.collection("drink_brands").get(),
            firebase_1.db.collection("drink_names").get(),
        ]);
        console.log("Fetched drink hierarchy successfully");
        res.json({
            types: types.docs.map(d => ({ id: d.id, ...d.data() })),
            categories: categories.docs.map(d => ({ id: d.id, ...d.data() })),
            brands: brands.docs.map(d => ({ id: d.id, ...d.data() })),
            names: names.docs.map(d => ({ id: d.id, ...d.data() })),
        });
    }
    catch (error) {
        console.error("Error fetching drink hierarchy:", error);
        res.status(500).json({ message: "Error fetching drink hierarchy" });
    }
};
exports.getDrinkHierarchy = getDrinkHierarchy;
