'use client';

import { toast } from "sonner";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TrendingUp, Package, DollarSign, Users, Loader2, ShoppingCart, ShieldCheck, Calendar, Award, Tag, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';

export default function AdminAnalyticsDashboard() {
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('all');
    const [exportType, setExportType] = useState('transactions');

    const [metrics, setMetrics] = useState({
        totalUsers: 0,
        activeProducts: 0,
        totalTransactions: 0,
        totalRevenue: 0,
    });


    const [trendChartData, setTrendChartData] = useState([]);
    const [categoryChartData, setCategoryChartData] = useState([]);
    const [pricingChartData, setPricingChartData] = useState([]);
    const [topUsersData, setTopUsersData] = useState([]);
    const [tagChartData, setTagChartData] = useState([]);

    useEffect(() => {
        async function fetchRobustAnalytics() {
            setLoading(true);
            try {
                let dateThreshold = null;
                const now = new Date();
                if (timeframe === '7days') {
                    dateThreshold = new Date(now.setDate(now.getDate() - 7)).toISOString();
                } else if (timeframe === '30days') {
                    dateThreshold = new Date(now.setDate(now.getDate() - 30)).toISOString();
                }

                // 1. Total users
                const { count: userCount } = await supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })

                // 2. Active products
                const { count: activeCount } = await supabase
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_available', true);

                // 3. Transactions query
                let txQuery = supabase
                    .from('transactions')
                    .select('id, product_id, seller_id, buyer_id, transaction_type, status, created_at')
                    .eq('status', 'completed');
                if (dateThreshold) {
                    txQuery = txQuery.gte('created_at', dateThreshold);
                }
                const { data: txData } = await txQuery;

                let txCount = 0;
                let revenueSum = 0;
                const sellerCounts = {};
                const buyerCounts = {};
                const trendMap = {};

                if (txData && txData.length > 0) {
                    txCount = txData.length;
                    const productIds = txData.map((t) => t.product_id).filter(Boolean);

                    if (productIds.length > 0) {
                        const { data: prodData } = await supabase
                            .from('products')
                            .select('id, price')
                            .in('id', productIds);

                        if (prodData) {
                            revenueSum = prodData.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
                        }
                    }

                    txData.forEach((t) => {
                        if (t.seller_id) {
                            sellerCounts[t.seller_id] = (sellerCounts[t.seller_id] || 0) + 1;
                        }
                        if (t.buyer_id) {
                            buyerCounts[t.buyer_id] = (buyerCounts[t.buyer_id] || 0) + 1;
                        }

                        if (t.created_at) {
                            const dateKey = t.created_at.split('T')[0];
                            if (!trendMap[dateKey]) {
                                trendMap[dateKey] = { date: dateKey, trades: 0 };
                            }
                            trendMap[dateKey].trades += 1;
                        }
                    });
                }

                const formattedTrendData = Object.values(trendMap).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setTrendChartData(formattedTrendData);

                // Fetch profiles for leaderboard
                const { data: profilesData } = await supabase.from('profiles').select('id, First_Name, Last_Name, email');
                if (profilesData) {
                    const profileMap = {};
                    profilesData.forEach((p) => {
                        const name = p.First_Name ? `${p.First_Name} ${p.Last_Name || ''}` : p.email?.split('@')[0] || 'User';
                        profileMap[p.id] = name.trim();
                    });

                    const userActivityMap = {};
                    Object.entries(sellerCounts).forEach(([id, count]) => {
                        userActivityMap[id] = (userActivityMap[id] || 0) + Number(count);
                    });
                    Object.entries(buyerCounts).forEach(([id, count]) => {
                        userActivityMap[id] = (userActivityMap[id] || 0) + Number(count);
                    });

                    const topUsersArray = Object.entries(userActivityMap)
                        .map(([id, count]) => ({
                            name: profileMap[id] || 'Unknown User',
                            transactions: Number(count),
                        }))
                        .sort((a, b) => b.transactions - a.transactions)
                        .slice(0, 5);

                    setTopUsersData(topUsersArray);
                }

                // 4. Fetch Categories and Products
                const { data: categoriesData } = await supabase.from('categories').select('id, name');
                const { data: allProducts } = await supabase.from('products').select('category_id, is_available, price_type, price, tags');

                if (categoriesData && allProducts) {
                    const formattedCatData = categoriesData.map((cat) => {
                        const catProducts = allProducts.filter((p) => p.category_id === cat.id);
                        const availableProducts = catProducts.filter((p) => p.is_available !== false);

                        const forSaleCount = availableProducts.filter((p) => {
                            const pt = p.price_type?.toLowerCase() || '';
                            return !pt.includes('rent') && !pt.includes('lease');
                        }).length;

                        const rentalCount = availableProducts.filter((p) => {
                            const pt = p.price_type?.toLowerCase() || '';
                            const hasRentalTag = Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes('rent'));
                            return pt.includes('rent') || pt.includes('lease') || hasRentalTag;
                        }).length;

                        return {
                            name: cat.name,
                            'For Sale': forSaleCount,
                            'Rentals': rentalCount,
                        };
                    });
                    setCategoryChartData(formattedCatData);


                    const pricingData = categoriesData
                        .map((cat) => {
                            const catProducts = allProducts.filter((p) => p.category_id === cat.id && Number(p.price) > 0);
                            const totalPrice = catProducts.reduce((acc, curr) => acc + Number(curr.price), 0);
                            const avgPrice = catProducts.length > 0 ? Math.round(totalPrice / catProducts.length) : 0;

                            return {
                                name: cat.name,
                                'Average Price (₱)': avgPrice,
                            };
                        })
                        .filter((item) => item['Average Price (₱)'] > 0); // <-- This removes categories with 0 value

                    setPricingChartData(pricingData);

                    // Tags Data
                    const tagCounts = {};
                    allProducts.forEach((p) => {
                        if (Array.isArray(p.tags)) {
                            p.tags.forEach((tag) => {
                                const cleanTag = tag.trim().toLowerCase();
                                if (cleanTag) {
                                    tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
                                }
                            });
                        }
                    });

                    const formattedTagsData = Object.entries(tagCounts)
                        .map(([tag, count]) => ({ tag: `#${tag}`, count: Number(count) }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 6);

                    setTagChartData(formattedTagsData);
                }

                setMetrics({
                    totalUsers: userCount || 0,
                    activeProducts: activeCount || 0,
                    totalTransactions: txCount,
                    totalRevenue: revenueSum,
                });
            } catch (err) {
                console.error('Error compiling analytics:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchRobustAnalytics();
    }, [timeframe]);

    // Flexible CSV Export Handler (Transactions, Products, Tags)
    const handleExportCSV = async () => {
        try {
            let csvContent = "";
            let filename = "";

            if (exportType === 'transactions') {
                const { data, error } = await supabase
                    .from("transactions")
                    .select(`id, transaction_type, status, created_at, products (title, price)`)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                if (!data || data.length === 0) { toast.warning("No transaction data to export."); return; }

                const headers = ["Transaction ID", "Type", "Status", "Product Title", "Price (PHP)", "Date"];
                const rows = data.map((tx: any) => {
                    const productInfo = tx.products;
                    const prodTitle = productInfo && !Array.isArray(productInfo) ? productInfo.title : "Unknown";
                    const prodPrice = productInfo && !Array.isArray(productInfo) ? productInfo.price : 0;

                    return [
                        tx.id,
                        tx.transaction_type,
                        tx.status,
                        `"${(prodTitle || "Unknown").replace(/"/g, '""')}"`,
                        prodPrice || 0,
                        new Date(tx.created_at).toLocaleString()
                    ];
                });

                csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                filename = `transactions_report_${new Date().toISOString().split('T')[0]}.csv`;

            } else if (exportType === 'products') {
                const { data, error } = await supabase
                    .from("products")
                    .select(`id, title, price, price_type, condition, is_available, created_at`)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                if (!data || data.length === 0) { toast.warning("No product inventory found."); return; }

                const headers = ["Product ID", "Title", "Price (PHP)", "Type", "Condition", "Available", "Created Date"];
                const rows = data.map((p: any) => [
                    p.id,
                    `"${(p.title || "").replace(/"/g, '""')}"`,
                    p.price || 0,
                    p.price_type || "Sale",
                    p.condition || "Good",
                    p.is_available ? "Yes" : "No",
                    new Date(p.created_at).toLocaleString()
                ]);

                csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                filename = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;

            } else if (exportType === 'tags') {
                const { data, error } = await supabase
                    .from("products")
                    .select(`id, title, tags`);

                if (error) throw error;
                if (!data || data.length === 0) { toast.warning("No product tags found."); return; }

                const headers = ["Product ID", "Product Title", "Associated Tags"];
                const rows = data.map((p: any) => [
                    p.id,
                    `"${(p.title || "").replace(/"/g, '""')}"`,
                    `"${Array.isArray(p.tags) ? p.tags.join(', ') : ''}"`
                ]);

                csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                filename = `tags_report_${new Date().toISOString().split('T')[0]}.csv`;
            }

            // Trigger download
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            toast.error("Failed to export data: " + err.message);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 p-6">
            {/* HEADER & CONTROLS */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={28} /> Marketplace Analytics & Intelligence
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Predictive campus telemetry tracking inventory distribution, pricing valuations, user activity, and catalog tags.
                    </p>
                </div>

                {/* EXPORT OPTIONS & TIMEFRAME CONTROLS */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl shadow-xs">
                        <select
                            value={exportType}
                            onChange={(e) => setExportType(e.target.value)}
                            className="bg-background text-foreground text-xs font-bold px-2 py-1.5 rounded-lg border border-border outline-none cursor-pointer"
                        >
                            <option value="transactions">Transactions Report</option>
                            <option value="products">Product Inventory</option>
                            <option value="tags">Product Tags Report</option>
                        </select>
                        <button
                            onClick={handleExportCSV}
                            className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-black uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <Download size={13} /> Export CSV
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl shadow-xs">
                        <span className="text-xs font-bold text-muted-foreground px-2 flex items-center gap-1">
                            <Calendar size={12} /> Timeframe:
                        </span>
                        <button
                            onClick={() => setTimeframe('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === 'all' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            All-Time
                        </button>
                        <button
                            onClick={() => setTimeframe('30days')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === '30days' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Last 30 Days
                        </button>
                        <button
                            onClick={() => setTimeframe('7days')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === '7days' ? 'bg-foreground text-background shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Last 7 Days
                        </button>
                    </div>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold uppercase tracking-wider">Total Accounts</span>
                        <Users size={18} className="text-purple-500" />
                    </div>
                    <p className="text-3xl font-black text-foreground">{metrics.totalUsers}</p>
                    <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                        <ShieldCheck size={12} /> Institutional SSO verified
                    </p>
                </div>

                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold uppercase tracking-wider">Active Inventory</span>
                        <Package size={18} className="text-amber-500" />
                    </div>
                    <p className="text-3xl font-black text-foreground">{metrics.activeProducts}</p>
                    <p className="text-[11px] text-muted-foreground">Live items currently available</p>
                </div>

                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold uppercase tracking-wider">Completed Transactions</span>
                        <ShoppingCart size={18} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-black text-foreground">{metrics.totalTransactions}</p>
                    <p className="text-[11px] text-muted-foreground">Logged transaction events</p>
                </div>

                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-xs font-bold uppercase tracking-wider">Trade Valuation</span>
                        <DollarSign size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-foreground">₱{metrics.totalRevenue.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Aggregate transaction volume</p>
                </div>
            </div>

            {loading ? (
                <div className="border border-border rounded-2xl bg-card p-16 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm">
                    <Loader2 size={32} className="animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">Recalculating charts & telemetry...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LINE CHART HERO: TRADE MOMENTUM OVER TIME */}
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4 lg:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                                    <TrendingUp size={18} className="text-blue-500" /> Marketplace Trade Momentum & Velocity
                                </h3>
                                <p className="text-xs text-muted-foreground">Time-series tracking of transaction frequency and financial volume within the selected timeframe.</p>
                            </div>
                        </div>
                        <div className="h-[320px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="date" stroke="currentColor" fontSize={11} tickLine={false} />
                                    <YAxis stroke="currentColor" fontSize={11} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            borderColor: '#27272a',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#f4f4f5',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: '#f4f4f5', fontWeight: '600', padding: '2px 0' }}
                                        labelStyle={{ color: '#a1a1aa', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                    <Line type="monotone" dataKey="trades" name="Completed Transactions" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHART 1: CATEGORY INVENTORY BREAKDOWN */}
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-foreground">Category Inventory Breakdown</h3>
                            <p className="text-xs text-muted-foreground">Available items categorized by For Sale vs. Rentals per category.</p>
                        </div>
                        <div className="h-[320px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} />
                                    <YAxis stroke="currentColor" fontSize={11} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            borderColor: '#27272a',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#f4f4f5',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: '#f4f4f5', fontWeight: '600', padding: '2px 0' }}
                                        labelStyle={{ color: '#a1a1aa', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                    <Bar dataKey="For Sale" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="Rentals" fill="#10b981" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHART 2: PRICING INTELLIGENCE */}
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                                <BarChart3 size={18} className="text-emerald-500" /> Pricing Intelligence (Average Valuation)
                            </h3>
                            <p className="text-xs text-muted-foreground">Mean listing price in Pesos (₱) across marketplace categories.</p>
                        </div>
                        <div className="h-[320px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pricingChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} />
                                    <YAxis stroke="currentColor" fontSize={11} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            borderColor: '#27272a',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#f4f4f5',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: '#f4f4f5', fontWeight: '600', padding: '2px 0' }}
                                        labelStyle={{ color: '#a1a1aa', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    />
                                    <Bar dataKey="Average Price (₱)" fill="#10b981" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHART 3: TOP ACTIVE USERS LEADERBOARD */}
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                                <Award size={18} className="text-amber-500" /> Top Active Users Leaderboard
                            </h3>
                            <p className="text-xs text-muted-foreground">Users with the highest total completed buying and selling volume.</p>
                        </div>
                        <div className="h-[320px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topUsersData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis type="number" stroke="currentColor" fontSize={11} tickLine={false} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" stroke="currentColor" fontSize={11} tickLine={false} width={100} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            borderColor: '#27272a',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#f4f4f5',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: '#f4f4f5', fontWeight: '600', padding: '2px 0' }}
                                        labelStyle={{ color: '#a1a1aa', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    />
                                    <Bar dataKey="transactions" name="Total Transactions" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* CHART 4: POPULAR PRODUCT TAGS DISTRIBUTION */}
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                                <Tag size={18} className="text-indigo-500" /> Popular Product Tags Distribution
                            </h3>
                            <p className="text-xs text-muted-foreground">Most frequently utilized search tags and keywords across current catalog listings.</p>
                        </div>
                        <div className="h-[320px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tagChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="tag" stroke="currentColor" fontSize={11} tickLine={false} />
                                    <YAxis stroke="currentColor" fontSize={11} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#18181b',
                                            borderColor: '#27272a',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#f4f4f5',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                            padding: '12px 16px'
                                        }}
                                        itemStyle={{ color: '#f4f4f5', fontWeight: '600', padding: '2px 0' }}
                                        labelStyle={{ color: '#a1a1aa', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    />
                                    <Bar dataKey="count" name="Listings Count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}