import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/orders');
      setOrders(await res.json());
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="loading">Loading orders...</div>;

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <h2>No orders yet</h2>
        <p>Once you place an order it will appear here.</p>
        <Link to="/" className="btn btn-primary">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Your Orders</h1>
      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-header">
              <div>
                <strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong>
                <div className="muted">{new Date(order.createdAt).toLocaleString()}</div>
              </div>
              <div className="order-status">{order.status.toUpperCase()}</div>
            </div>
            <div className="muted small">{order.customerName} • {order.email}</div>
            <table className="order-items">
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {order.items.map(i => (
                  <tr key={i.productId}>
                    <td>{i.name}</td>
                    <td>{i.quantity}</td>
                    <td>${i.price.toFixed(2)}</td>
                    <td>${i.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan="3"><strong>Total</strong></td><td><strong>${order.total.toFixed(2)}</strong></td></tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
