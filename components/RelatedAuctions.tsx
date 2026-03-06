import React, { useEffect, useState } from "react";
import { Auction } from "../types";
import { getAuctions, getFeaturedAuctions } from "../services/auction";
import AuctionSidebarCard from "./AuctionSidebarCard";
import { Sparkles, Timer, Layers, Star } from "lucide-react";

interface RelatedAuctionsProps {
    currentAuctionId: string;
    category: string;
}

const RelatedAuctions: React.FC<RelatedAuctionsProps> = ({ currentAuctionId, category }) => {
    const [featured, setFeatured] = useState<Auction[]>([]);
    const [similar, setSimilar] = useState<Auction[]>([]);
    const [endingSoon, setEndingSoon] = useState<Auction[]>([]);
    const [newest, setNewest] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRelated = async () => {
            setLoading(true);
            try {
                // Fetch general pool + featured concurrently
                const [res, featuredRes] = await Promise.all([
                    getAuctions({ limit: 40, status: "ACTIVE" }),
                    getFeaturedAuctions(),
                ]);

                const allFetched = res.data.auctions || [];
                const allFeatured: Auction[] = (featuredRes.data || []).filter(
                    (a: Auction) => a._id !== currentAuctionId
                ).slice(0, 8);
                setFeatured(allFeatured);

                // 1. Remove the current auction from the pool
                const pool = allFetched.filter((a: Auction) => a._id !== currentAuctionId);

                // 2. Similar Auctions (Same Category)
                const similarMatches = pool.filter((a: Auction) => a.category === category).slice(0, 10);
                setSimilar(similarMatches);

                // 3. Ending Soon (<= 60 minutes)
                const now = Date.now();
                const endingSoonMatches = pool
                    .filter((a: Auction) => {
                        if (!a.endTime) return false;
                        const diffMin = (new Date(a.endTime).getTime() - now) / 60000;
                        return diffMin > 0 && diffMin <= 60;
                    })
                    .filter((a: Auction) => !similarMatches.find((s: Auction) => s._id === a._id))
                    .sort((a: Auction, b: Auction) => {
                        const tA = new Date(a.endTime!).getTime();
                        const tB = new Date(b.endTime!).getTime();
                        return tA - tB;
                    })
                    .slice(0, 10);
                setEndingSoon(endingSoonMatches);

                // 4. Newest Auctions
                const newestMatches = pool
                    .filter((a: Auction) => !similarMatches.find((s: Auction) => s._id === a._id))
                    .filter((a: Auction) => !endingSoonMatches.find((e: Auction) => e._id === a._id))
                    .sort((a: Auction, b: Auction) => {
                        const tA = new Date(a.createdAt!).getTime();
                        const tB = new Date(b.createdAt!).getTime();
                        return tB - tA;
                    })
                    .slice(0, 10);
                setNewest(newestMatches);

            } catch (error) {
                console.error("Failed to load related auctions", error);
            } finally {
                setLoading(false);
            }
        };

        if (currentAuctionId) {
            fetchRelated();
        }
    }, [currentAuctionId, category]);

    if (loading) {
        return (
            <div className="w-full mt-24 pt-16 border-t border-slate-200/50 bg-slate-50 relative z-10 animate-pulse">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                    <div className="h-6 w-48 bg-slate-200 rounded-full mb-6"></div>
                    <div className="flex gap-4 overflow-hidden">
                        {[1, 2, 3, 4].map(i => <div key={i} className="min-w-[240px] h-32 bg-slate-200 rounded-2xl"></div>)}
                    </div>
                </div>
            </div>
        );
    }

    if (featured.length === 0 && similar.length === 0 && endingSoon.length === 0 && newest.length === 0) {
        return null;
    }

    return (
        <div className="w-full mt-24 pt-16 border-t border-slate-200/80 bg-slate-50 relative z-10 shadow-[inset_0_10px_20px_rgba(0,0,0,0.02)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

                <div className="text-center mb-12">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                        المزيد للاستكشاف
                    </h2>
                    <p className="text-slate-500 font-medium mt-2">
                        مزادات أخرى قد تثير اهتمامك
                    </p>
                </div>

                <div className="space-y-12">

                    {/* Section 0: Featured - shown first */}
                    {featured.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2.5 mb-5 border-b border-amber-200/60 pb-3">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                    <Star className="w-5 h-5 fill-amber-500" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800">
                                    مزادات مميزة
                                </h3>
                                <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">مدعومة</span>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                                {featured.map((auction) => (
                                    <div key={auction._id} className="min-w-[240px] sm:min-w-[280px] snap-start hover:-translate-y-1 transition-transform duration-300">
                                        <AuctionSidebarCard auction={auction} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Section 1: Similar */}
                    {similar.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2.5 mb-5 border-b border-slate-200/60 pb-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800">
                                    فرص مشابهة
                                </h3>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                                {similar.map((auction) => (
                                    <div key={auction._id} className="min-w-[240px] sm:min-w-[280px] snap-start hover:-translate-y-1 transition-transform duration-300">
                                        <AuctionSidebarCard auction={auction} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Section 2: Ending Soon */}
                    {endingSoon.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2.5 mb-5 border-b border-slate-200/60 pb-3">
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                    <Timer className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800">
                                    توشك على الانتهاء
                                </h3>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                                {endingSoon.map((auction) => (
                                    <div key={auction._id} className="min-w-[240px] sm:min-w-[280px] snap-start hover:-translate-y-1 transition-transform duration-300">
                                        <AuctionSidebarCard auction={auction} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Section 3: Newest */}
                    {newest.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2.5 mb-5 border-b border-slate-200/60 pb-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800">
                                    وصل حديثاً
                                </h3>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                                {newest.map((auction) => (
                                    <div key={auction._id} className="min-w-[240px] sm:min-w-[280px] snap-start hover:-translate-y-1 transition-transform duration-300">
                                        <AuctionSidebarCard auction={auction} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                </div>
            </div>
        </div>
    );
};

export default RelatedAuctions;
