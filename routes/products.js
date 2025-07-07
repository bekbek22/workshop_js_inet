const express = require('express');
const router = express.Router();
const Product = require('../models/product.model');
const { body, validationResult } = require('express-validator');
const {
  authenticate,
  authorize
} = require('../middleware/authMiddleware');
const { default: mongoose, mongo } = require('mongoose');

// ดึงสินค้าทั้งหมด
router.get(
    '/products',
    authenticate,
    async (req, res) => {
        try {
            const { category, minPrice, maxPrice } = req.query;
            let filter = { isActive: true };

            //กรองตามหมวดหมู่
            if (category) {
                filter.category = category;
            }

            // กรองตามช่วงราคา
            if (minPrice || maxPrice) {
                filter.price = {};
                if (minPrice) filter.price.$gte = parseFloat(minPrice);
                if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
            }

            // สำหรับ Admin: สามารถดูสินค้าที่ไม่ active ได้
            if (req.user.role === 'admin') {
                delete filter.isActive;
            }

            const products = await Product.find(filter)
                .select('name description price stock isActive')
                .sort({ createdAt: -1});

            res.json(products);
        } catch (error) {
            res.status(500).json({
                status: 500,
                message: 'ไม่สามารถดึงข้อมูลสินค้าได้'
            });
        }
    }
);

router.get(
    '/products/:id',
    authenticate,
    async (req, res) => {
        try {
            const {id} = req.params;

            if(!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    status: 400,
                    message: 'ID ไม่ถูกต้อง'
                });
            }

            const product = await Product.findById(id);

            if (!product) {
                return res.status(404).json({
                    status: 404,
                    message: 'ไม่พบสินค้านี้'
                });
            }

            // สำหรับผู้ใชทั่วไป: ดูสินค้าเฉพาะที่ active
            if (req.user.role === 'user' && !product.isActive) {
                return res.status(403).json({
                    status: 403,
                    message: 'ไม่สามารถเข้าถึงสินค้านี้ได้'
                });
            }

            res.status(200).json({
                status: 200,
                data: product
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                status: 500,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูล'
            });
        }
    }
);

router.post(
  '/products',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อสินค้า'),
    body('description').trim().notEmpty().withMessage('กรุณากรอกรายละเอียด'),
    body('price')
      .isFloat({ gt: 0 })
      .withMessage('ราคาต้องมากกว่า 0'),
    body('stock')
      .isInt({ min: 0 })
      .withMessage('จำนวนสินค้าต้องมากกว่าหรือเท่ากับ 0')
  ],
  async (req, res) => {
    // ตรวจสอบ Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 400,
        message: errors.array()
      });
    }

    try {
      // สร้างสินค้าใหม่
      const product = new Product(req.body);
      await product.save();

      res.status(201).json({
        status: 201,
        message: 'เพิ่มสินค้าสำหรับ',
        data: product
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: 'เกิดข้อผิดพลาดในการสร้างสินค้า'
      });
    }
  }
);

router.put(
  '/products/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('price').optional().isFloat({ gt: 0 }),
    body('stock').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      // ตรวจสอบ ID
      const {id} = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          status: 400,
          message: 'ID สินค้าไม่ถูกต้อง'
        });
      }

      // อัปเดตข้อมูล
      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        req.body, {
            new: true,
            runValidators: true
        }
      );

      if (!updatedProduct) {
        return res.status(404).json({
          status: 404,
          message: 'ไม่พบสินค้านี้'
        });
      }

      res.status(200).json({
        status: 200,
        message: 'แก้ไขสินค้าสำเร็จ',
        data: updatedProduct
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        message: 'เกิดข้อผิดพลาดในการอัปเดตสินค้า'
      });
    }
  }
);

router.delete(
  '/products/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          status: 400,
          message: 'ID สินค้าไม่ถูกต้อง'
        });
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({
          status: 404,
          message: 'ไม่พบสินค้านี้'
        });
      }

      res.status(200).json({
        status: 200,
        message: `ปิดการขายสินค้า ${product.name} เรียบร้อยแล้ว`,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        error: 'เกิดข้อผิดพลาดในการปิดการขายสินค้า'
      });
    }
  }
);

module.exports = router;
