import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import apiRoutes from "./routes/api";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier development/testing
}));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api", apiRoutes);

// Serve static files from the React app
const clientPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientPath));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Handle React routing, return all requests to React app
app.get(/.*/, (req: any, res: any) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(clientPath, "index.html"));
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
