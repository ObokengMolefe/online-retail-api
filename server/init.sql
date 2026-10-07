CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'placed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(32) NOT NULL REFERENCES products(id),
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (id, name, description, price, category, stock, image) VALUES
  ('p1', 'Wireless Headphones', 'Noise-cancelling over-ear headphones with 30-hour battery life.', 149.99, 'Electronics', 42, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop'),
  ('p2', 'Smart Watch', 'Fitness tracking, heart rate monitor, 7-day battery.', 199.00, 'Electronics', 18, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop'),
  ('p3', 'Running Sneakers', 'Lightweight breathable running shoes with cushioned sole.', 89.50, 'Clothing', 75, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop'),
  ('p4', 'Leather Backpack', 'Premium full-grain leather backpack, fits 15" laptop.', 129.00, 'Accessories', 12, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop'),
  ('p5', 'Ceramic Coffee Mug', 'Handmade 12oz ceramic mug, dishwasher safe.', 18.99, 'Home', 200, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop'),
  ('p6', 'Bluetooth Speaker', 'Portable waterproof speaker, 20W output, 12hr playtime.', 79.99, 'Electronics', 55, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop')
ON CONFLICT (id) DO NOTHING;
