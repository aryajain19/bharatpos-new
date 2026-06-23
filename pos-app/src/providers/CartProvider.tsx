import React, { createContext, useContext, useState } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  gst_pct: number;
  image_url?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getGST: () => number;
  getTotal: () => number;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => p.id === item.id ? { ...p, qty: p.qty + item.qty } : p);
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((p) => {
      if (p.id === id) {
        const newQty = Math.max(1, p.qty + delta);
        return { ...p, qty: newQty };
      }
      return p;
    }));
  };

  const clearCart = () => setCart([]);

  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const getGST = () => cart.reduce((sum, item) => sum + ((item.price * item.qty * item.gst_pct) / 100), 0);
  const getTotal = () => getSubtotal() + getGST();

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, updateQty, clearCart, getSubtotal, getGST, getTotal
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
