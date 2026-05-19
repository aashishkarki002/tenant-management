import { GooglegenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();
const genAi = new GooglegenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
export default genAi;