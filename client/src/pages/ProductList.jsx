import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const url = category === 'All' ? '/api/products' : `/api/products?category=${category}`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    };
    load();
  }, [category]);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <div className="filters">
          {categories.map(c => (
            <button
              key={c}
              className={`chip ${category === c ? 'chip-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="product-grid">
        {products.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
