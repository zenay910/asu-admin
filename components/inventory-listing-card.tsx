"use client";

import Image from "next/image";
import { Check, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InventoryListingCardProps = {
  image: string | null;
  alt: string;
  title: string;
  price: string;
  status: string;
  brand: string;
  type: string;
  condition: string;
  loading?: boolean;
  onMarkSold?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

export function InventoryListingCard({
  image,
  alt,
  title,
  price,
  status,
  brand,
  type,
  condition,
  loading = false,
  onMarkSold,
  onEdit,
  onDelete,
  className,
}: InventoryListingCardProps) {
  const normalizedStatus = status.toLowerCase();

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-ring/40 hover:shadow-md",
        className,
      )}
    >
      <div className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-muted sm:h-80">
        {!loading && normalizedStatus !== "published" && (
          <span
            className={cn(
              "absolute right-2 top-2 z-10 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm sm:text-xs",
              normalizedStatus === "sold"
                ? "bg-emerald-700 text-white"
                : "bg-zinc-700 text-zinc-100",
            )}
          >
            {status}
          </span>
        )}

        {loading ? (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" />
        ) : image ? (
          <Image
            src={image}
            alt={alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <span className="text-sm text-muted-foreground">No image</span>
        )}

        {!loading && (
          <div className="absolute inset-0 flex flex-col bg-background/90 p-4 opacity-0 backdrop-blur-sm transition-opacity duration-300 ease-in-out group-hover:opacity-100">
            <div className="text-foreground">
              <h3 className="mb-2 line-clamp-2 text-base font-semibold sm:text-lg">
                {title}
              </h3>
              <div className="mb-3 space-y-1 text-xs text-muted-foreground sm:text-sm">
                <p>Status: {status}</p>
                <p>Brand: {brand}</p>
                <p>Type: {type}</p>
                <p>Condition: {condition}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold sm:text-xl">{price}</span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {onMarkSold && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={onMarkSold}
                    className="hover:brightness-110"
                  >
                    <Check className="h-4 w-4" />
                    SOLD
                  </Button>
                )}
                {onEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onEdit}
                    className="hover:bg-secondary/90"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>

              {onDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  className="hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}