const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

async function getCartWithProducts() {
  const res = await query(
    `SELECT ci.product_id, ci.quantity,
            p.name, p.description, p.price, p.category, p.stock, p.image
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     ORDER BY ci.id ASC`
  );
  const items = res.rows.map(r => ({
    productId: r.product_id,
    quantity: r.quantity,
    product: {
      id: r.product_id,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      category: r.category,
      stock: r.stock,
      image: r.image
    }
  }));
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  return { items, total: parseFloat(total.toFixed(2)) };
}

async function getOrdersWithItems() {
  const ordersRes = await query(
    `SELECT id, customer_name, email, total, status, created_at
     FROM orders ORDER BY created_at DESC`
  );
  const itemsRes = await query(
    `SELECT order_id, product_id, name, price, quantity, subtotal
     FROM order_items`
  );
  const itemsByOrder = {};
  for (const row of itemsRes.rows) {
    if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = [];
    itemsByOrder[row.order_id].push({
      productId: row.product_id,
      name: row.name,
      price: parseFloat(row.price),
      quantity: row.quantity,
      subtotal: parseFloat(row.subtotal)
    });
  }
  return ordersRes.rows.map(o => ({
    id: o.id,
    customerName: o.customer_name,
    email: o.email,
    items: itemsByOrder[o.id] || [],
    total: parseFloat(o.total),
    status: o.status,
    createdAt: o.created_at.toISOString ? o.created_at.toISOString() : o.created_at
  }));
}

async function initDatabase() {
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
  console.log('Database schema initialized');
}

app.get('/api', (req, res) => {
  res.json({
    message: 'Online Retail API',
    endpoints: {
      products: 'GET /api/products',
      productById: 'GET /api/products/:id',
      cart: 'GET /api/cart',
      addToCart: 'POST /api/cart { productId, quantity }',
      updateCart: 'PUT /api/cart/:productId { quantity }',
      removeFromCart: 'DELETE /api/cart/:productId',
      clearCart: 'DELETE /api/cart',
      orders: 'GET /api/orders',
      createOrder: 'POST /api/orders { customerName, email }'
    }
  });
});

app.get('/api/products', async (req, res, next) => {
  try {
    const { category } = req.query;
    if (category) {
      const result = await query(
        `SELECT id, name, description, price, category, stock, image, created_at
         FROM products WHERE LOWER(category) = LOWER($1)`,
        [category]
      );
      return res.json(result.rows.map(r => ({ ...r, price: parseFloat(r.price) })));
    }
    const result = await query(
      `SELECT id, name, description, price, category, stock, image, created_at
       FROM products ORDER BY id ASC`
    );
    res.json(result.rows.map(r => ({ ...r, price: parseFloat(r.price) })));
  } catch (e) { next(e); }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, description, price, category, stock, image, created_at
       FROM products WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const r = result.rows[0];
    res.json({ ...r, price: parseFloat(r.price) });
  } catch (e) { next(e); }
});

app.get('/api/cart', async (req, res, next) => {
  try {
    res.json(await getCartWithProducts());
  } catch (e) { next(e); }
});

app.post('/api/cart', async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const productRes = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    await query(
      `INSERT INTO cart_items (product_id, quantity) VALUES ($1, $2)
       ON CONFLICT (product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [productId, quantity]
    );
    res.status(201).json(await getCartWithProducts());
  } catch (e) { next(e); }
});

app.put('/api/cart/:productId', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const exists = await query('SELECT 1 FROM cart_items WHERE product_id = $1', [req.params.productId]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Item not in cart' });

    if (quantity <= 0) {
      await query('DELETE FROM cart_items WHERE product_id = $1', [req.params.productId]);
    } else {
      await query('UPDATE cart_items SET quantity = $1 WHERE product_id = $2', [quantity, req.params.productId]);
    }
    res.json(await getCartWithProducts());
  } catch (e) { next(e); }
});

app.delete('/api/cart/:productId', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM cart_items WHERE product_id = $1 RETURNING 1', [req.params.productId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not in cart' });
    res.json(await getCartWithProducts());
  } catch (e) { next(e); }
});

app.delete('/api/cart', async (req, res, next) => {
  try {
    await query('TRUNCATE cart_items');
    res.json({ items: [], total: 0 });
  } catch (e) { next(e); }
});

app.get('/api/orders', async (req, res, next) => {
  try {
    res.json(await getOrdersWithItems());
  } catch (e) { next(e); }
});

app.post('/api/orders', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { customerName, email } = req.body;
    if (!customerName || !email) {
      return res.status(400).json({ error: 'customerName and email are required' });
    }

    await client.query('BEGIN');

    const cartRes = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price
       FROM cart_items ci JOIN products p ON p.id = ci.product_id`
    );
    if (cartRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = cartRes.rows.map(r => ({
      productId: r.product_id,
      name: r.name,
      price: parseFloat(r.price),
      quantity: r.quantity,
      subtotal: parseFloat((parseFloat(r.price) * r.quantity).toFixed(2))
    }));
    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
    const orderId = uuidv4();

    await client.query(
      `INSERT INTO orders (id, customer_name, email, total, status, created_at)
       VALUES ($1, $2, $3, $4, 'placed', NOW())`,
      [orderId, customerName, email, parseFloat(total.toFixed(2))]
    );

    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, it.productId, it.name, it.price, it.quantity, it.subtotal]
      );
    }

    await client.query('TRUNCATE cart_items');
    await client.query('COMMIT');

    const order = {
      id: orderId,
      customerName,
      email,
      items,
      total: parseFloat(total.toFixed(2)),
      status: 'placed',
      createdAt: new Date().toISOString()
    };
    res.status(201).json(order);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

if (fs.existsSync(PUBLIC_DIR)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/api') return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
