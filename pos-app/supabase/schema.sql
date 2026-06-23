-- Premium POS Ecosystem Schema

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'salesperson');
CREATE TYPE payment_mode AS ENUM ('Cash', 'UPI', 'Card', 'Credit');
CREATE TYPE stock_status_enum AS ENUM ('In Stock', 'Low Stock', 'Out of Stock');
CREATE TYPE inventory_log_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- 1. Users Table (Extends Supabase Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'salesperson',
    full_name TEXT,
    mobile TEXT UNIQUE,
    subscription_plan TEXT DEFAULT 'free_trial',
    subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '30 days'),
    permissions JSONB DEFAULT '{"pos_access": true, "stock_management": true, "barcode_generation": true, "reporting": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    variant TEXT,
    barcode TEXT UNIQUE NOT NULL,
    mrp DECIMAL(10, 2) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2) NOT NULL,
    gst_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    stock_status stock_status_enum DEFAULT 'In Stock',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to update stock status automatically
CREATE OR REPLACE FUNCTION update_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stock_qty <= 0 THEN
        NEW.stock_status = 'Out of Stock';
    ELSIF NEW.stock_qty <= 5 THEN
        NEW.stock_status = 'Low Stock';
    ELSE
        NEW.stock_status = 'In Stock';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_status
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION update_stock_status();

-- 3. Inventory Logs (For Profit/Loss tracking and stock history)
CREATE TABLE public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    log_type inventory_log_type NOT NULL,
    qty_change INTEGER NOT NULL,
    unit_purchase_price DECIMAL(10,2), -- Historical purchase price at time of log
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Sales Table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_no SERIAL, -- Auto-incrementing bill number
    vendor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_mobile TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    total_gst DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payment_mode payment_mode NOT NULL DEFAULT 'Cash',
    whatsapp_shared_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Sale Items Table
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- Price sold at
    unit_purchase_price DECIMAL(10, 2) NOT NULL, -- For exact profit calculation
    gst_amt DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to deduct stock on sale
CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET stock_qty = stock_qty - NEW.qty
    WHERE id = NEW.product_id;
    
    -- Log the inventory movement
    INSERT INTO public.inventory_logs (product_id, user_id, log_type, qty_change, unit_purchase_price)
    VALUES (NEW.product_id, NULL, 'OUT', -NEW.qty, NEW.unit_purchase_price);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deduct_stock_on_sale
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_sale();


-- ROW LEVEL SECURITY (RLS)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Admins can do everything. Salespersons can read products, insert sales, read their own sales.

-- Users
CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- Products
CREATE POLICY "Anyone authenticated can read products" ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Only admins can manage products" ON public.products FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Sales
CREATE POLICY "Salesperson can insert sales" ON public.sales FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Salesperson can read own sales" ON public.sales FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Admins can read all sales" ON public.sales FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Sale Items
CREATE POLICY "Salesperson can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Salesperson can read own sale items" ON public.sale_items FOR SELECT USING (sale_id IN (SELECT id FROM public.sales WHERE vendor_id = auth.uid()));
CREATE POLICY "Admins can read all sale items" ON public.sale_items FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Inventory Logs
CREATE POLICY "Only admins can read inventory logs" ON public.inventory_logs FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
CREATE POLICY "System can insert logs" ON public.inventory_logs FOR INSERT WITH CHECK (true); -- Usually triggered internally
