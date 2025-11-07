"use client";
import { useForm, SubmitHandler } from "react-hook-form";
import { useState } from "react";
import { productSchema, ProductFormData } from "@/app/schemas/productSchema";
import { zodResolver } from "@hookform/resolvers/zod";

export default function CreateProductForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("Success, ", result.message, result.product);
      setSuccessMessage("Product created successfully!");
    } else {
      console.log(result.error);
      setErrorMessage(result.error || "Something went wrong");
    }

    setIsSubmitting(false);
  };

  return (
    <div>
      {/*Page title */}
      <div className="text-2xl">This is the page to create new products</div>

      {/* Add these messages here */}
      {successMessage && (
        <div style={{ color: "green", padding: "10px", marginBottom: "10px" }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ color: "red", padding: "10px", marginBottom: "10px" }}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Section 1: title, brand, price, model_number */}
        <label>Title</label>
        <input {...register("title")} />
        {errors.title && (
          <span style={{ color: "red" }}>{errors.title.message}</span>
        )}

        <label>Brand</label>
        <input {...register("brand")} />
        {errors.brand && (
          <span style={{ color: "red" }}>{errors.brand.message}</span>
        )}

        <label>Price</label>
        <input type="number" {...register("price", { valueAsNumber: true })} />
        {errors.price && (
          <span style={{ color: "red" }}>{errors.price.message}</span>
        )}

        <label>Model number</label>
        <input {...register("model_number")} />
        {errors.model_number && (
          <span style={{ color: "red" }}>{errors.model_number.message}</span>
        )}

        {/* Section 2: type, configuration, dimensions, capacity, fuel, unit_type */}
        <label>Type</label>
        <input {...register("type")} />

        <label>Configuration</label>
        <input {...register("configuration")} />

        <label>Dimensions</label>
        <input {...register("dimensions")} />

        <label>Capacity</label>
        <input
          type="number"
          {...register("capacity", { valueAsNumber: true })}
        />

        <label>Fuel</label>
        <input {...register("fuel")} />

        <label>Unit type</label>
        <input {...register("unit_type")} />

        {/* Section 3, color, features, condition, status, description_long */}

        <label>Color</label>
        <input {...register("color")} />

        <label>Features</label>
        <input {...register("features")} />

        <label>Condition</label>
        <input {...register("condition")} />

        <label>Status</label>
        <input {...register("status")} />

        <label>Long description</label>
        <input {...register("description_long")} />

        {/* Submit button */}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
