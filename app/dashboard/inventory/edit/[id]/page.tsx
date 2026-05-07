import EditInventoryForm from '../edit-form'

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Edit Product
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update the product details below
        </p>
      </div>
      <EditInventoryForm productId={id} />
    </div>
  )
}
