"use client";
import React, { useEffect, useState } from "react";
//import Navbar from "@/components/navbar";
import Image from "next/image";
import { Check, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
//import { toPublicUrl } from "@/lib/storage";

// ---------- Types ----------
type ProductImage = {
  id: string;
  photo_url: string;
  product_id: string;
};

type Product = {
  id: string;
  title: string;
  brand: string;
  price: number;
  model_number: string;
  type: string | null;
  configuration: string | null;
  unit_type: string | null;
  fuel: string | null;
  color: string | null;
  condition: string | null;
  status: string | null;
  description_long?: string | null;
  product_images: ProductImage[];
};

type ProductCard = {
  id: string;
  name: string;
  price: string; // formatted for UI
  priceNumber: number | null; // raw for filtering
  condition: string;
  brand: string;
  type: string; // maps from DB `type`
  configuration?: string | null;
  unitType?: string | null;
  fuel?: string | null;
  image: string | null;
};

const filterOptions = {
  types: ["Washers", "Dryers", "Stoves/Ranges"],
  configurations: {
    Washers: ["Front Load", "Top Load", "Stacked Unit"],
    Dryers: ["Front Load", "Top Load", "Stacked Unit"], // moved Electric/Gas out
    "Stoves/Ranges": [], // we filter those by fuel only
  },
  unitTypes: ["Individual", "Set"],
  fuels: ["Electric", "Gas"], // NEW
  brands: [
    "Samsung",
    "LG",
    "Whirlpool",
    "GE",
    "Maytag",
    "Frigidaire",
    "KitchenAid",
    "Bosch",
    "Electrolux",
  ],
  priceRanges: [
    "Under $200",
    "$200 - $400",
    "$400 - $600",
    "$600 - $1000",
    "$1000 - $1500",
    "$1500+",
  ],
} as const;

export default function ProductsPage() {
  const [allProducts, setAllProducts] = useState<ProductCard[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionInFlight, setActionInFlight] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type: "sold" | "delete";
    product: ProductCard;
  } | null>(null);
  const [filters, setFilters] = useState({
    type: "All",
    configuration: "All",
    unitType: "All",
    fuel: "All", // NEW
    brand: "All",
    priceRange: "All",
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 1) Fetch Published items with their photos
  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      console.log("Fetching products from Supabase...");
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          title,
          brand,
          price,
          model_number,
          condition,
          status,
          type,
          configuration,
          unit_type,
          fuel,
          color,
          product_images (
            id,
            photo_url,
            product_id
          )
        `,
        )
        .eq("status", "Published")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load products:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        setAllProducts([]);
        setFilteredProducts([]);
        setLoading(false);
        return;
      }

      console.log("Fetched data:", data);
      console.log("Number of products:", data?.length || 0);

      const mapped: ProductCard[] = (data || []).map((row: Product) => {
        // Get the first image from product_images array
        const images = row.product_images || [];
        const firstImage = images[0];
        const image = firstImage?.photo_url || null;

        const priceNumber = row.price === null ? null : Number(row.price);

        return {
          id: row.id,
          name:
            row.title ||
            `${row.brand ? row.brand + " " : ""}${row.model_number || "Item"}`.trim(),
          price: priceNumber != null ? `$${priceNumber}` : "Call",
          priceNumber,
          condition: row.condition ?? "Good",
          brand: row.brand ?? "—",
          type: row.type ?? "Other",
          configuration: row.configuration ?? null,
          unitType: row.unit_type ?? null,
          fuel: row.fuel ?? null,
          image,
        };
      });

      setAllProducts(mapped);
      setFilteredProducts(mapped);
      setLoading(false);
    })();
  }, []);

  // 2) Filter handlers
  const handleFilterChange = (filterType: string, value: string) => {
    const next = { ...filters, [filterType]: value } as typeof filters;
    if (filterType === "type") {
      next.configuration = "All";
      next.unitType = "All";
    }
    setFilters(next);
  };

  const applyFilters = () => {
    let filtered = [...allProducts];

    // Type
    if (filters.type !== "All") {
      if (filters.type === "Washers")
        filtered = filtered.filter((p) => p.type === "Washer");
      else if (filters.type === "Dryers")
        filtered = filtered.filter((p) => p.type === "Dryer");
      else if (filters.type === "Stoves/Ranges")
        filtered = filtered.filter(
          (p) => p.type === "Stove" || p.type === "Range",
        );
    }

    // Configuration (no Electric/Gas here anymore)
    if (filters.configuration !== "All" && filters.type !== "All") {
      filtered = filtered.filter(
        (p) =>
          (p.configuration ?? "").toLowerCase() ===
          filters.configuration.toLowerCase(),
      );
    }

    // Fuel
    if (filters.fuel !== "All") {
      filtered = filtered.filter(
        (p) => (p.fuel ?? "").toLowerCase() === filters.fuel.toLowerCase(),
      );
    }

    // Unit Type
    if (filters.unitType !== "All") {
      filtered = filtered.filter(
        (p) =>
          (p.unitType ?? "").toLowerCase() === filters.unitType.toLowerCase(),
      );
    }

    // Brand
    if (filters.brand !== "All") {
      filtered = filtered.filter((p) => p.brand === filters.brand);
    }

    // Price Range
    if (filters.priceRange !== "All") {
      filtered = filtered.filter((p) => {
        const price = p.priceNumber;
        if (price == null) return false;
        switch (filters.priceRange) {
          case "Under $200":
            return price < 200;
          case "$200 - $400":
            return price >= 200 && price <= 400;
          case "$400 - $600":
            return price > 400 && price <= 600;
          case "$600 - $1000":
            return price > 600 && price <= 1000;
          case "$1000 - $1500":
            return price > 1000 && price <= 1500;
          case "$1500+":
            return price > 1500;
          default:
            return true;
        }
      });
    }

    setFilteredProducts(filtered);
    setShowMobileFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      type: "All",
      configuration: "All",
      unitType: "All",
      fuel: "All", // NEW
      brand: "All",
      priceRange: "All",
    });
    setFilteredProducts(allProducts);
    setShowMobileFilters(false);
  };

  const closeModal = () => {
    if (actionInFlight) return;
    setConfirmModal(null);
    setActionError(null);
  };

  const removeProductFromState = (productId: string) => {
    setAllProducts((prev) => prev.filter((item) => item.id !== productId));
    setFilteredProducts((prev) => prev.filter((item) => item.id !== productId));
  };

  const handleMarkAsSold = async () => {
    if (!confirmModal || confirmModal.type !== "sold") return;

    setActionInFlight(true);
    setActionError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ status: "Sold" })
      .eq("id", confirmModal.product.id);

    if (error) {
      console.error("Failed to mark product as sold:", error);
      setActionError("Unable to mark this listing as SOLD. Please try again.");
      setActionInFlight(false);
      return;
    }

    removeProductFromState(confirmModal.product.id);
    setActionInFlight(false);
    setConfirmModal(null);
  };

  const handleDelete = async () => {
    if (!confirmModal || confirmModal.type !== "delete") return;

    setActionInFlight(true);
    setActionError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", confirmModal.product.id);

    if (error) {
      console.error("Failed to delete product:", error);
      setActionError("Delete failed. This listing was not removed.");
      setActionInFlight(false);
      return;
    }

    removeProductFromState(confirmModal.product.id);
    setActionInFlight(false);
    setConfirmModal(null);
  };

  const skeletonProducts: ProductCard[] = Array.from({ length: 8 }, (_, i) => ({
    id: `skeleton-${i}`,
    name: "Loading",
    price: "",
    priceNumber: null,
    condition: "",
    brand: "",
    type: "",
    configuration: null,
    unitType: null,
    fuel: null,
    image: null,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8 sm:text-4xl lg:text-5xl">
          Products
        </h1>

        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <Button
            variant="outline"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="h-11 w-full justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
              />
            </svg>
            <span>Filters</span>
          </Button>
        </div>

        {/* Filter Section */}
        <div
          className={`mb-6 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:mb-8 sm:p-6 ${
            showMobileFilters ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="mb-4 text-lg font-semibold sm:text-xl">
            Filter Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Appliance Type Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Appliance Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Types</option>
                {filterOptions.types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Configuration Filter (Conditional) */}
            {filters.type !== "All" && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Configuration
                </label>
                <select
                  value={filters.configuration}
                  onChange={(e) =>
                    handleFilterChange("configuration", e.target.value)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="All">All Configurations</option>
                  {filterOptions.configurations[
                    filters.type as keyof typeof filterOptions.configurations
                  ]?.map((config) => (
                    <option key={config} value={config}>
                      {config}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Unit Type Filter (Conditional) */}
            {(filters.type === "Washers" || filters.type === "Dryers") && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Unit Type
                </label>
                <select
                  value={filters.unitType}
                  onChange={(e) =>
                    handleFilterChange("unitType", e.target.value)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="All">All Units</option>
                  {filterOptions.unitTypes.map((unitType) => (
                    <option key={unitType} value={unitType}>
                      {unitType}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Brand Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium">Brand</label>
              <select
                value={filters.brand}
                onChange={(e) => handleFilterChange("brand", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Brands</option>
                {filterOptions.brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Fuel Filter (Dryers & Stoves/Ranges) */}
            {(filters.type === "Dryers" ||
              filters.type === "Stoves/Ranges") && (
              <div>
                <label className="mb-2 block text-sm font-medium">Fuel</label>
                <select
                  value={filters.fuel}
                  onChange={(e) => handleFilterChange("fuel", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="All">All Fuel Types</option>
                  {filterOptions.fuels.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Price Range Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Price Range
              </label>
              <select
                value={filters.priceRange}
                onChange={(e) =>
                  handleFilterChange("priceRange", e.target.value)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Prices</option>
                {filterOptions.priceRanges.map((price) => (
                  <option key={price} value={price}>
                    {price}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row sm:gap-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button onClick={applyFilters}>Apply Filters</Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground sm:text-base">
            {loading ? (
              "Loading products…"
            ) : (
              <>
                Showing {filteredProducts.length} of {allProducts.length}{" "}
                products
              </>
            )}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {(!loading ? filteredProducts : skeletonProducts).map(
            (p: ProductCard & { id: string }) => (
              <article
                key={p.id}
                className="group overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-ring/40 hover:shadow-md"
              >
                <div className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-muted sm:h-80">
                  {loading ? (
                    <div className="h-full w-full animate-pulse bg-muted-foreground/10" />
                  ) : p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No image
                    </span>
                  )}

                  {!loading && (
                    <div className="absolute inset-0 flex flex-col bg-background/90 p-4 opacity-0 backdrop-blur-sm transition-opacity duration-300 ease-in-out group-hover:opacity-100">
                      <div className="text-foreground">
                        <h3 className="mb-2 line-clamp-2 text-base font-semibold sm:text-lg">
                          {p.name}
                        </h3>
                        <div className="mb-3 space-y-1 text-xs text-muted-foreground sm:text-sm">
                          <p>Brand: {p.brand}</p>
                          <p>Type: {p.type}</p>
                          <p>Condition: {p.condition}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg sm:text-xl font-bold">
                            {p.price}
                          </span>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() =>
                              setConfirmModal({ type: "sold", product: p })
                            }
                            className="shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:brightness-110"
                          >
                            <Check className="h-4 w-4" />
                            SOLD
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              console.info(`Edit listing requested for ${p.id}`);
                            }}
                            className="shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-md"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setConfirmModal({ type: "delete", product: p })
                          }
                          className="shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ),
          )}
        </div>

        {/* No Results Message */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="mb-4 text-lg text-foreground">
              No products found matching your criteria.
            </p>
            <Button onClick={clearFilters}>Clear All Filters</Button>
          </div>
        )}

        {/* Load More Button (placeholder for future pagination) */}
        {!loading && filteredProducts.length > 0 && (
          <div className="text-center mt-8">
            <Button>Load More Products</Button>
          </div>
        )}

        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-lg border border-border bg-card/100 p-5 text-card-foreground shadow-2xl ring-1 ring-black/10 bg-black transition-transform duration-200 sm:-translate-y-2 sm:p-6 sm:hover:-translate-y-3">
              <h2
                className={`text-lg font-semibold sm:text-xl ${
                  confirmModal.type === "delete"
                    ? "text-destructive"
                    : "text-emerald-700"
                }`}
              >
                {confirmModal.type === "delete"
                  ? "Delete this listing permanently?"
                  : "Mark this listing as SOLD?"}
              </h2>

              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                <span className="font-medium text-foreground">
                  {confirmModal.product.name}
                </span>
              </p>

              {confirmModal.type === "sold" ? (
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  This item will be marked as SOLD and will no longer be shown in
                  the customer-facing web app.
                </p>
              ) : (
                <p className="mt-3 text-sm text-destructive/90 sm:text-base">
                  This action permanently removes the item from the database.
                  Delete only listings created by mistake or duplicate entries.
                  Do not delete sold items or listings that are just unavailable.
                </p>
              )}

              {actionError && (
                <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={actionInFlight}
                >
                  Cancel
                </Button>

                {confirmModal.type === "sold" ? (
                  <Button
                    type="button"
                    onClick={handleMarkAsSold}
                    disabled={actionInFlight}
                    className="shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-md hover:bg-emerald-700"
                  >
                    {actionInFlight ? "Marking as SOLD..." : "Confirm SOLD"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={actionInFlight}
                    className="shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-md hover:bg-red-700"
                  >
                    {actionInFlight ? "Deleting..." : "Delete permanently"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
