import cron from "node-cron";
import { Rent } from "../modules/rents/rent.Model.js";
import { Tenant } from "../modules/tenant/Tenant.Model.js";
import dotenv from "dotenv";
dotenv.config();
const admin = process.env.SYSTEM_ADMIN_ID;
cron.schedule(
  "0 0 1 * *", // Run at midnight on the 1st day of every month
  async () => {
    console.log("Cron job started");
    try {
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const month = targetDate.getMonth() + 1;
      const year = new Date().getFullYear();
      await Rent.updateMany(
        {
          status: { $in: ["pending", "partially_paid"] },
          $or: [{ year: { $lt: year } }, { year, month: { $lt: month } }],
        },
        { $set: { status: "overdue" } }
      );
      const tenants = await Tenant.find({
        isActive: true,
      });
      for (const tenant of tenants) {
        const exists = await Rent.findOne({
          tenant: tenant._id,
          month: month,
          year: year,
        });
        if (exists) continue;
        await Rent.create({
          tenant: tenant._id,
          innerBlock: tenant.innerBlock,
          block: tenant.block,
          property: tenant.property,
          rentAmount: tenant.totalRent,
          month,
          year,
          status: "pending",
          createdBy: admin,
        });
        console.log(`Rent created for ${tenant.name} in ${month} ${year}`);
      }
    } catch (error) {
      console.log(error);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kathmandu",
  }
);
