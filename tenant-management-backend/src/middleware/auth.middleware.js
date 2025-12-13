import jwt from "jsonwebtoken";

export default function (req, res, next) {
    try {
        const authHeader = req.headers.authorization;
  

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];

        jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: "Unauthorized: invalid token" });
            }

            req.user = decoded; // attach decoded user data
            next(); // call once
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
