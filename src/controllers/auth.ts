import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../lib/firebase";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const signup = async (req: Request, res: Response) => {
  const { username, password, email } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username required" });
  }

  const userPassword = password || "";
  const sanitizedEmail = email && email.trim() !== "" ? email : "";

  try {
    const usersRef = db.collection("users");
    
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

    const passwordHash = await bcrypt.hash(userPassword, 10);
    
    const newUser = {
      username,
      passwordHash,
      email: sanitizedEmail,
      createdAt: new Date().toISOString(),
    };

    const docRef = await usersRef.add(newUser);
    const userId = docRef.id;

    const token = jwt.sign(
      { userId, username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({ token, user: { id: userId, username } });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username required" });
  }

  const userPassword = password || "";

  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("username", "==", username).get();
    
    if (snapshot.empty) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (!(await bcrypt.compare(userPassword, userData.passwordHash))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: userDoc.id, username: userData.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token, user: { id: userDoc.id, username: userData.username } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().username // Map username to name for frontend SelectOrAdd component
    }));
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
