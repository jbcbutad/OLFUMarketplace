import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { Search, ArrowLeft, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RentalsPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const selectedCategory = resolvedParams?.category || null;

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, icon");

  let query = supabase
    .from("products")
    .select(`
      id,
      title,
      price,
      tags, 
      image_urls,
      users (First_Name, Last_Name),
      categories!inner ( name )
    `)
    .contains("tags", ["Rentals"])
    .eq("is_available", true)
    .order("created_at", { ascending: false });
    
  if (selectedCategory) {
    query = query.eq("categories.name", selectedCategory);
  }

  const { data: rentals, error } = await query;

  if (error) {
    return (
      <div className="flex justify-center items-center h-96 bg-white w-full min-h-screen">
        <p className="text-red-400">Error loading rentals: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white w-full min-h-screen">
      
      <div className="max-w-screen mx-auto px-1 py-10">

        <div className="mb-12">
          {!selectedCategory ? (
            <>
              <div className="flex flex-col mb-8">
                <h2 className="text-3xl font-extrabold text-black tracking-tight uppercase">OLFU Rentals</h2>
                <p className="text-black text-sm">{rentals?.length || 0} items available for rent</p>
              </div>

              <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
                {categoriesData?.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/rentals?category=${encodeURIComponent(cat.name)}`}
                    className="shrink-0 snap-start flex flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-black hover:border-neutral-600 hover:bg-neutral-600 transition-all group active:scale-95"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                      {cat.icon}
                    </span>
                    <span className="text-sm font-semibold text-black group-hover:text-white tracking-wide whitespace-nowrap">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 border border-black rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              
              <div className="mb-4 md:mb-0">
                <Link href="/rentals" className="inline-flex items-center gap-2 text-neutral-500 hover:text-black mb-3 transition-colors text-sm font-medium">
                  <ArrowLeft size={16} /> All Rentals
                </Link>
                <h2 className="text-3xl font-extrabold text-black tracking-tight flex items-center gap-3">
                  <Search size={28} className="text-neutral-400" />
                  Viewing {selectedCategory}
                </h2>
                <p className="text-neutral-600 text-sm mt-1 font-medium ml-10">
                  {rentals?.length || 0} rentals found
                </p>
              </div>

              <Link
                href="/rentals"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl transition-all font-bold active:scale-95"
              >
                <X size={18} /> Clear Filter
              </Link>
            </div>
          )}
        </div>

        {rentals?.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-black animate-in fade-in duration-500">
            <p className="text-gray-500 text-lg">No rentals found in "{selectedCategory}".</p>
            <Link href="/rentals" className="text-blue-500 font-bold mt-4 inline-block hover:underline">
              Clear filter and see all rentals
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {rentals?.map((item, index) => {
              const sellerName = item.users
                ? `${item.users.First_Name || ''} ${item.users.Last_Name || ''}`.trim()
                : "Unknown Seller";

              return (
                <Link 
                  href={`/products/${item.id}`} 
                  key={item.id} 
                  className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
                >
                  <div className="relative">
                    <ProductCard
                      title={item.title}
                      price={item.price}
                      seller={sellerName}
                      image={item.image_urls?.[0] || "/placeholder.png"}
                      category={item.categories?.name}
                      tags={item.tags}
                      priority={index < 4}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}