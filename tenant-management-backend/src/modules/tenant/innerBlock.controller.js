import InnerBlock from "./InnerBlock.Model.js";
import middleware from "../../middleware/auth.middleware.js";
export default async function createInnerBlock(req, res) {  middleware(req, res, async () => {
    try {
        const name = " Saurya  Block"
     const property = "693d7d94f82ef4b0c10062ec"
     const block = "693d7e5b5bc40aa7b445c129"
        const innerBlock = await InnerBlock.create({ name, block, property });
        res.status(201).json({ success: true, message: "InnerBlock created successfully", innerBlock });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "InnerBlock creation failed", error: error });
    }
});
}