import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

const API = '/api';

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], total: 0 });

  const fetchCart = async () => {
    try {
      const res = await fetch(`${API}/cart`);
      const data = await res.json();
      setCart(data);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const addToCart = async (productId, quantity = 1) => {
    const res = await fetch(`${API}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    setCart(data);
  };

  const updateQuantity = async (productId, quantity) => {
    const res = await fetch(`${API}/cart/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    const data = await res.json();
    setCart(data);
  };

  const removeFromCart = async (productId) => {
    const res = await fetch(`${API}/cart/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    setCart(data);
  };

  const clearCart = async () => {
    const res = await fetch(`${API}/cart`, { method: 'DELETE' });
    const data = await res.json();
    setCart(data);
  };

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, itemCount, addToCart, updateQuantity, removeFromCart, clearCart, fetchCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
