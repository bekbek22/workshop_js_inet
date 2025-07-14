const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
      type: String,
      required: [true, 'กรุณากรอกชื่อสินค้า'],
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: [true, 'กรุณากรอกราคาสินค้า'],
      min: [0, 'ราคาสินค้าไม่ถูกต้อง']
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'จำนวนสินค้าไม่ถูกต้อง'],
      default: 0
    },
    images: [String],
    isActive: {
      type: Boolean,
      default: true
    },
    version: {
      type: Number,
      default: 0
    },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
