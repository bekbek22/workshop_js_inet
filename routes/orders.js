const express = require('express');
const router = express.Router();
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const { body, validationResult } = require('express-validator');
const checkApproval = require('../middleware/checkApproval');
const {
    authenticate,
    authorize
} = require('../middleware/authMiddleware');
const { default: mongoose } = require('mongoose');

// ดึงคำสั่งซื้อทั้งหมด
router.get(
    '/orders',
    authenticate,
    async (req, res) => {
        try {
            // สำหรับผู้ใช้ทั่วไป: เฉพาะคำสั่งซื้อของตัวเอง
            let query = { user: req.user._id };

            // สำหรับ Admin: สามารถดูทั้งหมดได้
            if (req.user.role === 'admin') {
                query = {};
            }

            const orders = await Order.find(query)
                .populate('user', 'username email')
                .populate({
                    path: 'products.product',
                    select: 'name price'
                });

            res.json(orders);
        } catch (error) {
            res.status(500).json({
                status: 500,
                message: 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้'
            });
        }
    }
);

router.get(
  '/products/:id/orders',
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: 400,
          message: 'ID ไม่ถูกต้อง'
        });
      }

      // ดึงข้อมูลคำสั่งซื้อ
      const query = {
        "products.product": id,
        ...(req.user.role === 'user' && { user: req.user._id })
      };

      const orders = await Order.find(query)
        .populate('user', 'username email') // แก้ให้ populate user
        .sort({ createdAt: -1 })
        .lean(); // ใช้ lean() เพื่อให้ได้ plain JavaScript objects

      // จัดรูปแบบคำสั่งซื้อ
      const formattedOrders = orders.map(order => {
        const productItems = order.products
          .filter(item => item.product.toString() === id)
          .map(item => ({
            productId: item.product,
            quantity: item.quantity,
            price: item.price
          }));

        return {
          orderId: order._id,
          date: order.createdAt,
          status: order.status,
          user: { // แสดงข้อมูลผู้ใช้
            _id: order.user._id,
            username: order.user.username,
            email: order.user.email
          },
          products: productItems,
          total: productItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
        };
      });

      res.status(200).json({
        status: 200,
        data: formattedOrders
      });
    } catch (error) {
      console.error('ดึงคำสั่งซื้อล้มเหลว:', error);
      res.status(500).json({
        status: 500,
        message: 'เกิดข้อผิดพลาดในการดึงคำสั่งซื้อ'
      });
    }
  }
);

router.post(
  '/products/:id/orders',
  authenticate,
  [
    body('quantity')
      .isInt({ min: 1 })
      .withMessage('จำนวนสินค้าต้องมากกว่า 0')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 400,
        message: 'ข้อมูลไม่ถูกต้อง', 
        errors: errors.array() 
      });
    }

    const { id: productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    // ตรวจสอบ ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        status: 400, 
        message: 'ID สินค้าไม่ถูกต้อง' 
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(productId)
        .session(session)
        .select('price stock isActive');

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ 
          status: 404, 
          message: 'ไม่พบสินค้านี้' 
        });
      }

      if (!product.isActive) {
        await session.abortTransaction();
        return res.status(400).json({ 
          status: 400, 
          message: 'สินค้านี้ไม่พร้อมขาย' 
        });
      }

      if (product.stock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({ 
          status: 400, 
          message: `สินค้าคงเหลือไม่พอ (เหลือ ${product.stock} ชิ้น)` 
        });
      }

      // หักสต็อก
      product.stock -= quantity;
      await product.save({ session });

      const total = product.price * quantity;

      const order = new Order({
        user: userId,
        products: [{
          product: productId,
          quantity,
          price: product.price
        }],
        total,
        status: 'pending'
      });

      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        status: 201,
        message: 'สั่งซื้อสำเร็จ',
        data: {
          orderId: order._id,
          total: order.total,
          items: order.products
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('เกิดข้อผิดพลาด:', error);

      res.status(500).json({ 
        status: 500, 
        message: 'ไม่สามารถดำเนินการสั่งซื้อได้' 
      });
    }
  }
);

module.exports = router;
