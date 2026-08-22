import React, { createContext, useContext, useState } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  mrp?: number;
  selling_price?: number;
  qty: number;
  gst_pct: number;
  hsn?: string;
  image_url?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: any) => void;
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

  const addToCart = (item: any) => {
    const rawPrice = item.price !== undefined ? item.price : (item.selling_price !== undefined ? item.selling_price : (item.mrp !== undefined ? item.mrp : 0));
    const safePrice = Number(rawPrice) || 0;
    const safeMrp = Number(item.mrp !== undefined ? item.mrp : safePrice) || safePrice;
    const safeGst = Number(item.gst_pct) || 0;
    const safeQty = Number(item.qty) || 1;

    setCart((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => p.id === item.id ? {
          ...p,
          qty: (Number(p.qty) || 0) + safeQty,
          price: Number(p.price) || safePrice,
          mrp: Number(p.mrp) || safeMrp,
          gst_pct: Number(p.gst_pct) || safeGst
        } : p);
      }
      return [...prev, {
        ...item,
        price: safePrice,
        mrp: safeMrp,
        gst_pct: safeGst,
        qty: safeQty
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((p) => {
      if (p.id === id) {
        const currentQty = Number(p.qty) || 1;
        const newQty = Math.max(1, currentQty + delta);
        return { ...p, qty: newQty };
      }
      return p;
    }));
  };

  const clearCart = () => setCart([]);

  const getSubtotal = () => cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
  const getGST = () => cart.reduce((sum, item) => sum + (((Number(item.price) || 0) * (Number(item.qty) || 1) * (Number(item.gst_pct) || 0)) / 100), 0);
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
