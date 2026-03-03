import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple .env locations
const paths = [
    path.join(__dirname, "../.env"),
    path.join(__dirname, "../../.env"),
    "/root/mazadtest/backend/.env"
];

paths.forEach(p => {
    const result = dotenv.config({ path: p });
    if (result.error) {
        console.log(`❌ Failed to load env from: ${p}`);
    } else {
        console.log(`✅ Loaded env from: ${p}`);
    }
});

console.log("✅ Environment Variables Loading Sequence Finished");
