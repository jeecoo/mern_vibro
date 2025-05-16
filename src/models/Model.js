import mongoose from "mongoose";

const modelModel = mongoose.Schema(
  {
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
        },
    modelName: {
        type: String, trim: true 
        },
    modelPath: {
        type: Boolean, default: false
         },
  },
  { timestamps: true }
);

const Model = mongoose.model("Model", modelModel);

export default Model;