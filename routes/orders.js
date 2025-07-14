const express = require('express');
const router = express.Router();
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Cart = require('../models/cart.model')
const { body, validationResult } = require('express-validator');
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

router.post(
  '/orders/checkout',
  authenticate,
  async (req, res) => {
    const session = await mongoose.startSession()
    session.startTransaction();

    try {
      const userId = req.user._id;
      const cart = await Cart.findOne({ user: userId })
        .session(session)
        .populate('items.product');
      
        if (!cart || cart.items.length === 0) {
          return res.status(400).json({
            status: 400,
            message: 'ตระกร้าสินค้าว่างเปล่า'
          });
        }

        // ตรวจสอบ stock
        for ( const item of cart.items) {
          if (item.product.stock < item.quantity) {
            throw new Error(`สินค้า ${item.product.name} ไม่เพียงพอ`);
          }
        }

        const totalPrice = cart.items.reduce(
          (sum, item) => sum + (item.quantity * item.price),
          0
        );

        // สร้างคำสั่งซื้อ
        const order = new Order({
          user: userId,
          products: cart.items.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.price
          })),
          total: totalPrice,
          status: 'pending'
        })

        await order.save({ session });

        //อัปเดต stock
        for (const item of cart.items) {
          item.product.stock -= item.quantity;
          await item.product.save({ session });
        }

        //ล้างตระกร้า
        await Cart.deleteOne({ user: userId })
          .session(session);
        
        await session.commitTransaction();

        res.status(201).json({
          status: 201,
          message: 'ซื้อสำเร็จ',
          data: order
        });

    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        status: 500,
        message: error.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ'
      });
    } finally {
      session.endSession();
    }
  }
);

// อัปเดตคำสั่งซื้อ
router.patch(
  '/orders/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('สถานะไม่ถูกต้อง')
  ],
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { status } = req.body;

      // ตรวจสอบ validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 400,
          message: 'ข้อมูลไม่ถูกต้อง',
          errors: errors.array()
        });
      }

      // ค้นหาคำสั่งซื้อ
      const order = await Order.findById(id)
        .session(session)
        .populate({
          path: 'products.product',
          model: 'Product'
        });

      if (!order) {
        await session.abortTransaction();
        return res.status(404).json({
          status: 404,
          message: 'ไม่พบคำสั่งซื้อ'
        });
      }

      // คัดลอกสถานะเดิมเพื่อตรวจสอบการเปลี่ยนแปลง
      const originalStatus = order.status;

      //ไม่ต้องทำอะไรหากสถานะเหมือนเดิม
      if (originalStatus === status) {
        await session.abortTransaction();
        return res.status(200).json({
          status: 200,
          message: 'สถานะไม่มีการเปลี่ยนแปลง',
          data: order
        });
      }

      // จัดการสต็อกสินค้าตามสถานะ
      if (status === 'cancelled' && originalStatus !== 'cancelled') {
        // คืนสต็อกสินค้าเมื่อยกเลิกคำสั่งซื้อ
        for (const item of order.products) {
          const product = item.product;
          // ในกรณียกเลิก เราจะคืนสต็อก ดังนั้นไม่ต้องตรวจสอบ stock ว่าพอไหม แต่ให้คืนได้เลย
          product.stock += item.quantity;
          await product.save({ session });
        }
      } else if (originalStatus === 'cancelled' && status !== 'cancelled') {
        // เปลี่ยนจากสถานะ cancelled ไปเป็นสถานะอื่น (เช่น pending, processing, ...)
        // ต้องหักสต็อกใหม่ และตรวจสอบก่อนว่าสต็อกเพียงพอหรือไม่
        for (const item of order.products) {
          const product = item.product;
          
          // ตรวจสอบว่าสต็อกสินค้าพอสำหรับจำนวนที่ต้องการหักหรือไม่
          if (product.stock < item.quantity) {
            await session.abortTransaction();
            return res.status(400).json({
              status: 400,
              message: `สต็อกสินค้า ${product.name} ไม่เพียงพอ (เหลือ: ${product.stock}, ต้องการ: ${item.quantity})`
            });
          }
          
          // หักสต็อก
          product.stock -= item.quantity;
          await product.save({ session });
        }
      }

      // อัปเดตสถานะคำสั่งซื้อ
      order.status = status;
      order.updatedAt = new Date();
      await order.save({ session });

      await session.commitTransaction();

      // ดึงข้อมูลล่าสุดพร้อม populate ใหม่
      const updatedOrder = await Order.findById(id)
        .populate('user', 'username email')
        .populate({
          path: 'products.product',
          select: 'name price images'
        });

      res.status(200).json({
        status: 200,
        message: 'อัปเดตสถานะคำสั่งซื้อสำเร็จ',
        data: updatedOrder
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ:', error);
      res.status(500).json({
        status: 500,
        message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ',
        error: error.message
      })
    } finally {
      session.endSession();
    }
  }
)

router.get(
  '/orders/:orderId',
  authenticate,
  async (req, res) => {
    try {
      const { orderId } = req.params;

      // ตรวจสอบว่าเป็น ObjectId ที่ถูกต้อง
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          status: 400,
          message: 'ID คำสั่งซื้อไม่ถูกต้อง'
        });
      }

      // สร้าง query เริ่มต้น
      let query = { _id: orderId };

      // สำหรับผู้ใช้ทั่วไป: เฉพาะคำสั่งซื้อของตัวเอง
      if (req.user.role === 'user') {
        query.user = req.user._id;
      }

      // ดึงข้อมูลคำสั่งซื้อ
      const order = await Order.findOne(query)
        .populate('user', 'username email phone')
        .populate({
          path: 'products.product',
          select: 'name price images stock'
        })
        .lean();

      if (!order) {
        return res.status(404).json({
          status: 404,
          message: 'ไม่พบคำสั่งซื้อ'
        });
      }

      // เพิ่มข้อมูลตะกร้า virtual (ถ้ามีในโมเดล)
      if (order.products) {
        order.products = order.products.map(item => ({
          ...item,
          total: item.price * item.quantity
        }));
      }

      res.status(200).json({
        status: 200,
        data: order
      });

    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการดึงคำสั่งซื้อ:', error);
      res.status(500).json({
        status: 500,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ'
      });
    }
  }
);

module.exports = router;
