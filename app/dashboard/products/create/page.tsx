"use client";
import { useForm, SubmitHandler } from "react-hook-form";

type FormData = {
  title: string;
  brand: string;
  price: Int16Array;
  model_number: string;
};

export default function CreateProductForm() {
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
        console.log("Success, ", result.message, result.product);
    } else {
        console.log(result.error);
    }
  };

  return (
    <div>
      {/*Page title */}
      <div className="text-2xl">This is the page to create new products</div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Section 1: title, brand, price, model_number */}
        <label>Title</label>
        <input {...register("title")} />

        <label>Brand</label>
        <input {...register("brand")} />

        <label>Price</label>
        <input {...register("price")} />

        <label>Model number</label>
        <input {...register("model_number")} />

        {/* Section 2: type, configuration, dimensions, capacity, fuel, init type */}

        {/* Section 3, color, features, condition, status, description_long */}

        {/* Submit button */}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
