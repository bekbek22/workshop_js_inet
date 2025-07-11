const express = require('express');
const router = express.Router();
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const {
    authenticate
} = require('../middleware/authMiddleware');

router.post(
    '/cart', 
    authenticate, 
    async (req, res) => {
        try {
            const { productId, quantity } = req.body;
            const userId = req.user._id;

            const product = await Product.findById(productId);
            if (!product || !product.isActive) {
            return res.status(400).json({
        status: 400,
        message: 'สินค้าไม่พร้อมจำหน่าย'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        status: 400,
        message: `สินค้าคงเหลือไม่เพียงพอ (${product.stock} ชิ้น)`
      });
    }

    // ตรวจสอบว่ามีสินค้านี้ในตะกร้าอยู่แล้วหรือยัง
    const cartHasProduct = await Cart.findOne({
      user: userId,
      'items.product': productId
    });

    let cart;

    if (cartHasProduct) {
      // เคยมี → เพิ่มจำนวน
      cart = await Cart.findOneAndUpdate(
        {
          user: userId,
          'items.product': productId
        },
        {
          $inc: { 'items.$.quantity': quantity }
        },
        {
          new: true
        }
      );
    } else {
      // ไม่เคยมี → push ใหม่
      cart = await Cart.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            items: {
              product: productId,
              quantity,
              price: product.price
            }
          }
        },
        {
          new: true,
          upsert: true
        }
      );
    }

    res.status(200).json({
      status: 200,
      message: 'เพิ่มสินค้าสำเร็จ',
      data: cart
    });
  } catch (error) {
    console.error('[Cart Error]', error);
    res.status(500).json({
      status: 500,
      message: 'เกิดข้อผิดพลาดในการเพิ่มตระกร้า'
    });
  }
});

router.get(
    '/cart',
    authenticate,
    async (req, res) => {
        try {
            const userId = req.user._id
            const cart = await Cart.findOne({ user: userId })
                .populate('items.product', 'name price images');

            res.status(200).json({
                status: 200,
                message: 'ดึงข้อมูลในตระกร้าสำเร็จ',
                data: cart || {
                    items: []
                }
            })
        } catch (error) {
            res.status(500).json({
                status: 500,
                message: 'เกิดข้อผิดพลาดในการดึงตระกร้า'
            })
        }
    }
)

module.exports = router;