"use client";

import React, { useState } from "react";



const dummyProducts = [
    {
        id: 1,
        name: "Studio Mug",
        price: 499,
        image: "https://via.placeholder.com/150",
    },
    {
        id: 2,
        name: "Coffee Beans",
        price: 899,
        image: "https://via.placeholder.com/150",
    },
    {
        id: 3,
        name: "T-Shirt",
        price: 1299,
        image: "https://via.placeholder.com/150",
    },
    {
        id: 4,
        name: "Notebook",
        price: 299,
        image: "https://via.placeholder.com/150",
    },
];

export default function TestShopPage() {
    const [cart, setCart] = useState([]);

    const addToCart = (product) => {
        setCart((prev) => [...prev, product]);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Test Shop</h1>
                <div className="bg-black text-white px-4 py-2 rounded-lg">
                    Cart: {cart.length}
                </div>
            </div>

            {/* Products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {dummyProducts.map((product) => (
                    <div
                        key={product.id}
                        className="bg-white p-4 rounded-2xl shadow-md"
                    >
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-40 object-cover rounded-lg mb-4"
                        />
                        <h2 className="text-lg font-semibold">{product.name}</h2>
                        <p className="text-gray-600 mb-3">Rs. {product.price}</p>

                        <button
                            onClick={() => addToCart(product)}
                            className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
                        >
                            Add to Cart
                        </button>
                    </div>
                ))}
            </div>


        </div>
    );
}