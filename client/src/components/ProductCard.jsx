import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useState } from 'react';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    await addToCart(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="product-card">
      <Link to={`/products/${product.id}`}>
        <img src={product.image} alt={product.name} className="product-img" />
      </Link>
      <div className="product-body">
        <span className="category-tag">{product.category}</span>
        <Link to={`/products/${product.id}`} className="product-name">
          {product.name}
        </Link>
        <p className="product-desc">{product.description}</p>
        <div className="product-footer">
          <span className="price">${product.price.toFixed(2)}</span>
          <button className={`btn ${added ? 'btn-success' : 'btn-primary'}`} onClick={handleAdd}>
            {added ? '✓ Added' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
