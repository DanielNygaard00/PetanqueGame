"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = exports.login = exports.signup = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_1 = require("../lib/firebase");
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const signup = async (req, res) => {
    const { username, password, email } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Username required" });
    }
    const userPassword = password || "";
    const sanitizedEmail = email && email.trim() !== "" ? email : "";
    try {
        const usersRef = firebase_1.db.collection("users");
        // Check for existing username
        const userSnapshot = await usersRef.where("username", "==", username).get();
        if (!userSnapshot.empty) {
            return res.status(400).json({ message: "Username already exists" });
        }
        // Check for existing email if provided
        if (sanitizedEmail) {
            const emailSnapshot = await usersRef.where("email", "==", sanitizedEmail).get();
            if (!emailSnapshot.empty) {
                return res.status(400).json({ message: "Email already exists" });
            }
        }
        const passwordHash = await bcrypt_1.default.hash(userPassword, 10);
        const newUser = {
            username,
            passwordHash,
            email: sanitizedEmail,
            createdAt: new Date().toISOString(),
        };
        const docRef = await usersRef.add(newUser);
        const userId = docRef.id;
        const token = jsonwebtoken_1.default.sign({ userId, username }, JWT_SECRET, { expiresIn: "24h" });
        res.status(201).json({ token, user: { id: userId, username } });
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.signup = signup;
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Username required" });
    }
    const userPassword = password || "";
    try {
        const usersRef = firebase_1.db.collection("users");
        const snapshot = await usersRef.where("username", "==", username).get();
        if (snapshot.empty) {
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        if (!(await bcrypt_1.default.compare(userPassword, userData.passwordHash))) {
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const token = jsonwebtoken_1.default.sign({ userId: userDoc.id, username: userData.username }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ token, user: { id: userDoc.id, username: userData.username } });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.login = login;
const getUsers = async (req, res) => {
    try {
        const snapshot = await firebase_1.db.collection("users").get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().username // Map username to name for frontend SelectOrAdd component
        }));
        res.json(users);
    }
    catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getUsers = getUsers;
