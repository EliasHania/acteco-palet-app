import mongoose from "mongoose";

const trabajadoraSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});

export default mongoose.model("Trabajadora", trabajadoraSchema);
