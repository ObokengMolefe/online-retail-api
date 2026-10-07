import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerName: '', email: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      await clearCart();
      navigate('/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="empty-state">
        <h2>Your cart is empty</h2>
        <p>Browse products and add some items to your cart.</p>
        <Link to="/" className="btn btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Shopping Cart</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map(item => (
            <div key={item.productId} className="cart-item">
              <img src={item.product.image} alt={item.product.name} className="cart-img" />
              <div className="cart-info">
                <Link to={`/products/${item.productId}`} className="cart-name">
                  {item.product.name}
                </Link>
                <div className="cart-price">${item.product.price.toFixed(2)} each</div>
              </div>
              <div className="cart-controls">
                <div className="qty-row inline">
                  <button
                    className="qty-btn"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >−</button>
                  <span className="qty-val">{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >+</button>
                </div>
                <div className="cart-subtotal">${(item.product.price * item.quantity).toFixed(2)}</div>
                <button className="btn-remove" onClick={() => removeFromCart(item.productId)}>Remove</button>
              </div>
            </div>
          ))}
          <button className="btn btn-outline" onClick={clearCart}>Clear Cart</button>
        </div>

        <div className="checkout">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Items ({cart.items.reduce((s, i) => s + i.quantity, 0)})</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>

          <form onSubmit={handleSubmit} className="checkout-form">
            <h4>Customer Details</h4>
            <label>Name</label>
            <input
              required
              type="text"
              value={form.customerName}
              onChange={e => setForm({ ...form, customerName: e.target.value })}
              placeholder="John Doe"
            />
            <label>Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
            />
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
