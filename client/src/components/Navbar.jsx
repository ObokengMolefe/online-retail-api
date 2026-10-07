import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { itemCount } = useCart();

  return (
    <nav className="navbar">
      <div className="container nav-content">
        <Link to="/" className="brand">🛒 ShopMart</Link>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Products
          </NavLink>
          <NavLink to="/cart" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Cart {itemCount > 0 && <span className="badge">{itemCount}</span>}
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Orders
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
