import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) return navigate('/');
      setProduct(await res.json());
    };
    load();
  }, [id, navigate]);

  if (!product) return <div className="loading">Loading...</div>;

  const handleAdd = async () => {
    await addToCart(product.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="product-detail">
      <Link to="/" className="back-link">← Back to products</Link>
      <div className="detail-grid">
        <img src={product.image} alt={product.name} className="detail-img" />
        <div className="detail-body">
          <span className="category-tag">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="detail-desc">{product.description}</p>
          <p className="stock">In stock: {product.stock} units</p>
          <div className="detail-price">${product.price.toFixed(2)}</div>
          <div className="qty-row">
            <label>Quantity:</label>
            <input
              type="number"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
              className="qty-input"
            />
          </div>
          <div className="detail-actions">
            <button className={`btn btn-large ${added ? 'btn-success' : 'btn-primary'}`} onClick={handleAdd}>
              {added ? `✓ Added ${quantity} to cart` : `Add ${quantity} to Cart`}
            </button>
            <Link to="/cart" className="btn btn-large btn-outline">View Cart</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
