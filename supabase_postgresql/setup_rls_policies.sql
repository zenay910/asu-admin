-- RLS Policies for products and product_images tables
-- Run these in your Supabase SQL Editor

-- ===== PRODUCTS TABLE =====

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read published products
CREATE POLICY "Allow public read access to published products"
ON products
FOR SELECT
USING (status = 'Published');

-- Policy: Allow service role to do everything (for admin operations)
CREATE POLICY "Allow service role full access to products"
ON products
FOR ALL
USING (auth.role() = 'service_role');

-- Optional: If you want authenticated users to manage products
-- CREATE POLICY "Allow authenticated users to manage products"
-- ON products
-- FOR ALL
-- USING (auth.role() = 'authenticated');


-- ===== PRODUCT_IMAGES TABLE =====

-- Enable RLS on product_images table
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read images for published products
CREATE POLICY "Allow public read access to product images"
ON product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.status = 'Published'
  )
);

-- Policy: Allow service role to do everything
CREATE POLICY "Allow service role full access to product_images"
ON product_images
FOR ALL
USING (auth.role() = 'service_role');

-- Optional: If you want authenticated users to manage images
-- CREATE POLICY "Allow authenticated users to manage product_images"
-- ON product_images
-- FOR ALL
-- USING (auth.role() = 'authenticated');


-- ===== VERIFY POLICIES =====
-- Run these to check your policies:

-- SELECT * FROM pg_policies WHERE tablename = 'products';
-- SELECT * FROM pg_policies WHERE tablename = 'product_images';
