"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for easier development/testing
}));
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use("/api", api_1.default);
// Serve static files from the React app
const clientPath = path_1.default.join(__dirname, "../../client/dist");
app.use(express_1.default.static(clientPath));
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
// Handle React routing, return all requests to React app
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith("/api")) {
        res.sendFile(path_1.default.join(clientPath, "index.html"));
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
