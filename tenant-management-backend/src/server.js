import app from "./app.js";
import "./modules/rents/rentScheduler.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});