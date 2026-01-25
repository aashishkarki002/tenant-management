import mongoose from "mongoose";
const electricitySchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Unit",
        required: true,
    },
property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
},
block: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Block",
    required: true,
},
previousUnit:{
    type:Number,
    required: true,
},
currentUnit:{
    type:Number,
    required: true,
},
consumedUnit:{
    type:Number,
    // Not required - calculated from currentUnit - previousUnit
},
ratePerUnit:{
    type:Number,
    required: true,
},
amount:{
    type:Number,
    // Not required - calculated from consumedUnit * ratePerUnit
},
nepaliMonth:{
    type:Number,
    required: true,
},
nepaliYear:{
    type:Number,
    required: true,
},
nepaliDate:{    
    type:Date,
    required: true,
},

billMedia:{
    url:String,
    publicId:String,
    generatedAt:Date,
},
status:{
    type:String,
    enum:["pending", "paid", "overdue", "cancelled"],
    default: "pending",
},
createdBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
},


}, { timestamps: true });
electricitySchema.pre("save", function () {
    // Always calculate consumedUnit and amount to ensure they're set correctly
    // This runs as a safety measure even if calculated in controller
    if (this.currentUnit != null && this.previousUnit != null) {
      this.consumedUnit = this.currentUnit - this.previousUnit;
  
      if (this.consumedUnit < 0) {
        throw new Error("Current unit cannot be less than previous unit")
      }
  
      // Calculate amount if ratePerUnit is provided
      if (this.ratePerUnit != null) {
        this.amount = this.consumedUnit * this.ratePerUnit;
      }
    }
  

  });
  export const Electricity = mongoose.model("Electricity", electricitySchema);